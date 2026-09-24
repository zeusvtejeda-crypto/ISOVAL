// Reglas de citas: creación, edición, estados, reagenda y política de cancelación del cliente.
// Lo usan api/appointments.js (panel), api/public.js (reserva en línea / enlace) y api/my.js (portal).
//
// Todas las funciones reciben `c` = { sdb, shop, now, actor, env }:
//   sdb   base con scope de la barbería (aislamiento)      now   { date, minutes } en la zona de la barbería
//   actor { id, name, kind } para el historial             env   variables (correo, MODE)
import { HttpError, newId, newFolio, nowIso, bad, conflict, money, diffDays, addDays, parseDateKey, pad2, isDateKey, parseHHMM, normPhone, isPhone, normEmail, isEmail } from '../util.js';
import { shopSettings } from './settings.js';
import { loadAgenda, checkFree, candidates, pickStaff, offersAll, OCCUPYING } from './slots.js';
import { logEvent } from './events.js';
import { notify } from './notify.js';
import { totalOf, durationOf } from './views.js';

export { OCCUPYING };
export const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
export const ACTIVE = ['pending', 'confirmed'];
export const STATUS_LABEL = { pending: 'pendiente', confirmed: 'confirmada', completed: 'atendida', cancelled: 'cancelada', no_show: 'no asistió' };
// docs/API.md → "Transiciones permitidas"
export const TRANSITIONS = {
  pending: ['confirmed', 'completed', 'cancelled', 'no_show'],
  confirmed: ['pending', 'completed', 'cancelled', 'no_show'],
  completed: ['confirmed'],
  cancelled: ['pending', 'confirmed'],
  no_show: ['confirmed', 'completed']
};
export const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);
export const MAX_SERVICES = 10;
export const MAX_CLIENT_RESCHEDULES = 5;

// ── Tiempo ──
// ¿Ya empezó (o empieza en ≤ 60 min)? Requisito para marcar atendida / no asistió.
export function hasStarted(a, now) { return a.date < now.date || (a.date === now.date && a.start_min <= now.minutes + 60); }
export function minutesUntil(a, now) { return diffDays(now.date, a.date) * 1440 + a.start_min - now.minutes; }

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fmtDateEs(k) { const d = parseDateKey(k); return DIAS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()]; }
export function fmtTimeEs(m) { const h = Math.floor(m / 60) % 24; return (h % 12 || 12) + ':' + pad2(m % 60) + (h < 12 ? ' a.m.' : ' p.m.'); }

// ── Entrada ──
// Junta errores por campo: un solo error → su mensaje; varios → mensaje general.
export function failIf(errs) {
  const keys = Object.keys(errs);
  if (keys.length) throw bad(keys.length === 1 ? errs[keys[0]] : 'Revisa los datos marcados.', errs);
}
// 'a,b' | ['a','b'] → ids únicos
export function parseIds(v) {
  const list = Array.isArray(v) ? v : (v == null || v === '' ? [] : String(v).split(','));
  const out = [];
  for (const x of list) { const s = String(x == null ? '' : x).trim(); if (s && s.length <= 64 && !out.includes(s)) out.push(s); }
  return out;
}
// minutos (número o 'HH:MM') → entero 0..1439 | null
export function parseStart(v) {
  if (typeof v === 'string' && v.includes(':')) return parseHHMM(v);
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < 1440 ? n : null;
}
export function parseDateField(v) { return isDateKey(v) ? v : null; }
export function cleanText(v, max) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max); }
// Texto libre con límite estricto (se rechaza, no se recorta en silencio).
export function textField(errs, field, v, max, label) {
  if (v == null) return '';
  const s = String(v).trim();
  if (s.length > max) errs[field] = (label || 'El texto') + ' puede tener máximo ' + max + ' caracteres.';
  return s.slice(0, max);
}
// Datos de contacto del cliente (reserva pública y alta rápida en el panel).
export function parseContact(errs, src, { requirePhone } = {}) {
  src = src || {};
  const name = cleanText(src.name, 200);
  if (name.length < 2 || name.length > 80) errs.name = 'Escribe el nombre (2 a 80 caracteres).';
  const rawPhone = src.phone == null ? '' : String(src.phone).trim();
  const phone = normPhone(rawPhone);
  if ((requirePhone || rawPhone) && !isPhone(phone)) errs.phone = 'Escribe un teléfono de 10 dígitos.';
  const email = normEmail(src.email);
  if (email && !isEmail(email)) errs.email = 'Revisa el correo electrónico.';
  return { name: name.slice(0, 80), phone: isPhone(phone) ? phone : '', email };
}

// Servicios del shop en el orden pedido. allowInactive: ids inactivos aceptados (los que ya tenía la cita).
export async function loadServices(sdb, ids, { allowInactive } = {}) {
  if (!ids.length) throw bad('Elige al menos un servicio.', { services: 'Elige al menos un servicio.' });
  if (ids.length > MAX_SERVICES) throw bad('Puedes elegir hasta ' + MAX_SERVICES + ' servicios por cita.', { services: 'Máximo ' + MAX_SERVICES + ' servicios.' });
  const rows = await sdb.find('services', { id: { in: ids } });
  const byId = Object.fromEntries(rows.map((s) => [s.id, s]));
  const allow = allowInactive === true ? null : (allowInactive || []);
  return ids.map((id) => {
    const s = byId[id];
    if (!s || (!s.active && allow && !allow.includes(id))) throw bad('Uno de los servicios ya no está disponible. Vuelve a elegir.', { services: 'Servicio no disponible.' });
    return s;
  });
}
export const snapshot = (rows) => rows.map((s) => ({ id: s.id, name: s.name, price: money(s.price), duration_min: Math.max(0, Math.round(Number(s.duration_min) || 0)) }));

const TAKEN_MSG = 'Ese horario acaba de ocuparse. Elige otro.';

// Error HTTP para un horario no disponible (reason/message de slots.checkFree).
export function slotError(r) {
  if (['overflow', 'past', 'out_of_window', 'offline'].includes(r.reason)) return bad(r.message, { [r.reason === 'overflow' ? 'start_min' : 'date']: r.message });
  return new HttpError(409, 'slot_taken', r.message, { start_min: r.message });
}

// Barbero para la cita: 'any' → pickStaff; id → validado y libre (salvo force).
async function resolveStaff(c, ag, { staff_id, date, start, duration, services, mode, excludeId, force }) {
  const pub = mode === 'public';
  if (staff_id === 'any') {
    const ids = candidates(ag, services, { bookable: true }).map((s) => s.id);
    if (!ids.length) throw bad('Ningún barbero ofrece esa combinación de servicios.', { staff_id: 'Sin barberos para esos servicios.' });
    const args = { date, start, duration, excludeId, now: c.now, mode };
    const id = pickStaff(ag, Object.assign({ staffIds: ids }, args)) || (force ? pickStaff(ag, { date, staffIds: ids, excludeId, anyFree: false }) : null);
    if (id) return id;
    // Motivos que aplican igual a todos (fecha pasada, anticipación…) se reportan tal cual; si no, "ocupado".
    const r = checkFree(ag, Object.assign({ staffId: ids[0] }, args));
    if (r && ['overflow', 'past', 'out_of_window', 'offline', 'lead'].includes(r.reason)) throw slotError(r);
    throw slotError({ reason: 'taken', message: pub ? TAKEN_MSG : 'Ningún barbero está libre en ese horario.' });
  }
  const st = ag.staff[staff_id];
  if (!st || !st.active) throw bad('Ese barbero no está disponible.', { staff_id: 'Barbero no disponible.' });
  if (pub && (!st.bookable || !offersAll(st.id, services))) throw bad('Ese barbero no ofrece los servicios elegidos. Elige otro.', { staff_id: 'No ofrece esos servicios.' });
  if (!force) { const r = checkFree(ag, { staffId: st.id, date, start, duration, excludeId, now: c.now, mode }); if (r) throw slotError(r); }
  return st.id;
}

// Segunda verificación tras escribir (dos reservas simultáneas pasan la primera): cede la de id mayor.
async function raceClash(sdb, a, buffer) {
  const same = await sdb.find('appointments', { staff_id: a.staff_id, date: a.date, status: { in: OCCUPYING }, id: { ne: a.id } });
  return same.find((x) => x.start_min - buffer < a.end_min && x.end_min + buffer > a.start_min && x.id < a.id) || null;
}

async function uniqueFolio(sdb) {
  for (let i = 0; i < 4; i++) { const f = newFolio('TB'); if (!(await sdb.findOne('appointments', { folio: f }))) return f; }
  return newFolio('TB');
}

// ── Crear ──
// o: { staff_id:'any'|id, date, start_min, services:[filas], client, client_name, client_phone, client_note,
//      internal_note, status, source, created_by, mode:'public'|'staff', force, first_visit, manage_token_hash }
export async function createAppointment(c, o) {
  const snap = snapshot(o.services);
  const duration = durationOf(snap);
  if (duration <= 0) throw bad('La duración de los servicios no es válida.', { services: 'Duración inválida.' });
  const status = o.status || 'confirmed';
  if (!['pending', 'confirmed', 'completed'].includes(status)) throw bad('Una cita nueva solo puede quedar pendiente, confirmada o atendida.', { status: 'Estado no válido.' });
  if (status === 'completed' && !hasStarted({ date: o.date, start_min: o.start_min }, c.now)) {
    throw bad('Solo puedes registrar como atendida una cita que ya empezó o empieza en menos de una hora.', { status: 'La cita aún no empieza.' });
  }
  const ag = await loadAgenda(c.sdb, c.shop, { from: o.date, to: o.date });
  const staff_id = await resolveStaff(c, ag, { staff_id: o.staff_id, date: o.date, start: o.start_min, duration, services: o.services, mode: o.mode, force: o.force });
  const at = nowIso();
  const row = await c.sdb.insert('appointments', {
    id: newId('ap'), folio: await uniqueFolio(c.sdb), client_id: o.client ? o.client.id : null, staff_id,
    date: o.date, start_min: o.start_min, end_min: o.start_min + duration, duration_min: duration,
    services: snap, total: money(totalOf(snap)), status, source: o.source || 'manual',
    client_name: o.client_name || (o.client && o.client.name) || '', client_phone: o.client_phone || (o.client && o.client.phone) || '',
    client_note: o.client_note || null, internal_note: o.internal_note || null, cancel_reason: null, cancelled_by: null,
    manage_token_hash: o.manage_token_hash || null, first_visit: o.first_visit == null ? null : !!o.first_visit,
    confirmed_at: status === 'confirmed' ? at : null, completed_at: status === 'completed' ? at : null,
    reschedule_count: 0, created_by: o.created_by || (c.actor && c.actor.id) || null, created_at: at, updated_at: null
  });
  if (!o.force && OCCUPYING.includes(status) && await raceClash(c.sdb, row, ag.buffer)) {
    await c.sdb.delete('appointments', { id: row.id });
    throw new HttpError(409, 'slot_taken', TAKEN_MSG, { start_min: TAKEN_MSG });
  }
  await logEvent(c.sdb, row.id, 'created', { source: row.source, status, staff_id, date: row.date, start_min: row.start_min, total: row.total }, c.actor);
  return row;
}

// ── Estados ──
// opts: { reason, by: 'client'|'staff', force }
export async function changeStatus(c, a, next, opts) {
  opts = opts || {};
  if (!STATUSES.includes(next)) throw bad('Estado no válido.', { status: 'Estado no válido.' });
  if (a.status === next) return a;
  if (!canTransition(a.status, next)) throw bad('No se puede pasar una cita ' + STATUS_LABEL[a.status] + ' a ' + STATUS_LABEL[next] + '.', { status: 'Cambio no permitido.' });
  if ((next === 'completed' || next === 'no_show') && !hasStarted(a, c.now)) {
    throw bad('Solo puedes marcar como ' + STATUS_LABEL[next] + ' una cita que ya empezó o empieza en menos de una hora.', { status: 'La cita aún no empieza.' });
  }
  // Restaurar (cancelada / no asistió → activa) exige que el horario siga libre.
  if (!OCCUPYING.includes(a.status) && OCCUPYING.includes(next) && !opts.force) {
    const ag = await loadAgenda(c.sdb, c.shop, { from: a.date, to: a.date });
    const r = checkFree(ag, { staffId: a.staff_id, date: a.date, start: a.start_min, duration: a.end_min - a.start_min, excludeId: a.id, now: c.now, mode: 'restore' });
    if (r) throw new HttpError(409, 'slot_taken', 'No se puede restaurar: ' + r.message.charAt(0).toLowerCase() + r.message.slice(1), { status: r.message });
  }
  const at = nowIso();
  const patch = { status: next, updated_at: at };
  if (next === 'confirmed') patch.confirmed_at = at;
  if (next === 'completed') patch.completed_at = at;
  if (a.status === 'completed') patch.completed_at = null;
  if (next === 'cancelled') { patch.cancel_reason = cleanText(opts.reason, 300) || null; patch.cancelled_by = opts.by === 'client' ? 'client' : 'staff'; }
  if (a.status === 'cancelled') { patch.cancel_reason = null; patch.cancelled_by = null; }
  await c.sdb.update('appointments', { id: a.id }, patch);
  const out = Object.assign({}, a, patch);
  await logEvent(c.sdb, a.id, 'status', { from: a.status, to: next, reason: patch.cancel_reason || cleanText(opts.reason, 300) || null, by: opts.by || 'staff' }, c.actor);
  if (next === 'cancelled') await notifyChange(c, out, 'cancelled', opts.by);
  return out;
}

// ── Reagendar (cliente o panel) ──
// o: { date, start_min, staff_id? ('any'|id; por defecto el mismo), mode, force, by }
export async function reschedule(c, a, o) {
  const duration = a.end_min - a.start_min;
  const date = o.date, start = o.start_min;
  const ag = await loadAgenda(c.sdb, c.shop, { from: date, to: date });
  const services = await c.sdb.find('services', { id: { in: (a.services || []).map((s) => s.id) } });
  const wanted = o.staff_id || a.staff_id;
  const occupying = OCCUPYING.includes(a.status);
  let staff_id = wanted;
  if (occupying || wanted === 'any') {
    staff_id = await resolveStaff(c, ag, { staff_id: wanted, date, start, duration, services, mode: o.mode, excludeId: a.id, force: o.force || !occupying });
  } else if (!ag.staff[wanted]) throw bad('Ese barbero no está disponible.', { staff_id: 'Barbero no disponible.' });
  if (staff_id === a.staff_id && date === a.date && start === a.start_min) return a;
  const prev = { date: a.date, start_min: a.start_min, end_min: a.end_min, staff_id: a.staff_id, reschedule_count: a.reschedule_count || 0 };
  const patch = { date, start_min: start, end_min: start + duration, staff_id, reschedule_count: prev.reschedule_count + 1, updated_at: nowIso() };
  await c.sdb.update('appointments', { id: a.id }, patch);
  const out = Object.assign({}, a, patch);
  if (!o.force && occupying && await raceClash(c.sdb, out, ag.buffer)) {
    await c.sdb.update('appointments', { id: a.id }, prev);
    throw new HttpError(409, 'slot_taken', TAKEN_MSG, { start_min: TAKEN_MSG });
  }
  await logEvent(c.sdb, a.id, 'rescheduled', { from: { date: prev.date, start_min: prev.start_min, staff_id: prev.staff_id }, to: { date, start_min: start, staff_id }, by: o.by || 'staff' }, c.actor);
  await notifyChange(c, out, 'rescheduled', o.by, prev.staff_id);
  return out;
}

// ── Editar (panel) ──
// p (ya parseado): { services?:[ids], staff_id?, date?, start_min?, client?: fila, internal_note?, client_note? }
export async function updateAppointment(c, a, p, { force } = {}) {
  const patch = {};
  const changed = [];
  if (p.services) {
    const rows = await loadServices(c.sdb, p.services, { allowInactive: (a.services || []).map((s) => s.id) });
    const snap = snapshot(rows);
    const duration = durationOf(snap);
    if (duration <= 0) throw bad('La duración de los servicios no es válida.', { services: 'Duración inválida.' });
    if (JSON.stringify(snap) !== JSON.stringify(a.services)) { Object.assign(patch, { services: snap, total: money(totalOf(snap)), duration_min: duration }); changed.push('services'); }
  }
  const date = p.date || a.date;
  const start = p.start_min != null ? p.start_min : a.start_min;
  const staff_id = p.staff_id || a.staff_id;
  const duration = patch.duration_min || a.duration_min;
  const moved = date !== a.date || start !== a.start_min || staff_id !== a.staff_id;
  let ag = null;
  if (moved || patch.duration_min) {
    ag = await loadAgenda(c.sdb, c.shop, { from: date, to: date });
    const st = ag.staff[staff_id];
    if (!st || (staff_id !== a.staff_id && !st.active)) throw bad('Ese barbero no está disponible.', { staff_id: 'Barbero no disponible.' });
    if (start + duration > 1440) throw bad('La cita debe terminar antes de medianoche.', { start_min: 'Termina después de las 24:00.' });
    if (!force && OCCUPYING.includes(a.status)) {
      const r = checkFree(ag, { staffId: staff_id, date, start, duration, excludeId: a.id, now: c.now, mode: 'staff' });
      if (r) throw slotError(r);
    }
    Object.assign(patch, { date, start_min: start, end_min: start + duration, staff_id });
    if (moved) patch.reschedule_count = (a.reschedule_count || 0) + 1;
  }
  if (p.client && p.client.id !== a.client_id) {
    Object.assign(patch, { client_id: p.client.id, client_name: p.client.name || '', client_phone: p.client.phone || '' });
    changed.push('client');
  }
  for (const k of ['internal_note', 'client_note']) {
    if (p[k] !== undefined && (p[k] || null) !== (a[k] || null)) { patch[k] = p[k] || null; changed.push(k); }
  }
  if (!Object.keys(patch).length) return a;
  patch.updated_at = nowIso();
  await c.sdb.update('appointments', { id: a.id }, patch);
  const out = Object.assign({}, a, patch);
  if (ag && !force && OCCUPYING.includes(a.status)) {
    if (await raceClash(c.sdb, out, ag.buffer)) {
      const undo = {};
      for (const k of Object.keys(patch)) undo[k] = a[k] === undefined ? null : a[k];
      await c.sdb.update('appointments', { id: a.id }, undo);
      throw new HttpError(409, 'slot_taken', TAKEN_MSG, { start_min: TAKEN_MSG });
    }
  }
  if (moved) {
    await logEvent(c.sdb, a.id, 'rescheduled', { from: { date: a.date, start_min: a.start_min, staff_id: a.staff_id }, to: { date, start_min: start, staff_id }, by: 'staff' }, c.actor);
    await notifyChange(c, out, 'rescheduled', 'staff', a.staff_id);
  }
  if (changed.length) {
    const onlyNote = changed.every((k) => k === 'internal_note');
    await logEvent(c.sdb, a.id, onlyNote ? 'note' : 'edited', onlyNote ? { internal_note: out.internal_note } : { fields: changed, total: out.total }, c.actor);
  }
  return out;
}

// ── Notificaciones ──
function summary(a, staffName) {
  return (a.client_name || 'Cliente') + ' · ' + (a.services || []).map((s) => s.name).join(', ') + ' · ' + fmtDateEs(a.date) + ', ' + fmtTimeEs(a.start_min) + (staffName ? ' con ' + staffName : '');
}
async function staffName(c, id) { const s = id ? await c.sdb.findOne('staff', { id }) : null; return s ? s.name : ''; }

// Reserva en línea nueva → dueños + barbero. Cita creada en el panel para otro barbero → ese barbero.
export async function notifyNew(c, a, { online } = {}) {
  const name = await staffName(c, a.staff_id);
  const actorStaff = c.actor && c.actor.kind === 'staff' ? c.actor.id : null;
  const to = online ? ['owners', 'staff:' + a.staff_id] : (actorStaff !== a.staff_id ? ['staff:' + a.staff_id] : []);
  if (!to.length) return 0;
  return notify(c.sdb, to, {
    type: 'booking_new', title: online ? 'Nueva reserva en línea' : 'Nueva cita en tu agenda',
    body: summary(a, name), link: '#/agenda?cita=' + a.id, data: { appointment_id: a.id, folio: a.folio }
  });
}
// Cancelación / reagenda: si la hizo el cliente → dueños + barbero(s); si fue el equipo y el cliente
// tiene cuenta → aviso al cliente en su centro de notificaciones.
async function notifyChange(c, a, kind, by, prevStaffId) {
  const name = await staffName(c, a.staff_id);
  const type = kind === 'cancelled' ? 'booking_cancelled' : 'booking_rescheduled';
  if (by === 'client') {
    const to = ['owners', 'staff:' + a.staff_id];
    if (prevStaffId && prevStaffId !== a.staff_id) to.push('staff:' + prevStaffId);
    return notify(c.sdb, to, {
      type, title: kind === 'cancelled' ? 'Cita cancelada por el cliente' : 'Cita reagendada por el cliente',
      body: summary(a, name) + (kind === 'cancelled' && a.cancel_reason ? ' · Motivo: ' + a.cancel_reason : ''),
      link: '#/agenda?cita=' + a.id, data: { appointment_id: a.id, folio: a.folio }
    });
  }
  let n = 0;
  if (a.client_id) {
    const cl = await c.sdb.findOne('clients', { id: a.client_id });
    if (cl && cl.user_id) {
      n += await notify(c.sdb, 'client:' + cl.id, {
        type, title: kind === 'cancelled' ? 'Tu cita fue cancelada' : 'Tu cita cambió de horario',
        body: kind === 'cancelled' ? 'Tu cita del ' + fmtDateEs(a.date) + ' a las ' + fmtTimeEs(a.start_min) + ' fue cancelada.' : summary(a, name),
        link: '#/mis-citas', data: { appointment_id: a.id, folio: a.folio }
      });
    }
  }
  // Movida por otra persona del equipo → avisa al barbero (y al anterior si cambió).
  const actorStaff = c.actor && c.actor.kind === 'staff' ? c.actor.id : null;
  const to = [a.staff_id, prevStaffId].filter((id, i, arr) => id && id !== actorStaff && arr.indexOf(id) === i).map((id) => 'staff:' + id);
  if (to.length && c.actor && c.actor.kind !== 'client') {
    n += await notify(c.sdb, to, {
      type, title: kind === 'cancelled' ? 'Se canceló una cita de tu agenda' : 'Se movió una cita de tu agenda',
      body: summary(a, name), link: '#/agenda?cita=' + a.id, data: { appointment_id: a.id, folio: a.folio }
    });
  }
  return n;
}

// ── Política del cliente (enlace de gestión y portal) ──
export function managePolicy(a, shop, now) {
  const st = shopSettings(shop);
  const hours = Math.max(0, Number(st.booking.cancel_hours) || 0);
  const until = minutesUntil(a, now);
  const ok = ACTIVE.includes(a.status) && until > 0 && until >= hours * 60;
  const tooMany = (a.reschedule_count || 0) >= MAX_CLIENT_RESCHEDULES;
  const phone = shop.whatsapp || shop.phone || '';
  let text;
  if (a.status === 'cancelled') text = 'Esta cita fue cancelada.';
  else if (a.status === 'completed') text = 'Esta cita ya fue atendida. ¡Gracias por tu visita!';
  else if (a.status === 'no_show') text = 'Esta cita se marcó como no asistida.';
  else if (until <= 0) text = 'La hora de esta cita ya pasó.';
  else if (ok) {
    let m = a.start_min - hours * 60, d = a.date;
    while (m < 0) { m += 1440; d = addDays(d, -1); }
    text = hours > 0 ? 'Puedes cancelar o reagendar hasta el ' + fmtDateEs(d) + ' a las ' + fmtTimeEs(m) + '.' : 'Puedes cancelar o reagendar antes de tu cita.';
  } else {
    text = 'Ya no es posible cancelar ni reagendar en línea: se requiere hacerlo con ' + (hours === 1 ? '1 hora' : hours + ' horas') + ' de anticipación. Comunícate con la barbería' + (phone ? ' al ' + phone : '') + '.';
  }
  return { can_cancel: ok, can_reschedule: ok && st.booking.online_enabled !== false && !tooMany, deadline_text: text };
}
// Lanza el error adecuado si el cliente no puede cancelar / reagendar.
export function assertClientCan(a, shop, now, action) {
  const p = managePolicy(a, shop, now);
  if (action === 'cancel' ? p.can_cancel : p.can_reschedule) return p;
  if (action === 'reschedule' && p.can_cancel && (a.reschedule_count || 0) >= MAX_CLIENT_RESCHEDULES) {
    throw conflict('Esta cita ya se reagendó varias veces. Comunícate con la barbería para cambiarla.');
  }
  if (action === 'reschedule' && p.can_cancel) throw conflict('Por ahora esta barbería no recibe cambios en línea. Comunícate con ella.');
  throw conflict(p.deadline_text);
}
