// ═══════════════════════════════════════════════════════════════
//  ALMACÉN — el "cajón" donde el asistente guarda lo que necesita
//  recordar entre un mensaje y otro: el hilo de cada conversación,
//  qué charlas están pausadas y qué mensajes ya contestó.
//
//  POR QUÉ EXISTE: antes todo esto vivía en la memoria del proceso
//  (un Map). En un hosting sin servidor (Vercel) el proceso se apaga
//  y se vuelve a encender todo el tiempo, así que ese Map se borra
//  solo. Resultado: el cliente decía "queen" y al mensaje siguiente
//  el asistente ya no se acordaba de nada.
//
//  CÓMO FUNCIONA:
//   • Si configuras un Redis (Upstash o Vercel KV — ambos tienen
//     plan gratis), guarda ahí y sobrevive a apagones y reinicios.
//   • Si NO lo configuras, sigue funcionando en la memoria del
//     proceso, igual que antes. Nada se rompe: solo se olvida al
//     reiniciar. Útil para probar en tu compu.
//   • Si el Redis falla a media operación, NO tumbamos al asistente:
//     se cae al respaldo en memoria y deja aviso en el log. Prefiero
//     un asistente con amnesia a un asistente mudo.
// ═══════════════════════════════════════════════════════════════

// Aceptamos los dos juegos de nombres: los de Upstash y los que
// Vercel KV inyecta solo al conectar el almacén desde su panel.
const URL_KV =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const TOKEN_KV =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

const hayKV = !!(URL_KV && TOKEN_KV);

// ── Respaldo en memoria del proceso (y modo local) ───────────────
const local = new Map(); // clave -> { valor, expira }

function leerLocal(clave) {
  const e = local.get(clave);
  if (!e) return null;
  if (Date.now() > e.expira) {
    local.delete(clave);
    return null;
  }
  return e.valor;
}

function guardarLocal(clave, valor, ttlSeg) {
  local.set(clave, { valor, expira: Date.now() + ttlSeg * 1000 });
}

// Limpieza para que el Map no crezca sin fin si el proceso vive mucho.
setInterval(() => {
  const ahora = Date.now();
  for (const [k, v] of local) if (ahora > v.expira) local.delete(k);
}, 30 * 60 * 1000).unref?.();

// ── Redis por HTTP (Upstash / Vercel KV) ─────────────────────────
// Se habla por REST, no por conexión TCP, justamente porque en
// serverless no hay dónde sostener una conexión abierta.
async function comando(...partes) {
  const resp = await fetch(URL_KV, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN_KV}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(partes.map(String)),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.error) {
    throw new Error(
      `almacén respondió ${resp.status}: ${data?.error || "sin detalle"}`
    );
  }
  return data?.result ?? null;
}

// Si el almacén remoto falla, avisamos UNA vez por arranque (no en
// cada mensaje) y seguimos con el respaldo. Un log repetido mil veces
// no informa, solo estorba para encontrar el problema de verdad.
let yaAvise = false;
function avisarFalla(err) {
  if (yaAvise) return;
  yaAvise = true;
  console.error(
    `[almacén] No pude usar el almacén persistente (${err.message}). ` +
      "Sigo trabajando con memoria del proceso: el asistente contesta " +
      "igual, pero puede olvidar el hilo al reiniciarse."
  );
}

// ── API pública ──────────────────────────────────────────────────
const TTL_POR_DEFECTO = 6 * 60 * 60; // 6 horas en segundos

// Devuelve el valor guardado (ya convertido de JSON) o null.
async function leer(clave) {
  if (hayKV) {
    try {
      const crudo = await comando("GET", clave);
      return crudo == null ? null : JSON.parse(crudo);
    } catch (err) {
      avisarFalla(err);
    }
  }
  return leerLocal(clave);
}

// Guarda un valor con caducidad. Todo lo que guardamos caduca solo:
// así el almacén no se llena de conversaciones viejas ni hay que
// hacer limpieza manual nunca.
async function guardar(clave, valor, ttlSeg = TTL_POR_DEFECTO) {
  if (hayKV) {
    try {
      await comando("SET", clave, JSON.stringify(valor), "EX", ttlSeg);
      return;
    } catch (err) {
      avisarFalla(err);
    }
  }
  guardarLocal(clave, valor, ttlSeg);
}

async function borrar(clave) {
  if (hayKV) {
    try {
      await comando("DEL", clave);
      return;
    } catch (err) {
      avisarFalla(err);
    }
  }
  local.delete(clave);
}

// "Aparta" una clave: devuelve true la PRIMERA vez y false si ya
// estaba apartada. Es una operación atómica (SET NX), y de eso
// depende que no contestemos dos veces el mismo mensaje: Meta
// reintenta el webhook cuando tarda, y sin esto el cliente recibe
// la misma respuesta repetida.
async function apartar(clave, ttlSeg = 3600) {
  if (hayKV) {
    try {
      const r = await comando("SET", clave, "1", "NX", "EX", ttlSeg);
      return r === "OK";
    } catch (err) {
      avisarFalla(err);
    }
  }
  if (leerLocal(clave) !== null) return false;
  guardarLocal(clave, "1", ttlSeg);
  return true;
}

// Para /salud: decir si estamos guardando de verdad o solo en memoria.
async function estadoAlmacen() {
  if (!hayKV) {
    return {
      tipo: "MEMORIA",
      persistente: false,
      detalle:
        "Sin almacén configurado: el asistente olvida el hilo cada vez " +
        "que el servidor se reinicia (en Vercel, muy seguido).",
    };
  }
  try {
    await comando("PING");
    return { tipo: "REDIS", persistente: true };
  } catch (err) {
    return {
      tipo: "REDIS",
      persistente: false,
      detalle: `Configurado pero no responde: ${err.message}`,
    };
  }
}

module.exports = { leer, guardar, borrar, apartar, estadoAlmacen, hayKV };
