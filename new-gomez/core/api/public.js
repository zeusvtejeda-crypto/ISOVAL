// Rutas públicas (sin sesión): página de la barbería, días/horarios libres, reserva en línea y
// enlace "gestionar mi cita" (token secreto; en la base solo vive su sha256).
import { bad, notFound, conflict, nowInTz, int, clamp, addDays, omit } from '../util.js';
import { scopedDb } from '../db.js';
import { sha256Hex, newToken } from '../crypto.js';
import { rateCheck, rateFail } from '../session.js';
import { shopSettings } from '../domain/settings.js';
import { publicShopView, publicApptView } from '../domain/views.js';
import { findOrCreateClient } from '../domain/clients.js';
import { sendBookingEmail } from '../domain/email.js';
import { loadAgenda, candidates, offersAll, computeSlots, computeDays } from '../domain/slots.js';
import {
  ACTIVE, failIf, parseIds, parseStart, parseDateField, parseContact, textField, loadServices, createAppointment,
  changeStatus, reschedule, notifyNew, managePolicy, assertClientCan
} from '../domain/appointments.js';

export const BOOK_LIMIT = { max: 15, windowMin: 60, lockMin: 60 };

// ── Barbería ──
async function shopBySlug(db, slug) {
  const s = slug ? await db.findOne('shops', { slug: String(slug).toLowerCase().slice(0, 60) }) : null;
  if (!s) throw notFound('No encontramos esa barbería.');
  if (s.status !== 'active') throw notFound('Esta barbería no está disponible.');
  return s;
}
function normHost(h) { return String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, ''); }

async function shopPayload(db, shop) {
  const sdb = scopedDb(db, shop.id);
  const [services, staff] = await Promise.all([
    sdb.find('services', { active: true }, { order: ['sort asc', 'name asc'] }),
    sdb.find('staff', { active: true, bookable: true }, { order: ['sort asc', 'name asc'] })
  ]);
  return {
    shop: publicShopView(shop),
    services: services.map((s) => ({ id: s.id, name: s.name, description: s.description || '', category: s.category || '', duration_min: s.duration_min, price: s.price, popular: !!s.popular, staff_ids: Array.isArray(s.staff_ids) ? s.staff_ids : [] })),
    staff: staff.map((s) => ({ id: s.id, name: s.name, avatar_url: s.avatar_url || '', bio: s.bio || '', color: s.color || '' }))
  };
}

// Contexto de dominio para una barbería resuelta por slug/token (el shop_id sale de la base, nunca del cliente).
function scope(ctx, shop, actor) {
  return { sdb: scopedDb(ctx.db, shop.id), shop, now: nowInTz(shop.timezone), env: ctx.env, actor: actor || ctx.actor };
}

// Servicios + barbero pedidos para días/horarios/reserva. staff: 'any' | id (validado).
async function bookingInput(c, ag, { services: rawServices, staff }, { requireServices = true } = {}) {
  const st = shopSettings(c.shop);
  const ids = parseIds(rawServices);
  let services;
  if (ids.length || requireServices) services = await loadServices(c.sdb, ids);
  else {
    // Sin servicios (vista previa del calendario): se usa el servicio activo más corto.
    const all = await c.sdb.find('services', { active: true });
    const min = all.reduce((m, s) => Math.min(m, s.duration_min || m), Infinity);
    services = [{ duration_min: Number.isFinite(min) ? min : ag.step, staff_ids: null }];
  }
  const duration = services.reduce((m, s) => m + (Number(s.duration_min) || 0), 0);
  const cands = candidates(ag, services, { bookable: true });
  const want = staff == null || staff === '' ? 'any' : String(staff);
  let staffIds;
  if (want === 'any') {
    if (!st.booking.allow_any_staff) throw bad('Elige un barbero.', { staff: 'Elige un barbero.' });
    staffIds = cands.map((s) => s.id);
  } else {
    if (!cands.some((s) => s.id === want)) throw bad('Ese barbero no está disponible para esos servicios. Elige otro.', { staff: 'Barbero no disponible.' });
    staffIds = [want];
  }
  return { services, duration, staffIds, staff: want };
}

async function home(ctx) {
  const host = normHost(ctx.req.query.host || ctx.req.headers['x-forwarded-host'] || ctx.req.headers.host);
  let shop = null;
  if (host && host.includes('.')) {
    const rows = await ctx.db.find('shops', { domain: { in: [host, 'www.' + host] }, status: 'active' });
    shop = rows[0] || null;
  }
  if (!shop) {
    const s = await ctx.db.findOne('shops', { slug: ctx.env.DEFAULT_SHOP_SLUG || 'new-gomez' });
    if (s && s.status === 'active') shop = s;
  }
  if (!shop) shop = (await ctx.db.find('shops', { status: 'active' }, { order: 'created_at asc', limit: 1 }))[0] || null;
  if (!shop) throw notFound('Todavía no hay barberías disponibles.');
  return shopPayload(ctx.db, shop);
}

async function shopInfo(ctx) { return shopPayload(ctx.db, await shopBySlug(ctx.db, ctx.params.slug)); }

async function days(ctx) {
  const shop = await shopBySlug(ctx.db, ctx.params.slug);
  const c = scope(ctx, shop);
  const q = ctx.req.query;
  let from = q.from ? parseDateField(q.from) : c.now.date;
  if (!from) throw bad('La fecha de inicio no es válida.', { from: 'Usa el formato AAAA-MM-DD.' });
  if (from < c.now.date) from = c.now.date;
  const n = clamp(int(q.days, 14), 1, 60);
  const to = addDays(from, n - 1);
  const ag = await loadAgenda(c.sdb, shop, { from, to });
  const inp = await bookingInput(c, ag, q, { requireServices: false });
  return { days: computeDays(ag, { from, days: n, duration: inp.duration, staffIds: inp.staffIds, now: c.now, mode: 'public' }) };
}

async function slots(ctx) {
  const shop = await shopBySlug(ctx.db, ctx.params.slug);
  const c = scope(ctx, shop);
  const date = parseDateField(ctx.req.query.date);
  if (!date) throw bad('Elige una fecha válida.', { date: 'Usa el formato AAAA-MM-DD.' });
  const ag = await loadAgenda(c.sdb, shop, { from: date, to: date });
  const inp = await bookingInput(c, ag, ctx.req.query);
  return computeSlots(ag, { date, duration: inp.duration, staffIds: inp.staffIds, now: c.now, mode: 'public' });
}

// Envía el aviso por correo sin romper la reserva (en Workers usa waitUntil si el adaptador lo expone).
async function emailSafe(ctx, shop, appt, staffName) {
  if (ctx.env.MODE === 'demo') return;
  try {
    const view = Object.assign(omit(appt, ['manage_token_hash']), { staff_name: staffName, staff_color: '', paid: 0, balance: appt.total });
    const p = Promise.resolve().then(() => sendBookingEmail(ctx.env, shop, view)).catch(() => null);
    const wait = ctx.waitUntil || (ctx.env && ctx.env.waitUntil);
    if (typeof wait === 'function') wait(p);
    else await Promise.race([p, new Promise((r) => setTimeout(r, 4000))]);
  } catch (e) { /* el correo nunca rompe la reserva */ }
}

async function book(ctx) {
  const shop = await shopBySlug(ctx.db, ctx.params.slug);
  const st = shopSettings(shop);
  const rateKey = 'book:' + (ctx.req.ip || 'unknown');
  await rateCheck(ctx.db, rateKey, BOOK_LIMIT);
  if (!st.booking.online_enabled) throw bad('Por ahora esta barbería no recibe reservas en línea. Comunícate por teléfono o WhatsApp.');
  const c = scope(ctx, shop, { id: null, name: 'Cliente (en línea)', kind: 'public' });
  const b = ctx.req.body || {};
  const errs = {};
  const contact = parseContact(errs, b, { requirePhone: st.booking.require_phone });
  const note = textField(errs, 'note', b.note, 500, 'La nota');
  const date = parseDateField(b.date);
  if (!date) errs.date = 'Elige una fecha válida.';
  const start = parseStart(b.start_min);
  if (start == null) errs.start_min = 'Elige un horario.';
  const ids = parseIds(b.services);
  if (!ids.length) errs.services = 'Elige al menos un servicio.';
  const staffWanted = b.staff_id == null || b.staff_id === '' ? 'any' : String(b.staff_id);
  if (staffWanted === 'any' && !st.booking.allow_any_staff) errs.staff_id = 'Elige un barbero.';
  failIf(errs);
  const services = await loadServices(c.sdb, ids);
  if (staffWanted !== 'any') {
    const stf = await c.sdb.findOne('staff', { id: staffWanted });
    if (!stf || !stf.active || !stf.bookable || !offersAll(stf.id, services)) throw bad('Ese barbero no está disponible para esos servicios. Elige otro.', { staff_id: 'Barbero no disponible.' });
  }

  // Doble envío / reserva repetida: mismo teléfono, misma fecha y hora, activa.
  if (contact.phone) {
    const dup = await c.sdb.findOne('appointments', { client_phone: contact.phone, date, start_min: start, status: { in: ACTIVE } });
    if (dup) throw conflict('Ya tienes una cita reservada en ese horario. Revisa tu confirmación.', 'duplicate');
  }

  // Sesión: si es un usuario (no personal de esta barbería), la ficha queda vinculada a su cuenta.
  const isTeam = ctx.user && (ctx.user.is_superadmin || ctx.contexts.some((x) => x.shop_id === shop.id && x.role !== 'client'));
  const user_id = ctx.user && !isTeam ? ctx.user.id : null;
  const getClient = async () => {
    const { client, created } = await findOrCreateClient(c.sdb, { name: contact.name, phone: contact.phone, email: contact.email, user_id, source: 'online' });
    let first_visit = true;
    if (!created) {
      const prev = await c.sdb.count('appointments', { client_id: client.id, status: 'completed' });
      first_visit = prev === 0 ? (b.first_visit == null ? true : !!b.first_visit) : false;
    }
    return { client, first_visit };
  };

  const token = newToken();
  const appt = await createAppointment(c, {
    staff_id: staffWanted, date, start_min: start, services, getClient, client_name: contact.name, client_phone: contact.phone,
    client_note: note || null, status: st.booking.auto_confirm ? 'confirmed' : 'pending', source: 'online', created_by: 'online',
    mode: 'public', manage_token_hash: await sha256Hex(token)
  });
  await rateFail(ctx.db, rateKey, BOOK_LIMIT); // cuenta cada reserva hecha desde esta IP
  const staff = await c.sdb.findOne('staff', { id: appt.staff_id });
  await notifyNew(c, appt, { online: true });
  await emailSafe(ctx, shop, appt, staff ? staff.name : '');
  return { appointment: publicApptView(appt, shop, staff ? staff.name : ''), manage_token: token };
}

// ── Enlace de gestión ──
// El token identifica la cita en cualquier barbería: la búsqueda es global por hash (secreto de 40
// caracteres) y todo lo demás se hace con scope de la barbería de ESA cita.
async function byToken(ctx) {
  const token = String(ctx.params.token || '');
  if (!/^[A-Za-z0-9]{20,80}$/.test(token)) throw notFound('No encontramos esa cita. Revisa el enlace.');
  const a = await ctx.db.findOne('appointments', { manage_token_hash: await sha256Hex(token) });
  if (!a) throw notFound('No encontramos esa cita. Revisa el enlace.');
  const shop = await ctx.db.findOne('shops', { id: a.shop_id });
  if (!shop || shop.status !== 'active') throw notFound('Esta barbería no está disponible.');
  const c = scope(ctx, shop, { id: a.client_id, name: a.client_name || 'Cliente', kind: 'client' });
  return { a, shop, c };
}
async function tokenView(c, a) {
  const staff = await c.sdb.findOne('staff', { id: a.staff_id });
  return Object.assign({ appointment: publicApptView(a, c.shop, staff ? staff.name : '') }, managePolicy(a, c.shop, c.now));
}

async function manageGet(ctx) { const { a, c } = await byToken(ctx); return tokenView(c, a); }

async function manageCancel(ctx) {
  const { a, shop, c } = await byToken(ctx);
  const b = ctx.req.body || {};
  const errs = {};
  const reason = textField(errs, 'reason', b.reason, 300, 'El motivo');
  failIf(errs);
  assertClientCan(a, shop, c.now, 'cancel');
  const out = await changeStatus(c, a, 'cancelled', { reason, by: 'client' });
  return tokenView(c, out);
}

async function manageReschedule(ctx) {
  const { a, shop, c } = await byToken(ctx);
  const b = ctx.req.body || {};
  const errs = {};
  const date = parseDateField(b.date);
  if (!date) errs.date = 'Elige una fecha válida.';
  const start = parseStart(b.start_min);
  if (start == null) errs.start_min = 'Elige un horario.';
  const staff_id = b.staff_id == null || b.staff_id === '' ? null : String(b.staff_id);
  if (staff_id === 'any' && !shopSettings(shop).booking.allow_any_staff) errs.staff_id = 'Elige un barbero.';
  failIf(errs);
  assertClientCan(a, shop, c.now, 'reschedule');
  const out = await reschedule(c, a, { date, start_min: start, staff_id, mode: 'public', by: 'client' });
  return tokenView(c, out);
}

export const routes = [
  { method: 'GET', path: '/api/public/home', auth: 'public', handler: home },
  { method: 'GET', path: '/api/public/shops/:slug', auth: 'public', handler: shopInfo },
  { method: 'GET', path: '/api/public/shops/:slug/days', auth: 'public', handler: days },
  { method: 'GET', path: '/api/public/shops/:slug/slots', auth: 'public', handler: slots },
  { method: 'POST', path: '/api/public/shops/:slug/appointments', auth: 'public', handler: book },
  { method: 'GET', path: '/api/public/appointments/:token', auth: 'public', handler: manageGet },
  { method: 'POST', path: '/api/public/appointments/:token/cancel', auth: 'public', handler: manageCancel },
  { method: 'POST', path: '/api/public/appointments/:token/reschedule', auth: 'public', handler: manageReschedule }
];
