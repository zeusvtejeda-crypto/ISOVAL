// Plataforma (superadmin): métricas globales, barberías y usuarios. Ver docs/API.md → "Plataforma".
// Única zona que lee tablas por barbería con ctx.db SIN scope (permitido solo con auth 'platform').
import { bad, notFound, conflict, normEmail, nowIso, nowInTz, addDays, money, int, clamp } from '../util.js';
import { publicUser } from '../session.js';
import { createShopWithOwner, txt, failIf, passwordError, emailError, nameError, optionalPhone, isTimeZone, PLANS, DEFAULT_TIMEZONE } from './auth.js';
import { hashSecret } from '../crypto.js';

const SHOP_STATUS = ['active', 'suspended'];
const USER_STATUS = ['active', 'disabled'];
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const IN_CHUNK = 80;       // D1 admite ~100 parámetros por sentencia
const TOP_CANDIDATES = 20; // barberías a las que se cuentan citas para el top (ver stats)

// Presupuesto de consultas: D1 permite 50 consultas por invocación en el plan gratuito (1000 en el de pago),
// y la interfaz de datos no agrupa (sin GROUP BY). Por eso aquí se evita "una consulta por barbería" salvo
// donde es inevitable (clientes por barbería en una página acotada del listado).

const body = (ctx) => { const b = ctx.req.body; return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; };
// D1 limita los patrones LIKE a 50 bytes: el término de búsqueda se recorta por bytes (UTF-8).
const enc = new TextEncoder();
function term(v) {
  let s = txt(v).replace(/[%_]/g, '');
  while (s && enc.encode(s).length > 40) s = s.slice(0, -1);
  return s;
}
const like = (cols, q) => ({ $or: cols.map((c) => ({ [c]: { like: q } })) });

// Últimos 30 días (incluye hoy) en fechas locales 'YYYY-MM-DD'; la plataforma usa la zona de México.
function last30() {
  const to = nowInTz(DEFAULT_TIMEZONE).date;
  return { from: addDays(to, -29), to, since_iso: new Date(Date.now() - 30 * 86400000).toISOString() };
}
// find con una lista IN larga partida en trozos (evita el escaneo completo de db-d1 con listas > 80).
async function findIn(db, table, col, ids, where, opts) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  const out = [];
  for (let i = 0; i < uniq.length; i += IN_CHUNK) {
    out.push(...await db.find(table, Object.assign({}, where || {}, { [col]: { in: uniq.slice(i, i + IN_CHUNK) } }), opts));
  }
  return out;
}
// Citas "reales" del periodo: todas menos las canceladas (no_show sí cuenta: ocupó agenda).
const apptWhere = (r, shopId) => Object.assign(shopId ? { shop_id: shopId } : {}, { date: { gte: r.from, lte: r.to }, status: { ne: 'cancelled' } });
const payWhere = (r) => ({ status: 'paid', date: { gte: r.from, lte: r.to } });
function sumBy(rows, f) {
  const m = {};
  for (const x of rows) m[x.shop_id] = (m[x.shop_id] || 0) + f(x);
  return m;
}
const amountOf = (p) => Number(p.amount) || 0;

async function stats(ctx) {
  const db = ctx.db;
  const r = last30();
  const [shops, users, newUsers, clients, appointments, pays] = await Promise.all([
    db.find('shops', {}, { order: 'created_at desc' }), db.count('users'), db.count('users', { created_at: { gte: r.since_iso } }),
    db.count('clients', { deleted_at: null }), db.count('appointments', apptWhere(r)), db.find('payments', payWhere(r))
  ]);
  const rev = sumBy(pays, amountOf);
  // Top: se cuentan citas solo de las candidatas con más ingresos (acota consultas con muchas barberías).
  const cands = shops.slice().sort((a, b) => (rev[b.id] || 0) - (rev[a.id] || 0)).slice(0, TOP_CANDIDATES);
  const counts = await Promise.all(cands.map((s) => db.count('appointments', apptWhere(r, s.id))));
  const top = cands.map((s, i) => ({ id: s.id, slug: s.slug, name: s.name, status: s.status, plan: s.plan, appointments_30d: counts[i], revenue_30d: money(rev[s.id] || 0) }))
    .filter((s) => s.appointments_30d || s.revenue_30d)
    .sort((a, b) => b.revenue_30d - a.revenue_30d || b.appointments_30d - a.appointments_30d)
    .slice(0, 5);
  return {
    shops: shops.length,
    active_shops: shops.filter((s) => s.status === 'active').length,
    users,
    appointments_30d: appointments,
    revenue_30d: money(pays.reduce((a, p) => a + amountOf(p), 0)),
    top_shops: top,
    // extras (opcionales)
    suspended_shops: shops.filter((s) => s.status === 'suspended').length,
    new_shops_30d: shops.filter((s) => s.created_at >= r.since_iso).length,
    new_users_30d: newUsers,
    clients,
    range: { from: r.from, to: r.to }
  };
}

// Barberías con dueño, equipo, clientes y métricas de 30 días.
async function enrichShops(db, shops) {
  if (!shops.length) return [];
  const r = last30();
  const ids = shops.map((s) => s.id);
  const [staff, pays, appts, clients] = await Promise.all([
    findIn(db, 'staff', 'shop_id', ids, { active: true }, { order: 'created_at asc' }),
    findIn(db, 'payments', 'shop_id', ids, payWhere(r)),
    findIn(db, 'appointments', 'shop_id', ids, apptWhere(r)),
    Promise.all(shops.map((s) => db.count('clients', { shop_id: s.id, deleted_at: null })))
  ]);
  const owners = {};
  for (const s of staff) if (s.role === 'owner' && s.user_id && !owners[s.shop_id]) owners[s.shop_id] = s;
  const users = await findIn(db, 'users', 'id', Object.values(owners).map((s) => s.user_id));
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));
  const staffCount = sumBy(staff, () => 1);
  const apptCount = sumBy(appts, () => 1);
  const rev = sumBy(pays, amountOf);
  return shops.map((s, i) => {
    const ow = owners[s.id];
    const u = ow && userById[ow.user_id];
    return Object.assign({}, s, {
      owner_email: u ? u.email : '', owner_name: ow ? ow.name : '',
      staff_count: staffCount[s.id] || 0, clients_count: clients[i],
      appointments_30d: apptCount[s.id] || 0, revenue_30d: money(rev[s.id] || 0)
    });
  });
}

// Paginado (limit ≤ 200, 30 por defecto; offset). El total va en la cabecera x-total-count.
async function listShops(ctx) {
  const db = ctx.db;
  const q = term(ctx.req.query.q);
  const limit = clamp(int(ctx.req.query.limit, 30), 1, 200);
  const offset = clamp(int(ctx.req.query.offset, 0), 0, 1e6);
  let where = {};
  if (q) {
    where = like(['name', 'slug', 'city', 'domain', 'phone', 'email'], q);
    // También por correo/nombre del dueño.
    const us = await db.find('users', like(['email', 'name'], q), { limit: 50 });
    if (us.length) {
      const ow = await findIn(db, 'staff', 'user_id', us.map((u) => u.id), { role: 'owner' });
      const shopIds = [...new Set(ow.map((s) => s.shop_id))].slice(0, IN_CHUNK);
      if (shopIds.length) where.$or.push({ id: { in: shopIds } });
    }
  }
  const [shops, total] = await Promise.all([db.find('shops', where, { order: 'created_at desc', limit, offset }), db.count('shops', where)]);
  ctx.header('x-total-count', String(total));
  return enrichShops(db, shops);
}

async function createShop(ctx) {
  const db = ctx.db;
  const b = body(ctx);
  const name = txt(b.name);
  const ownerName = txt(b.owner_name);
  const ownerEmail = normEmail(b.owner_email);
  const password = typeof b.owner_password === 'string' ? b.owner_password : '';
  const phone = optionalPhone(b.phone);
  const city = txt(b.city);
  const slug = txt(b.slug).toLowerCase();
  const plan = b.plan == null || b.plan === '' ? 'basic' : b.plan;
  const tz = txt(b.timezone);
  const fields = {};
  const ne = nameError(name, { max: 80, empty: 'Escribe el nombre de la barbería.', label: 'El nombre de la barbería' });
  if (ne) fields.name = ne;
  const ee = emailError(ownerEmail, 'Escribe el correo del dueño.');
  if (ee) fields.owner_email = ee;
  // Si el correo ya tiene cuenta, se vincula como dueño sin tocar su contraseña.
  const existing = !ee ? await db.findOne('users', { email: ownerEmail }) : null;
  if (!existing) {
    const on = nameError(ownerName, { max: 120, empty: 'Escribe el nombre del dueño.' });
    if (on) fields.owner_name = on;
    const pe = passwordError(password);
    if (pe) fields.owner_password = pe;
  } else if (ownerName.length > 120) fields.owner_name = 'El nombre es demasiado largo (máximo 120 caracteres).';
  if (phone === null) fields.phone = 'El teléfono debe tener 10 dígitos.';
  if (city.length > 80) fields.city = 'La ciudad es demasiado larga (máximo 80 caracteres).';
  if (slug && !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) fields.slug = 'El enlace solo admite minúsculas, números y guiones (máximo 40).';
  if (!PLANS.includes(plan)) fields.plan = 'Plan no válido: usa demo, basic o pro.';
  if (tz && !isTimeZone(tz)) fields.timezone = 'Zona horaria no válida.';
  failIf(fields);

  const r = await createShopWithOwner(db, {
    name, slug: slug || undefined, owner_name: ownerName || (existing && existing.name), email: ownerEmail,
    password: existing ? undefined : password, user: existing || undefined, phone, city, plan, timezone: tz || DEFAULT_TIMEZONE
  });
  return { shop: r.shop, owner: publicUser(r.user), linked_existing: !!existing };
}

function normDomain(v) {
  return txt(v).toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/\.$/, '');
}

async function updateShop(ctx) {
  const db = ctx.db;
  const shop = await db.findOne('shops', { id: ctx.params.id });
  if (!shop) throw notFound('No encontramos esa barbería.');
  const b = body(ctx);
  const patch = {};
  const fields = {};
  if (b.status !== undefined) { if (SHOP_STATUS.includes(b.status)) patch.status = b.status; else fields.status = 'Estado no válido: usa active o suspended.'; }
  if (b.plan !== undefined) { if (PLANS.includes(b.plan)) patch.plan = b.plan; else fields.plan = 'Plan no válido: usa demo, basic o pro.'; }
  if (b.name !== undefined) {
    const name = txt(b.name);
    const ne = nameError(name, { max: 80, empty: 'Escribe el nombre de la barbería.', label: 'El nombre de la barbería' });
    if (ne) fields.name = ne; else patch.name = name;
  }
  if (b.domain !== undefined) {
    const d = b.domain === null ? '' : normDomain(b.domain);
    if (!d) patch.domain = null;
    else if (DOMAIN_RE.test(d)) patch.domain = d;
    else fields.domain = 'Dominio no válido. Ejemplo: mibarberia.com';
  }
  failIf(fields);
  if (!Object.keys(patch).length) throw bad('No hay cambios que guardar.');
  if (patch.domain && await db.findOne('shops', { domain: patch.domain, id: { ne: shop.id } })) {
    throw conflict('Ese dominio ya está asignado a otra barbería.', 'duplicate');
  }
  patch.updated_at = nowIso();
  await db.update('shops', { id: shop.id }, patch);
  return { shop: Object.assign({}, shop, patch) };
}

// Usuario para el panel de plataforma: datos públicos + estado + barberías donde participa.
async function userViews(db, users) {
  const ids = users.map((u) => u.id);
  const [staff, clients] = await Promise.all([
    findIn(db, 'staff', 'user_id', ids, { active: true }),
    findIn(db, 'clients', 'user_id', ids, { deleted_at: null })
  ]);
  const shops = await findIn(db, 'shops', 'id', staff.concat(clients).map((x) => x.shop_id));
  const shopById = Object.fromEntries(shops.map((s) => [s.id, s]));
  const byUser = {};
  const add = (uid, shopId, role) => {
    const sh = shopById[shopId];
    if (!sh) return;
    const list = byUser[uid] = byUser[uid] || [];
    if (!list.some((x) => x.shop_id === shopId)) list.push({ shop_id: sh.id, shop_slug: sh.slug, shop_name: sh.name, shop_status: sh.status, role });
  };
  for (const s of staff) add(s.user_id, s.shop_id, s.role);
  for (const c of clients) add(c.user_id, c.shop_id, 'client');
  return users.map((u) => Object.assign(publicUser(u), { status: u.status, last_login_at: u.last_login_at || null, has_password: !!u.password_hash, shops: byUser[u.id] || [] }));
}

async function listUsers(ctx) {
  const q = term(ctx.req.query.q);
  const limit = clamp(int(ctx.req.query.limit, 100), 1, 500);
  const offset = clamp(int(ctx.req.query.offset, 0), 0, 1e6);
  const where = q ? like(['email', 'name', 'phone'], q) : {};
  const [users, total] = await Promise.all([ctx.db.find('users', where, { order: 'created_at desc', limit, offset }), ctx.db.count('users', where)]);
  ctx.header('x-total-count', String(total));
  return userViews(ctx.db, users);
}

// Extra (no está en el contrato original): activar/desactivar una cuenta o fijarle contraseña (soporte).
async function updateUser(ctx) {
  const db = ctx.db;
  const u = await db.findOne('users', { id: ctx.params.id });
  if (!u) throw notFound('No encontramos ese usuario.');
  const b = body(ctx);
  const patch = {};
  const fields = {};
  if (b.status !== undefined) {
    if (!USER_STATUS.includes(b.status)) fields.status = 'Estado no válido: usa active o disabled.';
    else if (b.status === 'disabled' && u.id === ctx.user.id) fields.status = 'No puedes desactivar tu propia cuenta.';
    else patch.status = b.status;
  }
  if (b.password !== undefined) {
    const pe = passwordError(typeof b.password === 'string' ? b.password : '');
    if (pe) fields.password = pe; else patch.password_hash = await hashSecret(b.password);
  }
  if (b.name !== undefined) {
    const name = txt(b.name);
    const ne = nameError(name, { max: 120, empty: 'Escribe el nombre.' });
    if (ne) fields.name = ne; else patch.name = name;
  }
  failIf(fields);
  if (!Object.keys(patch).length) throw bad('No hay cambios que guardar.');
  await db.update('users', { id: u.id }, patch);
  // Desactivar o cambiar la contraseña cierra sus sesiones (salvo la del propio superadmin que hace el cambio).
  if (patch.status === 'disabled' || patch.password_hash) await db.delete('sessions', { user_id: u.id, id: { ne: ctx.session.id } });
  const [view] = await userViews(db, [Object.assign({}, u, patch)]);
  return { user: view };
}

const P = { auth: 'platform', perm: 'platform.manage' };
export const routes = [
  Object.assign({ method: 'GET', path: '/api/admin/stats', handler: stats }, P),
  Object.assign({ method: 'GET', path: '/api/admin/shops', handler: listShops }, P),
  Object.assign({ method: 'POST', path: '/api/admin/shops', handler: createShop }, P),
  Object.assign({ method: 'PATCH', path: '/api/admin/shops/:id', handler: updateShop }, P),
  Object.assign({ method: 'GET', path: '/api/admin/users', handler: listUsers }, P),
  Object.assign({ method: 'PATCH', path: '/api/admin/users/:id', handler: updateUser }, P)
];
