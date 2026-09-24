// Primer arranque del servidor: crea el superadmin y la barbería real NEW GOMEZ (datos del index.html
// original), y opcionalmente carga la demo. Protegido con env.SETUP_KEY; solo funciona con la base vacía
// (sin usuarios), salvo { demo:true }, que únicamente carga la demo si aún no existe.
//
//   GET  /api/setup/status → { needs_setup, has_setup_key, has_demo }
//   POST /api/setup        { key, email, password, name?, pins?:{ angel, alexis }, demo? }
import { conflict, forbidden, normEmail, newId, nowIso } from '../util.js';
import { hashSecret, sha256Hex, PIN_ITERATIONS } from '../crypto.js';
import { publicUser, rateCheck, rateFail, rateReset } from '../session.js';
import { scopedDb, tableDef } from '../db.js';
import { TABLES } from '../schema.js';
import { notify } from '../domain/notify.js';
import { txt, failIf, passwordError, emailError, nameError } from './auth.js';

export const DEMO_SLUG = 'demo';
const SETUP_LIMIT = { max: 10, windowMin: 15, lockMin: 15 }; // 'setup:<ip>' (llaves equivocadas)

// ── NEW GOMEZ (index.html → NEGOCIO y DATA) ──
export const NEW_GOMEZ_SLUG = 'new-gomez';
export const NEW_GOMEZ_HOURS = {
  0: [], 1: [[600, 840], [960, 1200]], 2: [[600, 840], [960, 1200]], 3: [[600, 840], [960, 1200]],
  4: [[600, 840], [960, 1200]], 5: [[600, 840], [960, 1200]], 6: [[600, 960]]
};
export const NEW_GOMEZ = {
  slug: NEW_GOMEZ_SLUG,
  name: 'NEW GOMEZ',
  tagline: 'Barbería en Tepic · Cortes, barba y tinte',
  description: 'Barbería en Tepic, Nayarit: cortes de cabello, barba, tinte y limpieza facial con Angel y Alexis. Mejorando siempre nuestros servicios para ofrecerles trabajos de calidad, con tratamientos para cuidar tanto el cabello como la piel.',
  phone: '3111585540',
  whatsapp: '3111585540',
  email: null,
  address: 'Tuxpan 45, Col. Morelos, 63160 Tepic, Nayarit',
  city: 'Tepic',
  maps_url: 'https://www.google.com/maps/search/?api=1&query=21.497270,-104.901603',
  timezone: 'America/Mazatlan',
  currency: 'MXN',
  logo_url: '/img/logo.jpg',
  cover_url: '/img/foto3.jpg',
  brand_color: '#C49A3C',
  domain: 'gomez.tubarberia.mx',
  settings: {
    hours: NEW_GOMEZ_HOURS,
    booking: { step_min: 20, lead_min: 30, window_days: 14 },
    public: {
      rating: 5, reviews_count: 145,
      review_url: 'https://www.google.com/search?q=Barber%C3%ADa+%C3%81ngel+Tuxpan+45+Tepic&ludocid=16017407076252956381#lrd=0x84273726b5bd348d:0xde4942df3ae2b6dd,3',
      instagram: 'https://www.instagram.com/angel_newgomez',
      fresha: 'https://www.fresha.com/es/a/new-gomez-tepic-tuxpan-grp0jy1g',
      maps_place_url: 'https://maps.google.com/?cid=16017407076252956381',
      gallery: ['/img/foto3.jpg', '/img/foto4.jpg', '/img/foto6.jpg', '/img/foto2.jpg', '/img/foto5.jpg']
    }
  }
};
// Mismos nombres que el sistema anterior (el importador de citas antiguas empata servicios por nombre).
export const NEW_GOMEZ_SERVICES = [
  { name: 'Corte de pelo', category: 'Cortes', duration_min: 40, price: 180, popular: true, description: 'Corte a máquina o tijera a tu estilo, con acabado y peinado.' },
  { name: 'Corte de pelo y barba', category: 'Combos', duration_min: 60, price: 360, popular: true, description: 'Corte de cabello más arreglo y perfilado de barba.' },
  { name: 'Corte de barba', category: 'Barba', duration_min: 40, price: 180, popular: false, description: 'Rebajado y perfilado de barba con máquina y navaja.' },
  { name: 'Barba y tinte', category: 'Barba', duration_min: 60, price: 360, popular: false, description: 'Arreglo de barba con tinte para un tono parejo.' },
  { name: 'Corte, barba y tinte', category: 'Combos', duration_min: 80, price: 540, popular: false, description: 'Servicio completo: corte de cabello, arreglo de barba y tinte.' },
  { name: 'Corte, exfoliación y mascarilla', category: 'Combos', duration_min: 60, price: 360, popular: false, description: 'Corte de cabello más limpieza facial con exfoliación y mascarilla.' },
  { name: 'Exfoliación y mascarilla', category: 'Facial', duration_min: 20, price: 180, popular: false, description: 'Limpieza facial: exfoliación para retirar impurezas y mascarilla.' },
  { name: 'Limpieza de contornos', category: 'Extras', duration_min: 20, price: 80, popular: false, description: 'Delineado con máquina, navaja y gel.' },
  { name: 'Limpieza de cejas', category: 'Extras', duration_min: 10, price: 80, popular: false, description: 'Limpieza y perfilado de cejas.' },
  { name: 'Limpieza nasal', category: 'Extras', duration_min: 20, price: 80, popular: false, description: 'Retiro de vello de la nariz para una apariencia más limpia.' }
];
export const NEW_GOMEZ_STAFF = [
  { key: 'angel', name: 'Angel', role: 'owner', avatar_url: '/img/angel.jpg', commission_pct: 0, color: '#C49A3C', bio: 'Dueño y barbero de NEW GOMEZ.' },
  { key: 'alexis', name: 'Alexis', role: 'barber', avatar_url: '/img/alexis.jpg', commission_pct: 50, color: '#5B7FDB', bio: 'Barbero en NEW GOMEZ.' }
];

const body = (ctx) => { const b = ctx.req.body; return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };
const brief = (s) => (s ? { id: s.id, slug: s.slug, name: s.name } : null);

// Comparación de la llave sin filtrar su longitud ni su contenido por tiempos.
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([sha256Hex(String(a)), sha256Hex(String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// Borra una barbería y TODO lo suyo (limpieza de un alta a medias). Solo para setup/demo.
async function purgeShop(db, shopId) {
  const sdb = scopedDb(db, shopId);
  for (const t of TABLES) if (tableDef(t).scoped) { try { await sdb.delete(t, {}); } catch (e) { /* best-effort */ } }
  try { await db.delete('sessions', { shop_id: shopId }); } catch (e) { /* best-effort */ }
  try { await db.delete('shops', { id: shopId }); } catch (e) { /* best-effort */ }
}

// createNewGomez(db, { pins?:{ angel, alexis }, plan? }) → { shop, staff, services, created }
// Idempotente: si ya existe la barbería 'new-gomez' la devuelve sin tocarla (created:false).
// PINs ya validados por quien llama (4 a 6 dígitos, distintos). Staff sin cuenta: entran con PIN; el dueño
// puede vincular correo/contraseña después en Equipo (POST /api/staff/:id/account).
export async function createNewGomez(db, opts) {
  opts = opts || {};
  const existing = await db.findOne('shops', { slug: NEW_GOMEZ_SLUG });
  if (existing) {
    const sdb = scopedDb(db, existing.id);
    const [staff, services] = await Promise.all([sdb.find('staff', {}, { order: 'sort asc' }), sdb.find('services', {}, { order: 'sort asc' })]);
    return { shop: existing, staff, services, created: false };
  }
  const now = nowIso();
  const pins = opts.pins || {};
  // El dominio es opcional: si otra barbería ya lo tiene, NEW GOMEZ queda sin dominio (se asigna después).
  const domain = (await db.findOne('shops', { domain: NEW_GOMEZ.domain })) ? null : NEW_GOMEZ.domain;
  const shop = await db.insert('shops', Object.assign({}, NEW_GOMEZ, {
    id: newId('sh'), domain, status: 'active', plan: ['demo', 'basic', 'pro'].includes(opts.plan) ? opts.plan : 'pro',
    settings: JSON.parse(JSON.stringify(NEW_GOMEZ.settings)), created_at: now, updated_at: now
  }));
  try {
    const sdb = scopedDb(db, shop.id);
    const staff = [];
    for (const [i, s] of NEW_GOMEZ_STAFF.entries()) {
      const pin = pins[s.key];
      staff.push({
        id: newId('st'), shop_id: shop.id, user_id: null, name: s.name, role: s.role, bookable: true, active: true,
        color: s.color, avatar_url: s.avatar_url, bio: s.bio, phone: s.role === 'owner' ? NEW_GOMEZ.phone : null,
        commission_pct: s.commission_pct, pin_hash: pin ? await hashSecret(String(pin), PIN_ITERATIONS) : null,
        sort: i, created_at: now, updated_at: now
      });
    }
    await sdb.insertMany('staff', staff);
    const services = NEW_GOMEZ_SERVICES.map((s, i) => Object.assign({ id: newId('sv'), shop_id: shop.id }, s, { active: true, staff_ids: [], sort: i, created_at: now, updated_at: now }));
    await sdb.insertMany('services', services);
    // Disponibilidad de cada barbero = horario de la barbería (cada quien la ajusta después).
    const avail = [];
    for (const st of staff) for (let wd = 0; wd <= 6; wd++) for (const [a, b] of NEW_GOMEZ_HOURS[wd]) avail.push({ id: newId('av'), shop_id: shop.id, staff_id: st.id, weekday: wd, start_min: a, end_min: b });
    await sdb.insertMany('availability', avail);
    await notify(sdb, 'owners', {
      type: 'system', title: '¡NEW GOMEZ ya está en TuBarbería!',
      body: 'Tus 10 servicios, horarios y equipo quedaron cargados. Comparte tu enlace de reservas y revisa los ajustes.',
      link: '#/ajustes', data: { kind: 'welcome', slug: shop.slug }
    });
    return { shop, staff, services, created: true };
  } catch (e) {
    await purgeShop(db, shop.id);
    throw e;
  }
}

// PINs opcionales de Angel y Alexis → { angel?, alexis? }; errores en fields['pins.<nombre>'].
function parsePins(v, fields) {
  const out = {};
  if (v === undefined || v === null) return out;
  if (typeof v !== 'object' || Array.isArray(v)) { fields.pins = 'Los PIN deben venir como { angel, alexis }.'; return out; }
  for (const s of NEW_GOMEZ_STAFF) {
    const raw = v[s.key];
    if (raw === undefined || raw === null || raw === '') continue;
    const p = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
    if (!/^\d{4,6}$/.test(p)) fields['pins.' + s.key] = 'El PIN de ' + s.name + ' debe tener de 4 a 6 dígitos.';
    else out[s.key] = p;
  }
  if (out.angel && out.alexis && out.angel === out.alexis) fields['pins.alexis'] = 'Angel y Alexis necesitan PIN distintos.';
  return out;
}

// Carga la demo (core/seed-demo.js, otro módulo). Nunca rompe el setup: los errores vuelven en { ok:false, error }.
// En el servidor va SIN superadmin de demo (sus credenciales son públicas: daría acceso a todas las barberías).
async function loadDemo(ctx) {
  const db = ctx.db;
  const [supersBefore, shopsBefore] = await Promise.all([
    db.find('users', { is_superadmin: true }),
    db.find('shops', { slug: { in: [DEMO_SLUG, 'demo-norte'] } })
  ]);
  const superIds = new Set(supersBefore.map((u) => u.id));
  const hadShop = new Set(shopsBefore.map((s) => s.slug));
  let emails = [];
  let usersBefore = new Set();
  // Cualquier superadmin nuevo que haya creado la siembra se desactiva (defensa en profundidad).
  const lockSupers = async () => {
    for (const u of await db.find('users', { is_superadmin: true })) {
      if (!superIds.has(u.id)) await db.update('users', { id: u.id }, { is_superadmin: false, status: 'disabled' });
    }
  };
  try {
    const mod = await import('../seed-demo.js');
    emails = Object.values(mod.DEMO_CREDENTIALS || {}).map((c) => c && c.email).filter(Boolean);
    usersBefore = new Set((emails.length ? await db.find('users', { email: { in: emails } }) : []).map((u) => u.email));
    const base = typeof ctx.env.PUBLIC_URL === 'string' && /^https?:\/\//.test(ctx.env.PUBLIC_URL) ? ctx.env.PUBLIC_URL : undefined;
    const r = await mod.seedDemo(db, { withPlatform: false, base });
    await lockSupers();
    const credentials = Object.assign({}, (r && r.credentials) || {});
    delete credentials.superadmin;
    return {
      ok: true, shop: brief(r && r.shop), credentials,
      pins: ((r && r.pins) || []).map((p) => ({ name: p.name, role: p.role, pin: p.pin }))
    };
  } catch (e) {
    if (typeof console !== 'undefined') console.error('[setup] demo', e);
    // Limpieza de una siembra a medias, para poder reintentar con { demo:true }.
    try {
      await lockSupers();
      for (const s of await db.find('shops', { slug: { in: [DEMO_SLUG, 'demo-norte'] } })) if (!hadShop.has(s.slug)) await purgeShop(db, s.id);
      for (const u of emails.length ? await db.find('users', { email: { in: emails } }) : []) {
        if (!usersBefore.has(u.email) && !superIds.has(u.id)) { await db.delete('sessions', { user_id: u.id }); await db.delete('users', { id: u.id }); }
      }
    } catch (x) { /* best-effort */ }
    return { ok: false, error: 'No se pudo cargar la demo: ' + String(e && e.message || e).slice(0, 300) };
  }
}

async function status(ctx) {
  const [users, demo] = await Promise.all([ctx.db.count('users'), ctx.db.findOne('shops', { slug: DEMO_SLUG })]);
  return { needs_setup: users === 0, has_setup_key: !!ctx.env.SETUP_KEY, has_demo: !!demo };
}

async function setup(ctx) {
  const db = ctx.db;
  const b = body(ctx);
  const key = ctx.env.SETUP_KEY;
  if (!key) throw forbidden('La configuración inicial está desactivada: define la variable SETUP_KEY en Cloudflare y vuelve a intentarlo.');
  const rk = 'setup:' + (txt(ctx.req.ip).slice(0, 64) || 'anon');
  await rateCheck(db, rk, SETUP_LIMIT);
  if (typeof b.key !== 'string' || !b.key || b.key.length > 500 || !(await sameSecret(b.key, key))) {
    await rateFail(db, rk, SETUP_LIMIT);
    throw forbidden('La llave de configuración no es correcta.');
  }
  await rateReset(db, rk);
  if (b.demo !== undefined && typeof b.demo !== 'boolean') failIf({ demo: 'El campo demo debe ser true o false.' });
  const wantDemo = b.demo === true;

  // Ya configurado: solo se permite cargar la demo si falta.
  if (await db.count('users') > 0) {
    if (!wantDemo) throw conflict('La plataforma ya está configurada. Inicia sesión con tu cuenta de superadmin.', 'already_setup');
    if (await db.findOne('shops', { slug: DEMO_SLUG })) throw conflict('La plataforma ya está configurada y la demo ya está cargada.', 'already_setup');
    return { setup: false, user: null, shop: null, staff: [], services: 0, demo: await loadDemo(ctx) };
  }

  const email = normEmail(b.email);
  const password = typeof b.password === 'string' ? b.password : '';
  const name = b.name == null || b.name === '' ? 'Administrador' : txt(b.name);
  const fields = {};
  const ee = emailError(email, 'Escribe el correo del superadmin.');
  if (ee) fields.email = ee;
  const pe = passwordError(password);
  if (pe) fields.password = pe;
  const ne = nameError(name, { max: 120, empty: 'Escribe tu nombre (mínimo 2 caracteres).' });
  if (ne) fields.name = ne;
  const pins = parsePins(b.pins, fields);
  failIf(fields);

  const user = await db.insert('users', {
    id: newId('us'), email, name, phone: null, password_hash: await hashSecret(password), is_superadmin: true,
    status: 'active', created_at: nowIso(), last_login_at: null
  });
  let ng;
  try { ng = await createNewGomez(db, { pins }); } catch (e) {
    await db.delete('users', { id: user.id }); // sin usuarios otra vez → se puede reintentar
    throw e;
  }
  const demo = wantDemo && !(await db.findOne('shops', { slug: DEMO_SLUG })) ? await loadDemo(ctx) : null;
  return {
    setup: true,
    user: publicUser(user),
    shop: brief(ng.shop),
    shop_created: ng.created,
    staff: ng.staff.map((s) => ({ id: s.id, name: s.name, role: s.role, has_pin: !!s.pin_hash })),
    services: ng.services.length,
    demo
  };
}

export const routes = [
  { method: 'GET', path: '/api/setup/status', auth: 'public', handler: status },
  { method: 'POST', path: '/api/setup', auth: 'public', handler: setup }
];
