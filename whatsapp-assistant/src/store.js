// ═══════════════════════════════════════════════════════════════
//  BITÁCORA DE CONVERSACIONES (para el panel de atención)
//  Guarda todo lo que escriben los clientes y lo que contesta el
//  asistente, para que el dueño del negocio lo pueda ver.
//
//  Dos modos, se elige solo:
//   • Con Redis (Upstash): las conversaciones se guardan de verdad y
//     sobreviven a reinicios. Es lo que quieres en producción.
//   • Sin Redis: guarda en memoria. Funciona, pero se borra cuando el
//     servidor "se duerme". Sirve para probar sin configurar nada.
//
//  Para activar Redis: en Vercel -> Storage -> crea una base Redis
//  (plan gratis) y conéctala al proyecto. Vercel inyecta las
//  variables solo; este archivo las detecta sin que toques nada.
// ═══════════════════════════════════════════════════════════════

// Vercel/Upstash exponen las credenciales con distintos nombres según
// cómo se haya conectado la base; aceptamos los dos.
const REDIS_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const HAY_REDIS = !!(REDIS_URL && REDIS_TOKEN);

const MAX_MENSAJES = 200; // por conversación
const MAX_CONVERSACIONES = 100;

const clave = (businessId, usuario) => `${businessId}|${usuario}`;

// ── Modo Redis (Upstash REST: se habla con simple fetch) ─────────
async function redis(comandos) {
  const resp = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(comandos),
  });
  if (!resp.ok) throw new Error(`Redis ${resp.status}: ${await resp.text()}`);
  return (await resp.json()).map((r) => r.result);
}

// ── Modo memoria (respaldo) ─────────────────────────────────────
const memoria = new Map(); // clave -> { mensajes: [], visto: number }

// ── API pública ─────────────────────────────────────────────────

// Anota un mensaje. quien = "cliente" | "bot"
async function registrar(businessId, usuario, quien, texto) {
  const k = clave(businessId, usuario);
  const mensaje = { quien, texto, ts: Date.now() };

  if (!HAY_REDIS) {
    const entrada = memoria.get(k) || { mensajes: [], visto: 0 };
    entrada.mensajes.push(mensaje);
    if (entrada.mensajes.length > MAX_MENSAJES) {
      entrada.mensajes = entrada.mensajes.slice(-MAX_MENSAJES);
    }
    entrada.visto = mensaje.ts;
    memoria.set(k, entrada);
    return;
  }

  await redis([
    ["RPUSH", `conv:${k}`, JSON.stringify(mensaje)],
    ["LTRIM", `conv:${k}`, -MAX_MENSAJES, -1],
    ["ZADD", "convs", mensaje.ts, k],
  ]);
}

// Lista de conversaciones, la más reciente primero.
async function listarConversaciones() {
  if (!HAY_REDIS) {
    return [...memoria.entries()]
      .sort((a, b) => b[1].visto - a[1].visto)
      .slice(0, MAX_CONVERSACIONES)
      .map(([k, v]) => {
        const [businessId, usuario] = k.split("|");
        const ultimo = v.mensajes[v.mensajes.length - 1];
        return {
          businessId,
          usuario,
          visto: v.visto,
          adelanto: ultimo ? ultimo.texto : "",
          total: v.mensajes.length,
        };
      });
  }

  const [claves] = await redis([
    ["ZRANGE", "convs", 0, MAX_CONVERSACIONES - 1, "REV"],
  ]);
  if (!claves?.length) return [];

  // Traemos el último mensaje y el total de cada conversación.
  const detalles = await redis(
    claves.flatMap((k) => [
      ["LRANGE", `conv:${k}`, -1, -1],
      ["LLEN", `conv:${k}`],
    ])
  );

  return claves.map((k, i) => {
    const [businessId, usuario] = k.split("|");
    const ultimo = parseMensaje(detalles[i * 2]?.[0]);
    return {
      businessId,
      usuario,
      visto: ultimo?.ts || 0,
      adelanto: ultimo?.texto || "",
      total: detalles[i * 2 + 1] || 0,
    };
  });
}

// Todos los mensajes de una conversación.
async function obtenerMensajes(businessId, usuario) {
  const k = clave(businessId, usuario);

  if (!HAY_REDIS) return memoria.get(k)?.mensajes || [];

  const [crudos] = await redis([["LRANGE", `conv:${k}`, 0, -1]]);
  return (crudos || []).map(parseMensaje).filter(Boolean);
}

function parseMensaje(crudo) {
  if (!crudo) return null;
  if (typeof crudo === "object") return crudo;
  try {
    return JSON.parse(crudo);
  } catch {
    return null;
  }
}

module.exports = {
  registrar,
  listarConversaciones,
  obtenerMensajes,
  HAY_REDIS,
};
