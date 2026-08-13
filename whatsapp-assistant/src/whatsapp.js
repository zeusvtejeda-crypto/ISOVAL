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
async function enviarTexto(phoneNumberId, para, texto, token) {
  const tokenUsar = token || WHATSAPP_TOKEN;

  if (!tokenUsar) {
    console.warn("[whatsapp] Falta el token de acceso; no se envió el mensaje.");
    return;
  }
  if (!phoneNumberId) {
    console.warn("[whatsapp] Falta phoneNumberId; no se envió el mensaje.");
    return;
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
    }
  } catch (err) {
    console.error("[whatsapp] Error de red enviando mensaje:", err.message);
  }
}

module.exports = { enviarTexto };
