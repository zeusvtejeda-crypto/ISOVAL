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

const negocios = [camas, fithouse, inmobiliaria];

// Índices rápidos para buscar por id o por phoneNumberId de WhatsApp
const porId = {};
const porPhoneNumberId = {};

for (const n of negocios) {
  porId[n.id] = n;
  if (n.phoneNumberId) porPhoneNumberId[n.phoneNumberId] = n;
}

module.exports = { negocios, porId, porPhoneNumberId };
