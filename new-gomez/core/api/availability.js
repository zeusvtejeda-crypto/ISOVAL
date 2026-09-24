// Disponibilidad semanal por barbero y descansos (time_off). Barbero: solo lo suyo.
import { bad, forbidden, notFound, newId, nowIso, parseHHMM, diffDays, addDays } from '../util.js';
import { buildAgenda, weekFor, OCCUPYING } from '../domain/slots.js';
import { shopSettings } from '../domain/settings.js';
import { failIf, parseDateField, textField } from '../domain/appointments.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MAX_BLOCKS = 8;

function ownScope(ctx, allPerm) {
  if (ctx.can(allPerm)) return null;
  if (!ctx.staff) throw forbidden();
  return ctx.staff.id;
}

// minutos (número o 'HH:MM'; '24:00' solo como fin) → entero 0..1440 | null
function toMin(v, isEnd) {
  if (typeof v === 'string' && v.includes(':')) return isEnd && /^24:00$/.test(v.trim()) ? 1440 : parseHHMM(v.trim());
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 1440 ? n : null;
}

// { 0:[[s,e]], … } | [[…], …×7] → semana validada: bloques ordenados, sin traslapes, contiguos unidos.
export function parseWeek(input) {
  if (!input || typeof input !== 'object') throw bad('Envía el horario de la semana.', { week: 'Falta el horario.' });
  const week = {};
  const errs = {};
  for (let d = 0; d < 7; d++) {
    const raw = input[d] !== undefined ? input[d] : input[String(d)];
    const list = raw == null ? [] : raw;
    const key = 'week.' + d;
    if (!Array.isArray(list)) { errs[key] = 'El horario del ' + DIAS[d] + ' no es válido.'; continue; }
    if (list.length > MAX_BLOCKS) { errs[key] = 'Máximo ' + MAX_BLOCKS + ' bloques por día.'; continue; }
    const blocks = [];
    for (const b of list) {
      const pair = Array.isArray(b) ? b : (b && typeof b === 'object' ? [b.start_min !== undefined ? b.start_min : b.start, b.end_min !== undefined ? b.end_min : b.end] : []);
      const s = toMin(pair[0], false), e = toMin(pair[1], true);
      if (s == null || e == null || s >= 1440) { errs[key] = 'El ' + DIAS[d] + ' tiene una hora no válida.'; break; }
      if (s >= e) { errs[key] = 'El ' + DIAS[d] + ': la hora de salida debe ser después de la de entrada.'; break; }
      blocks.push([s, e]);
    }
    if (errs[key]) continue;
    blocks.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const x of blocks) {
      const l = out[out.length - 1];
      if (l && x[0] < l[1]) { errs[key] = 'Los horarios del ' + DIAS[d] + ' se traslapan.'; break; }
      if (l && x[0] === l[1]) l[1] = x[1]; else out.push(x);
    }
    week[d] = out;
  }
  failIf(errs);
  return week;
}

async function getAvailability(ctx) {
  const own = ownScope(ctx, 'availability.manage.all');
  const wanted = ctx.req.query.staff_id ? String(ctx.req.query.staff_id) : '';
  if (own && wanted && wanted !== own) throw forbidden('Solo puedes ver tu propio horario.');
  const [staff, availability] = await Promise.all([
    ctx.sdb.find('staff', {}, { order: ['sort asc', 'name asc'] }),
    ctx.sdb.find('availability', own || wanted ? { staff_id: own || wanted } : {})
  ]);
  const ag = buildAgenda({ settings: shopSettings(ctx.shop), staff, availability });
  let ids;
  if (own) ids = [own];
  else if (wanted) { if (!ag.staff[wanted]) throw notFound('No encontramos a ese barbero.'); ids = [wanted]; }
  else ids = ag.order.filter((id) => ag.staff[id].active);
  // Semana efectiva: la del barbero o, si nunca la configuró, el horario de la barbería.
  const out = {};
  for (const id of ids) out[id] = weekFor(ag, id);
  return out;
}

async function putAvailability(ctx) {
  const own = ownScope(ctx, 'availability.manage.all');
  const staffId = String(ctx.params.staff_id || '');
  if (own && staffId !== own) throw forbidden('Solo puedes cambiar tu propio horario.');
  const st = await ctx.sdb.findOne('staff', { id: staffId });
  if (!st) throw notFound('No encontramos a ese barbero.');
  const b = ctx.req.body || {};
  const week = parseWeek(b.week !== undefined ? b.week : b);
  const rows = [];
  for (let d = 0; d < 7; d++) for (const [s, e] of week[d]) rows.push({ id: newId('av'), staff_id: staffId, weekday: d, start_min: s, end_min: e });
  // Semana vacía: fila centinela de 0 min para que no se herede el horario de la barbería.
  if (!rows.length) rows.push({ id: newId('av'), staff_id: staffId, weekday: 0, start_min: 0, end_min: 0 });
  // Primero se insertan los nuevos y luego se borran los anteriores (si algo falla, queda el horario previo).
  const old = (await ctx.sdb.find('availability', { staff_id: staffId })).map((r) => r.id);
  await ctx.sdb.insertMany('availability', rows);
  for (let i = 0; i < old.length; i += 50) await ctx.sdb.delete('availability', { staff_id: staffId, id: { in: old.slice(i, i + 50) } });
  return { [staffId]: week };
}

async function listTimeOff(ctx) {
  const q = ctx.req.query;
  const own = ownScope(ctx, 'timeoff.manage.all');
  const errs = {};
  const from = q.from ? parseDateField(q.from) : ctx.now().date;
  if (!from) errs.from = 'Fecha inválida (AAAA-MM-DD).';
  const to = q.to ? parseDateField(q.to) : (from ? addDays(from, 365) : null);
  if (!to) errs.to = 'Fecha inválida (AAAA-MM-DD).';
  if (from && to && to < from) errs.to = 'La fecha final debe ser igual o posterior a la inicial.';
  failIf(errs);
  const staffFilter = own || (q.staff_id ? String(q.staff_id) : '');
  const where = { date_from: { lte: to }, date_to: { gte: from } };
  if (staffFilter) where.$or = [{ staff_id: staffFilter }, { staff_id: null }];
  const [rows, staff] = await Promise.all([
    ctx.sdb.find('time_off', where, { order: ['date_from asc', 'start_min asc'] }),
    ctx.sdb.find('staff', {})
  ]);
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  return rows.map((r) => Object.assign({}, r, { staff_name: r.staff_id ? (names[r.staff_id] || '') : 'Toda la barbería' }));
}

async function createTimeOff(ctx) {
  const own = ownScope(ctx, 'timeoff.manage.all');
  const b = ctx.req.body || {};
  const errs = {};
  let staff_id = b.staff_id === undefined || b.staff_id === '' ? (own || null) : b.staff_id;
  if (own) {
    if (staff_id === null) throw forbidden('Solo el dueño puede registrar descansos para toda la barbería.');
    if (String(staff_id) !== own) throw forbidden('Solo puedes registrar tus propios descansos.');
  }
  if (staff_id !== null) {
    staff_id = String(staff_id);
    if (!(await ctx.sdb.findOne('staff', { id: staff_id }))) errs.staff_id = 'Ese barbero no existe.';
  }
  const date_from = parseDateField(b.date_from);
  if (!date_from) errs.date_from = 'Elige la fecha de inicio.';
  const date_to = b.date_to == null || b.date_to === '' ? date_from : parseDateField(b.date_to);
  if (!date_to) errs.date_to = 'Elige la fecha final.';
  if (date_from && date_to) {
    if (date_to < date_from) errs.date_to = 'La fecha final debe ser igual o posterior a la inicial.';
    else if (diffDays(date_from, date_to) > 366) errs.date_to = 'Un descanso puede durar máximo un año.';
  }
  let start_min = null, end_min = null;
  const hasS = b.start_min != null && b.start_min !== '', hasE = b.end_min != null && b.end_min !== '';
  if (hasS || hasE) {
    start_min = toMin(b.start_min, false);
    end_min = toMin(b.end_min, true);
    if (start_min == null || start_min >= 1440) errs.start_min = 'Hora de inicio no válida.';
    if (end_min == null) errs.end_min = 'Hora de fin no válida.';
    if (start_min != null && end_min != null && start_min >= end_min) errs.end_min = 'La hora de fin debe ser después de la de inicio.';
  }
  const reason = textField(errs, 'reason', b.reason, 120, 'El motivo');
  failIf(errs);
  const row = await ctx.sdb.insert('time_off', { id: newId('to'), staff_id, date_from, date_to, start_min, end_min, reason: reason || null, created_at: nowIso() });
  // Aviso: citas activas que caen en el descanso (no se cancelan solas).
  const appts = await ctx.sdb.find('appointments', Object.assign({ date: { gte: date_from, lte: date_to }, status: { in: OCCUPYING } }, staff_id ? { staff_id } : {}));
  const conflicts = appts.filter((a) => start_min == null || (a.start_min < end_min && a.end_min > start_min)).length;
  return Object.assign({}, row, { conflicts });
}

async function deleteTimeOff(ctx) {
  const own = ownScope(ctx, 'timeoff.manage.all');
  const row = await ctx.sdb.findOne('time_off', { id: String(ctx.params.id || '') });
  if (!row) throw notFound('No encontramos ese descanso.');
  if (own) {
    if (row.staff_id === null) throw forbidden('Solo el dueño puede quitar descansos de toda la barbería.');
    if (row.staff_id !== own) throw notFound('No encontramos ese descanso.');
  }
  await ctx.sdb.delete('time_off', { id: row.id });
  return null;
}

export const routes = [
  { method: 'GET', path: '/api/availability', auth: 'shop', perm: 'availability.read', handler: getAvailability },
  { method: 'PUT', path: '/api/availability/:staff_id', auth: 'shop', perm: ['availability.manage.all', 'availability.manage.own'], handler: putAvailability },
  { method: 'GET', path: '/api/time-off', auth: 'shop', perm: 'availability.read', handler: listTimeOff },
  { method: 'POST', path: '/api/time-off', auth: 'shop', perm: ['timeoff.manage.all', 'timeoff.manage.own'], handler: createTimeOff },
  { method: 'DELETE', path: '/api/time-off/:id', auth: 'shop', perm: ['timeoff.manage.all', 'timeoff.manage.own'], handler: deleteTimeOff }
];
