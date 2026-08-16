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
    return { ok: true };
  } catch (err) {
    console.error("[whatsapp] Error de red enviando mensaje:", err.message);
    return { ok: false, motivo: `error de red: ${err.message}` };
  }
}

module.exports = { enviarTexto };
