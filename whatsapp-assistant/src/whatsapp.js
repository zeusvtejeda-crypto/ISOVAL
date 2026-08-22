// ═══════════════════════════════════════════════════════════════
//  ENVÍO A WHATSAPP (Meta Cloud API)
//  Manda un mensaje de texto usando la Graph API de Meta.
// ═══════════════════════════════════════════════════════════════
const { WHATSAPP_TOKEN, GRAPH_VERSION } = require("./config");

// phoneNumberId = número del NEGOCIO que envía (lo da Meta)
// para          = número del CLIENTE (a quién le contestamos)
// token         = token de acceso de ESE negocio (cada app de Meta
//                  tiene el suyo). Si no se pasa, usa el general
//                  WHATSAPP_TOKEN como respaldo (útil si solo tienes
//                  un negocio conectado por ahora).
//
// DEVUELVE { ok, motivo? }. Antes no devolvía nada y los errores solo se
// registraban con console.error: por eso, cuando el token venció, quien
// llamaba seguía tan campante y el webhook contestaba 200 como si todo
// hubiera salido bien. El asistente estuvo caído más de un día así. Si
// el envío falla, ahora quien llama se entera y puede decirlo.
async function enviarTexto(phoneNumberId, para, texto, token) {
  const tokenUsar = token || WHATSAPP_TOKEN;

  if (!tokenUsar) {
    console.warn("[whatsapp] Falta el token de acceso; no se envió el mensaje.");
    return { ok: false, motivo: "sin token" };
  }
  if (!phoneNumberId) {
    console.warn("[whatsapp] Falta phoneNumberId; no se envió el mensaje.");
    return { ok: false, motivo: "sin phoneNumberId" };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenUsar}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: para,
        type: "text",
        text: { body: texto },
      }),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error(`[whatsapp] Error ${resp.status}:`, detalle);
      return { ok: false, motivo: `Meta respondió ${resp.status}: ${detalle}` };
    }

    // Devolvemos también el id del mensaje que acabamos de mandar.
    // Sirve para reconocer nuestro propio eco después (ver app.js) y
    // no confundirlo con una persona real entrando a la conversación.
    const datos = await resp.json().catch(() => ({}));
    return { ok: true, id: datos?.messages?.[0]?.id };
  } catch (err) {
    console.error("[whatsapp] Error de red enviando mensaje:", err.message);
    return { ok: false, motivo: `error de red: ${err.message}` };
  }
}

// ── Envío de PLANTILLA (para avisarte fuera de la ventana de 24 h) ──
// Regla de Meta: solo puedes mandar texto libre a alguien que te
// escribió en las últimas 24 horas. Pasado ese rato, Meta rechaza el
// envío con el código 131047 y SOLO acepta plantillas aprobadas.
//
// Esto importa justo donde más duele: el aviso de "un cliente necesita
// que lo atienda una persona" va a TU celular, y tú casi nunca le
// escribes al número del negocio. O sea que el aviso más importante
// del sistema es el que más fácil se cae. Por eso, si el texto libre
// se rechaza, reintentamos con una plantilla.
async function enviarPlantilla(phoneNumberId, para, plantilla, idioma, parametros, token) {
  const tokenUsar = token || WHATSAPP_TOKEN;
  if (!tokenUsar || !phoneNumberId || !plantilla) {
    return { ok: false, motivo: "faltan datos para enviar la plantilla" };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  const componentes = parametros?.length
    ? [{ type: "body", parameters: parametros.map((t) => ({ type: "text", text: String(t) })) }]
    : [];

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenUsar}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: para,
        type: "template",
        template: {
          name: plantilla,
          language: { code: idioma || "es_MX" },
          components: componentes,
        },
      }),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error(`[whatsapp] Error ${resp.status} enviando plantilla:`, detalle);
      return { ok: false, motivo: `Meta respondió ${resp.status}: ${detalle}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, motivo: `error de red: ${err.message}` };
  }
}

// ¿El envío falló porque pasaron más de 24 h desde el último mensaje
// del destinatario? Ese caso tiene arreglo (mandar plantilla); los
// demás no, y conviene no confundirlos.
function esVentanaCerrada(motivo = "") {
  return /131047|Re-engagement|24 hours/i.test(motivo);
}

module.exports = { enviarTexto, enviarPlantilla, esVentanaCerrada };
