// Utilidades compartidas por el servidor (Cloudflare Pages Functions) y el navegador (demo).
// Nada de APIs de Node: solo JS estándar + WebCrypto, para que el mismo código corra en ambos.

export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.fields = fields || null;
  }
}
export const bad = (message, fields) => new HttpError(400, 'bad_request', message, fields);
export const unauthorized = (message) => new HttpError(401, 'unauthorized', message || 'Inicia sesión para continuar.');
export const forbidden = (message) => new HttpError(403, 'forbidden', message || 'No tienes permiso para esta acción.');
export const notFound = (message) => new HttpError(404, 'not_found', message || 'No se encontró el recurso.');
export const conflict = (message, code) => new HttpError(409, code || 'conflict', message);
export const tooMany = (message) => new HttpError(429, 'too_many_requests', message || 'Demasiados intentos. Espera unos minutos.');

// ── Identificadores ──
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz';
export function randomString(len, alphabet) {
  const a = alphabet || ALPHA;
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < len; i++) s += a[bytes[i] % a.length];
  return s;
}
// id ordenable por tiempo: 9 chars de tiempo (base36) + 8 aleatorios. Prefijo por tipo.
// Reloj lógico: dos ids creados en el mismo milisegundo siguen ordenándose por creación.
let lastIdTime = 0;
export function newId(prefix) {
  let now = Date.now();
  if (now <= lastIdTime) now = lastIdTime + 1;
  lastIdTime = now;
  const t = now.toString(36).padStart(9, '0');
  return (prefix ? prefix + '_' : '') + t + randomString(8);
}
// Folio legible para el cliente (sin 0/O/1/I para dictarlo por teléfono sin confusiones).
export function newFolio(prefix) {
  return (prefix || 'TB') + '-' + randomString(6, '23456789ABCDEFGHJKLMNPQRSTUVWXYZ');
}

// ── Fechas: una cita vive en la hora LOCAL de la barbería: date 'YYYY-MM-DD' + minutos desde medianoche.
export const pad2 = (n) => String(n).padStart(2, '0');
export const isDateKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
export function dateKeyUTC(d) { return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
export function parseDateKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
export function addDays(k, n) { const d = parseDateKey(k); d.setUTCDate(d.getUTCDate() + n); return dateKeyUTC(d); }
export function weekday(k) { return parseDateKey(k).getUTCDay(); } // 0 = domingo
export function diffDays(a, b) { return Math.round((parseDateKey(b) - parseDateKey(a)) / 86400000); }
export function eachDay(from, to) { const out = []; for (let k = from; k <= to; k = addDays(k, 1)) out.push(k); return out; }
export function fmtMin(m) { return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); }
export function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const v = +m[1] * 60 + +m[2];
  return v >= 0 && v < 1440 ? v : null;
}
// "Ahora" en la zona horaria de la barbería (Workers corre en UTC; el navegador en la zona del usuario).
export function nowInTz(tz, at) {
  const d = at ? new Date(at) : new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(d);
    const g = (t) => parts.find((p) => p.type === t).value;
    return { date: g('year') + '-' + g('month') + '-' + g('day'), minutes: (+g('hour')) * 60 + (+g('minute')), iso: d.toISOString() };
  } catch (e) {
    return { date: dateKeyUTC(d), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), iso: d.toISOString() };
  }
}
export const nowIso = () => new Date().toISOString();

// ── Validación / normalización ──
export function str(v, max) { if (v == null) return ''; return String(v).trim().slice(0, max || 500); }
export function normEmail(v) { return str(v, 200).toLowerCase(); }
export function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
// Teléfono MX: se guarda solo con dígitos (10 dígitos nacionales, o con lada país 52/521).
export function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  return d.slice(0, 15);
}
export function isPhone(v) { return /^\d{10}$/.test(v); }
export function waNumber(phone, cc) { const p = normPhone(phone); return p.length === 10 ? (cc || '52') + p : p; }
export function int(v, def) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; }
export function num(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
export function money(v) { return Math.round(num(v, 0) * 100) / 100; }
export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
export function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'barberia';
}
export function pick(obj, keys) { const o = {}; for (const k of keys) if (obj && obj[k] !== undefined) o[k] = obj[k]; return o; }
export function omit(obj, keys) { const o = {}; for (const k in obj) if (!keys.includes(k)) o[k] = obj[k]; return o; }
export function sum(arr, f) { return arr.reduce((a, x) => a + (f ? f(x) : x), 0); }
export function groupBy(arr, f) { const m = {}; for (const x of arr) { const k = f(x); (m[k] = m[k] || []).push(x); } return m; }
export function csvCell(v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
export function toCSV(rows) { return rows.map((r) => r.map(csvCell).join(',')).join('\r\n'); }
