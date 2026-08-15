// ═══════════════════════════════════════════════════════════════
//  ENVÍO A INSTAGRAM Y FACEBOOK (Messenger Platform)
//  Los DM de Instagram y los mensajes de Messenger usan la misma
//  API, así que este archivo sirve para los dos.
//
//  Diferencia clave con WhatsApp: aquí NO hay número de teléfono.
//  Cada negocio se identifica por su Página de Facebook (pageId) y
//  contesta con el token de esa página (metaPageToken).
// ═══════════════════════════════════════════════════════════════
const { GRAPH_VERSION } = require("./config");

// destinatario = el "PSID"/"IGSID" de la persona que escribió
async function enviarMensaje(destinatario, texto, token) {
  if (!token) {
    console.warn("[messenger] Falta el token de la página; no se envió nada.");
    return;
  }
  if (!destinatario) {
    console.warn("[messenger] Falta el destinatario; no se envió nada.");
    return;
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${token}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: destinatario },
        message: { text: texto },
        messaging_type: "RESPONSE",
      }),
    });

    if (!resp.ok) {
      console.error(`[messenger] Error ${resp.status}:`, await resp.text());
    }
  } catch (err) {
    console.error("[messenger] Error de red enviando mensaje:", err.message);
  }
}

// Saca los mensajes de texto reales de un webhook de Instagram/Facebook,
// descartando lo que no hay que contestar.
function extraerMensajes(entrada) {
  const utiles = [];

  for (const evento of entrada.messaging || []) {
    const msg = evento.message;

    // "is_echo" = mensaje que mandó la propia página (incluidos los del
    // asistente). Si lo contestáramos, se respondería a sí mismo en bucle.
    if (!msg || msg.is_echo) continue;

    // Confirmaciones de lectura/entrega y reacciones: no son preguntas.
    if (evento.read || evento.delivery || evento.reaction) continue;

    const texto = (msg.text || "").trim();
    if (!texto) continue; // fotos, stickers, audios: por ahora se ignoran

    utiles.push({ de: evento.sender?.id, texto });
  }

  return utiles;
}

module.exports = { enviarMensaje, extraerMensajes };
