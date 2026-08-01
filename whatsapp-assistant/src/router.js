// ═══════════════════════════════════════════════════════════════
//  ENRUTADOR — decide QUÉ negocio atiende un mensaje entrante.
//  Regla: el mensaje llega a un número (phone_number_id) de Meta,
//  y cada número está asignado a un negocio en su perfil.
// ═══════════════════════════════════════════════════════════════
const { porPhoneNumberId, porId } = require("../businesses");
const { DEFAULT_BUSINESS } = require("./config");

function elegirNegocio(phoneNumberId) {
  // 1) ¿Hay un negocio asignado a este número?
  const porNumero = porPhoneNumberId[phoneNumberId];
  if (porNumero && porNumero.activo) return porNumero;

  // 2) Si no, usamos el negocio por defecto (si está configurado)
  if (DEFAULT_BUSINESS && porId[DEFAULT_BUSINESS]) {
    return porId[DEFAULT_BUSINESS];
  }

  // 3) Nada configurado -> null (el servidor lo registra y no responde)
  return null;
}

module.exports = { elegirNegocio };
