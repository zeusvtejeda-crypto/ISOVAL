// Mensajes de WhatsApp: plantillas, variables, enlaces wa.me, enlace de gestión y registro en `messages`.
// Lo usan api/messages.js (panel: modo manual → wa.me, modo auto → cola) y api/automation.js (recordatorios).
//
// Plantillas: DEFAULT_TEMPLATES (domain/settings.js), sobrescribibles en settings.whatsapp.templates.
// Variables: {cliente} {barberia} {fecha} {hora} {servicios} {barbero} {total} {folio} {enlace} {direccion} {resena}
// (se aceptan también con acentos o mayúsculas: {Barbería}, {dirección}, {reseña}).
//
// Enlace de gestión: el token de la cita solo se guarda hasheado (appointments.manage_token_hash), así que
// para poner un enlace "gestiona tu cita" en un mensaje se genera un token NUEVO (el anterior deja de servir).
// Por eso la VISTA PREVIA no genera token: deja el marcador literal {enlace} (LINK_MARKER) y el token se rota
// solo al registrar el mensaje de verdad (fillLink reemplaza el marcador en el texto que manda el panel).
import { newId, nowIso, fmtMin, normPhone, waNumber } from '../util.js';
import { sha256Hex, newToken } from '../crypto.js';
import { shopSettings, DEFAULT_TEMPLATES } from './settings.js';
import { fmtDateEs } from './appointments.js';
import { logEvent } from './events.js';

export const KINDS = ['confirmation', 'reminder', 'reschedule', 'cancellation', 'thanks', 'no_show', 'custom'];
export const KIND_LABEL = {
  confirmation: 'Confirmación', reminder: 'Recordatorio', reschedule: 'Cambio de horario', cancellation: 'Cancelación',
  thanks: 'Agradecimiento', no_show: 'No asistió', custom: 'Mensaje libre'
};
// Tipos cuyo {enlace} lleva al cliente a gestionar SU cita (token nuevo). Los demás usan el link de reservas.
export const TOKEN_KINDS = ['confirmation', 'reminder', 'reschedule', 'no_show'];
// Tipos que, sin texto propio, necesitan una cita (su plantilla habla de fecha, hora, servicios…).
export const APPT_KINDS = ['confirmation', 'reminder', 'reschedule', 'cancellation', 'no_show'];
export const MESSAGE_STATUSES = ['prepared', 'opened', 'sent', 'queued', 'failed'];
export const MAX_BODY = 1000;
export const VARS = ['cliente', 'barberia', 'fecha', 'hora', 'servicios', 'barbero', 'total', 'folio', 'enlace', 'direccion', 'resena'];
export const LINK_MARKER = '{enlace}';

const fold = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const VAR_RE = /\{([^{}\n]{1,24})\}/g;

// ── Texto ──
// Reemplaza {variable}. Las desconocidas se dejan tal cual; una línea cuyas variables quedaron todas vacías y
// que ya no tiene texto (p. ej. "📍 {direccion}" sin dirección) se quita.
export function renderTemplate(tpl, vars) {
  vars = vars || {};
  const val = (k) => { const key = fold(k); return Object.prototype.hasOwnProperty.call(vars, key) ? (vars[key] == null ? '' : String(vars[key])) : null; };
  const out = [];
  for (const line of String(tpl == null ? '' : tpl).replace(/\r\n?/g, '\n').split('\n')) {
    let used = 0, empty = 0;
    let r = line.replace(VAR_RE, (m, k) => { const v = val(k); if (v === null) return m; used++; if (!v.trim()) empty++; return v; });
    if (used && used === empty && !/[\p{L}\p{N}]/u.test(r)) continue;
    if (empty) r = r.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').trimEnd();
    out.push(r);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
// ¿La plantilla usa {name}?
export function usesVar(tpl, name) {
  for (const m of String(tpl || '').matchAll(VAR_RE)) if (fold(m[1]) === name) return true;
  return false;
}
export function firstName(name) {
  const w = String(name || '').trim().split(/\s+/)[0] || '';
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
}
// $1,250 · $99.50 · $300 USD (la moneda solo se escribe si no es MXN).
export function fmtMoney(n, currency) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const s = (Number.isInteger(v) ? String(v) : v.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + s + (currency && currency !== 'MXN' ? ' ' + currency : '');
}

// ── Enlaces ──
function cleanBase(u) {
  if (typeof u !== 'string' || !u.trim()) return '';
  try {
    const x = new URL(u.trim());
    if (x.protocol !== 'http:' && x.protocol !== 'https:') return '';
    return (x.origin + x.pathname).replace(/\/+$/, '');
  } catch (e) { return ''; }
}
// Base pública del sitio: env.PUBLIC_URL; si no, la cabecera host (https). En la demo, origin/host si vienen;
// sin nada → '' (enlaces relativos '/?…').
export function publicBase(env, headers) {
  env = env || {}; headers = headers || {};
  const fromEnv = cleanBase(env.PUBLIC_URL);
  if (fromEnv) return fromEnv;
  const demo = env.MODE === 'demo';
  if (demo) { const o = cleanBase(headers.origin); if (o) return o; }
  const host = String(headers.host || '').trim().toLowerCase();
  if (/^[a-z0-9.-]{1,253}(:\d{1,5})?$/.test(host) && /[a-z0-9]/.test(host)) {
    const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host);
    return (demo && local ? 'http://' : 'https://') + host;
  }
  return '';
}
export const bookingUrl = (base, shop) => (base || '') + '/?b=' + encodeURIComponent((shop && shop.slug) || '');
export const manageUrl = (base, token) => (base || '') + '/?cita=' + token;
// https://wa.me/52XXXXXXXXXX?text=… (10 dígitos → lada del país; sin teléfono → elegir contacto en WhatsApp).
export function waLink(phone, text, countryCode) {
  const n = phone ? waNumber(phone, countryCode || '52') : '';
  return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
}

// Teléfono del destinatario (solo dígitos, sin lada 52): ficha del cliente o copia en la cita.
export function messagePhone(client, appt) {
  return normPhone((client && client.phone) || (appt && appt.client_phone) || '');
}
export const validPhone = (p) => typeof p === 'string' && /^\d{10,15}$/.test(p);

// ── Plantillas y variables ──
export function templateFor(shop, kind) {
  const t = (shopSettings(shop).whatsapp || {}).templates || {};
  return typeof t[kind] === 'string' && t[kind].trim() ? t[kind] : (DEFAULT_TEMPLATES[kind] || '');
}

// opts: { client, staffName, link (enlace ya resuelto), base, bookingUrl }
export function buildVars(shop, appt, opts) {
  opts = opts || {};
  shop = shop || {};
  const a = appt || {};
  const st = shopSettings(shop);
  const booking = opts.bookingUrl || bookingUrl(opts.base, shop);
  const name = (opts.client && opts.client.name) || a.client_name || '';
  let fecha = '';
  try { fecha = a.date ? fmtDateEs(a.date) : ''; } catch (e) { fecha = ''; }
  return {
    cliente: firstName(name),
    barberia: shop.name || '',
    fecha,
    hora: Number.isInteger(a.start_min) ? fmtMin(a.start_min) : '',
    servicios: (Array.isArray(a.services) ? a.services : []).map((s) => s && s.name).filter(Boolean).join(' + '),
    barbero: opts.staffName || a.staff_name || '',
    total: appt ? fmtMoney(a.total, shop.currency) : '',
    folio: a.folio || '',
    enlace: opts.link || booking,
    direccion: shop.address || shop.maps_url || '',
    resena: (st.public && st.public.review_url) || booking
  };
}

// Token nuevo para el enlace de gestión de la cita (invalida el anterior). Devuelve el token en claro.
export async function rotateManageToken(sdb, appointmentId) {
  const token = newToken();
  await sdb.update('appointments', { id: appointmentId }, { manage_token_hash: await sha256Hex(token) });
  return token;
}

// Texto del mensaje desde la plantilla de la barbería. c = { sdb, shop }.
// o: { kind, appt?, client?, base, withToken (rota el token si la plantilla usa {enlace}), preview, staffName? }
// preview: el enlace de gestión queda como el marcador {enlace} (no se rota el token).
export async function composeMessage(c, o) {
  const tpl = templateFor(c.shop, o.kind);
  if (!tpl) return '';
  let link = '';
  if (o.appt && TOKEN_KINDS.includes(o.kind) && usesVar(tpl, 'enlace')) {
    if (o.preview) link = LINK_MARKER;
    else if (o.withToken) link = manageUrl(o.base, await rotateManageToken(c.sdb, o.appt.id));
  }
  let staffName = o.staffName;
  if (staffName == null && o.appt && o.appt.staff_id) {
    const s = await c.sdb.findOne('staff', { id: o.appt.staff_id });
    staffName = s ? s.name : '';
  }
  return renderTemplate(tpl, buildVars(c.shop, o.appt, { client: o.client, staffName, link, base: o.base })).slice(0, MAX_BODY * 2);
}

// Texto ya armado (p. ej. el de la vista previa, editado en el panel) con {enlace}: al registrarlo se reemplaza
// por el enlace de gestión (token nuevo) si el tipo lo lleva y hay cita; si no, por el link de reservas.
export async function fillLink(c, text, { kind, appt, base }) {
  if (!usesVar(text, 'enlace')) return text;
  const link = appt && TOKEN_KINDS.includes(kind) ? manageUrl(base, await rotateManageToken(c.sdb, appt.id)) : bookingUrl(base, c.shop);
  return String(text).replace(VAR_RE, (m, k) => (fold(k) === 'enlace' ? link : m));
}

// Estado inicial según el modo de WhatsApp de la barbería: manual → 'prepared' (wa.me); auto → 'queued'.
export function initialStatus(shop) { return shopSettings(shop).whatsapp.mode === 'auto' ? 'queued' : 'prepared'; }

// Guarda el mensaje y, si es de una cita, lo anota en su historial.
export async function recordMessage(sdb, m, actor) {
  const row = await sdb.insert('messages', {
    id: newId('msg'), appointment_id: m.appointment_id || null, client_id: m.client_id || null, channel: 'whatsapp',
    kind: m.kind, to_phone: m.to_phone || null, body: m.body, status: m.status, provider_id: null, error: null,
    created_by: m.created_by || (actor && actor.id) || null, created_at: nowIso(), sent_at: null
  });
  if (row.appointment_id) await logEvent(sdb, row.appointment_id, 'message', { message_id: row.id, kind: row.kind, status: row.status, to_phone: row.to_phone }, actor);
  return row;
}
