import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { addDays, nowInTz } from '../core/util.js';
import { canTransition, hasStarted, TRANSITIONS, managePolicy, fmtDateEs, fmtTimeEs } from '../core/domain/appointments.js';

async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  f.tokens.barberA2 = await createSession(f.db, { kind: 'pin', staff_id: 'st_barberA2', shop_id: 'shop_a' });
  const today = nowInTz('America/Mexico_City').date;
  let past = addDays(today, -2);
  while (new Date(past + 'T12:00:00Z').getUTCDay() === 0) past = addDays(past, -1);
  f.past = past;
  f.newAppt = async (body, as) => {
    const r = await f.call('POST', '/api/appointments', { as: as || 'ownerA', shop: 'shop_a', body: Object.assign({ staff_id: 'st_barberA', date: f.day, start_min: 600, services: ['sv_corte'], client: { name: 'Juan Pérez', phone: '5512345678' } }, body || {}) });
    return r;
  };
  return f;
}
const A = { shop: 'shop_a' };

test('reglas puras: tabla de transiciones y "ya empezó"', () => {
  assert.ok(canTransition('pending', 'confirmed'));
  assert.ok(canTransition('confirmed', 'pending'));
  assert.ok(canTransition('completed', 'confirmed'));
  assert.ok(canTransition('cancelled', 'pending'));
  assert.ok(canTransition('no_show', 'completed'));
  assert.ok(!canTransition('completed', 'cancelled'));
  assert.ok(!canTransition('cancelled', 'completed'));
  assert.ok(!canTransition('no_show', 'pending'));
  assert.ok(!canTransition('completed', 'no_show'));
  assert.equal(Object.keys(TRANSITIONS).length, 5);
  const now = { date: '2026-10-05', minutes: 600 };
  assert.ok(hasStarted({ date: '2026-10-04', start_min: 1300 }, now));
  assert.ok(hasStarted({ date: '2026-10-05', start_min: 660 }, now), 'empieza en 60 min');
  assert.ok(!hasStarted({ date: '2026-10-05', start_min: 661 }, now));
  assert.ok(!hasStarted({ date: '2026-10-06', start_min: 0 }, now));
  assert.equal(fmtDateEs('2026-10-05'), 'lunes 5 de octubre');
  assert.equal(fmtTimeEs(630), '10:30 a.m.');
  assert.equal(fmtTimeEs(780), '1:00 p.m.');
  assert.equal(fmtTimeEs(0), '12:00 a.m.');
});

test('reglas puras: política de cancelación (cancel_hours)', () => {
  const shop = { name: 'X', phone: '5500000000', settings: { booking: { cancel_hours: 2 } } };
  const now = { date: '2026-10-05', minutes: 600 };
  const a = (date, start_min, status) => ({ date, start_min, end_min: start_min + 40, status: status || 'confirmed' });
  let p = managePolicy(a('2026-10-05', 720), shop, now);
  assert.equal(p.can_cancel, true);
  assert.match(p.deadline_text, /hasta el lunes 5 de octubre a las 10:00 a\.m\./);
  p = managePolicy(a('2026-10-05', 719), shop, now);
  assert.equal(p.can_cancel, false);
  assert.match(p.deadline_text, /2 horas/);
  assert.match(p.deadline_text, /5500000000/);
  p = managePolicy(a('2026-10-06', 60), shop, now);
  assert.equal(p.can_cancel, true);
  assert.match(p.deadline_text, /lunes 5 de octubre a las 11:00 p\.m\./, 'el límite cae el día anterior');
  assert.equal(managePolicy(a('2026-10-06', 700, 'cancelled'), shop, now).can_cancel, false);
  assert.equal(managePolicy(a('2026-10-04', 700), shop, now).deadline_text, 'La hora de esta cita ya pasó.');
});

test('crear: el servidor calcula total, duración, fin, folio y snapshot (ignora lo del cliente)', async () => {
  const f = await setup();
  const r = await f.newAppt({ services: ['sv_corte', 'sv_barba'], total: 1, duration_min: 5, end_min: 601, status: 'pending', internal_note: 'Prefiere tijera' });
  assert.equal(r.status, 200, r.body);
  const a = r.data;
  assert.equal(a.total, 320);
  assert.equal(a.duration_min, 60);
  assert.equal(a.end_min, 660);
  assert.equal(a.status, 'pending');
  assert.equal(a.source, 'manual');
  assert.match(a.folio, /^TB-[A-Z0-9]{6}$/);
  assert.deepEqual(a.services, [{ id: 'sv_corte', name: 'Corte', price: 200, duration_min: 40 }, { id: 'sv_barba', name: 'Barba', price: 120, duration_min: 20 }]);
  assert.equal(a.staff_name, 'Barbero A');
  assert.equal(a.paid, 0);
  assert.equal(a.balance, 320);
  assert.equal(a.manage_token_hash, undefined);
  assert.equal(a.client_name, 'Juan Pérez');
  assert.equal(a.client_phone, '5512345678');
  assert.equal(a.shop_id, 'shop_a');
  // La ficha del cliente se creó y se reutiliza por teléfono.
  const r2 = await f.newAppt({ start_min: 800, client: { name: 'Juan', phone: '55 1234 5678' } });
  assert.equal(r2.status, 200, r2.body);
  assert.equal(r2.data.client_id, a.client_id);
  const d = await f.call('GET', '/api/appointments/' + a.id, { as: 'ownerA', ...A });
  assert.equal(d.status, 200);
  assert.equal(d.data.client.id, a.client_id);
  assert.equal(d.data.events[0].type, 'created');
  assert.deepEqual(d.data.payments, []);
  assert.deepEqual(d.data.messages, []);
  assert.equal(d.data.appointment.id, a.id);
});

test('crear: validaciones con mensajes por campo', async () => {
  const f = await setup();
  let r = await f.call('POST', '/api/appointments', { as: 'ownerA', ...A, body: {} });
  assert.equal(r.status, 400);
  for (const k of ['staff_id', 'date', 'start_min', 'services', 'client']) assert.ok(r.error.fields[k], k);
  assert.equal(r.error.message, 'Revisa los datos marcados.');
  r = await f.call('POST', '/api/appointments', { as: 'ownerA', ...A, body: { staff_id: 'st_barberA', date: '2026-13-40', start_min: 2000, services: [] } });
  assert.equal(r.status, 400);
  for (const k of ['date', 'start_min', 'services', 'client']) assert.ok(r.error.fields[k], k);
  r = await f.newAppt({ client: { name: 'J', phone: '123' } });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields['client.name'] && r.error.fields['client.phone']);
  r = await f.newAppt({ status: 'cancelled' });
  assert.equal(r.status, 400); assert.ok(r.error.fields.status);
  r = await f.newAppt({ source: 'online' });
  assert.equal(r.status, 400); assert.ok(r.error.fields.source);
  r = await f.newAppt({ internal_note: 'x'.repeat(1001) });
  assert.equal(r.status, 400); assert.ok(r.error.fields.internal_note);
  r = await f.newAppt({ start_min: 1420 });
  assert.equal(r.status, 400, 'no cruza medianoche');
  r = await f.newAppt({ date: addDays(f.day, 1000) });
  assert.equal(r.status, 400, 'fecha absurda');
  assert.ok(r.error.fields.date);
  r = await f.newAppt({ start_min: '10:20' });
  assert.equal(r.status, 200, 'acepta HH:MM');
  assert.equal(r.data.start_min, 620);
  r = await f.newAppt({ status: 'completed' });
  assert.equal(r.status, 400, 'no se registra atendida una cita futura');
});

test('crear: choque de horario → 409 slot_taken con mensaje humano; force:true lo permite', async () => {
  const f = await setup();
  assert.equal((await f.newAppt()).status, 200);
  let r = await f.newAppt({ start_min: 620, client: { name: 'Otro' } });
  assert.equal(r.status, 409);
  assert.equal(r.error.code, 'slot_taken');
  assert.match(r.error.message, /choca con otra cita de Barbero A \(10:00–10:40, Juan Pérez\)/);
  r = await f.newAppt({ start_min: 1180, client: { name: 'Tarde' } });
  assert.equal(r.status, 409);
  assert.match(r.error.message, /fuera del horario/);
  r = await f.newAppt({ start_min: 620, client: { name: 'Otro' }, force: true });
  assert.equal(r.status, 200, 'force');
  r = await f.newAppt({ start_min: 640, client: { name: 'Pegado' } });
  assert.equal(r.status, 409, 'la forzada también ocupa');
  // Una cancelada libera el horario.
  const list = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + f.day, { as: 'ownerA', ...A });
  for (const a of list.data.items) await f.call('POST', '/api/appointments/' + a.id + '/status', { as: 'ownerA', ...A, body: { status: 'cancelled' } });
  r = await f.newAppt({ start_min: 620, client: { name: 'Nuevo' } });
  assert.equal(r.status, 200);
});

test("crear: 'any' asigna al barbero libre con menos carga", async () => {
  const f = await setup();
  await f.newAppt({ staff_id: 'st_ownerA', start_min: 600 });
  await f.newAppt({ staff_id: 'st_ownerA', start_min: 700 });
  await f.newAppt({ staff_id: 'st_barberA', start_min: 800 });
  const r = await f.newAppt({ staff_id: 'any', start_min: 900, client: { name: 'Ana' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.staff_id, 'st_barberA2');
  const r2 = await f.newAppt({ staff_id: 'any', start_min: 900, client: { name: 'Beto' } });
  assert.equal(r2.data.staff_id, 'st_barberA', '40 min < 80 min');
  const r3 = await f.newAppt({ staff_id: 'any', start_min: 900, client: { name: 'Caro' } });
  assert.equal(r3.data.staff_id, 'st_ownerA');
  const r4 = await f.newAppt({ staff_id: 'any', start_min: 900, client: { name: 'Dani' } });
  assert.equal(r4.status, 409);
  assert.match(r4.error.message, /Ningún barbero/);
});

test('barbero (.own): solo su agenda — listar, leer, editar, estados y crear', async () => {
  const f = await setup();
  const mine = (await f.newAppt({ staff_id: 'st_barberA' })).data;
  const other = (await f.newAppt({ staff_id: 'st_barberA2', client: { name: 'Otro' } })).data;
  let r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + f.day, { as: 'barberA', ...A });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.items.map((x) => x.id), [mine.id]);
  assert.equal(r.data.total, 1);
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + f.day + '&staff_id=st_barberA2', { as: 'barberA', ...A });
  assert.deepEqual(r.data.items.map((x) => x.id), [mine.id], 'no puede pedir la agenda de otro');
  assert.equal((await f.call('GET', '/api/appointments/' + other.id, { as: 'barberA', ...A })).status, 404);
  assert.equal((await f.call('PATCH', '/api/appointments/' + other.id, { as: 'barberA', ...A, body: { internal_note: 'x' } })).status, 404);
  assert.equal((await f.call('POST', '/api/appointments/' + other.id + '/status', { as: 'barberA', ...A, body: { status: 'cancelled' } })).status, 404);
  assert.equal((await f.call('GET', '/api/appointments/' + mine.id, { as: 'barberA', ...A })).status, 200);
  r = await f.call('PATCH', '/api/appointments/' + mine.id, { as: 'barberA', ...A, body: { staff_id: 'st_barberA2' } });
  assert.equal(r.status, 403, 'no pasa su cita a otro barbero');
  r = await f.newAppt({ staff_id: 'st_barberA2', start_min: 900 }, 'barberA');
  assert.equal(r.status, 403, 'no agenda para otro');
  r = await f.call('POST', '/api/appointments', { as: 'barberA', ...A, body: { date: f.day, start_min: 900, services: ['sv_barba'], client: { name: 'Walk-in' }, source: 'walkin' } });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.staff_id, 'st_barberA', 'sin staff_id → el suyo');
  assert.equal(r.data.source, 'walkin');
  // Sesión por PIN (sin usuario) también funciona y ve solo lo suyo.
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + f.day, { as: 'barberA2', ...A });
  assert.deepEqual(r.data.items.map((x) => x.id), [other.id]);
  // Notificación al barbero cuando el dueño le agenda.
  const nts = await f.db.find('notifications', { staff_id: 'st_barberA2', type: 'booking_new' });
  assert.equal(nts.length, 1);
  assert.equal(nts[0].link, '#/agenda?cita=' + other.id);
});

test('cliente y otras barberías no acceden a la agenda (aislamiento, ids adivinados)', async () => {
  const f = await setup();
  const a = (await f.newAppt()).data;
  assert.equal((await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + f.day, { as: 'clientA', ...A })).status, 403);
  assert.equal((await f.call('POST', '/api/appointments', { as: 'clientA', ...A, body: {} })).status, 403);
  const B = { shop: 'shop_b' };
  let r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + f.day, { as: 'ownerB', ...B });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.items, []);
  assert.equal((await f.call('GET', '/api/appointments/' + a.id, { as: 'ownerB', ...B })).status, 404);
  assert.equal((await f.call('PATCH', '/api/appointments/' + a.id, { as: 'ownerB', ...B, body: { internal_note: 'hack' } })).status, 404);
  assert.equal((await f.call('POST', '/api/appointments/' + a.id + '/status', { as: 'ownerB', ...B, body: { status: 'cancelled' } })).status, 404);
  assert.equal((await f.call('GET', '/api/appointments/' + a.id, { as: 'ownerB', ...A })).status, 403, 'x-shop-id ajeno');
  // Crear en A con piezas de B
  r = await f.newAppt({ services: ['sv_corteB'] });
  assert.equal(r.status, 400); assert.ok(r.error.fields.services);
  r = await f.newAppt({ staff_id: 'st_ownerB' });
  assert.equal(r.status, 400); assert.ok(r.error.fields.staff_id);
  r = await f.newAppt({ client: undefined, client_id: 'cl_walkB' });
  assert.equal(r.status, 400); assert.ok(r.error.fields.client_id);
  r = await f.call('PATCH', '/api/appointments/' + a.id, { as: 'ownerA', ...A, body: { client_id: 'cl_walkB' } });
  assert.equal(r.status, 400);
  r = await f.call('PATCH', '/api/appointments/' + a.id, { as: 'ownerA', ...A, body: { services: ['sv_corteB'] } });
  assert.equal(r.status, 400);
  r = await f.call('PATCH', '/api/appointments/' + a.id, { as: 'ownerA', ...A, body: { staff_id: 'st_ownerB' } });
  assert.equal(r.status, 400);
  // Intentar inyectar shop_id no sirve.
  r = await f.newAppt({ shop_id: 'shop_b', start_min: 900 });
  assert.equal(r.status, 200);
  assert.equal(r.data.shop_id, 'shop_a');
  const db = await f.db.find('appointments', { shop_id: 'shop_b' });
  assert.equal(db.length, 0);
  // Superadmin sí entra (actúa como dueño).
  assert.equal((await f.call('GET', '/api/appointments/' + a.id, { as: 'super', ...A })).status, 200);
});

test('listar: rango obligatorio, filtros, búsqueda y client_id', async () => {
  const f = await setup();
  const a1 = (await f.newAppt({ start_min: 600, client: { name: 'María López', phone: '5511112222' } })).data;
  const a2 = (await f.newAppt({ start_min: 700, staff_id: 'st_barberA2', client: { name: 'Pedro Ruiz', phone: '5533334444' } })).data;
  const a3 = (await f.newAppt({ date: addDays(f.day, 1), start_min: 600, client: { name: 'María López', phone: '5511112222' } })).data;
  await f.call('POST', '/api/appointments/' + a2.id + '/status', { as: 'ownerA', ...A, body: { status: 'cancelled' } });
  let r = await f.call('GET', '/api/appointments', { as: 'ownerA', ...A });
  assert.equal(r.status, 400); assert.ok(r.error.fields.from && r.error.fields.to);
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + addDays(f.day, 401), { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + addDays(f.day, -1), { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + addDays(f.day, 5), { as: 'ownerA', ...A });
  assert.deepEqual(r.data.items.map((x) => x.id), [a1.id, a2.id, a3.id], 'orden por fecha y hora');
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + addDays(f.day, 5) + '&status=confirmed,pending', { as: 'ownerA', ...A });
  assert.deepEqual(r.data.items.map((x) => x.id), [a1.id, a3.id]);
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + addDays(f.day, 5) + '&status=borrada', { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + addDays(f.day, 5) + '&staff_id=st_barberA2', { as: 'ownerA', ...A });
  assert.deepEqual(r.data.items.map((x) => x.id), [a2.id]);
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + addDays(f.day, 5) + '&q=maría', { as: 'ownerA', ...A });
  assert.equal(r.data.total, 2);
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + addDays(f.day, 5) + '&q=' + encodeURIComponent('55 3333'), { as: 'ownerA', ...A });
  assert.deepEqual(r.data.items.map((x) => x.id), [a2.id], 'teléfono con espacios');
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + addDays(f.day, 5) + '&q=' + a3.folio.toLowerCase(), { as: 'ownerA', ...A });
  assert.deepEqual(r.data.items.map((x) => x.id), [a3.id], 'folio');
  r = await f.call('GET', '/api/appointments?client_id=' + a1.client_id, { as: 'ownerA', ...A });
  assert.equal(r.status, 200);
  assert.equal(r.data.total, 2, 'sin rango con client_id');
  r = await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + addDays(f.day, 5) + '&limit=1', { as: 'ownerA', ...A });
  assert.equal(r.data.items.length, 1);
  assert.equal(r.data.total, 3);
});

test('estados: transiciones válidas, inválidas, reglas de tiempo y restaurar', async () => {
  const f = await setup();
  const st = (id, body, as) => f.call('POST', '/api/appointments/' + id + '/status', { as: as || 'ownerA', ...A, body });
  const fut = (await f.newAppt({ status: 'pending' })).data;
  let r = await st(fut.id, { status: 'completed' });
  assert.equal(r.status, 400, 'atendida en el futuro');
  assert.match(r.error.message, /ya empezó/);
  assert.equal((await st(fut.id, { status: 'no_show' })).status, 400);
  r = await st(fut.id, { status: 'confirmed' });
  assert.equal(r.status, 200);
  assert.ok(r.data.confirmed_at);
  r = await st(fut.id, { status: 'cancelled', reason: 'Se enfermó' });
  assert.equal(r.status, 200);
  assert.equal(r.data.cancel_reason, 'Se enfermó');
  assert.equal(r.data.cancelled_by, 'staff');
  assert.equal((await st(fut.id, { status: 'no_show' })).status, 400, 'cancelada → no asistió no existe');
  assert.equal((await st(fut.id, { status: 'volando' })).status, 400);
  // Otro ocupa el horario → restaurar falla con 409.
  const taker = (await f.newAppt({ client: { name: 'Nuevo' } })).data;
  r = await st(fut.id, { status: 'confirmed' });
  assert.equal(r.status, 409);
  assert.equal(r.error.code, 'slot_taken');
  assert.match(r.error.message, /No se puede restaurar/);
  await st(taker.id, { status: 'cancelled' });
  r = await st(fut.id, { status: 'pending' });
  assert.equal(r.status, 200, 'restaurada');
  assert.equal(r.data.cancel_reason, null);
  assert.equal(r.data.cancelled_by, null);

  // Cita pasada (walk-in registrado después): atendida, deshacer, no asistió.
  const old = (await f.newAppt({ date: f.past, status: 'completed' })).data;
  assert.equal(old.status, 'completed');
  assert.ok(old.completed_at);
  assert.equal((await st(old.id, { status: 'cancelled' })).status, 400, 'atendida → cancelada no');
  r = await st(old.id, { status: 'confirmed' });
  assert.equal(r.status, 200, 'deshacer atendida');
  assert.equal(r.data.completed_at, null);
  r = await st(old.id, { status: 'no_show' });
  assert.equal(r.status, 200);
  assert.equal((await st(old.id, { status: 'pending' })).status, 400);
  r = await st(old.id, { status: 'completed' });
  assert.equal(r.status, 200, 'no asistió → atendida (llegó tarde)');
  // Mismo estado: sin cambios.
  r = await st(old.id, { status: 'completed' });
  assert.equal(r.status, 200);
  const d = await f.call('GET', '/api/appointments/' + old.id, { as: 'ownerA', ...A });
  const statusEvents = d.data.events.filter((e) => e.type === 'status').map((e) => e.data.to);
  assert.deepEqual(statusEvents, ['confirmed', 'no_show', 'completed']);
  assert.equal(d.data.events[1].actor_name, 'Dueño A');
  // El barbero puede cambiar estados de sus citas.
  assert.equal((await st(old.id, { status: 'confirmed' }, 'barberA')).status, 200);
});

test('no_show libera el horario y deshacerlo exige que siga libre', async () => {
  const f = await setup();
  const ns = (await f.newAppt({ date: f.past, start_min: 700 })).data;
  let r = await f.call('POST', '/api/appointments/' + ns.id + '/status', { as: 'ownerA', ...A, body: { status: 'no_show' } });
  assert.equal(r.status, 200);
  const walk = await f.newAppt({ date: f.past, start_min: 700, client: { name: 'Walk-in' }, status: 'completed', source: 'walkin' });
  assert.equal(walk.status, 200, 'el hueco del no-show se usa para un walk-in');
  r = await f.call('POST', '/api/appointments/' + ns.id + '/status', { as: 'ownerA', ...A, body: { status: 'confirmed' } });
  assert.equal(r.status, 409);
  r = await f.call('POST', '/api/appointments/' + ns.id + '/status', { as: 'ownerA', ...A, body: { status: 'confirmed', force: true } });
  assert.equal(r.status, 200, 'force');
});

test('editar: mover con choque → 409, force, servicios recalculan, notas y eventos', async () => {
  const f = await setup();
  const a = (await f.newAppt({ start_min: 600 })).data;
  const b = (await f.newAppt({ start_min: 700, client: { name: 'Bea' } })).data;
  const patch = (id, body, as) => f.call('PATCH', '/api/appointments/' + id, { as: as || 'ownerA', ...A, body });
  let r = await patch(a.id, { start_min: 680 });
  assert.equal(r.status, 409);
  assert.equal(r.error.code, 'slot_taken');
  r = await patch(a.id, { start_min: 660 });
  assert.equal(r.status, 200, 'termina justo cuando empieza la otra');
  assert.equal(r.data.end_min, 700);
  assert.equal(r.data.reschedule_count, 1);
  r = await patch(a.id, { services: ['sv_corte', 'sv_barba'] });
  assert.equal(r.status, 409, 'al crecer la duración choca con la de las 11:40');
  assert.match(r.error.message, /Bea/);
  r = await patch(a.id, { services: ['sv_corte', 'sv_barba'], start_min: 600 });
  assert.equal(r.status, 200);
  assert.equal(r.data.total, 320);
  assert.equal(r.data.duration_min, 60);
  assert.equal(r.data.end_min, 660);
  r = await patch(a.id, { staff_id: 'st_barberA2', start_min: 700 });
  assert.equal(r.status, 200, 'otro barbero libre');
  assert.equal(r.data.staff_name, 'Barbero A2');
  r = await patch(a.id, { staff_id: 'st_barberA', force: true });
  assert.equal(r.status, 200, 'force permite encimar');
  r = await patch(a.id, { internal_note: 'Cliente frecuente' });
  assert.equal(r.status, 200);
  assert.equal(r.data.internal_note, 'Cliente frecuente');
  r = await patch(a.id, { date: 'ayer' });
  assert.equal(r.status, 400);
  r = await patch(a.id, { staff_id: 'any' });
  assert.equal(r.status, 400);
  r = await patch(a.id, { client_id: 'cl_clientA' });
  assert.equal(r.status, 200);
  assert.equal(r.data.client_name, 'Cliente A');
  const d = await f.call('GET', '/api/appointments/' + a.id, { as: 'ownerA', ...A });
  const types = d.data.events.map((e) => e.type);
  assert.deepEqual(types, ['created', 'rescheduled', 'rescheduled', 'edited', 'rescheduled', 'rescheduled', 'note', 'edited']);
  // El barbero afectado recibe aviso cuando el dueño mueve su cita.
  const moved = await f.db.find('notifications', { staff_id: 'st_barberA2', type: 'booking_rescheduled' });
  assert.ok(moved.length >= 1);
  // Cliente con cuenta recibe aviso al cancelar su cita el equipo.
  await f.call('POST', '/api/appointments/' + a.id + '/status', { as: 'ownerA', ...A, body: { status: 'cancelled' } });
  const cn = await f.db.find('notifications', { client_id: 'cl_clientA', type: 'booking_cancelled' });
  assert.equal(cn.length, 1);
  assert.ok(b.id);
});

test('carrera: dos altas simultáneas al mismo horario → solo una queda', async () => {
  const f = await setup();
  const body = (n) => ({ staff_id: 'st_barberA', date: f.day, start_min: 900, services: ['sv_corte'], client: { name: 'Carrera ' + n } });
  const rs = await Promise.all([1, 2, 3].map((n) => f.call('POST', '/api/appointments', { as: 'ownerA', ...A, body: body(n) })));
  assert.equal(rs.filter((r) => r.status === 200).length, 1, rs.map((r) => r.status).join());
  assert.ok(rs.filter((r) => r.status !== 200).every((r) => r.status === 409));
  const rows = await f.db.find('appointments', { shop_id: 'shop_a', date: f.day, start_min: 900 });
  assert.equal(rows.length, 1);
});
