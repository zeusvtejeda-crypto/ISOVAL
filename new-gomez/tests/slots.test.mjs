import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { addDays } from '../core/util.js';
import {
  buildAgenda, computeSlots, computeDays, checkFree, pickStaff, freeStarts, mergeRanges, weekFor, candidates
} from '../core/domain/slots.js';

// ── Motor puro ──
const MON = '2026-10-05'; // lunes
const SUN = '2026-10-04';
const hours = { 0: [], 1: [[600, 1200]], 2: [[600, 1200]], 3: [[600, 1200]], 4: [[600, 1200]], 5: [[600, 1200]], 6: [[600, 960]] };
const staff = [
  { id: 'a', name: 'Ana', active: true, bookable: true, sort: 0 },
  { id: 'b', name: 'Beto', active: true, bookable: true, sort: 1 },
  { id: 'c', name: 'Caro', active: false, bookable: true, sort: 2 },
  { id: 'd', name: 'Dani', active: true, bookable: false, sort: 3 }
];
const ap = (id, staff_id, date, s, e, status) => ({ id, staff_id, date, start_min: s, end_min: e, status: status || 'confirmed', client_name: 'X' });
const agenda = (o) => buildAgenda(Object.assign({ settings: { hours, booking: { step_min: 20, lead_min: 0, window_days: 21, buffer_min: 0 } }, staff, availability: [], timeOff: [], appointments: [] }, o || {}));
const farNow = { date: '2026-10-01', minutes: 600 };
const starts = (r) => r.slots.map((s) => s.start_min);

test('slots: rejilla básica desde el inicio del bloque y sin pasarse del cierre', () => {
  const ag = agenda();
  const r = computeSlots(ag, { date: MON, duration: 40, staffIds: ['a'], now: farNow, mode: 'public' });
  assert.equal(r.closed, false);
  assert.equal(r.duration_min, 40);
  const s = starts(r);
  assert.equal(s[0], 600);
  assert.equal(s[s.length - 1], 1160);
  assert.equal(s.length, 29);
  assert.ok(s.every((t, i) => i === 0 || t > s[i - 1]), 'ordenado');
});

test('slots: domingo cerrado → closed:true', () => {
  const r = computeSlots(agenda(), { date: SUN, duration: 40, staffIds: ['a', 'b'], now: farNow, mode: 'public' });
  assert.equal(r.closed, true);
  assert.deepEqual(r.slots, []);
});

test('slots: bloques partidos (comida) — nada cruza el hueco', () => {
  const availability = [1, 2, 3, 4, 5, 6].flatMap((wd) => [
    { staff_id: 'a', weekday: wd, start_min: 600, end_min: 840 },
    { staff_id: 'a', weekday: wd, start_min: 900, end_min: 1200 }
  ]);
  const ag = agenda({ availability });
  const s = starts(computeSlots(ag, { date: MON, duration: 40, staffIds: ['a'], now: farNow, mode: 'staff' }));
  assert.ok(s.includes(800), '800–840 cabe antes de comer');
  assert.ok(!s.includes(820) && !s.includes(840) && !s.includes(860) && !s.includes(880));
  assert.ok(s.includes(900));
  for (const t of s) assert.ok((t >= 600 && t + 40 <= 840) || (t >= 900 && t + 40 <= 1200));
});

test('slots: barbero sin filas de availability usa el horario de la barbería; semana vacía (centinela) cierra', () => {
  const ag = agenda({ availability: [{ staff_id: 'b', weekday: 0, start_min: 0, end_min: 0 }] });
  assert.deepEqual(weekFor(ag, 'a')[1], [[600, 1200]]);
  assert.deepEqual(weekFor(ag, 'b')[1], []);
  assert.equal(freeStarts(ag, 'b', MON, 40), null);
  const r = computeSlots(ag, { date: MON, duration: 40, staffIds: ['a', 'b'], now: farNow, mode: 'public' });
  assert.ok(r.slots.every((x) => x.staff_ids.length === 1 && x.staff_ids[0] === 'a'));
});

test('slots: citas existentes bloquean y las canceladas / no asistió liberan', () => {
  const ag = agenda({ appointments: [ap('1', 'a', MON, 600, 640), ap('2', 'a', MON, 700, 760, 'cancelled'), ap('3', 'a', MON, 800, 840, 'no_show'), ap('4', 'a', MON, 900, 940, 'pending'), ap('5', 'a', MON, 1000, 1040, 'completed')] });
  const s = starts(computeSlots(ag, { date: MON, duration: 40, staffIds: ['a'], now: farNow, mode: 'staff' }));
  assert.ok(!s.includes(600) && !s.includes(620));
  assert.ok(s.includes(640));
  assert.ok(s.includes(700) && s.includes(720), 'cancelada libera');
  assert.ok(s.includes(800), 'no_show libera');
  assert.ok(!s.includes(880) && !s.includes(900) && !s.includes(920), 'pendiente ocupa');
  assert.ok(!s.includes(1000), 'atendida ocupa');
  // Ningún horario ofrecido traslapa una cita que ocupa.
  for (const t of s) for (const [x, y] of [[600, 640], [900, 940], [1000, 1040]]) assert.ok(t + 40 <= x || t >= y, 'traslape en ' + t);
});

test('slots: buffer_min separa citas por ambos lados', () => {
  const ag = buildAgenda({ settings: { hours, booking: { step_min: 10, buffer_min: 15 } }, staff, availability: [], timeOff: [], appointments: [ap('1', 'a', MON, 700, 740)] });
  const s = starts(computeSlots(ag, { date: MON, duration: 30, staffIds: ['a'], now: farNow, mode: 'staff' }));
  assert.ok(s.includes(650) && !s.includes(660), 'termina 685 ≤ 700−15');
  assert.ok(!s.includes(750) && s.includes(760), 'empieza ≥ 740+15 → 760 en rejilla de 10');
  const r = checkFree(ag, { staffId: 'a', date: MON, start: 745, duration: 30, now: farNow, mode: 'staff' });
  assert.equal(r.reason, 'taken');
  assert.match(r.message, /15 min/);
});

test('slots: lead_min hoy, fechas pasadas, ventana y reservas en línea apagadas', () => {
  const ag = buildAgenda({ settings: { hours, booking: { step_min: 20, lead_min: 30, window_days: 7 } }, staff, availability: [], timeOff: [], appointments: [] });
  const now = { date: MON, minutes: 605 };
  const s = starts(computeSlots(ag, { date: MON, duration: 40, staffIds: ['a'], now, mode: 'public' }));
  assert.equal(s[0], 640, '10:05 + 30 min → primer horario 10:40');
  // staff: sin lead (permite registrar lo ya atendido)
  assert.equal(starts(computeSlots(ag, { date: MON, duration: 40, staffIds: ['a'], now, mode: 'staff' }))[0], 600);
  const past = computeSlots(ag, { date: addDays(MON, -1), duration: 40, staffIds: ['a'], now, mode: 'public' });
  assert.equal(past.slots.length, 0); assert.equal(past.reason, 'past');
  assert.equal(computeSlots(ag, { date: addDays(MON, 7), duration: 40, staffIds: ['a'], now, mode: 'public' }).slots.length > 0, true);
  const far = computeSlots(ag, { date: addDays(MON, 8), duration: 40, staffIds: ['a'], now, mode: 'public' });
  assert.equal(far.slots.length, 0); assert.equal(far.reason, 'out_of_window');
  // lead de más de un día también aplica a mañana
  const ag2 = buildAgenda({ settings: { hours, booking: { step_min: 20, lead_min: 1440 } }, staff, availability: [], timeOff: [], appointments: [] });
  assert.equal(starts(computeSlots(ag2, { date: addDays(MON, 1), duration: 40, staffIds: ['a'], now, mode: 'public' }))[0], 620);
  const off = buildAgenda({ settings: { hours, booking: { online_enabled: false } }, staff, availability: [], timeOff: [], appointments: [] });
  const r = computeSlots(off, { date: addDays(MON, 1), duration: 40, staffIds: ['a'], now, mode: 'public' });
  assert.equal(r.closed, true); assert.equal(r.reason, 'offline');
});

test('slots: descansos parciales, de día completo y de toda la barbería', () => {
  const timeOff = [
    { staff_id: 'a', date_from: MON, date_to: MON, start_min: 840, end_min: 900, reason: 'Comida' },
    { staff_id: 'b', date_from: MON, date_to: addDays(MON, 1), start_min: null, end_min: null, reason: 'Vacaciones' },
    { staff_id: null, date_from: addDays(MON, 2), date_to: addDays(MON, 2), start_min: null, end_min: null, reason: 'Feriado' }
  ];
  const ag = agenda({ timeOff });
  const r = computeSlots(ag, { date: MON, duration: 40, staffIds: ['a', 'b'], now: farNow, mode: 'public' });
  const s = starts(r);
  assert.ok(!s.includes(820) && !s.includes(860) && s.includes(800) && s.includes(900));
  assert.ok(r.slots.every((x) => !x.staff_ids.includes('b')), 'b de vacaciones');
  assert.equal(freeStarts(ag, 'b', addDays(MON, 1), 40), null);
  assert.equal(computeSlots(ag, { date: addDays(MON, 2), duration: 40, staffIds: ['a', 'b'], now: farNow, mode: 'public' }).closed, true, 'feriado');
  const cf = checkFree(ag, { staffId: 'a', date: MON, start: 860, duration: 40, now: farNow, mode: 'staff' });
  assert.equal(cf.reason, 'time_off'); assert.match(cf.message, /Comida/);
  assert.equal(checkFree(ag, { staffId: 'a', date: MON, start: 860, duration: 40, now: farNow, mode: 'public' }).message.includes('Comida'), false, 'al público no se le da el motivo');
});

test("slots: 'any' une barberos y pickStaff reparte la carga (empate → orden)", () => {
  const ag = agenda({ appointments: [ap('1', 'a', MON, 600, 700), ap('2', 'b', MON, 800, 820)] });
  const r = computeSlots(ag, { date: MON, duration: 40, staffIds: ['a', 'b'], now: farNow, mode: 'public' });
  assert.deepEqual(r.slots.find((x) => x.start_min === 600).staff_ids, ['b']);
  assert.deepEqual(r.slots.find((x) => x.start_min === 900).staff_ids, ['a', 'b']);
  // a tiene 100 min, b 20 → b
  assert.equal(pickStaff(ag, { date: MON, start: 900, duration: 40, staffIds: ['a', 'b'], now: farNow, mode: 'public' }), 'b');
  // a las 10:00 solo b está libre
  assert.equal(pickStaff(ag, { date: MON, start: 600, duration: 40, staffIds: ['a', 'b'], now: farNow, mode: 'public' }), 'b');
  // a las 13:20 b está ocupado → a
  assert.equal(pickStaff(ag, { date: MON, start: 800, duration: 20, staffIds: ['a', 'b'], now: farNow, mode: 'public' }), 'a');
  const empty = agenda();
  assert.equal(pickStaff(empty, { date: MON, start: 900, duration: 40, staffIds: ['a', 'b'], now: farNow, mode: 'public' }), 'a', 'empate → primero');
  // Reparto: asignar 6 citas seguidas con 'any' alterna entre barberos.
  const appts = [];
  for (let i = 0; i < 6; i++) {
    const g = agenda({ appointments: appts });
    const id = pickStaff(g, { date: MON, start: 600 + i * 40, duration: 40, staffIds: ['a', 'b'], now: farNow, mode: 'public' });
    appts.push(ap('x' + i, id, MON, 600 + i * 40, 640 + i * 40));
  }
  assert.equal(appts.filter((x) => x.staff_id === 'a').length, 3);
});

test('slots: candidatos — activos, reservables y que ofrecen todos los servicios', () => {
  const ag = agenda();
  const svcs = [{ id: 's1', staff_ids: [] }, { id: 's2', staff_ids: ['b', 'd'] }];
  assert.deepEqual(candidates(ag, svcs, { bookable: true }).map((s) => s.id), ['b']);
  assert.deepEqual(candidates(ag, svcs, {}).map((s) => s.id), ['b', 'd']);
  assert.deepEqual(candidates(ag, [{ id: 's1', staff_ids: null }], { bookable: true }).map((s) => s.id), ['a', 'b']);
});

test('slots: checkFree — fuera de horario, rejilla pública, medianoche y restaurar', () => {
  const ag = agenda({ appointments: [ap('1', 'a', MON, 700, 740)] });
  assert.equal(checkFree(ag, { staffId: 'a', date: MON, start: 1180, duration: 40, now: farNow, mode: 'staff' }).reason, 'outside_hours');
  assert.equal(checkFree(ag, { staffId: 'a', date: SUN, start: 700, duration: 40, now: farNow, mode: 'staff' }).reason, 'day_off');
  assert.equal(checkFree(ag, { staffId: 'a', date: MON, start: 605, duration: 40, now: farNow, mode: 'public' }).reason, 'grid');
  assert.equal(checkFree(ag, { staffId: 'a', date: MON, start: 605, duration: 40, now: farNow, mode: 'staff' }), null, 'el panel acepta cualquier minuto');
  assert.equal(checkFree(ag, { staffId: 'a', date: MON, start: 1420, duration: 40, now: farNow, mode: 'staff' }).reason, 'overflow');
  assert.equal(checkFree(ag, { staffId: 'a', date: MON, start: 720, duration: 40, now: farNow, mode: 'staff' }).reason, 'taken');
  assert.equal(checkFree(ag, { staffId: 'a', date: MON, start: 720, duration: 40, excludeId: '1', now: farNow, mode: 'staff' }), null, 'exclude');
  assert.equal(checkFree(ag, { staffId: 'a', date: SUN, start: 700, duration: 40, now: farNow, mode: 'restore' }), null, 'restaurar no exige horario');
  assert.match(checkFree(ag, { staffId: 'a', date: MON, start: 720, duration: 40, now: farNow, mode: 'public' }).message, /acaba de ocuparse/);
});

test('slots: computeDays marca abiertos/disponibles', () => {
  const ag = buildAgenda({ settings: { hours, booking: { window_days: 3 } }, staff, availability: [], timeOff: [], appointments: [] });
  const d = computeDays(ag, { from: SUN, days: 6, duration: 40, staffIds: ['a'], now: { date: SUN, minutes: 0 }, mode: 'public' });
  assert.equal(d.length, 6);
  assert.deepEqual(d[0], { date: SUN, open: false, available: false, reason: 'closed' });
  assert.deepEqual(d[1], { date: MON, open: true, available: true });
  assert.equal(d[4].available, false, 'fuera de la ventana de 3 días');
});

test('slots: computeDays — días fuera de la ventana no se ven "llenos": open:false con motivo', () => {
  const ag = buildAgenda({ settings: { hours, booking: { window_days: 3 } }, staff, availability: [], timeOff: [], appointments: [ap('1', 'a', MON, 600, 1200)] });
  const d = computeDays(ag, { from: SUN, days: 6, duration: 40, staffIds: ['a'], now: { date: SUN, minutes: 0 }, mode: 'public' });
  assert.deepEqual(d[1], { date: MON, open: true, available: false, reason: 'full' }, 'lleno de verdad');
  assert.deepEqual(d[3], { date: '2026-10-07', open: true, available: true }, 'último día de la ventana');
  assert.deepEqual(d[4], { date: '2026-10-08', open: false, available: false, reason: 'out_of_window' });
  const off = buildAgenda({ settings: { hours, booking: { online_enabled: false } }, staff, availability: [], timeOff: [], appointments: [] });
  assert.deepEqual(computeDays(off, { from: MON, days: 1, duration: 40, staffIds: ['a'], now: farNow, mode: 'public' })[0], { date: MON, open: false, available: false, reason: 'offline' });
});

test('slots: la reserva en línea es la intersección del horario del barbero con el de la barbería', () => {
  // Ana trabaja 9:00–21:00 todos los días (sus propias filas); la barbería abre 10:00–20:00 y cierra el domingo.
  const av = [0, 1, 2, 3, 4, 5, 6].map((wd) => ({ staff_id: 'a', weekday: wd, start_min: 540, end_min: 1260 }));
  let ag = agenda({ availability: av });
  let r = computeSlots(ag, { date: MON, duration: 40, staffIds: ['a'], now: farNow, mode: 'public' });
  assert.equal(starts(r)[0], 600, 'no antes de que abra la barbería');
  assert.equal(starts(r)[starts(r).length - 1], 1160, 'termina antes del cierre');
  assert.equal(checkFree(ag, { staffId: 'a', date: MON, start: 540, duration: 40, now: farNow, mode: 'public' }).reason, 'outside_hours');
  assert.equal(checkFree(ag, { staffId: 'a', date: MON, start: 540, duration: 40, now: farNow, mode: 'staff' }), null, 'el panel usa el horario del barbero');
  r = computeSlots(ag, { date: SUN, duration: 40, staffIds: ['a'], now: farNow, mode: 'public' });
  assert.equal(r.closed, true, 'barbería cerrada el domingo → sin reserva en línea');
  assert.equal(checkFree(ag, { staffId: 'a', date: SUN, start: 600, duration: 40, now: farNow, mode: 'public' }).reason, 'day_off');
  assert.equal(computeSlots(ag, { date: SUN, duration: 40, staffIds: ['a'], now: farNow, mode: 'staff' }).closed, false);
  // Horario partido de la barbería: nada cruza el hueco.
  ag = buildAgenda({ settings: { hours: Object.assign({}, hours, { 1: [[600, 840], [960, 1200]] }), booking: { step_min: 20, lead_min: 0, window_days: 21 } }, staff, availability: av, timeOff: [], appointments: [] });
  r = computeSlots(ag, { date: MON, duration: 40, staffIds: ['a'], now: farNow, mode: 'public' });
  assert.ok(starts(r).every((t) => t + 40 <= 840 || t >= 960));
  assert.ok(starts(r).includes(960));
});

test('slots: mergeRanges ordena, une contiguos y descarta inválidos', () => {
  assert.deepEqual(mergeRanges([[900, 1000], [600, 700], [700, 800], [50, 50], ['x', 3], [950, 1100]]), [[600, 800], [900, 1100]]);
});

test('slots: rendimiento — 60 días × 4 barberos con muchas citas', () => {
  const appointments = [];
  for (let d = 0; d < 60; d++) for (let i = 0; i < 12; i++) appointments.push(ap('p' + d + '_' + i, i % 2 ? 'a' : 'b', addDays(MON, d), 600 + i * 40, 640 + i * 40));
  const ag = agenda({ appointments });
  const t0 = Date.now();
  const days = computeDays(ag, { from: MON, days: 60, duration: 40, staffIds: ['a', 'b', 'd'], now: { date: MON, minutes: 0 }, mode: 'staff' });
  assert.equal(days.length, 60);
  assert.ok(Date.now() - t0 < 500);
});

// ── API: /api/slots, disponibilidad y descansos ──
async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  await f.db.update('staff', { id: 'st_barberA2' }, { pin_hash: 'pbkdf2$1000$prueba$prueba' }); // una sesión PIN exige PIN configurado
  f.tokens.barberA2 = await createSession(f.db, { kind: 'pin', staff_id: 'st_barberA2', shop_id: 'shop_a' });
  return f;
}
const A = { shop: 'shop_a' };

test('api /api/slots: dueño ve cualquiera, barbero solo el suyo, cliente no', async () => {
  const f = await setup();
  let r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte,sv_barba&staff_id=any', { as: 'ownerA', ...A });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.duration_min, 60, 'duración multi-servicio');
  assert.ok(r.data.slots.length > 0);
  assert.ok(r.data.slots[0].staff_ids.length === 3);
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte&staff_id=st_barberA2', { as: 'ownerA', ...A });
  assert.equal(r.status, 200);
  assert.ok(r.data.slots.every((s) => s.staff_ids.join() === 'st_barberA2'));
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte', { as: 'barberA', ...A });
  assert.equal(r.status, 200);
  assert.ok(r.data.slots.every((s) => s.staff_ids.join() === 'st_barberA'), 'barbero: su agenda');
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte&staff_id=st_barberA2', { as: 'barberA', ...A });
  assert.equal(r.status, 403);
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte', { as: 'clientA', ...A });
  assert.equal(r.status, 403);
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corteB&staff_id=any', { as: 'ownerA', ...A });
  assert.equal(r.status, 400, 'servicio de otra barbería');
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte&staff_id=st_ownerB', { as: 'ownerA', ...A });
  assert.equal(r.status, 400, 'barbero de otra barbería');
  r = await f.call('GET', '/api/slots?date=mañana&services=sv_corte&staff_id=any', { as: 'ownerA', ...A });
  assert.equal(r.status, 400); assert.ok(r.error.fields.date);
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte&staff_id=any', { as: 'super', ...A });
  assert.equal(r.status, 200, 'superadmin actúa como dueño');
});

test('api /api/slots: exclude permite reubicar una cita sobre su propio horario', async () => {
  const f = await setup();
  const c = await f.call('POST', '/api/appointments', { as: 'ownerA', ...A, body: { staff_id: 'st_barberA', date: f.day, start_min: 600, services: ['sv_corte'], client: { name: 'Pepe' } } });
  assert.equal(c.status, 200, c.body);
  let r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte&staff_id=st_barberA', { as: 'ownerA', ...A });
  assert.ok(!r.data.slots.some((s) => s.start_min === 600));
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte&staff_id=st_barberA&exclude=' + c.data.id, { as: 'ownerA', ...A });
  assert.ok(r.data.slots.some((s) => s.start_min === 600));
});

test('api disponibilidad: leer, validar y guardar; barbero solo la suya; aislamiento', async () => {
  const f = await setup();
  let r = await f.call('GET', '/api/availability', { as: 'ownerA', ...A });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.data).sort(), ['st_barberA', 'st_barberA2', 'st_ownerA']);
  assert.deepEqual(r.data.st_barberA[1], [[600, 1200]]);
  r = await f.call('GET', '/api/availability', { as: 'barberA', ...A });
  assert.deepEqual(Object.keys(r.data), ['st_barberA']);
  r = await f.call('GET', '/api/availability?staff_id=st_ownerA', { as: 'barberA', ...A });
  assert.equal(r.status, 403);

  const week = { 1: [[900, 1200], [600, 840]], 2: [['10:00', '14:00'], ['14:00', '19:00']], 3: [], 6: [{ start_min: 600, end_min: 900 }] };
  r = await f.call('PUT', '/api/availability/st_barberA', { as: 'barberA', ...A, body: { week } });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.data.st_barberA[1], [[600, 840], [900, 1200]], 'ordenado');
  assert.deepEqual(r.data.st_barberA[2], [[600, 1140]], 'contiguos unidos');
  assert.deepEqual(r.data.st_barberA[0], []);
  r = await f.call('GET', '/api/availability?staff_id=st_barberA', { as: 'ownerA', ...A });
  assert.deepEqual(r.data.st_barberA[3], []);
  // Los horarios públicos respetan el nuevo horario (comida 14:00–15:00 del lunes).
  const mon = (() => { let d = f.day; while (new Date(d + 'T12:00:00Z').getUTCDay() !== 1) d = addDays(d, 1); return d; })();
  r = await f.call('GET', '/api/slots?date=' + mon + '&services=sv_corte&staff_id=st_barberA', { as: 'ownerA', ...A });
  assert.ok(!r.data.slots.some((s) => s.start_min === 820));

  for (const bad of [{ 1: [[600, 600]] }, { 1: [[700, 600]] }, { 1: [[600, 800], [700, 900]] }, { 1: [[600, 1500]] }, { 1: 'x' }, { 1: [['25:00', '26:00']] }]) {
    r = await f.call('PUT', '/api/availability/st_barberA', { as: 'ownerA', ...A, body: { week: bad } });
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.ok(r.error.fields['week.1'], JSON.stringify(r.error));
  }
  r = await f.call('PUT', '/api/availability/st_barberA2', { as: 'barberA', ...A, body: { week } });
  assert.equal(r.status, 403, 'barbero no toca la de otro');
  r = await f.call('PUT', '/api/availability/st_barberA', { as: 'ownerB', shop: 'shop_b', body: { week } });
  assert.equal(r.status, 404, 'dueño B no ve staff de A');
  r = await f.call('PUT', '/api/availability/st_barberA', { as: 'ownerB', ...A, body: { week } });
  assert.equal(r.status, 403, 'dueño B no entra a la barbería A');
  r = await f.call('GET', '/api/availability', { as: 'clientA', ...A });
  assert.equal(r.status, 403);

  // Semana vacía: no hereda el horario de la barbería.
  r = await f.call('PUT', '/api/availability/st_barberA2', { as: 'ownerA', ...A, body: { week: {} } });
  assert.equal(r.status, 200);
  r = await f.call('GET', '/api/availability?staff_id=st_barberA2', { as: 'ownerA', ...A });
  assert.deepEqual(r.data.st_barberA2[1], []);
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte&staff_id=st_barberA2', { as: 'ownerA', ...A });
  assert.equal(r.data.closed, true);
});

test('api descansos: crear, listar, borrar, permisos y aislamiento', async () => {
  const f = await setup();
  let r = await f.call('POST', '/api/time-off', { as: 'barberA', ...A, body: { date_from: f.day, start_min: '14:00', end_min: '15:00', reason: 'Comida' } });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.staff_id, 'st_barberA');
  assert.equal(r.data.date_to, f.day);
  assert.equal(r.data.conflicts, 0);
  const mine = r.data.id;
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte', { as: 'barberA', ...A });
  assert.ok(!r.data.slots.some((s) => s.start_min >= 820 && s.start_min < 900));

  r = await f.call('POST', '/api/time-off', { as: 'barberA', ...A, body: { staff_id: null, date_from: f.day } });
  assert.equal(r.status, 403, 'barbero no crea feriados');
  r = await f.call('POST', '/api/time-off', { as: 'barberA', ...A, body: { staff_id: 'st_barberA2', date_from: f.day } });
  assert.equal(r.status, 403);

  const c = await f.call('POST', '/api/appointments', { as: 'ownerA', ...A, body: { staff_id: 'st_barberA2', date: f.day, start_min: 600, services: ['sv_corte'], client: { name: 'Luis' } } });
  assert.equal(c.status, 200, c.body);
  r = await f.call('POST', '/api/time-off', { as: 'ownerA', ...A, body: { staff_id: null, date_from: f.day, date_to: f.day, reason: 'Feriado' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.conflicts, 1, 'avisa citas afectadas');
  const holiday = r.data.id;
  r = await f.call('GET', '/api/slots?date=' + f.day + '&services=sv_corte&staff_id=any', { as: 'ownerA', ...A });
  assert.equal(r.data.closed, true);

  for (const body of [{ date_from: 'x' }, { date_from: f.day, date_to: addDays(f.day, -1) }, { date_from: f.day, start_min: 900, end_min: 800 }, { date_from: f.day, start_min: 900 }, { date_from: f.day, reason: 'x'.repeat(200) }, { staff_id: 'st_ownerB', date_from: f.day }]) {
    r = await f.call('POST', '/api/time-off', { as: 'ownerA', ...A, body });
    assert.equal(r.status, 400, JSON.stringify(body));
  }

  r = await f.call('GET', '/api/time-off?from=' + f.day + '&to=' + f.day, { as: 'barberA', ...A });
  assert.deepEqual(r.data.map((x) => x.id).sort(), [mine, holiday].sort(), 'barbero: los suyos + los de toda la barbería');
  assert.equal(r.data.find((x) => x.id === holiday).staff_name, 'Toda la barbería');
  r = await f.call('GET', '/api/time-off?from=' + f.day + '&to=' + f.day, { as: 'ownerB', shop: 'shop_b' });
  assert.deepEqual(r.data, [], 'B no ve descansos de A');

  r = await f.call('DELETE', '/api/time-off/' + holiday, { as: 'barberA', ...A });
  assert.equal(r.status, 403);
  r = await f.call('DELETE', '/api/time-off/' + mine, { as: 'ownerB', shop: 'shop_b' });
  assert.equal(r.status, 404, 'B no borra de A');
  r = await f.call('DELETE', '/api/time-off/' + mine, { as: 'barberA', ...A });
  assert.equal(r.status, 200);
  r = await f.call('DELETE', '/api/time-off/' + holiday, { as: 'ownerA', ...A });
  assert.equal(r.status, 200);
  r = await f.call('GET', '/api/time-off?from=' + f.day + '&to=' + f.day, { as: 'ownerA', ...A });
  assert.deepEqual(r.data, []);
});

test('slots: propiedad — lo que se ofrece es exactamente lo que checkFree acepta, sin traslapes (aleatorio)', () => {
  let seed = 42;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let round = 0; round < 60; round++) {
    const step = [10, 15, 20, 30][rnd(4)];
    const buffer = [0, 5, 10][rnd(3)];
    const appointments = [];
    for (let i = 0; i < rnd(8); i++) { const s = 600 + rnd(36) * 15; appointments.push(ap('r' + i, ['a', 'b'][rnd(2)], MON, s, s + 15 + rnd(4) * 15, ['confirmed', 'pending', 'cancelled', 'no_show'][rnd(4)])); }
    const timeOff = rnd(2) ? [{ staff_id: ['a', 'b', null][rnd(3)], date_from: MON, date_to: MON, start_min: 700 + rnd(10) * 10, end_min: 800 + rnd(10) * 10 }] : [];
    const availability = rnd(2) ? [{ staff_id: 'a', weekday: 1, start_min: 540, end_min: 780 }, { staff_id: 'a', weekday: 1, start_min: 840, end_min: 1140 }] : [];
    const ag = buildAgenda({ settings: { hours, booking: { step_min: step, buffer_min: buffer, lead_min: rnd(3) * 30 } }, staff, availability, timeOff, appointments });
    const now = { date: MON, minutes: 540 + rnd(6) * 30 };
    const dur = 20 + rnd(5) * 10;
    const r = computeSlots(ag, { date: MON, duration: dur, staffIds: ['a', 'b'], now, mode: 'public' });
    for (const id of ['a', 'b']) {
      const offered = new Set(r.slots.filter((x) => x.staff_ids.includes(id)).map((x) => x.start_min));
      for (let t = 480; t < 1260; t += 5) {
        const ok = checkFree(ag, { staffId: id, date: MON, start: t, duration: dur, now, mode: 'public' }) === null;
        assert.equal(ok, offered.has(t), 'ronda ' + round + ' barbero ' + id + ' t=' + t);
        if (ok) for (const x of appointments) if (x.staff_id === id && ['confirmed', 'pending'].includes(x.status)) assert.ok(t + dur + buffer <= x.start_min || t >= x.end_min + buffer);
      }
    }
  }
});
