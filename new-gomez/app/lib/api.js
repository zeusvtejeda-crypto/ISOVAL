// Cliente de la API con dos transportes y la MISMA interfaz:
//   - 'server': fetch a /api/* (Cloudflare Pages Functions + D1). Sesión en cookie HttpOnly.
//   - 'demo'  : ejecuta core/router.js dentro del navegador sobre una base en memoria
//               persistida en localStorage, sembrada con datos ficticios (core/seed-demo.js).
//               Mismas reglas, permisos y validaciones que producción — sin tocar el servidor.
//
//   api.get('/appointments', { from, to }) → data   (lanza ApiError con message en español)
import { nowInTz } from '../../core/util.js';

export class ApiError extends Error {
  constructor(status, code, message, fields) { super(message); this.status = status; this.code = code; this.fields = fields || null; }
}

const API_BASE = new URL('../../api', import.meta.url).pathname;        // '/api' (o '/sub/api')
export const SITE_BASE = new URL('../../', import.meta.url).href;       // 'https://host/' — raíz del sitio
export const APP_BASE = new URL('../', import.meta.url).href;           // 'https://host/app/'

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* modo privado */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } }
};
export { LS };

let mode = LS.get('tb:mode') === 'demo' ? 'demo' : 'server';
let shopId = null;
export const getMode = () => mode;
export function setMode(m, opts) { mode = m === 'demo' ? 'demo' : 'server'; if (!opts || opts.persist !== false) LS.set('tb:mode', mode); }
export const setShop = (id) => { shopId = id || null; };
export const getShop = () => shopId;

// ── Motor de la demo ─────────────────────────────────────────────────────
const DEMO_KEY = 'tb:demo:data:v1';
const DEMO_TZ = 'America/Mazatlan';
const demo = { ready: null, db: null, mem: null, handle: null, seedDemo: null, token: LS.get('tb:demo:token') };

function readDemoData() { try { return JSON.parse(LS.get(DEMO_KEY) || 'null'); } catch (e) { return null; } }

// ── Varias pestañas de la demo (p. ej. panel + página pública en el mismo navegador) ──
// Cada pestaña guarda SOLO lo que ella cambió: relee la copia de localStorage (que puede traer lo que guardó otra
// pestaña), le aplica sus altas, cambios y bajas por tabla e id, y la vuelve a escribir bajo un candado entre
// pestañas. Al llegar la copia de otra pestaña (evento 'storage'), esa copia es la base y encima se vuelven a
// aplicar los cambios locales que aún no se guardan. Así ninguna pestaña pisa la base completa con una foto vieja:
// una reserva o una nota que ya se confirmó no desaparece.
const pending = new Map(); // tabla → Map(id → 'put' | 'del'), cambios de esta pestaña aún sin guardar
let seeding = false;       // sembrando: no se guarda nada a medias
let overwrite = false;     // siembra/reinicio: se escribe la base completa (no se combina)

function markPending(table, ids, op) {
  let m = pending.get(table);
  if (!m) pending.set(table, (m = new Map()));
  for (const id of ids) if (id != null) m.set(id, op);
}
// La misma interfaz que memoryDb, anotando qué filas cambió esta pestaña.
function trackedDb(mem) {
  const idsOf = async (table, where) => (await mem.find(table, where)).map((r) => r.id);
  return Object.assign({}, mem, {
    async insert(table, row) { const r = await mem.insert(table, row); markPending(table, [r.id], 'put'); return r; },
    async insertMany(table, rows) { const n = await mem.insertMany(table, rows); markPending(table, rows.map((r) => r.id), 'put'); return n; },
    async update(table, where, patch) { const ids = await idsOf(table, where); const n = await mem.update(table, where, patch); if (n) markPending(table, ids, 'put'); return n; },
    async delete(table, where) { const ids = await idsOf(table, where); const n = await mem.delete(table, where); if (n) markPending(table, ids, 'del'); return n; }
  });
}
// base (lo guardado por cualquier pestaña) + cambios pendientes de esta pestaña (tomados de `local`).
function withPending(base, local) {
  if (!base || typeof base !== 'object') return local; // sin copia válida: se escribe lo de esta pestaña completo
  const out = {};
  for (const t of Object.keys(local)) out[t] = Array.isArray(base[t]) ? base[t].slice() : [];
  for (const [t, ops] of pending) {
    const rows = out[t] || (out[t] = []);
    const pos = new Map();
    rows.forEach((r, i) => { if (r) pos.set(r.id, i); });
    const mine = new Map((local[t] || []).map((r) => [r.id, r]));
    for (const [id, op] of ops) {
      const i = pos.get(id);
      const r = op === 'put' ? mine.get(id) : null;
      if (r) { if (i === undefined) { pos.set(id, rows.length); rows.push(r); } else rows[i] = r; }
      else if (i !== undefined) { rows[i] = null; pos.delete(id); }
    }
    out[t] = rows.filter(Boolean);
  }
  return out;
}
// Reemplaza los datos en memoria sin reprogramar el guardado (dump() es el objeto interno de memoryDb).
function adopt(next) {
  const d = demo.mem.dump();
  for (const t of Object.keys(d)) d[t] = Array.isArray(next[t]) ? next[t] : [];
}
function writeDemo() {
  if (!pending.size) return;
  const merged = withPending(readDemoData(), demo.mem.dump());
  pending.clear();
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(merged)); } catch (e) { return; /* cuota llena o modo privado */ }
  adopt(merged); // esta pestaña también ve lo que guardaron las otras
}
function saveDemo(data) {
  if (seeding) return;
  if (overwrite) { overwrite = false; pending.clear(); LS.set(DEMO_KEY, JSON.stringify(data)); return; }
  if (!pending.size) return;
  const locks = typeof navigator !== 'undefined' && navigator.locks;
  if (locks && typeof locks.request === 'function') locks.request('tb:demo:data', () => writeDemo()).catch(() => writeDemo());
  else writeDemo();
}

async function demoInit() {
  if (demo.ready) return demo.ready;
  demo.ready = (async () => {
    const [dbm, router, seed] = await Promise.all([import('../../core/db.js'), import('../../core/router.js'), import('../../core/seed-demo.js')]);
    const today = nowInTz(DEMO_TZ).date;
    const stored = LS.get('tb:demo:seeded') === today ? readDemoData() : null;
    demo.mem = dbm.memoryDb({ load: () => stored, save: saveDemo, debounce: 250 });
    demo.db = trackedDb(demo.mem);
    demo.handle = router.handle;
    demo.seedDemo = seed.seedDemo;
    // Los datos se generan relativos a "hoy": si cambió el día se vuelven a sembrar para que la agenda luzca viva.
    if (!stored) await seedFresh(today);
    window.addEventListener('storage', (e) => {
      if (e.key !== DEMO_KEY || !e.newValue) return;
      let incoming;
      try { incoming = JSON.parse(e.newValue); } catch (err) { return; /* JSON a medias: se ignora */ }
      if (!incoming || typeof incoming !== 'object') return;
      adopt(pending.size ? withPending(incoming, demo.mem.dump()) : incoming);
      window.dispatchEvent(new CustomEvent('tb:demo-sync'));
    });
    // Al cerrar o recargar la pestaña, lo pendiente se guarda ya (sin esperar el debounce).
    window.addEventListener('pagehide', () => { if (!seeding) writeDemo(); });
  })();
  demo.ready.catch(() => { demo.ready = null; });
  return demo.ready;
}
async function seedFresh(today) {
  seeding = true;
  try {
    demo.mem.replace(null);
    await demo.seedDemo(demo.mem, { today: today || nowInTz(DEMO_TZ).date });
  } finally { seeding = false; }
  pending.clear();
  overwrite = true;
  demo.mem.flush();
  LS.set('tb:demo:seeded', today || nowInTz(DEMO_TZ).date);
  demo.token = null; LS.del('tb:demo:token');
}
export async function resetDemo() { await demoInit(); await seedFresh(); }
export async function demoCredentials() { const seed = await import('../../core/seed-demo.js'); return seed.DEMO_CREDENTIALS; }

async function demoRequest(method, path, query, body) {
  await demoInit();
  const headers = { host: location.host, origin: location.origin };
  if (demo.token) headers.authorization = 'Bearer ' + demo.token;
  if (shopId) headers['x-shop-id'] = shopId;
  const res = await demo.handle(
    { method, path: '/api' + path, query: query || {}, body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)), headers, ip: 'demo' },
    { db: demo.db, env: { MODE: 'demo', DEFAULT_SHOP_SLUG: 'demo', PUBLIC_URL: SITE_BASE.replace(/\/$/, '') } }
  );
  // Latencia mínima para que loaders y transiciones se perciban igual que en producción.
  await new Promise((r) => setTimeout(r, method === 'GET' ? 60 : 180));
  return res;
}

// ── Petición genérica ────────────────────────────────────────────────────
function cleanQuery(q) {
  const out = {};
  for (const [k, v] of Object.entries(q || {})) if (v !== undefined && v !== null && v !== '') out[k] = Array.isArray(v) ? v.join(',') : String(v);
  return out;
}
async function request(method, path, opts) {
  opts = opts || {};
  const query = cleanQuery(opts.query);
  let status, headers, text;
  if (mode === 'demo') {
    const r = await demoRequest(method, path, query, opts.body);
    status = r.status; headers = r.headers || {}; text = r.body;
  } else {
    const qs = Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : '';
    const h = { 'x-requested-with': 'tb', accept: 'application/json' };
    if (opts.body !== undefined) h['content-type'] = 'application/json';
    if (shopId) h['x-shop-id'] = shopId;
    let res;
    try {
      res = await fetch(API_BASE + path + qs, { method, credentials: 'same-origin', headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), cache: 'no-store' });
    } catch (e) {
      throw new ApiError(0, 'network', navigator.onLine === false ? 'Estás sin conexión. Revisa tu internet e intenta de nuevo.' : 'No se pudo conectar con el servidor. Intenta de nuevo.');
    }
    status = res.status; text = await res.text();
    headers = { 'content-type': res.headers.get('content-type') || '', 'content-disposition': res.headers.get('content-disposition') || '' };
  }
  const ctype = String(headers['content-type'] || '');
  if (opts.raw && status === 200 && !ctype.includes('application/json')) {
    const m = /filename="([^"]+)"/.exec(headers['content-disposition'] || '');
    return { body: text, filename: m ? m[1] : 'descarga.csv', contentType: ctype };
  }
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* no es JSON: hosting estático sin backend */ }
  if (!json || typeof json !== 'object' || !('ok' in json)) {
    throw new ApiError(status || 0, 'backend_unavailable', 'El servidor de la app no está disponible en este sitio.');
  }
  if (!json.ok) {
    const e = json.error || {};
    const err = new ApiError(status, e.code || 'error', e.message || 'Algo salió mal. Intenta de nuevo.', e.fields);
    if (status === 401 && !opts.silent401) emit401(err);
    throw err;
  }
  if (mode === 'demo') {
    if (/^\/auth\/(login|pin|register|signup)$/.test(path) && json.data && json.data.token) { demo.token = json.data.token; LS.set('tb:demo:token', demo.token); }
    if (path === '/auth/logout') { demo.token = null; LS.del('tb:demo:token'); }
  }
  return json.data;
}

const listeners401 = new Set();
export function on401(fn) { listeners401.add(fn); return () => listeners401.delete(fn); }
function emit401(err) { listeners401.forEach((fn) => { try { fn(err); } catch (e) { /* */ } }); }

export const api = {
  get: (path, query, o) => request('GET', path, Object.assign({ query }, o)),
  post: (path, body, o) => request('POST', path, Object.assign({ body: body === undefined ? {} : body }, o)),
  patch: (path, body, o) => request('PATCH', path, Object.assign({ body: body || {} }, o)),
  put: (path, body, o) => request('PUT', path, Object.assign({ body: body || {} }, o)),
  del: (path, o) => request('DELETE', path, o),
  // Descarga (CSV): devuelve { body, filename, contentType }
  raw: (path, query) => request('GET', path, { query, raw: true })
};

// ¿Hay backend real en este sitio? → { ok, backend } o lanza ApiError.
export async function health() { return request('GET', '/health', { silent401: true }); }
