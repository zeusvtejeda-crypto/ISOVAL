// Entrada de dist/_worker.js (Cloudflare Pages, modo avanzado): un solo archivo que atiende la API y sirve la app,
// sin subir los archivos estáticos por separado. Lo arma scripts/empaquetar.mjs (ARCHIVOS viene de public/).
import ARCHIVOS from 'archivos-embebidos';
import { onRequest } from '../functions/api/[[path]].js';

const cuerpos = new Map();
const cuerpoDe = (ruta, a) => {
  if (!cuerpos.has(ruta)) cuerpos.set(ruta, a.b64 ? Uint8Array.from(atob(a.b64), (c) => c.charCodeAt(0)) : a.texto);
  return cuerpos.get(ruta);
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return onRequest({ request, env });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Método no permitido', { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    const ruta = pathname === '/' ? '/index.html' : pathname;
    const a = ARCHIVOS[ruta];
    if (!a) return new Response('No encontrado', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    const cabeceras = new Headers(a.cabeceras);
    if (request.headers.get('if-none-match') === a.cabeceras.etag) return new Response(null, { status: 304, headers: cabeceras });
    return new Response(request.method === 'HEAD' ? null : cuerpoDe(ruta, a), { headers: cabeceras });
  }
};
