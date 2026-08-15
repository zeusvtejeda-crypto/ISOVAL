// ═══════════════════════════════════════════════════════════════
//  REGISTRO DE NEGOCIOS
//  Aquí se juntan todos los perfiles. Para AGREGAR un negocio nuevo:
//    1) Crea un archivo nuevo en esta carpeta (copia uno existente).
//    2) Impórtalo abajo y agrégalo al arreglo "negocios".
//  Nada más. El asistente lo tomará automáticamente.
// ═══════════════════════════════════════════════════════════════
const camas = require("./camas");
const fithouse = require("./fithouse");
const inmobiliaria = require("./inmobiliaria");
const isoval = require("./isoval");

const negocios = [camas, fithouse, inmobiliaria, isoval];

// Índices rápidos para encontrar el negocio según por dónde llegó el mensaje:
//   • phoneNumberId -> WhatsApp
//   • paginaId / instagramId -> Facebook e Instagram
const porId = {};
const porPhoneNumberId = {};
const porPaginaId = {};

for (const n of negocios) {
  porId[n.id] = n;
  if (n.phoneNumberId) porPhoneNumberId[n.phoneNumberId] = n;
  // La Página de Facebook y la cuenta de Instagram apuntan al mismo negocio.
  if (n.paginaId) porPaginaId[n.paginaId] = n;
  if (n.instagramId) porPaginaId[n.instagramId] = n;
}

module.exports = { negocios, porId, porPhoneNumberId, porPaginaId };
