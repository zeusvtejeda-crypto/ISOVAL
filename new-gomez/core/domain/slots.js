// Motor de disponibilidad (agenda). Funciones PURAS sobre una "agenda" en memoria + un cargador
// desde la base con scope. Lo usan la reserva pública, el panel (/api/slots) y las reglas de citas.
//
//   const ag = await loadAgenda(sdb, shop, { from, to });          // 4 consultas para todo el rango
//   computeSlots(ag, { date, duration, staffIds, now, mode })       // → { date, duration_min, closed, slots:[{start_min, staff_ids}] }
//   computeDays(ag, { from, days, duration, staffIds, now, mode })  // → [{ date, open, available }]
//     (ambas aceptan excludeId: la cita que se está moviendo no ocupa su propio horario)
//   pickStaff(ag, { date, start, duration, staffIds, now, mode })   // 'any' → barbero libre con menos minutos ese día
//   checkFree(ag, { staffId, date, start, duration, now, mode })    // null = libre | { reason, message }
//
// mode: 'public'  → reserva en línea: online_enabled, ventana, lead_min, horario del barbero ∩ horario de la
//                   barbería (settings.hours) y rejilla (step_min).
//       'staff'   → panel: sin lead ni ventana (se permiten citas pasadas: walk-in ya atendido); exige horario.
//       'restore' → restaurar una cita cancelada / no asistida: solo choques (citas y descansos), no el horario.
//
// Reglas: un barbero sin NINGUNA fila de availability usa settings.hours de la barbería. En línea solo se
// ofrece la intersección de su horario con el de la barbería: si la barbería está cerrada ese día u hora
// (settings.hours), no se reserva en línea aunque el barbero tenga su propio horario. Los descansos
// (time_off) con staff_id null aplican a todos; sin start_min/end_min son de día completo; con minutos,
// el rango aplica a cada día de date_from..date_to. buffer_min separa citas del mismo barbero.
import { weekday, diffDays, addDays, eachDay, fmtMin } from '../util.js';
import { shopSettings } from './settings.js';

// Estados que ocupan agenda. docs/API.md: `cancelled` y `no_show` NO ocupan (el hueco de un no-show
// puede usarse para un walk-in).
export const OCCUPYING = ['pending', 'confirmed', 'completed'];

const toInt = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== null && v !== '' ? Math.min(max, Math.max(min, n)) : def; };

// Ordena, descarta inválidos y une rangos que se traslapan o se tocan: [[s,e]] → [[s,e]].
export function mergeRanges(list) {
  const r = (Array.isArray(list) ? list : [])
    .filter((x) => Array.isArray(x) && Number.isFinite(+x[0]) && Number.isFinite(+x[1]) && +x[1] > +x[0])
    .map((x) => [+x[0], +x[1]]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const x of r) { const l = out[out.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else out.push(x); }
  return out;
}

// ── Construcción de la agenda (pura) ──
export function buildAgenda({ settings, staff, availability, timeOff, appointments }) {
  const b = (settings && settings.booking) || {};
  const ag = {
    hours: (settings && settings.hours) || {},
    step: toInt(b.step_min, 5, 240, 20),
    buffer: toInt(b.buffer_min, 0, 240, 0),
    lead: toInt(b.lead_min, 0, 525600, 0),
    windowDays: toInt(b.window_days, 1, 730, 21),
    online: b.online_enabled !== false,
    staff: {}, order: [], av: {}, off: [], appts: {}
  };
  for (const s of staff || []) { ag.staff[s.id] = s; ag.order.push(s.id); }
  const raw = {};
  for (const r of availability || []) {
    const w = (raw[r.staff_id] = raw[r.staff_id] || {});
    (w[r.weekday] = w[r.weekday] || []).push([r.start_min, r.end_min]);
  }
  for (const id of Object.keys(raw)) { ag.av[id] = {}; for (let d = 0; d < 7; d++) ag.av[id][d] = mergeRanges(raw[id][d]); }
  ag.off = (timeOff || []).filter((t) => t && t.date_from && t.date_to);
  for (const a of appointments || []) {
    if (!OCCUPYING.includes(a.status)) continue;
    const k = a.staff_id + '|' + a.date;
    (ag.appts[k] = ag.appts[k] || []).push({ id: a.id, s: a.start_min, e: a.end_min, name: a.client_name || '' });
  }
  return ag;
}

// Carga todo lo necesario para [from, to] con 4 consultas (sdb = base con scope de la barbería).
export async function loadAgenda(sdb, shop, { from, to }) {
  to = to || from;
  const [staff, availability, timeOff, appointments] = await Promise.all([
    sdb.find('staff', {}, { order: ['sort asc', 'name asc'] }),
    sdb.find('availability', {}),
    sdb.find('time_off', { date_from: { lte: to }, date_to: { gte: from } }),
    sdb.find('appointments', { date: from === to ? from : { gte: from, lte: to }, status: { in: OCCUPYING } })
  ]);
  return buildAgenda({ settings: shopSettings(shop), staff, availability, timeOff, appointments });
}

// Barberos candidatos: activos, (reservables) y que ofrezcan TODOS los servicios (staff_ids vacío/null = todos).
export function candidates(ag, services, { bookable } = {}) {
  return ag.order.map((id) => ag.staff[id]).filter((s) => s.active && (!bookable || s.bookable) && offersAll(s.id, services));
}
export function offersAll(staffId, services) {
  return (services || []).every((sv) => !Array.isArray(sv.staff_ids) || !sv.staff_ids.length || sv.staff_ids.includes(staffId));
}

// ── Consultas sobre la agenda ──
const offApplies = (t, staffId, date) => (t.staff_id == null || t.staff_id === staffId) && t.date_from <= date && t.date_to >= date;
const fullDay = (t) => t.start_min == null || t.end_min == null;

// Semana efectiva de un barbero: sus bloques o, si no tiene ninguno, el horario de la barbería.
export function weekFor(ag, staffId) {
  const own = ag.av[staffId];
  const w = {};
  for (let d = 0; d < 7; d++) w[d] = own ? own[d].map((x) => x.slice()) : mergeRanges(ag.hours[d]);
  return w;
}

// Intersección de dos listas de rangos ordenadas y sin traslapes.
export function intersectRanges(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    const s = Math.max(a[i][0], b[j][0]), e = Math.min(a[i][1], b[j][1]);
    if (e > s) out.push([s, e]);
    if (a[i][1] < b[j][1]) i++; else j++;
  }
  return out;
}

// Bloques de trabajo de un barbero en una fecha ([] = no trabaja / descanso de día completo).
// mode 'public': además, solo dentro del horario de la barbería (settings.hours) de ese día.
export function blocksFor(ag, staffId, date, mode) {
  if (ag.off.some((t) => fullDay(t) && offApplies(t, staffId, date))) return [];
  const own = ag.av[staffId];
  const wd = weekday(date);
  const shop = mergeRanges(ag.hours[wd]);
  if (!own) return shop;
  return mode === 'public' ? intersectRanges(own[wd], shop) : own[wd];
}

// Rangos ocupados (citas expandidas por buffer + descansos parciales), ordenados y unidos.
export function busyFor(ag, staffId, date, excludeId) {
  const out = [];
  for (const a of ag.appts[staffId + '|' + date] || []) if (a.id !== excludeId) out.push([a.s - ag.buffer, a.e + ag.buffer]);
  for (const t of ag.off) if (!fullDay(t) && offApplies(t, staffId, date)) out.push([t.start_min, t.end_min]);
  return mergeRanges(out);
}

// Minutos ya agendados de un barbero ese día (para repartir carga con 'any').
export function bookedMinutes(ag, staffId, date, excludeId) {
  let m = 0;
  for (const a of ag.appts[staffId + '|' + date] || []) if (a.id !== excludeId) m += Math.max(0, a.e - a.s);
  return m;
}

// Inicios libres de un barbero (rejilla de step_min desde el inicio de cada bloque). null = no trabaja ese día.
export function freeStarts(ag, staffId, date, dur, { minStart = -Infinity, excludeId, mode } = {}) {
  const blocks = blocksFor(ag, staffId, date, mode);
  if (!blocks.length) return null;
  const busy = busyFor(ag, staffId, date, excludeId);
  const out = [];
  let j = 0;
  for (const [bs, be] of blocks) {
    for (let t = bs; t + dur <= be; t += ag.step) {
      if (t < minStart) continue;
      while (j < busy.length && busy[j][1] <= t) j++;
      if (j < busy.length && busy[j][0] < t + dur) continue;
      out.push(t);
    }
  }
  return out;
}

// Reglas de reserva en línea para una fecha: { minStart } o { reason, message } si no se puede reservar.
export function publicWindow(ag, date, now) {
  if (!ag.online) return { reason: 'offline', message: 'Por ahora esta barbería no recibe reservas en línea.' };
  const d = diffDays(now.date, date);
  if (d < 0) return { reason: 'past', message: 'Esa fecha ya pasó. Elige otra.' };
  if (d > ag.windowDays) return { reason: 'out_of_window', message: 'Solo se puede reservar con hasta ' + ag.windowDays + ' días de anticipación.' };
  return { minStart: now.minutes + ag.lead - d * 1440 };
}

export function computeSlots(ag, { date, duration, staffIds, now, mode, excludeId }) {
  const res = { date, duration_min: duration, closed: false, slots: [] };
  let minStart = -Infinity;
  if (mode === 'public') {
    const w = publicWindow(ag, date, now);
    if (w.reason) return Object.assign(res, { closed: w.reason === 'offline', reason: w.reason, message: w.message });
    minStart = w.minStart;
  }
  const by = new Map();
  let open = false;
  for (const id of staffIds) {
    const starts = freeStarts(ag, id, date, duration, { minStart, excludeId, mode });
    if (!starts) continue;
    open = true;
    for (const t of starts) { if (!by.has(t)) by.set(t, []); by.get(t).push(id); }
  }
  if (!open) return Object.assign(res, { closed: true, reason: 'closed', message: 'Ese día no hay servicio. Elige otra fecha.' });
  res.slots = [...by.keys()].sort((a, b) => a - b).map((t) => ({ start_min: t, staff_ids: by.get(t) }));
  if (!res.slots.length) Object.assign(res, { reason: 'full', message: 'Ya no hay horarios libres ese día. Elige otra fecha.' });
  return res;
}

// { date, open, available, reason? }. Sin horarios, reason dice por qué: 'closed' (no hay servicio), 'full'
// (abierto pero sin lugar), 'out_of_window' (más allá de window_days), 'past' u 'offline' (reservas en línea
// apagadas). Solo 'full' cuenta como día abierto: fuera de la ventana u offline no es "lleno".
export function computeDays(ag, { from, days, duration, staffIds, now, mode, excludeId }) {
  return eachDay(from, addDays(from, Math.max(1, days) - 1)).map((date) => {
    const r = computeSlots(ag, { date, duration, staffIds, now, mode, excludeId });
    const available = r.slots.length > 0;
    const out = { date, open: !r.closed && !['out_of_window', 'past', 'offline'].includes(r.reason), available };
    if (!available) out.reason = r.reason || 'full';
    return out;
  });
}

// ¿Está libre [start, start+duration) para ese barbero? null = sí; si no, { reason, message, conflict_id? }.
// Mensajes en modo 'public' sin datos de otros clientes.
export function checkFree(ag, { staffId, date, start, duration, excludeId, now, mode }) {
  const st = ag.staff[staffId];
  const who = st ? st.name : 'El barbero';
  const pub = mode === 'public';
  const end = start + duration;
  if (!Number.isInteger(start) || start < 0 || end > 1440) return { reason: 'overflow', message: 'La cita debe empezar y terminar el mismo día (antes de las 24:00).' };
  if (pub) {
    const w = publicWindow(ag, date, now);
    if (w.reason) return w;
    if (start < w.minStart) return { reason: 'lead', message: 'Ese horario ya no está disponible para reservar en línea. Elige otro.' };
  }
  for (const t of ag.off) {
    if (!offApplies(t, staffId, date)) continue;
    if (fullDay(t) || (t.start_min < end && t.end_min > start)) {
      return { reason: 'time_off', message: pub ? 'Ese horario no está disponible. Elige otro.' : who + ' tiene un descanso registrado en ese horario' + (t.reason ? ' (' + t.reason + ')' : '') + '.' };
    }
  }
  if (mode !== 'restore') {
    const blocks = blocksFor(ag, staffId, date, mode);
    const inBlock = blocks.find(([s, e]) => start >= s && end <= e);
    if (!blocks.length) return { reason: 'day_off', message: pub ? 'Ese día no hay servicio con ese barbero. Elige otra fecha.' : who + ' no trabaja ese día.' };
    if (!inBlock) return { reason: 'outside_hours', message: pub ? 'Ese horario no está disponible. Elige otro.' : 'Ese horario está fuera del horario de trabajo de ' + who + '.' };
    if (pub && (start - inBlock[0]) % ag.step !== 0) return { reason: 'grid', message: 'Elige uno de los horarios disponibles.' };
  }
  for (const a of ag.appts[staffId + '|' + date] || []) {
    if (a.id === excludeId) continue;
    if (a.s - ag.buffer < end && a.e + ag.buffer > start) {
      if (pub) return { reason: 'taken', conflict_id: a.id, message: 'Ese horario acaba de ocuparse. Elige otro.' };
      const real = a.s < end && a.e > start;
      return {
        reason: 'taken', conflict_id: a.id,
        message: real
          ? 'Ese horario choca con otra cita de ' + who + ' (' + fmtMin(a.s) + '–' + fmtMin(a.e) + (a.name ? ', ' + a.name : '') + ').'
          : 'Se necesitan ' + ag.buffer + ' min libres entre citas de ' + who + ' (hay otra de ' + fmtMin(a.s) + ' a ' + fmtMin(a.e) + ').'
      };
    }
  }
  return null;
}

// 'Cualquier barbero': entre los candidatos libres, el de menos minutos agendados ese día.
// staffIds ya viene en orden (sort, nombre) → el empate lo gana el primero. anyFree:false ignora si está libre (force).
export function pickStaff(ag, { date, start, duration, staffIds, excludeId, now, mode, anyFree = true }) {
  let best = null, bestLoad = Infinity;
  for (const id of staffIds) {
    if (anyFree && checkFree(ag, { staffId: id, date, start, duration, excludeId, now, mode })) continue;
    const load = bookedMinutes(ag, id, date, excludeId);
    if (load < bestLoad) { best = id; bestLoad = load; }
  }
  return best;
}
