// Portal del cliente (rol client): sus citas en ESTA barbería, cancelar/reagendar con la política
// cancel_hours y su perfil. La ficha sale de la sesión (ctx.client), nunca del cuerpo de la petición.
// La lista trae además un resumen de las próximas citas en sus OTRAS barberías (misma cuenta), para avisarle.
import { notFound, conflict, nowIso, normPhone, isPhone, isDateKey, nowInTz, addDays } from '../util.js';
import { scopedDb } from '../db.js';
import { publicApptView } from '../domain/views.js';
import { shopSettings } from '../domain/settings.js';
import {
  ACTIVE, failIf, parseStart, parseDateField, textField, cleanText, changeStatus, reschedule, managePolicy, assertClientCan, minutesUntil,
  clientReschedules
} from '../domain/appointments.js';

const PERM = 'my.appointments';
const PAST_LIMIT = 100;

function me(ctx) {
  if (!ctx.client || ctx.client.deleted_at) throw notFound('No encontramos tu ficha de cliente en esta barbería.');
  return ctx.client;
}
const dom = (ctx) => ({ sdb: ctx.sdb, shop: ctx.shop, now: ctx.now(), actor: ctx.actor, env: ctx.env });

async function myAppt(ctx) {
  const cl = me(ctx);
  const a = await ctx.sdb.findOne('appointments', { id: String(ctx.params.id || ''), client_id: cl.id });
  if (!a) throw notFound('No encontramos esa cita.');
  return a;
}
// Reagendas hechas por el cliente (el límite no cuenta los movimientos del equipo).
const movesOf = async (ctx, a) => (await clientReschedules(ctx.sdb, [a.id]))[a.id];
async function view(ctx, a, withPolicy) {
  const st = await ctx.sdb.findOne('staff', { id: a.staff_id });
  const v = publicApptView(a, ctx.shop, st ? st.name : '');
  return withPolicy ? Object.assign(v, managePolicy(a, ctx.shop, ctx.now(), await movesOf(ctx, a))) : v;
}

// Próximas: activas que aún no terminan (hora local de su barbería).
const isUpcoming = (a, now) => ACTIVE.includes(a.status) && minutesUntil(a, now) + (a.end_min - a.start_min) > 0;

async function list(ctx) {
  const cl = me(ctx);
  const now = ctx.now();
  const [rows, staff, elsewhere] = await Promise.all([
    ctx.sdb.find('appointments', { client_id: cl.id }, { order: ['date asc', 'start_min asc'] }),
    ctx.sdb.find('staff', {}),
    upcomingElsewhere(ctx)
  ]);
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  const moves = await clientReschedules(ctx.sdb, rows.filter((a) => isUpcoming(a, now)).map((a) => a.id));
  const upcoming = [], past = [];
  for (const a of rows) {
    const v = publicApptView(a, ctx.shop, names[a.staff_id] || '');
    if (isUpcoming(a, now)) upcoming.push(Object.assign(v, managePolicy(a, ctx.shop, now, moves[a.id])));
    else past.push(v);
  }
  return { upcoming, past: past.reverse().slice(0, PAST_LIMIT), elsewhere };
}

// Otras barberías donde esta cuenta también es cliente y tiene citas próximas:
// [{ shop_id, shop_slug, shop_name, shop_logo, count, next }] (next = su cita más cercana, vista pública).
// Cada barbería se lee con SU scopedDb y la ficha de cliente de SU contexto; las suspendidas no se muestran.
async function upcomingElsewhere(ctx) {
  const out = [];
  for (const c of ctx.contexts || []) {
    if (c.role !== 'client' || !c.client_id || c.shop_id === ctx.shop.id || c.shop_status === 'suspended') continue;
    const shop = await ctx.db.findOne('shops', { id: c.shop_id });
    if (!shop || shop.status === 'suspended') continue;
    const sdb = scopedDb(ctx.db, shop.id);
    const now = nowInTz(shop.timezone);
    const rows = await sdb.find('appointments', { client_id: c.client_id, status: { in: ACTIVE }, date: { gte: addDays(now.date, -1) } }, { order: ['date asc', 'start_min asc'] });
    const up = rows.filter((a) => isUpcoming(a, now));
    if (!up.length) continue;
    const st = await sdb.findOne('staff', { id: up[0].staff_id });
    out.push({ shop_id: shop.id, shop_slug: shop.slug, shop_name: shop.name, shop_logo: shop.logo_url || '', count: up.length, next: publicApptView(up[0], shop, st ? st.name : '') });
  }
  return out.sort((a, b) => (a.next.date + String(a.next.start_min).padStart(4, '0')).localeCompare(b.next.date + String(b.next.start_min).padStart(4, '0')));
}

async function cancel(ctx) {
  const a = await myAppt(ctx);
  const errs = {};
  const reason = textField(errs, 'reason', (ctx.req.body || {}).reason, 300, 'El motivo');
  failIf(errs);
  const c = dom(ctx);
  assertClientCan(a, ctx.shop, c.now, 'cancel');
  const out = await changeStatus(c, a, 'cancelled', { reason, by: 'client' });
  return { appointment: await view(ctx, out, true) };
}

async function move(ctx) {
  const a = await myAppt(ctx);
  const b = ctx.req.body || {};
  const errs = {};
  const date = parseDateField(b.date);
  if (!date) errs.date = 'Elige una fecha válida.';
  const start = parseStart(b.start_min);
  if (start == null) errs.start_min = 'Elige un horario.';
  const staff_id = b.staff_id == null || b.staff_id === '' ? null : String(b.staff_id);
  if (staff_id === 'any' && !shopSettings(ctx.shop).booking.allow_any_staff) errs.staff_id = 'Elige un barbero.';
  failIf(errs);
  const c = dom(ctx);
  assertClientCan(a, ctx.shop, c.now, 'reschedule', await movesOf(ctx, a));
  const out = await reschedule(c, a, { date, start_min: start, staff_id, mode: 'public', by: 'client' });
  return { appointment: await view(ctx, out, true) };
}

// Vista segura de la ficha (sin notas internas ni etiquetas del equipo).
const clientView = (c) => ({ id: c.id, name: c.name, phone: c.phone || '', email: c.email || '', birthday: c.birthday || '', marketing_ok: !!c.marketing_ok, created_at: c.created_at });

async function profile(ctx) {
  const cl = me(ctx);
  const b = ctx.req.body || {};
  const errs = {};
  const patch = {};
  if (b.name !== undefined) {
    const name = cleanText(b.name, 200);
    if (name.length < 2 || name.length > 80) errs.name = 'Escribe tu nombre (2 a 80 caracteres).';
    else patch.name = name;
  }
  if (b.phone !== undefined) {
    const phone = normPhone(b.phone);
    if (!isPhone(phone)) errs.phone = 'Escribe un teléfono de 10 dígitos.';
    else if (phone !== cl.phone) patch.phone = phone;
  }
  if (b.marketing_ok !== undefined) {
    if (typeof b.marketing_ok !== 'boolean') errs.marketing_ok = 'Valor no válido.';
    else patch.marketing_ok = b.marketing_ok;
  }
  if (b.birthday !== undefined) {
    if (b.birthday === null || b.birthday === '') patch.birthday = null;
    else if (!isDateKey(b.birthday) || b.birthday > ctx.now().date) errs.birthday = 'Fecha de nacimiento no válida.';
    else patch.birthday = b.birthday;
  }
  failIf(errs);
  if (patch.phone) {
    const other = await ctx.sdb.findOne('clients', { phone: patch.phone, deleted_at: null, id: { ne: cl.id } });
    if (other) throw conflict('Ese teléfono ya está registrado con otro cliente. Comunícate con la barbería para unir tus datos.', 'duplicate');
  }
  if (!Object.keys(patch).length) return { client: clientView(cl) };
  patch.updated_at = nowIso();
  await ctx.sdb.update('clients', { id: cl.id }, patch);
  return { client: clientView(Object.assign({}, cl, patch)) };
}

export const routes = [
  { method: 'GET', path: '/api/my/appointments', auth: 'shop', perm: PERM, handler: list },
  { method: 'POST', path: '/api/my/appointments/:id/cancel', auth: 'shop', perm: PERM, handler: cancel },
  { method: 'POST', path: '/api/my/appointments/:id/reschedule', auth: 'shop', perm: PERM, handler: move },
  { method: 'PATCH', path: '/api/my/profile', auth: 'shop', perm: PERM, handler: profile }
];
