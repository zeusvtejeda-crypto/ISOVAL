// Cloudflare Pages Function — API del inventario de Bases Box Tepic.
// Necesita una base D1 enlazada con el nombre "DB" (ver README.md). Toda la lógica vive en
// public/core.js; aquí solo se traduce la petición HTTP y se responde en JSON.
import BBCore from '../../public/core.js';
import { crearRepoD1 } from '../_d1.js';

const CABECERAS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const responder = (status, json) => new Response(JSON.stringify(json), { status, headers: CABECERAS });
const error = (status, code, mensaje) => responder(status, { ok: false, error: { code, mensaje } });

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'POST') return error(405, 'metodo', 'Método no permitido.');
  if (!env.DB) return error(503, 'sin_base_de_datos', 'Falta conectar la base de datos D1 con el nombre "DB".');

  const url = new URL(request.url);
  let body = null;
  if (request.method === 'POST') {
    if (Number(request.headers.get('content-length') || 0) > 65536) return error(413, 'muy_grande', 'La petición es demasiado grande.');
    try { body = await request.json(); } catch (e) { return error(400, 'json', 'No pude leer la petición.'); }
  }

  const repo = await crearRepoD1(env.DB);
  const r = await BBCore.handle(repo, {
    method: request.method,
    path: url.pathname.replace(/^\/api/, '') || '/',
    query: Object.fromEntries(url.searchParams),
    body,
    token: (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  });
  return responder(r.status, r.json);
}
