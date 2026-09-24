// Autenticación: correo/contraseña, PIN de barbero, registro de clientes, alta de barberías (signup),
// sesión actual, perfil y cambio de contraseña. Ver docs/API.md → "Autenticación".
import { HttpError, bad, forbidden, notFound, conflict, unauthorized, normEmail, isEmail, normPhone, isPhone, slugify, newId, nowIso } from '../util.js';
import { hashSecret, verifySecret } from '../crypto.js';
import { COOKIE, SESSION_TTL, publicUser, createSession, destroySession, contextsFor, rateCheck, rateFail, rateReset } from '../session.js';
import { scopedDb } from '../db.js';
import { DEFAULT_HOURS } from '../domain/settings.js';
import { notify } from '../domain/notify.js';

// ── Límites de intentos (tabla login_attempts) ──
export const LIMITS = {
  pw: { max: 5, windowMin: 15, lockMin: 15 },      // 'pw:<email>'
  ip: { max: 30, windowMin: 15, lockMin: 15 },     // 'ip:<ip>' (fallos de contraseña/PIN desde una IP)
  pin: { max: 8, windowMin: 15, lockMin: 15 },     // 'pin:<shop_id>:<ip>'
  reg: { max: 10, windowMin: 60, lockMin: 60 },    // 'reg:<ip>' (registros de cliente por hora)
  signup: { max: 5, windowMin: 60, lockMin: 60 }   // 'signup:<ip>' (barberías nuevas por hora)
};

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;
export const PLANS = ['demo', 'basic', 'pro'];
export const RESERVED_SLUGS = ['demo', 'app', 'api', 'admin', 'b', 'www', 'panel'];
export const DEFAULT_TIMEZONE = 'America/Mexico_City';
const OWNER_COLOR = '#C8A24A';
const BAD_LOGIN = 'Correo o contraseña incorrectos.';
const DUP_EMAIL = 'Ya existe una cuenta con ese correo. Inicia sesión.';

// Servicios con los que arranca toda barbería nueva (el dueño los edita después).
export const TEMPLATE_SERVICES = [
  { name: 'Corte de cabello', category: 'Cortes', duration_min: 40, price: 200, popular: true, description: 'Corte a máquina o tijera, con lavado y peinado.' },
  { name: 'Corte y barba', category: 'Combos', duration_min: 60, price: 320, popular: true, description: 'Corte de cabello más arreglo de barba con toalla caliente.' },
  { name: 'Arreglo de barba', category: 'Barba', duration_min: 30, price: 150, popular: false, description: 'Perfilado y rebajado de barba con navaja.' },
  { name: 'Cejas', category: 'Extras', duration_min: 10, price: 60, popular: false, description: 'Limpieza y perfilado de cejas.' },
  { name: 'Diseño / líneas', category: 'Extras', duration_min: 20, price: 80, popular: false, description: 'Diseño o líneas con navaja.' },
  { name: 'Corte infantil', category: 'Cortes', duration_min: 30, price: 150, popular: false, description: 'Corte para niñas y niños de hasta 12 años.' }
];

// ── Validación ──
// Texto recortado; cualquier cosa que no sea texto/número cuenta como vacío (evita "[object Object]").
export const txt = (v) => (typeof v === 'string' || typeof v === 'number') ? String(v).trim() : '';
const body = (ctx) => { const b = ctx.req.body; return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };
const secret = (v) => (typeof v === 'string' ? v : '');
const ipOf = (ctx) => txt(ctx.req.ip).slice(0, 64);
// Lanza 400 con el primer mensaje como texto principal (para el toast) y todos los campos en `fields`.
export function failIf(fields) {
  const msgs = Object.values(fields);
  if (msgs.length) throw bad(msgs[0], fields);
}
export function passwordError(pw) {
  if (!pw) return 'Escribe una contraseña.';
  if (pw.length < MIN_PASSWORD) return 'La contraseña debe tener al menos ' + MIN_PASSWORD + ' caracteres.';
  if (pw.length > MAX_PASSWORD) return 'La contraseña es demasiado larga (máximo ' + MAX_PASSWORD + ' caracteres).';
  return '';
}
export function emailError(email, empty) {
  if (!email) return empty || 'Escribe tu correo.';
  if (!isEmail(email) || email.length > 160) return 'Escribe un correo válido, por ejemplo nombre@correo.com.';
  return '';
}
export function nameError(name, { min, max, empty, label }) {
  if (name.length < (min || 2)) return empty;
  if (name.length > max) return (label || 'El nombre') + ' es demasiado largo (máximo ' + max + ' caracteres).';
  return '';
}
// Teléfono opcional: '' si no se envió; null si es inválido.
export function optionalPhone(v) {
  const raw = txt(v);
  if (!raw) return '';
  const p = normPhone(raw);
  return isPhone(p) ? p : null;
}
export function isTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
}

// Verificación "falsa" cuando el correo no existe: iguala el tiempo de respuesta para no revelar qué correos existen.
let dummyHash = null;
async function fakeVerify(pw) {
  dummyHash = dummyHash || hashSecret('tb-dummy-' + newId());
  await verifySecret(pw, await dummyHash);
  return false;
}

// ── Sesión ──
async function openSession(ctx, { kind, user, staff, shop }) {
  const s = { kind, user_id: user ? user.id : null, staff_id: staff ? staff.id : null, shop_id: shop ? shop.id : null };
  const token = await createSession(ctx.db, Object.assign({ user_agent: txt(ctx.req.headers['user-agent']) }, s));
  ctx.setCookie(COOKIE, token, { maxAge: Math.round(SESSION_TTL[kind] / 1000) });
  const contexts = await contextsFor(ctx.db, { user: user || null, session: s });
  return { contexts, token: ctx.env.MODE === 'demo' ? token : undefined };
}
// Un nuevo inicio de sesión en el mismo navegador reemplaza la sesión de la cookie anterior (no queda viva en la base).
async function dropCookieSession(ctx) {
  if (ctx.token && !ctx.req.headers.authorization) await destroySession(ctx.db, ctx.token);
}
function requireUser(ctx) {
  if (!ctx.user) throw forbidden('Esta acción requiere iniciar sesión con tu correo y contraseña.');
  return ctx.user;
}

// ── Alta de barbería + dueño (reutilizable: signup, superadmin, setup, demo) ──
// Genera un slug libre a partir de un nombre: "barberia-gomez", "barberia-gomez-2", …
export async function uniqueSlug(db, base, opts) {
  const root = slugify(base);
  const allowReserved = !!(opts && opts.allow_reserved);
  // Una sola consulta: los slugs que ya empiezan con la raíz (like = "contiene"; se filtra exacto abajo).
  const rows = await db.find('shops', { $or: [{ slug: root }, { slug: { like: root + '-' } }] });
  const taken = new Set(rows.map((s) => s.slug));
  let slug = root;
  for (let n = 2; (!allowReserved && RESERVED_SLUGS.includes(slug)) || taken.has(slug); n++) slug = root + '-' + n;
  return slug;
}

// createShopWithOwner(db, opts) → { shop, user, staff, services, user_created }
//   opts: name | shop_name, slug? (fijo: 409 si está ocupado), owner_name, email | owner_email,
//         password? | password_hash?, user? (fila de users ya existente), link_existing? (si el correo ya
//         existe, usa ese usuario sin tocar su contraseña; si no → 409), phone?, city?, timezone?, plan?,
//         status?, settings? (por defecto {} → se usan los DEFAULT_SETTINGS), services? (false = sin plantilla),
//         welcome? (false = sin notificación), allow_reserved?, last_login_at?
// No valida formato de la entrada del usuario (lo hacen los handlers); sí normaliza y garantiza unicidad.
export async function createShopWithOwner(db, o) {
  o = o || {};
  const now = nowIso();
  const name = txt(o.name != null ? o.name : o.shop_name).slice(0, 80) || 'Mi barbería';
  const email = normEmail(o.email != null ? o.email : o.owner_email);
  const phone = normPhone(o.phone) || null;
  const city = txt(o.city).slice(0, 80) || null;
  let user = o.user || null;
  let userCreated = false;
  if (!user) {
    if (!isEmail(email)) throw bad('Escribe un correo válido para el dueño.', { email: 'Escribe un correo válido.' });
    const existing = await db.findOne('users', { email });
    if (existing && !o.link_existing) throw conflict(DUP_EMAIL, 'duplicate');
    user = existing;
  }
  const ownerName = txt(o.owner_name).slice(0, 120) || (user && user.name) || 'Dueño';
  if (!user) {
    const password_hash = o.password_hash || (o.password ? await hashSecret(String(o.password)) : null);
    user = await db.insert('users', {
      id: newId('us'), email, name: ownerName, phone, password_hash, is_superadmin: false, status: 'active',
      created_at: now, last_login_at: o.last_login_at || null
    });
    userCreated = true;
  }
  let shop = null;
  try {
    shop = await insertShop(db, {
      name, phone, whatsapp: null, email: null, city, currency: 'MXN',
      timezone: isTimeZone(o.timezone) ? o.timezone : DEFAULT_TIMEZONE,
      status: o.status === 'suspended' ? 'suspended' : 'active',
      plan: PLANS.includes(o.plan) ? o.plan : 'basic',
      settings: o.settings && typeof o.settings === 'object' ? o.settings : {},
      created_at: now, updated_at: now
    }, o);
    const sdb = scopedDb(db, shop.id);
    const staff = await sdb.insert('staff', {
      id: newId('st'), user_id: user.id, name: ownerName, role: 'owner', bookable: true, active: true,
      color: OWNER_COLOR, phone: phone || user.phone || null, commission_pct: 0, sort: 0, created_at: now, updated_at: now
    });
    const services = o.services === false ? [] : TEMPLATE_SERVICES.map((s, i) => Object.assign({
      id: newId('sv'), shop_id: shop.id, active: true, staff_ids: [], sort: i, created_at: now, updated_at: now
    }, s));
    if (services.length) await sdb.insertMany('services', services);
    const avail = [];
    for (let wd = 0; wd <= 6; wd++) for (const [start_min, end_min] of (DEFAULT_HOURS[wd] || [])) avail.push({ id: newId('av'), staff_id: staff.id, weekday: wd, start_min, end_min });
    if (avail.length) await sdb.insertMany('availability', avail);
    if (o.welcome !== false) {
      await notify(sdb, 'staff:' + staff.id, {
        type: 'system', title: '¡Bienvenido a TuBarbería!',
        body: name + ' ya está lista. Revisa tus servicios y horarios, invita a tu equipo y comparte tu enlace de reservas.',
        link: '#/ajustes', data: { kind: 'welcome', slug: shop.slug }
      });
    }
    return { shop, user, staff, services, user_created: userCreated };
  } catch (e) {
    // Sin transacciones en la interfaz de datos: limpieza best-effort para no dejar una barbería a medias.
    if (shop) {
      const sdb = scopedDb(db, shop.id);
      for (const t of ['notifications', 'availability', 'services', 'staff']) { try { await sdb.delete(t, {}); } catch (x) { /* nada */ } }
      try { await db.delete('shops', { id: shop.id }); } catch (x) { /* nada */ }
    }
    if (userCreated) { try { await db.delete('users', { id: user.id }); } catch (x) { /* nada */ } }
    throw e;
  }
}
async function insertShop(db, row, o) {
  const fixed = txt(o.slug) !== '';
  let slug = fixed ? slugify(o.slug) : await uniqueSlug(db, row.name, o);
  if (fixed) {
    if (!o.allow_reserved && RESERVED_SLUGS.includes(slug)) throw bad('Ese enlace está reservado. Elige otro.', { slug: 'Ese enlace está reservado. Elige otro.' });
    if (await db.findOne('shops', { slug })) throw conflict('Ese enlace ya lo usa otra barbería. Elige otro.', 'duplicate');
  }
  for (let i = 0; ; i++) {
    try { return await db.insert('shops', Object.assign({}, row, { id: newId('sh'), slug })); } catch (e) {
      // Otra alta tomó el mismo slug al mismo tiempo: se busca el siguiente libre.
      if (fixed || i >= 3 || !(e instanceof HttpError && e.status === 409)) throw e;
      slug = await uniqueSlug(db, row.name, o);
    }
  }
}

// ── Handlers ──
async function login(ctx) {
  const b = body(ctx);
  const email = normEmail(b.email);
  const password = secret(b.password);
  const fields = {};
  const ee = emailError(email);
  if (ee) fields.email = ee;
  if (!password) fields.password = 'Escribe tu contraseña.';
  else if (password.length > MAX_PASSWORD) fields.password = BAD_LOGIN;
  failIf(fields);

  const db = ctx.db;
  const ip = ipOf(ctx);
  const kPw = 'pw:' + email;
  const kIp = ip ? 'ip:' + ip : null;
  await rateCheck(db, kPw, LIMITS.pw);
  if (kIp) await rateCheck(db, kIp, LIMITS.ip);

  const u = await db.findOne('users', { email });
  const ok = u && u.password_hash ? await verifySecret(password, u.password_hash) : await fakeVerify(password);
  if (!ok) {
    await rateFail(db, kPw, LIMITS.pw);
    if (kIp) await rateFail(db, kIp, LIMITS.ip);
    throw unauthorized(BAD_LOGIN);
  }
  await rateReset(db, kPw);
  if (u.status !== 'active') throw forbidden('Tu cuenta está desactivada. Contacta al administrador de la plataforma.');

  const now = nowIso();
  await db.update('users', { id: u.id }, { last_login_at: now });
  u.last_login_at = now;
  await dropCookieSession(ctx);
  const s = await openSession(ctx, { kind: 'password', user: u });
  return { user: publicUser(u), contexts: s.contexts, token: s.token };
}

async function pinLogin(ctx) {
  const b = body(ctx);
  const slug = txt(b.shop_slug).toLowerCase().slice(0, 60);
  const pin = txt(b.pin);
  const fields = {};
  if (!slug) fields.shop_slug = 'Indica la barbería.';
  if (!/^\d{4,6}$/.test(pin)) fields.pin = 'El PIN debe tener de 4 a 6 dígitos.';
  failIf(fields);

  const db = ctx.db;
  const shop = await db.findOne('shops', { slug });
  if (!shop) throw notFound('No encontramos esa barbería. Revisa el enlace.');
  if (shop.status !== 'active') throw forbidden('Esta barbería está suspendida. Contacta a soporte.');

  const ip = ipOf(ctx);
  const kPin = 'pin:' + shop.id + ':' + ip;
  const kIp = ip ? 'ip:' + ip : null;
  await rateCheck(db, kPin, LIMITS.pin);
  if (kIp) await rateCheck(db, kIp, LIMITS.ip);

  // Solo el equipo activo de ESTA barbería (scopedDb) con PIN configurado.
  const sdb = scopedDb(db, shop.id);
  const candidates = await sdb.find('staff', { active: true, pin_hash: { isNull: false } }, { order: ['sort asc', 'created_at asc'] });
  let st = null;
  for (const s of candidates) if (await verifySecret(pin, s.pin_hash)) { st = s; break; }
  if (!st) {
    await rateFail(db, kPin, LIMITS.pin);
    if (kIp) await rateFail(db, kIp, LIMITS.ip);
    throw unauthorized('PIN incorrecto.');
  }
  await rateReset(db, kPin);
  if (st.user_id) {
    const u = await db.findOne('users', { id: st.user_id });
    if (u && u.status !== 'active') throw forbidden('Tu cuenta está desactivada. Habla con el dueño de la barbería.');
  }
  await dropCookieSession(ctx);
  const s = await openSession(ctx, { kind: 'pin', staff: st, shop });
  return { user: null, staff: { id: st.id, name: st.name, role: st.role, shop_id: shop.id }, contexts: s.contexts, token: s.token };
}

// Ficha de cliente para una cuenta nueva. Solo se reclama una ficha existente si su correo coincide y no
// tiene cuenta; nunca por teléfono (evita que alguien se adueñe del historial de otra persona).
export async function linkClientAccount(db, shop, user, { name, email, phone }) {
  const sdb = scopedDb(db, shop.id);
  const now = nowIso();
  let c = email ? await sdb.findOne('clients', { email, user_id: null, deleted_at: null }) : null;
  if (c) {
    const patch = { user_id: user.id, updated_at: now };
    if (!c.phone && phone) patch.phone = phone;
    // user_id: null en el where: si otra petición la reclamó al mismo tiempo, no se pisa.
    if (await sdb.update('clients', { id: c.id, user_id: null }, patch)) return { client: Object.assign(c, patch), created: false };
  }
  c = await sdb.insert('clients', {
    id: newId('cl'), user_id: user.id, name, phone: phone || null, email: email || null, tags: [], source: 'online',
    marketing_ok: true, created_at: now, updated_at: now
  });
  await notify(sdb, 'owners', {
    type: 'client_new', title: 'Nuevo cliente registrado', body: name + ' creó su cuenta para reservar en línea.',
    link: '#/clientes?id=' + c.id, data: { client_id: c.id }
  });
  return { client: c, created: true };
}

async function register(ctx) {
  const b = body(ctx);
  const name = txt(b.name);
  const email = normEmail(b.email);
  const password = secret(b.password);
  const phone = optionalPhone(b.phone);
  const slug = txt(b.shop_slug).toLowerCase().slice(0, 60);
  const fields = {};
  const ne = nameError(name, { max: 120, empty: 'Escribe tu nombre.' });
  if (ne) fields.name = ne;
  const ee = emailError(email);
  if (ee) fields.email = ee;
  const pe = passwordError(password);
  if (pe) fields.password = pe;
  if (phone === null) fields.phone = 'El teléfono debe tener 10 dígitos.';
  failIf(fields);

  const db = ctx.db;
  const ip = ipOf(ctx);
  if (ip) {
    await rateCheck(db, 'reg:' + ip, LIMITS.reg);
    await rateFail(db, 'reg:' + ip, LIMITS.reg); // cuenta cada intento, no solo los fallidos
  }
  let shop = null;
  if (slug) {
    shop = await db.findOne('shops', { slug });
    if (!shop) throw notFound('No encontramos esa barbería. Revisa el enlace.');
    if (shop.status !== 'active') throw forbidden('Esta barbería no está recibiendo registros por ahora.');
  }
  if (await db.findOne('users', { email })) throw conflict(DUP_EMAIL, 'duplicate');

  const now = nowIso();
  const user = await db.insert('users', {
    id: newId('us'), email, name, phone: phone || null, password_hash: await hashSecret(password),
    is_superadmin: false, status: 'active', created_at: now, last_login_at: now
  });
  if (shop) await linkClientAccount(db, shop, user, { name, email, phone });
  await dropCookieSession(ctx);
  const s = await openSession(ctx, { kind: 'password', user });
  return { user: publicUser(user), contexts: s.contexts, token: s.token };
}

async function signup(ctx) {
  if (ctx.env.ALLOW_SIGNUP === '0') throw forbidden('El registro de nuevas barberías está desactivado por ahora. Escríbenos para darte de alta.');
  const b = body(ctx);
  const shopName = txt(b.shop_name);
  const ownerName = txt(b.owner_name);
  const email = normEmail(b.email);
  const password = secret(b.password);
  const phone = optionalPhone(b.phone);
  const city = txt(b.city);
  const tz = txt(b.timezone);
  const fields = {};
  const sn = nameError(shopName, { max: 80, empty: 'Escribe el nombre de tu barbería.', label: 'El nombre de la barbería' });
  if (sn) fields.shop_name = sn;
  const on = nameError(ownerName, { max: 120, empty: 'Escribe tu nombre.' });
  if (on) fields.owner_name = on;
  const ee = emailError(email);
  if (ee) fields.email = ee;
  const pe = passwordError(password);
  if (pe) fields.password = pe;
  if (phone === null) fields.phone = 'El teléfono debe tener 10 dígitos.';
  if (city.length > 80) fields.city = 'La ciudad es demasiado larga (máximo 80 caracteres).';
  if (tz && !isTimeZone(tz)) fields.timezone = 'Zona horaria no válida.';
  failIf(fields);

  const db = ctx.db;
  const ip = ipOf(ctx);
  if (ip) {
    await rateCheck(db, 'signup:' + ip, LIMITS.signup);
    await rateFail(db, 'signup:' + ip, LIMITS.signup);
  }
  if (await db.findOne('users', { email })) throw conflict(DUP_EMAIL, 'duplicate');

  const r = await createShopWithOwner(db, {
    name: shopName, owner_name: ownerName, email, password, phone, city, timezone: tz || DEFAULT_TIMEZONE, plan: 'basic',
    last_login_at: nowIso()
  });
  await dropCookieSession(ctx);
  const s = await openSession(ctx, { kind: 'password', user: r.user });
  return { user: publicUser(r.user), contexts: s.contexts, shop: r.shop, token: s.token };
}

async function logout(ctx) {
  if (ctx.token) await destroySession(ctx.db, ctx.token);
  ctx.setCookie(COOKIE, '', { maxAge: 0 });
  return null;
}

async function me(ctx) {
  const s = ctx.session;
  let staff = null;
  if (s.kind === 'pin') {
    const st = s.shop_id ? await scopedDb(ctx.db, s.shop_id).findOne('staff', { id: s.staff_id }) : null;
    if (!st || !st.active) {
      await destroySession(ctx.db, ctx.token);
      ctx.setCookie(COOKIE, '', { maxAge: 0 });
      throw unauthorized('Tu acceso fue desactivado. Habla con el dueño de la barbería.');
    }
    staff = { id: st.id, name: st.name, role: st.role, shop_id: st.shop_id };
  }
  return { user: publicUser(ctx.user), staff, contexts: ctx.contexts, session_kind: s.kind };
}

async function profile(ctx) {
  const u = requireUser(ctx);
  const b = body(ctx);
  const patch = {};
  const fields = {};
  if (b.name !== undefined) {
    const name = txt(b.name);
    const ne = nameError(name, { max: 120, empty: 'Escribe tu nombre.' });
    if (ne) fields.name = ne; else patch.name = name;
  }
  if (b.phone !== undefined) {
    const phone = optionalPhone(b.phone);
    if (phone === null) fields.phone = 'El teléfono debe tener 10 dígitos.'; else patch.phone = phone || null;
  }
  failIf(fields);
  if (!Object.keys(patch).length) throw bad('No hay cambios que guardar.');
  await ctx.db.update('users', { id: u.id }, patch);
  return { user: publicUser(Object.assign({}, u, patch)) };
}

async function changePassword(ctx) {
  const u = requireUser(ctx);
  const b = body(ctx);
  const current = secret(b.current);
  const next = secret(b.next);
  const fields = {};
  if (!current) fields.current = 'Escribe tu contraseña actual.';
  const pe = passwordError(next);
  if (pe) fields.next = pe;
  else if (next === current) fields.next = 'La nueva contraseña debe ser distinta a la actual.';
  failIf(fields);

  // Mismo límite que el login: una sesión robada no puede adivinar la contraseña actual sin freno.
  const key = 'pw:' + u.email;
  await rateCheck(ctx.db, key, LIMITS.pw);
  if (current.length > MAX_PASSWORD || !(await verifySecret(current, u.password_hash))) {
    await rateFail(ctx.db, key, LIMITS.pw);
    throw bad('Tu contraseña actual no es correcta.', { current: 'Tu contraseña actual no es correcta.' });
  }
  await rateReset(ctx.db, key);
  await ctx.db.update('users', { id: u.id }, { password_hash: await hashSecret(next) });
  // Cierra todas las demás sesiones del usuario (otros dispositivos); la actual sigue activa.
  await ctx.db.delete('sessions', { user_id: u.id, id: { ne: ctx.session.id } });
  return null;
}

export const routes = [
  { method: 'POST', path: '/api/auth/login', auth: 'public', handler: login },
  { method: 'POST', path: '/api/auth/pin', auth: 'public', handler: pinLogin },
  { method: 'POST', path: '/api/auth/register', auth: 'public', handler: register },
  { method: 'POST', path: '/api/auth/signup', auth: 'public', handler: signup },
  { method: 'POST', path: '/api/auth/logout', auth: 'public', handler: logout },
  { method: 'GET', path: '/api/auth/me', auth: 'user', handler: me },
  { method: 'PATCH', path: '/api/auth/profile', auth: 'user', handler: profile },
  { method: 'POST', path: '/api/auth/password', auth: 'user', handler: changePassword }
];
