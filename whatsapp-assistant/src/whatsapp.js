// ═══════════════════════════════════════════════════════════════
//  ENVÍO A WHATSAPP (Meta Cloud API)
//  Manda un mensaje de texto usando la Graph API de Meta.
// ═══════════════════════════════════════════════════════════════
const { WHATSAPP_TOKEN, GRAPH_VERSION } = require("./config");

// phoneNumberId = número del NEGOCIO que envía (lo da Meta)
// para          = número del CLIENTE (a quién le contestamos)
async function enviarTexto(phoneNumberId, para, texto) {
  if (!WHATSAPP_TOKEN) {
    console.warn("[whatsapp] Falta WHATSAPP_TOKEN; no se envió el mensaje.");
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
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
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
