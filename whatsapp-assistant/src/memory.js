// ═══════════════════════════════════════════════════════════════
//  MEMORIA DE CONVERSACIÓN (simple, en memoria)
//  Guarda los últimos mensajes de cada cliente para que el asistente
//  no pierda el hilo. Se borra sola tras 6 horas de inactividad.
//
//  NOTA: al ser en memoria, se reinicia si apagas el servidor. Para
//  producción con varias instancias conviene usar una base de datos
//  o Redis (ver README). Para empezar, esto funciona perfecto.
// ═══════════════════════════════════════════════════════════════
const { MAX_HISTORIAL } = require("./config");

const TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const store = new Map(); // clave -> { mensajes: [], visto: timestamp }

function clave(businessId, usuario) {
  return `${businessId}:${usuario}`;
}

function obtener(businessId, usuario) {
  const k = clave(businessId, usuario);
  const entrada = store.get(k);
  if (!entrada) return [];
  if (Date.now() - entrada.visto > TTL_MS) {
    store.delete(k);
    return [];
  }
  return entrada.mensajes;
}

function agregar(businessId, usuario, rol, texto) {
  const k = clave(businessId, usuario);
  const entrada = store.get(k) || { mensajes: [], visto: Date.now() };
  entrada.mensajes.push({ role: rol, content: texto });
  // Nos quedamos solo con los últimos MAX_HISTORIAL mensajes
  if (entrada.mensajes.length > MAX_HISTORIAL) {
    entrada.mensajes = entrada.mensajes.slice(-MAX_HISTORIAL);
  }
  entrada.visto = Date.now();
  store.set(k, entrada);
}

// ¿Es la primera vez que escribe este cliente? (para el saludo)
function esNuevo(businessId, usuario) {
  return obtener(businessId, usuario).length === 0;
}

// Limpieza periódica de conversaciones viejas
setInterval(() => {
  const ahora = Date.now();
  for (const [k, v] of store) {
    if (ahora - v.visto > TTL_MS) store.delete(k);
  }
}, 60 * 60 * 1000).unref?.();

module.exports = { obtener, agregar, esNuevo };
