// Carga las variables de entorno desde el archivo .env (si existe)
require("dotenv").config();

module.exports = {
  // Puerto del servidor
  PORT: process.env.PORT || 3000,

  // ── WhatsApp (Meta Cloud API) ────────────────────────────────
  // Token que TÚ inventas y pones igual en el panel de Meta al
  // configurar el webhook. Sirve para que Meta verifique tu servidor.
  VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || "cambia-esto",

  // Token de acceso permanente de la app de Meta (lo obtienes en Meta).
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN || "",

  // Versión de la Graph API de Meta.
  GRAPH_VERSION: process.env.GRAPH_VERSION || "v21.0",

  // ── Cerebro (Claude / Anthropic) ─────────────────────────────
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  MODEL: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",

  // Máximo de mensajes de historial que recuerda por conversación.
  MAX_HISTORIAL: Number(process.env.MAX_HISTORIAL || 12),

  // Negocio por defecto cuando no se reconoce el número que recibió
  // el mensaje (útil al empezar con un solo número). Ej: "camas".
  DEFAULT_BUSINESS: process.env.DEFAULT_BUSINESS || "",
};
