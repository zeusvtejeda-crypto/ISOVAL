// Agenda del panel: horarios libres, listado/detalle, alta, edición y cambios de estado.
// Barbero (permisos .own): solo su agenda (staff_id = ctx.staff.id). Dueño/superadmin: toda la barbería.
import { bad, forbidden, notFound, int, clamp, diffDays } from '../util.js';
import { apptView } from '../domain/views.js';
import { findOrCreateClient } from '../domain/clients.js';
import { loadAgenda, candidates, computeSlots } from '../domain/slots.js';
import {
  STATUSES, failIf, parseIds, parseStart, parseDateField, parseContact, textField, loadServices,
  createAppointment, updateAppointment, changeStatus, notifyNew, hasStarted
} from '../domain/appointments.js';

const READ = ['appointments.read.all', 'appointments.read.own'];
const WRITE = ['appointments.write.all', 'appointments.write.own'];
const SOURCES = ['manual', 'walkin'];
const MAX_RANGE_DAYS = 400;

// null = ve todo; id = solo lo suyo.
function ownScope(ctx, allPerm) {
  if (ctx.can(allPerm)) return null;
  if (!ctx.staff) throw forbidden();
  return ctx.staff.id;
}
const dom = (ctx) => ({ sdb: ctx.sdb, shop: ctx.shop, now: ctx.now(), actor: ctx.actor, env: ctx.env });

// Cita visible para quien pregunta (otra barbería u otro barbero → 404).
async function getOwnAppt(ctx, allPerm) {
  const own = ownScope(ctx, allPerm);
  const a = await ctx.sdb.findOne('appointments', { id: String(ctx.params.id || '') });
  if (!a || (own && a.staff_id !== own)) throw notFound('No encontramos esa cita.');
  return a;
}

// Barbero pedido según permisos: el barbero .own solo puede usar el suyo.
function staffFor(ctx, raw, { allowAny } = {}) {
  const own = ownScope(ctx, 'appointments.write.all');
  const v = raw == null || raw === '' ? '' : String(raw);
  if (own) {
    if (v && v !== 'any' && v !== own) throw forbidden('Solo puedes agendar en tu propia agenda.');
    return own;
  }
  if (!v) throw bad('Elige un barbero.', { staff_id: 'Elige un barbero.' });
  if (v === 'any' && !allowAny) throw bad('Elige un barbero.', { staff_id: 'Elige un barbero.' });
  return v;
}

async function slots(ctx) {
  const q = ctx.req.query;
  const date = parseDateField(q.date);
  if (!date) throw bad('Elige una fecha válida.', { date: 'Usa el formato AAAA-MM-DD.' });
  const services = await loadServices(ctx.sdb, parseIds(q.services), { allowInactive: true });
  const duration = services.reduce((m, s) => m + (Number(s.duration_min) || 0), 0);
  const want = staffFor(ctx, q.staff_id || 'any', { allowAny: true });
  const ag = await loadAgenda(ctx.sdb, ctx.shop, { from: date, to: date });
  let staffIds;
  if (want === 'any') staffIds = candidates(ag, services, { bookable: true }).map((s) => s.id);
  else {
    const st = ag.staff[want];
    if (!st || !st.active) throw bad('Ese barbero no está disponible.', { staff_id: 'Barbero no disponible.' });
    staffIds = [st.id];
  }
  return computeSlots(ag, { date, duration, staffIds, now: ctx.now(), mode: 'staff', excludeId: q.exclude ? String(q.exclude) : undefined });
}

async function list(ctx) {
  const q = ctx.req.query;
  const own = ownScope(ctx, 'appointments.read.all');
  const where = {};
  const errs = {};
  const client_id = q.client_id ? String(q.client_id) : '';
  if (client_id) where.client_id = client_id;
  const from = q.from ? parseDateField(q.from) : null;
  const to = q.to ? parseDateField(q.to) : null;
  if (q.from && !from) errs.from = 'Fecha inválida (AAAA-MM-DD).';
  if (q.to && !to) errs.to = 'Fecha inválida (AAAA-MM-DD).';
  if (!client_id && (!q.from || !q.to)) { if (!q.from) errs.from = 'Indica la fecha inicial.'; if (!q.to) errs.to = 'Indica la fecha final.'; }
  if (from && to) {
    if (to < from) errs.to = 'La fecha final debe ser igual o posterior a la inicial.';
    else if (diffDays(from, to) > MAX_RANGE_DAYS) errs.to = 'El rango máximo es de ' + MAX_RANGE_DAYS + ' días.';
  }
  let statuses = null;
  if (q.status) {
    statuses = parseIds(q.status);
    if (statuses.some((s) => !STATUSES.includes(s))) errs.status = 'Estado no válido.';
  }
  failIf(errs);
  if (from && to) where.date = { gte: from, lte: to };
  else if (from) where.date = { gte: from };
  else if (to) where.date = { lte: to };
  if (own) where.staff_id = own;
  else if (q.staff_id) where.staff_id = String(q.staff_id);
  if (statuses) where.status = { in: statuses };
  const text = String(q.q || '').trim().slice(0, 80);
  if (text) {
    const ors = [{ client_name: { like: text } }, { folio: { like: text } }];
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 3) ors.push({ client_phone: { like: digits } });
    where.$or = ors;
  }
  const limit = clamp(int(q.limit, 500), 1, 2000);
  const [rows, total] = await Promise.all([
    ctx.sdb.find('appointments', where, { order: ['date asc', 'start_min asc', 'id asc'], limit }),
    ctx.sdb.count('appointments', where)
  ]);
  return { items: await apptView(ctx.sdb, rows), total };
}

async function detail(ctx) {
  const a = await getOwnAppt(ctx, 'appointments.read.all');
  const order = ['created_at asc', 'id asc'];
  const [appointment, client, events, payments, messages] = await Promise.all([
    apptView(ctx.sdb, a),
    a.client_id ? ctx.sdb.findOne('clients', { id: a.client_id }) : null,
    ctx.sdb.find('appointment_events', { appointment_id: a.id }, { order }),
    ctx.sdb.find('payments', { appointment_id: a.id }, { order }),
    ctx.sdb.find('messages', { appointment_id: a.id }, { order })
  ]);
  return { appointment, client, events, payments, messages };
}

// Cliente de la cita: client_id existente o { name, phone, email } (se reutiliza la ficha por teléfono/correo).
async function resolveClient(ctx, b, errs, source) {
  if (b.client_id) {
    const cl = await ctx.sdb.findOne('clients', { id: String(b.client_id), deleted_at: null });
    if (!cl) errs.client_id = 'Ese cliente no existe.';
    return cl ? { client: cl } : null;
  }
  if (b.client && typeof b.client === 'object') {
    const e = {};
    const contact = parseContact(e, b.client);
    for (const k of Object.keys(e)) errs['client.' + k] = e[k];
    return Object.keys(e).length ? null : { contact, source };
  }
  errs.client = 'Indica el cliente (elige uno o escribe su nombre).';
  return null;
}

async function create(ctx) {
  const b = ctx.req.body || {};
  const errs = {};
  const staff_id = staffFor(ctx, b.staff_id, { allowAny: true });
  const date = parseDateField(b.date);
  if (!date) errs.date = 'Elige una fecha válida.';
  const start = parseStart(b.start_min);
  if (start == null) errs.start_min = 'Elige una hora válida.';
  const ids = parseIds(b.services);
  if (!ids.length) errs.services = 'Elige al menos un servicio.';
  const status = b.status == null || b.status === '' ? 'confirmed' : String(b.status);
  if (!['pending', 'confirmed', 'completed'].includes(status)) errs.status = 'Una cita nueva solo puede quedar pendiente, confirmada o atendida.';
  const source = b.source == null || b.source === '' ? 'manual' : String(b.source);
  if (!SOURCES.includes(source)) errs.source = 'Origen no válido (manual o walkin).';
  const internal_note = textField(errs, 'internal_note', b.internal_note, 1000, 'La nota interna');
  const client_note = textField(errs, 'client_note', b.client_note, 500, 'La nota del cliente');
  const who = await resolveClient(ctx, b, errs, source);
  failIf(errs);
  const c = dom(ctx);
  if (status === 'completed' && !hasStarted({ date, start_min: start }, c.now)) {
    throw bad('Solo puedes registrar como atendida una cita que ya empezó o empieza en menos de una hora.', { status: 'La cita aún no empieza.' });
  }
  const services = await loadServices(ctx.sdb, ids);
  let client = who.client;
  if (!client) client = (await findOrCreateClient(ctx.sdb, { name: who.contact.name, phone: who.contact.phone, email: who.contact.email, source: who.source })).client;
  const first = (await ctx.sdb.count('appointments', { client_id: client.id, status: 'completed' })) === 0;
  const appt = await createAppointment(c, {
    staff_id, date, start_min: start, services, client, client_name: client.name, client_phone: client.phone || '',
    client_note: client_note || null, internal_note: internal_note || null, status, source, mode: 'staff', force: b.force === true, first_visit: first
  });
  await notifyNew(c, appt, { online: false });
  return apptView(ctx.sdb, appt);
}

async function patch(ctx) {
  const a = await getOwnAppt(ctx, 'appointments.write.all');
  const own = ownScope(ctx, 'appointments.write.all');
  const b = ctx.req.body || {};
  const errs = {};
  const p = {};
  if (b.services !== undefined) { p.services = parseIds(b.services); if (!p.services.length) errs.services = 'Elige al menos un servicio.'; }
  if (b.staff_id !== undefined && b.staff_id !== null && b.staff_id !== '') {
    p.staff_id = String(b.staff_id);
    if (p.staff_id === 'any') errs.staff_id = 'Elige un barbero.';
    else if (own && p.staff_id !== own) throw forbidden('Solo el dueño puede pasar una cita a otro barbero.');
  }
  if (b.date !== undefined) { p.date = parseDateField(b.date); if (!p.date) errs.date = 'Elige una fecha válida.'; }
  if (b.start_min !== undefined) { p.start_min = parseStart(b.start_min); if (p.start_min == null) errs.start_min = 'Elige una hora válida.'; }
  if (b.internal_note !== undefined) p.internal_note = textField(errs, 'internal_note', b.internal_note, 1000, 'La nota interna');
  if (b.client_note !== undefined) p.client_note = textField(errs, 'client_note', b.client_note, 500, 'La nota del cliente');
  if (b.client_id !== undefined && b.client_id !== null && b.client_id !== '') {
    p.client = await ctx.sdb.findOne('clients', { id: String(b.client_id), deleted_at: null });
    if (!p.client) errs.client_id = 'Ese cliente no existe.';
  }
  failIf(errs);
  const out = await updateAppointment(dom(ctx), a, p, { force: b.force === true });
  return apptView(ctx.sdb, out);
}

async function setStatus(ctx) {
  const a = await getOwnAppt(ctx, 'appointments.write.all');
  const b = ctx.req.body || {};
  const errs = {};
  const status = String(b.status || '');
  if (!STATUSES.includes(status)) errs.status = 'Estado no válido.';
  const reason = textField(errs, 'reason', b.reason, 300, 'El motivo');
  failIf(errs);
  const out = await changeStatus(dom(ctx), a, status, { reason, by: 'staff', force: b.force === true });
  return apptView(ctx.sdb, out);
}

export const routes = [
  { method: 'GET', path: '/api/slots', auth: 'shop', perm: WRITE, handler: slots },
  { method: 'GET', path: '/api/appointments', auth: 'shop', perm: READ, handler: list },
  { method: 'POST', path: '/api/appointments', auth: 'shop', perm: WRITE, handler: create },
  { method: 'GET', path: '/api/appointments/:id', auth: 'shop', perm: READ, handler: detail },
  { method: 'PATCH', path: '/api/appointments/:id', auth: 'shop', perm: WRITE, handler: patch },
  { method: 'POST', path: '/api/appointments/:id/status', auth: 'shop', perm: WRITE, handler: setStatus }
];
