// ═══════════════════════════════════════════════════════════════
//  MEMORIA DE CONVERSACIÓN
//  Guarda los últimos mensajes de cada cliente para que el asistente
//  no pierda el hilo. Caduca sola tras 6 horas sin actividad.
//
//  Vive en src/almacen.js: si configuraste un Redis, el hilo
//  sobrevive a reinicios y apagones; si no, se guarda en la memoria
//  del proceso (funciona, pero se olvida al reiniciar).
// ═══════════════════════════════════════════════════════════════
const { leer, guardar } = require("./almacen");
const { MAX_HISTORIAL } = require("./config");

const TTL_SEG = 6 * 60 * 60; // 6 horas

function clave(businessId, usuario) {
  return `hist:${businessId}:${usuario}`;
}

async function obtener(businessId, usuario) {
  const mensajes = await leer(clave(businessId, usuario));
  return Array.isArray(mensajes) ? mensajes : [];
}

// Agrega un mensaje al hilo y devuelve el hilo ya actualizado.
// Devolverlo evita tener que volver a leer el almacén justo después:
// cada lectura es una llamada de red, y en WhatsApp la demora se nota.
// Si ya tienes el hilo en la mano, pásalo en "previo" y nos ahorramos
// otra lectura más.
async function agregar(businessId, usuario, rol, texto, previo) {
  const mensajes = previo || (await obtener(businessId, usuario));
  mensajes.push({ role: rol, content: texto });

  // Nos quedamos solo con los últimos MAX_HISTORIAL mensajes
  const recortado = mensajes.slice(-MAX_HISTORIAL);
  await guardar(clave(businessId, usuario), recortado, TTL_SEG);
  return recortado;
}

// ¿Es la primera vez que escribe este cliente? (para el saludo)
async function esNuevo(businessId, usuario) {
  return (await obtener(businessId, usuario)).length === 0;
}

module.exports = { obtener, agregar, esNuevo };
