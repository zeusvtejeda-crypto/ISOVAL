// ═══════════════════════════════════════════════════════════════
//  ENRUTADOR — decide QUÉ negocio atiende un mensaje entrante.
//  Regla: el mensaje llega a un número (phone_number_id) de Meta,
//  y cada número está asignado a un negocio en su perfil.
// ═══════════════════════════════════════════════════════════════
const { porPhoneNumberId, porPaginaId, porId } = require("../businesses");
const { DEFAULT_BUSINESS } = require("./config");

// Último recurso: el negocio por defecto, si está configurado.
function porDefecto() {
  if (DEFAULT_BUSINESS && porId[DEFAULT_BUSINESS]) return porId[DEFAULT_BUSINESS];
  return null;
}

// WhatsApp: el mensaje llegó a un número (phone_number_id) de Meta.
function elegirNegocio(phoneNumberId) {
  const negocio = porPhoneNumberId[phoneNumberId];
  if (negocio && negocio.activo) return negocio;
  return porDefecto();
}

// Instagram / Facebook: el mensaje llegó a una Página o cuenta de IG.
// El id viene en entry[].id del webhook.
function elegirNegocioPorPagina(paginaId) {
  const negocio = porPaginaId[paginaId];
  if (negocio && negocio.activo) return negocio;
  return porDefecto();
}

module.exports = { elegirNegocio, elegirNegocioPorPagina };
