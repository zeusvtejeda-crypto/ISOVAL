// Contexto de la barbería activa (GET /api/context) y datos/ajustes de la barbería (PATCH /api/shop).
// También exporta los validadores de entrada que comparten staff.js, services.js y clients.js.
import { HttpError, bad, nowIso, normEmail, isEmail, normPhone, isPhone } from '../util.js';
import { permissionsFor } from '../permissions.js';
import { publicUser } from '../session.js';
import { staffView } from '../domain/views.js';
import { shopSettings, deepMerge, DEFAULT_TEMPLATES } from '../domain/settings.js';
import { RESERVED_SLUGS, isTimeZone } from './auth.js';

// ── Validadores comunes ──
// Convención: undefined = no se envió (no se toca); '' / null = borrar; si es inválido se anota en errs[campo]
// (mensaje listo para mostrar) y se devuelve undefined. Al final, failIf(errs) lanza un 400 con `fields`.
export const body = (ctx) => { const b = ctx.req.body; return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };
export const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const isText = (v) => typeof v === 'string' || typeof v === 'number';
export function failIf(errs) {
  const keys = Object.keys(errs);
  if (keys.length) throw bad(errs[keys[0]], errs);
}
export function dupError(message, field) { return new HttpError(409, 'duplicate', message, field ? { [field]: message } : null); }

// o: { max, min, label, empty, multiline }
export function textIn(errs, field, v, o) {
  if (v === undefined) return undefined;
  const label = o.label || 'El texto';
  if (v !== null && !isText(v)) { errs[field] = label + ' no es válido.'; return undefined; }
  let s = v == null ? '' : String(v);
  s = o.multiline ? s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : s.replace(/\s+/g, ' ').trim();
  if (o.min && s.length < o.min) { errs[field] = s ? label + ' debe tener al menos ' + o.min + ' caracteres.' : (o.empty || 'Este dato es obligatorio.'); return undefined; }
  if (s.length > o.max) { errs[field] = label + ' puede tener máximo ' + o.max + ' caracteres.'; return undefined; }
  return s;
}
// Teléfono MX (10 dígitos; acepta +52/521, espacios y guiones). '' → null.
export function phoneIn(errs, field, v) {
  if (v === undefined) return undefined;
  if (v === null || (isText(v) && String(v).trim() === '')) return null;
  const p = isText(v) ? normPhone(v) : '';
  if (!isPhone(p)) { errs[field] = 'Escribe un teléfono de 10 dígitos.'; return undefined; }
  return p;
}
export function emailIn(errs, field, v) {
  if (v === undefined) return undefined;
  if (v === null || (isText(v) && String(v).trim() === '')) return null;
  const e = typeof v === 'string' ? normEmail(v) : '';
  if (!isEmail(e) || e.length > 160) { errs[field] = 'Escribe un correo válido, por ejemplo nombre@correo.com.'; return undefined; }
  return e;
}
export function colorIn(errs, field, v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return '';
  if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v.trim())) { errs[field] = 'Elige un color válido (formato #rrggbb).'; return undefined; }
  return v.trim().toLowerCase();
}
export function boolOf(v) {
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  if (v === false || v === 0 || v === '0' || v === 'false') return false;
  return null;
}
export function boolIn(errs, field, v) {
  if (v === undefined) return undefined;
  const b = boolOf(v);
  if (b === null) { errs[field] = 'Elige sí o no.'; return undefined; }
  return b;
}
const toNumber = (v) => (typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN));
export function intIn(errs, field, v, min, max, label) {
  if (v === undefined) return undefined;
  const n = toNumber(v);
  if (!Number.isInteger(n) || n < min || n > max) { errs[field] = (label || 'El valor') + ' debe ser un número entero entre ' + min + ' y ' + max + '.'; return undefined; }
  return n;
}
export function numIn(errs, field, v, min, max, label) {
  if (v === undefined) return undefined;
  const n = toNumber(v);
  if (!Number.isFinite(n) || n < min || n > max) { errs[field] = (label || 'El valor') + ' debe ser un número entre ' + min + ' y ' + max + '.'; return undefined; }
  return Math.round(n * 100) / 100;
}
// Enlaces: http(s)://…; con image:true también rutas del mismo sitio ('/img/x.png') e imágenes data: pequeñas.
export const MAX_DATA_URL = 400000; // ≈ 300 KB de imagen en base64
const DATA_IMG = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i;
export function isHttpUrl(s) {
  if (typeof s !== 'string' || s.length > 500 || !/^https?:\/\/[^\s<>"'\\`]+$/i.test(s)) return false;
  try { const u = new URL(s); return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname; } catch (e) { return false; }
}
export function urlIn(errs, field, v, o) {
  o = o || {};
  if (v === undefined) return undefined;
  if (v === null || v === '') return '';
  const label = o.label || 'El enlace';
  if (typeof v !== 'string') { errs[field] = label + ' no es válido.'; return undefined; }
  const s = v.trim();
  if (!s) return '';
  if (o.image && /^data:/i.test(s)) {
    if (s.length > MAX_DATA_URL) { errs[field] = 'La imagen es muy pesada (máximo 300 KB).'; return undefined; }
    if (!DATA_IMG.test(s)) { errs[field] = 'La imagen debe ser PNG, JPG, WEBP o GIF.'; return undefined; }
    return s;
  }
  if (o.image && /^\/(?!\/)[^\s<>"'\\`]{1,300}$/.test(s)) return s;
  if (!isHttpUrl(s)) { errs[field] = label + ' debe ser una dirección web completa (https://…).'; return undefined; }
  return s;
}

// ── Ajustes (shops.settings) ──
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MAX_BLOCKS = 6;
const BOOKING_INT = {
  step_min: [5, 120, 'El intervalo entre horarios'],
  lead_min: [0, 2880, 'La anticipación mínima'],
  window_days: [1, 180, 'Los días para reservar'],
  buffer_min: [0, 120, 'El descanso entre citas'],
  cancel_hours: [0, 168, 'Las horas para cancelar']
};
const BOOKING_BOOL = ['auto_confirm', 'require_phone', 'allow_any_staff', 'online_enabled'];
export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'other'];
export const TEMPLATE_KEYS = Object.keys(DEFAULT_TEMPLATES).concat('custom');
const SOCIAL = { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', tiktok: 'https://www.tiktok.com/@' };
const MAX_GALLERY = 12;

// minutos (entero o 'HH:MM'; '24:00' solo como cierre) → 0..1440 | null
function toMin(v, isEnd) {
  if (typeof v === 'string' && v.includes(':')) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
    if (!m || +m[2] > 59) return null;
    const n = +m[1] * 60 + +m[2];
    return n < 1440 || (isEnd && n === 1440) ? n : null;
  }
  const n = toNumber(v);
  return Number.isInteger(n) && n >= 0 && n <= 1440 ? n : null;
}

// Horario semanal parcial { '0'..'6': [[s,e],…] } → mismo formato validado (solo los días enviados).
export function parseHours(errs, input, field) {
  field = field || 'settings.hours';
  if (!isObj(input)) { errs[field] = 'El horario no es válido.'; return undefined; }
  const out = {};
  for (const k of Object.keys(input)) {
    if (!/^[0-6]$/.test(k)) { errs[field] = 'Los días del horario van del 0 (domingo) al 6 (sábado).'; continue; }
    const key = field + '.' + k;
    const day = DIAS[+k];
    const list = input[k] == null ? [] : input[k];
    if (!Array.isArray(list)) { errs[key] = 'El horario del ' + day + ' no es válido.'; continue; }
    if (list.length > MAX_BLOCKS) { errs[key] = 'Máximo ' + MAX_BLOCKS + ' turnos por día.'; continue; }
    const blocks = [];
    for (const b of list) {
      const s = Array.isArray(b) && b.length === 2 ? toMin(b[0], false) : null;
      const e = Array.isArray(b) && b.length === 2 ? toMin(b[1], true) : null;
      if (s == null || e == null || s >= 1440) { errs[key] = 'El ' + day + ' tiene una hora no válida.'; break; }
      if (s >= e) { errs[key] = 'El ' + day + ': la hora de cierre debe ser después de la de apertura.'; break; }
      blocks.push([s, e]);
    }
    if (errs[key]) continue;
    blocks.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < blocks.length; i++) if (blocks[i][0] < blocks[i - 1][1]) { errs[key] = 'Los horarios del ' + day + ' se traslapan.'; break; }
    if (!errs[key]) out[k] = blocks;
  }
  return out;
}

function socialIn(errs, field, v, base, label) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return '';
  if (typeof v !== 'string') { errs[field] = label + ' no es válido.'; return undefined; }
  const s = v.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return urlIn(errs, field, s, { label });
  const h = s.replace(/^@/, '');
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(h)) { errs[field] = 'Escribe el enlace completo (https://…) o el usuario, por ejemplo @mibarberia.'; return undefined; }
  return base + h;
}

// Ajustes parciales validados (solo lo enviado; las claves desconocidas se ignoran). Se guardan con
// deepMerge sobre lo ya guardado. Los campos con error se reportan como 'settings.<grupo>.<clave>'.
export function parseSettings(errs, input) {
  const F = 'settings';
  if (!isObj(input)) { errs[F] = 'Los ajustes no son válidos.'; return undefined; }
  const out = {};
  const group = (name) => {
    const g = input[name];
    if (g === undefined) return null;
    if (!isObj(g)) { errs[F + '.' + name] = 'Los ajustes no son válidos.'; return null; }
    return g;
  };
  const put = (o, k, v) => { if (v !== undefined) o[k] = v; };

  if (input.hours !== undefined) { const h = parseHours(errs, input.hours, F + '.hours'); if (h) out.hours = h; }

  const bk = group('booking');
  if (bk) {
    const o = {};
    for (const k of Object.keys(BOOKING_INT)) { const [min, max, label] = BOOKING_INT[k]; put(o, k, intIn(errs, F + '.booking.' + k, bk[k], min, max, label)); }
    for (const k of BOOKING_BOOL) put(o, k, boolIn(errs, F + '.booking.' + k, bk[k]));
    out.booking = o;
  }

  const wa = group('whatsapp');
  if (wa) {
    const o = {};
    const P = F + '.whatsapp.';
    if (wa.mode !== undefined) { if (['manual', 'auto'].includes(wa.mode)) o.mode = wa.mode; else errs[P + 'mode'] = 'Elige el modo de envío: manual o automático.'; }
    if (wa.country_code !== undefined) {
      const cc = isText(wa.country_code) ? String(wa.country_code).replace(/[\s+]/g, '') : '';
      if (/^\d{1,4}$/.test(cc)) o.country_code = cc; else errs[P + 'country_code'] = 'La lada del país debe tener de 1 a 4 dígitos (México: 52).';
    }
    put(o, 'reminder_hours', intIn(errs, P + 'reminder_hours', wa.reminder_hours, 1, 72, 'Las horas de anticipación del recordatorio'));
    if (wa.templates !== undefined) {
      if (!isObj(wa.templates)) errs[P + 'templates'] = 'Las plantillas no son válidas.';
      else {
        const t = {};
        for (const k of Object.keys(wa.templates)) {
          if (!TEMPLATE_KEYS.includes(k)) continue;
          const v = wa.templates[k];
          if (v !== null && typeof v !== 'string') { errs[P + 'templates.' + k] = 'La plantilla no es válida.'; continue; }
          const s = String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim();
          if (s.length > 1000) { errs[P + 'templates.' + k] = 'La plantilla puede tener máximo 1000 caracteres.'; continue; }
          // Vacía = volver al texto original.
          t[k] = s || DEFAULT_TEMPLATES[k] || '';
        }
        o.templates = t;
      }
    }
    out.whatsapp = o;
  }

  const pay = group('payments');
  if (pay) {
    const o = {};
    if (pay.methods !== undefined) {
      const list = Array.isArray(pay.methods) ? pay.methods : null;
      if (!list || list.some((m) => !PAYMENT_METHODS.includes(m))) errs[F + '.payments.methods'] = 'Los métodos de pago válidos son efectivo, tarjeta, transferencia y otro.';
      else if (!list.length) errs[F + '.payments.methods'] = 'Activa al menos un método de pago.';
      else o.methods = PAYMENT_METHODS.filter((m) => list.includes(m));
    }
    put(o, 'tips', boolIn(errs, F + '.payments.tips', pay.tips));
    out.payments = o;
  }

  const pub = group('public');
  if (pub) {
    const o = {};
    const P = F + '.public.';
    if (pub.rating !== undefined) {
      if (pub.rating === null || pub.rating === '') o.rating = null;
      else { const r = numIn(errs, P + 'rating', pub.rating, 0, 5, 'La calificación'); if (r !== undefined) o.rating = Math.round(r * 10) / 10; }
    }
    if (pub.reviews_count !== undefined) {
      if (pub.reviews_count === null || pub.reviews_count === '') o.reviews_count = null;
      else put(o, 'reviews_count', intIn(errs, P + 'reviews_count', pub.reviews_count, 0, 10000000, 'El número de reseñas'));
    }
    put(o, 'review_url', urlIn(errs, P + 'review_url', pub.review_url, { label: 'El enlace de reseñas' }));
    for (const k of Object.keys(SOCIAL)) put(o, k, socialIn(errs, P + k, pub[k], SOCIAL[k], 'El enlace de ' + k));
    put(o, 'policies', textIn(errs, P + 'policies', pub.policies, { max: 500, label: 'Las políticas', multiline: true }));
    if (pub.gallery !== undefined) {
      const g = pub.gallery == null ? [] : pub.gallery;
      if (!Array.isArray(g)) errs[P + 'gallery'] = 'La galería no es válida.';
      else if (g.length > MAX_GALLERY) errs[P + 'gallery'] = 'La galería admite máximo ' + MAX_GALLERY + ' fotos.';
      else {
        const e2 = {};
        const list = g.map((u, i) => urlIn(e2, P + 'gallery.' + i, u, { label: 'La foto', image: true }));
        if (Object.keys(e2).length) Object.assign(errs, e2); else o.gallery = list.filter(Boolean);
      }
    }
    out.public = o;
  }

  if (input.notify_email !== undefined) { const e = emailIn(errs, F + '.notify_email', input.notify_email); if (e !== undefined) out.notify_email = e || ''; }
  return out;
}

// Fila completa de la barbería con los ajustes mezclados con los valores por defecto.
export function shopFull(shop) { return Object.assign({}, shop, { settings: shopSettings(shop) }); }

// ── Slug (enlace de reservas) ──
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
export function slugError(slug) {
  if (!SLUG_RE.test(slug) || slug.includes('--')) return 'El enlace debe tener de 3 a 40 caracteres: letras minúsculas, números y guiones (sin espacios ni acentos).';
  if (RESERVED_SLUGS.includes(slug)) return 'Ese enlace está reservado. Elige otro.';
  return '';
}

// ── Handlers ──
async function context(ctx) {
  const shop = shopFull(ctx.shop);
  // El cliente no necesita (ni debe ver) el correo interno de avisos.
  if (ctx.role === 'client') shop.settings = Object.assign({}, shop.settings, { notify_email: '' });
  let staff = null, unread = 0;
  if (ctx.staff) {
    const u = ctx.staff.user_id ? await ctx.db.findOne('users', { id: ctx.staff.user_id }) : null;
    staff = staffView(ctx.staff, u);
    unread = await ctx.sdb.count('notifications', { staff_id: ctx.staff.id, read_at: null });
  } else if (ctx.client) {
    unread = await ctx.sdb.count('notifications', { client_id: ctx.client.id, read_at: null });
  }
  return {
    shop, role: ctx.role, permissions: permissionsFor(ctx.role), staff, client: ctx.client || null, unread,
    user: publicUser(ctx.user), session_kind: ctx.session ? ctx.session.kind : null
  };
}

const TEXT_FIELDS = {
  tagline: { max: 120, label: 'La frase' },
  description: { max: 1000, label: 'La descripción', multiline: true },
  address: { max: 200, label: 'La dirección' },
  city: { max: 80, label: 'La ciudad' }
};

async function updateShop(ctx) {
  const b = body(ctx);
  const shop = ctx.shop;
  const errs = {};
  const patch = {};
  const put = (k, v) => { if (v !== undefined) patch[k] = v; };
  put('name', textIn(errs, 'name', b.name, { min: 2, max: 80, label: 'El nombre', empty: 'Escribe el nombre de la barbería.' }));
  for (const k of Object.keys(TEXT_FIELDS)) { const v = textIn(errs, k, b[k], TEXT_FIELDS[k]); if (v !== undefined) patch[k] = v || null; }
  put('phone', phoneIn(errs, 'phone', b.phone));
  put('whatsapp', phoneIn(errs, 'whatsapp', b.whatsapp));
  put('email', emailIn(errs, 'email', b.email));
  for (const [k, o] of [['maps_url', { label: 'El enlace del mapa' }], ['logo_url', { label: 'El logo', image: true }], ['cover_url', { label: 'La portada', image: true }]]) {
    const v = urlIn(errs, k, b[k], o);
    if (v !== undefined) patch[k] = v || null;
  }
  const color = colorIn(errs, 'brand_color', b.brand_color);
  if (color !== undefined) patch.brand_color = color || null;
  if (b.timezone !== undefined) {
    const tz = typeof b.timezone === 'string' ? b.timezone.trim() : '';
    if (isTimeZone(tz)) patch.timezone = tz; else errs.timezone = 'Elige una zona horaria válida, por ejemplo America/Mexico_City.';
  }
  if (b.currency !== undefined) {
    const cur = typeof b.currency === 'string' ? b.currency.trim().toUpperCase() : '';
    if (['MXN', 'USD'].includes(cur)) patch.currency = cur; else errs.currency = 'La moneda debe ser MXN o USD.';
  }
  let slugChanged = false;
  if (b.slug !== undefined) {
    const slug = typeof b.slug === 'string' ? b.slug.trim().toLowerCase() : '';
    if (slug !== shop.slug) {
      const se = slugError(slug);
      if (se) errs.slug = se; else { patch.slug = slug; slugChanged = true; }
    }
  }
  if (b.settings !== undefined) { const s = parseSettings(errs, b.settings); if (s) patch.settings = s; }
  failIf(errs);
  if (!Object.keys(patch).length && b.slug === undefined) throw bad('No hay cambios que guardar.');
  if (slugChanged && await ctx.db.findOne('shops', { slug: patch.slug, id: { ne: shop.id } })) {
    throw dupError('Ese enlace ya lo usa otra barbería. Elige otro.', 'slug');
  }
  if (patch.settings) patch.settings = deepMerge(isObj(shop.settings) ? shop.settings : {}, patch.settings);
  if (Object.keys(patch).length) {
    patch.updated_at = nowIso();
    // shops es tabla global: se actualiza SOLO la barbería de la sesión (ctx.shop.id), nunca un id del cliente.
    await ctx.db.update('shops', { id: shop.id }, patch);
  }
  const fresh = await ctx.db.findOne('shops', { id: shop.id });
  return { shop: shopFull(fresh) };
}

export const routes = [
  { method: 'GET', path: '/api/context', auth: 'shop', handler: context },
  { method: 'PATCH', path: '/api/shop', auth: 'shop', perm: 'shop.update', handler: updateShop }
];
