// ═══════════════════════════════════════════════════════════════
//  PROXY OPCIONAL — solo para desarrollo/pruebas.
//  Si el entorno donde corres el asistente tiene un proxy HTTPS
//  configurado (ej. algunos sandboxes de desarrollo), lo usamos para
//  las llamadas fetch salientes (Gemini/Claude/WhatsApp).
//  En producción normal (Render, Railway, tu servidor) no hay proxy
//  configurado y este archivo no hace nada.
// ═══════════════════════════════════════════════════════════════
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;

if (proxyUrl) {
  const { ProxyAgent, setGlobalDispatcher } = require("undici");
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}
