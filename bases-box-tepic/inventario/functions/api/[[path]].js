// Cloudflare Pages Function — API del inventario de Bases Box Tepic.
// Necesita una base D1 enlazada con el nombre "DB" (ver README.md); SETUP_KEY es opcional: si existe,
// el asistente de primera configuración la pide. Toda la lógica vive en
// public/core.js; aquí solo se traduce la petición HTTP y se responde en JSON.
import BBCore from '../../public/core.js';
import { crearRepoD1 } from '../_d1.js';

const CABECERAS = {
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer', 'cross-origin-resource-policy': 'same-origin', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=63072000; includeSubDomains'
};
const MAX_CUERPO = 65536;
const responder = (status, json) => new Response(JSON.stringify(json), { status, headers: CABECERAS });
const error = (status, code, mensaje) => responder(status, { ok: false, error: { code, mensaje } });

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'POST') return error(405, 'metodo', 'Método no permitido.');
  if (!env.DB) return error(503, 'sin_base_de_datos', 'Falta conectar la base de datos D1 con el nombre "DB".');

  const url = new URL(request.url);
  // Defensa en profundidad: una petición que viene de otro sitio web se rechaza (la app siempre llama desde su propio origen).
  const origen = request.headers.get('origin');
  if (origen && origen !== url.origin) return error(403, 'origen', 'Petición no permitida desde este sitio.');
  let body = null;
  if (request.method === 'POST') {
    if (Number(request.headers.get('content-length') || 0) > MAX_CUERPO) return error(413, 'muy_grande', 'La petición es demasiado grande.');
    let texto;
    try { texto = await request.text(); } catch (e) { return error(400, 'json', 'No pude leer la petición.'); }
    if (texto.length > MAX_CUERPO) return error(413, 'muy_grande', 'La petición es demasiado grande.');
    try { body = JSON.parse(texto); } catch (e) { return error(400, 'json', 'No pude leer la petición.'); }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return error(400, 'json', 'No pude leer la petición.');
  }

  const repo = await crearRepoD1(env.DB);
  const r = await BBCore.handle(repo, {
    method: request.method,
    path: url.pathname.replace(/^\/api/, '') || '/',
    query: Object.fromEntries(url.searchParams),
    body,
    token: (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  }, { claveInstalacion: env.SETUP_KEY });
  return responder(r.status, r.json);
}
