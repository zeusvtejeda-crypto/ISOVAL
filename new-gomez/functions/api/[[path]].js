// Pages Function: todas las rutas /api/* → core/router.js sobre Cloudflare D1 (binding `DB`).
// La base se crea/actualiza sola (core/d1-migrate.js) en la primera petición de cada isolate.
import { handle } from '../../core/router.js';
import { d1Db } from '../../core/db-d1.js';
import { ensureSchema } from '../../core/d1-migrate.js';

const MAX_BODY = 1024 * 1024; // 1 MB
const BODY_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
// _headers no se aplica a las respuestas de Functions: las cabeceras de seguridad van aquí.
const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY'
};

class RequestError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function jsonResponse(status, obj) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  for (const [k, v] of Object.entries(SECURITY)) h.set(k, v);
  return new Response(JSON.stringify(obj), { status, headers: h });
}
const fail = (status, code, message) => jsonResponse(status, { ok: false, error: { code, message } });

// Cuerpo JSON con límite real de tamaño (no se confía solo en content-length: puede venir en trozos).
async function readJson(request) {
  const len = Number(request.headers.get('content-length'));
  if (Number.isFinite(len) && len > MAX_BODY) throw new RequestError(413, 'payload_too_large', 'La información enviada es demasiado grande (máximo 1 MB).');
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      try { await reader.cancel(); } catch (e) { /* nada */ }
      throw new RequestError(413, 'payload_too_large', 'La información enviada es demasiado grande (máximo 1 MB).');
    }
    chunks.push(value);
  }
  if (!size) return undefined;
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  const text = new TextDecoder().decode(buf);
  if (!text.trim()) return undefined;
  try { return JSON.parse(text); } catch (e) {
    throw new RequestError(400, 'bad_request', 'La información enviada no tiene un formato válido (se esperaba JSON).');
  }
}

function toResponse(res) {
  const h = new Headers();
  for (const [k, v] of Object.entries(res.headers || {})) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => h.append(k, String(x))); // set-cookie: una cabecera por cookie
    else h.set(k, String(v));
  }
  for (const [k, v] of Object.entries(SECURITY)) if (!h.has(k)) h.set(k, v);
  const status = res.status || 200;
  const noBody = status === 204 || status === 205 || status === 304;
  return new Response(noBody || res.body == null ? null : res.body, { status, headers: h });
}

// Variables para el core. waitUntil deja terminar tareas en segundo plano (correo de nueva reserva)
// sin retrasar la respuesta.
function appEnv(context, url) {
  const env = context.env;
  return Object.assign({}, env, {
    MODE: 'server',
    DEFAULT_SHOP_SLUG: env.DEFAULT_SHOP_SLUG || 'new-gomez',
    PUBLIC_URL: env.PUBLIC_URL || url.origin,
    waitUntil: typeof context.waitUntil === 'function' ? (p) => context.waitUntil(p) : undefined
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!/^\/api(\/|$)/.test(url.pathname)) return context.next ? context.next() : fail(404, 'not_found', 'Ruta no encontrada.');
  if (!env || !env.DB) return fail(503, 'backend_not_configured', 'El servidor aún no tiene base de datos configurada.');

  const method = request.method.toUpperCase();
  let body;
  try {
    if (BODY_METHODS.includes(method)) body = await readJson(request);
  } catch (e) {
    if (e instanceof RequestError) return fail(e.status, e.code, e.message);
    return fail(400, 'bad_request', 'No se pudo leer la información enviada.');
  }

  try {
    await ensureSchema(env.DB);
  } catch (e) {
    console.error('[api] ensureSchema', e);
    return fail(503, 'db_unavailable', 'No pudimos conectar con la base de datos. Intenta de nuevo en unos segundos.');
  }

  const query = {};
  for (const [k, v] of url.searchParams) query[k] = v;
  const headers = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

  try {
    const res = await handle(
      { method, path: url.pathname, query, body, headers, ip: request.headers.get('cf-connecting-ip') || '' },
      { db: d1Db(env.DB), env: appEnv(context, url) }
    );
    return toResponse(res);
  } catch (e) {
    console.error('[api] ' + method + ' ' + url.pathname, e);
    return fail(500, 'server_error', 'Ocurrió un error inesperado. Intenta de nuevo.');
  }
}
