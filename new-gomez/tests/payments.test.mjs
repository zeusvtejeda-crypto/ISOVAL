import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { addDays, nowInTz, newId, nowIso } from '../core/util.js';

const A = { shop: 'shop_a' };
const B = { shop: 'shop_b' };

async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  f.tokens.barberA2 = await createSession(f.db, { kind: 'pin', staff_id: 'st_barberA2', shop_id: 'shop_a' });
  f.today = nowInTz('America/Mexico_City').date;
  let past = addDays(f.today, -2);
  while (new Date(past + 'T12:00:00Z').getUTCDay() === 0) past = addDays(past, -1);
  f.past = past;
  // Cita insertada directo (fecha/estado controlados).
  f.appt = (o) => f.db.insert('appointments', Object.assign({
    id: newId('ap'), shop_id: 'shop_a', folio: 'TB-' + Math.random().toString(36).slice(2, 8).toUpperCase(), client_id: 'cl_clientA',
    staff_id: 'st_barberA', date: f.past, start_min: 600, end_min: 640, duration_min: 40,
    services: [{ id: 'sv_corte', name: 'Corte', price: 200, duration_min: 40 }], total: 200, status: 'confirmed',
    source: 'manual', client_name: 'Cliente A', client_phone: '3110000001', created_at: nowIso()
  }, o || {}));
  f.pay = (body, as, shop) => f.call('POST', '/api/payments', { as: as || 'ownerA', shop: shop || 'shop_a', body });
  f.range = '?from=' + addDays(f.today, -1) + '&to=' + f.today;
  return f;
}

test('cobrar una cita pasada con complete: la marca atendida, registra eventos y toma barbero/cliente de la cita', async () => {
  const f = await setup();
  const a = await f.appt();
  const r = await f.pay({ appointment_id: a.id, amount: '200', tip: 30, method: 'cash', complete: true, staff_id: 'st_barberA2', client_id: 'cl_walkB' });
  assert.equal(r.status, 200, r.body);
  const p = r.data;
  assert.equal(p.amount, 200);
  assert.equal(p.tip, 30);
  assert.equal(p.total, 230);
  assert.equal(p.method, 'cash');
  assert.equal(p.status, 'paid');
  assert.equal(p.staff_id, 'st_barberA', 'barbero de la cita, no del cuerpo');
  assert.equal(p.client_id, 'cl_clientA', 'cliente de la cita, no del cuerpo');
  assert.equal(p.date, f.today);
  assert.equal(p.shop_id, 'shop_a');
  assert.equal(p.concept, 'Corte');
  assert.equal(p.staff_name, 'Barbero A');
  assert.equal(p.client_name, 'Cliente A');
  assert.equal(p.folio, a.folio);
  assert.equal(p.cash_session_id, null, 'sin caja abierta');
  assert.equal(p.appointment_status, 'completed');
  assert.equal(p.created_by, 'st_ownerA');
  const d = await f.call('GET', '/api/appointments/' + a.id, { as: 'ownerA', ...A });
  assert.equal(d.status, 200, d.body);
  assert.equal(d.data.appointment.status, 'completed');
  assert.ok(d.data.appointment.completed_at);
  assert.equal(d.data.appointment.paid, 200);
  assert.equal(d.data.appointment.balance, 0);
  const types = d.data.events.map((e) => e.type);
  assert.deepEqual(types, ['status', 'payment']);
  assert.deepEqual([d.data.events[0].data.from, d.data.events[0].data.to], ['confirmed', 'completed']);
  assert.equal(d.data.events[1].data.amount, 200);
  assert.equal(d.data.events[1].data.tip, 30);
  assert.equal(d.data.events[1].data.method, 'cash');
  assert.equal(d.data.payments.length, 1);
});

test('complete: no_show → completed sí; cita futura solo se cobra (anticipo) sin cambiar estado; cancelada → 409', async () => {
  const f = await setup();
  const ns = await f.appt({ status: 'no_show' });
  let r = await f.pay({ appointment_id: ns.id, amount: 200, method: 'card', complete: true });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.appointment_status, 'completed');
  const fut = await f.appt({ date: f.day, status: 'pending' });
  r = await f.pay({ appointment_id: fut.id, amount: 100, method: 'transfer', complete: true });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.appointment_status, 'pending');
  assert.equal((await f.db.findOne('appointments', { id: fut.id })).status, 'pending');
  // Sin complete, una cita pasada queda como estaba.
  const pa = await f.appt({ start_min: 700, end_min: 740 });
  r = await f.pay({ appointment_id: pa.id, amount: 200, method: 'cash' });
  assert.equal(r.data.appointment_status, 'confirmed');
  const done = await f.appt({ start_min: 800, end_min: 840, status: 'completed' });
  r = await f.pay({ appointment_id: done.id, amount: 50, method: 'cash', complete: true, concept: 'Cera para cabello' });
  assert.equal(r.status, 200);
  assert.equal(r.data.appointment_status, 'completed');
  assert.equal(r.data.concept, 'Cera para cabello');
  const can = await f.appt({ start_min: 900, end_min: 940, status: 'cancelled' });
  r = await f.pay({ appointment_id: can.id, amount: 200, method: 'cash' });
  assert.equal(r.status, 409);
  assert.match(r.error.message, /cancelada/);
  assert.equal(await f.db.count('payments', { appointment_id: can.id }), 0);
});

test('validaciones del cobro con mensajes por campo', async () => {
  const f = await setup();
  let r = await f.pay({});
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.amount && r.error.fields.method);
  r = await f.pay({ amount: -5, tip: -1, method: 'bitcoin', concept: 'x'.repeat(121) });
  assert.equal(r.status, 400);
  for (const k of ['amount', 'tip', 'method', 'concept']) assert.ok(r.error.fields[k], k);
  r = await f.pay({ amount: 100001, method: 'cash' });
  assert.equal(r.status, 400);
  assert.match(r.error.fields.amount, /100,000/);
  r = await f.pay({ amount: 'doscientos', method: 'cash' });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.amount);
  r = await f.pay({ amount: 0, tip: 0, method: 'cash' });
  assert.equal(r.status, 400);
  assert.match(r.error.fields.amount, /mayor a cero/);
  r = await f.pay({ amount: 100, method: 'other' });
  assert.equal(r.status, 400, '"other" no está en los métodos por defecto');
  assert.ok(r.error.fields.method);
  r = await f.pay({ amount: '$1,250.555', method: 'card' });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.amount, 1250.56);
  assert.equal(r.data.concept, 'Venta');
  // Propinas desactivadas en la barbería.
  const shop = await f.db.findOne('shops', { id: 'shop_a' });
  await f.db.update('shops', { id: 'shop_a' }, { settings: Object.assign({}, shop.settings, { payments: { methods: ['cash', 'other'], tips: false } }) });
  r = await f.pay({ amount: 100, tip: 10, method: 'cash' });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.tip);
  r = await f.pay({ amount: 100, method: 'other' });
  assert.equal(r.status, 200, 'ahora "other" sí está activo');
  r = await f.pay({ amount: 100, method: 'card' });
  assert.equal(r.status, 400, 'tarjeta desactivada');
});

test('venta suelta: barbero/cliente opcionales y siempre de la misma barbería', async () => {
  const f = await setup();
  let r = await f.pay({ amount: 90, method: 'cash', concept: 'Pomada', staff_id: 'st_barberA2', client_id: 'cl_clientA' });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.appointment_id, null);
  assert.equal(r.data.staff_id, 'st_barberA2');
  assert.equal(r.data.client_id, 'cl_clientA');
  assert.equal(r.data.concept, 'Pomada');
  r = await f.pay({ amount: 90, method: 'cash' });
  assert.equal(r.status, 200);
  assert.equal(r.data.staff_id, null);
  r = await f.pay({ amount: 90, method: 'cash', staff_id: 'st_ownerB', client_id: 'cl_walkB' });
  assert.equal(r.status, 400, 'ids de otra barbería');
  assert.ok(r.error.fields.staff_id && r.error.fields.client_id);
  await f.db.update('staff', { id: 'st_barberA2' }, { active: false });
  r = await f.pay({ amount: 90, method: 'cash', staff_id: 'st_barberA2' });
  assert.equal(r.status, 400);
  assert.match(r.error.fields.staff_id, /desactivado/);
  await f.db.update('clients', { id: 'cl_clientA' }, { deleted_at: nowIso() });
  r = await f.pay({ amount: 90, method: 'cash', client_id: 'cl_clientA' });
  assert.equal(r.status, 400, 'cliente borrado');
});

test('barbero: solo cobra sus citas y ventas a su nombre', async () => {
  const f = await setup();
  const mine = await f.appt();
  const other = await f.appt({ staff_id: 'st_barberA2', start_min: 700, end_min: 740 });
  let r = await f.pay({ appointment_id: mine.id, amount: 200, method: 'cash', complete: true }, 'barberA');
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.created_by, 'st_barberA');
  r = await f.pay({ appointment_id: other.id, amount: 200, method: 'cash' }, 'barberA');
  assert.equal(r.status, 404, 'cita de otro barbero');
  r = await f.pay({ amount: 50, method: 'cash', staff_id: 'st_barberA2' }, 'barberA');
  assert.equal(r.status, 403);
  r = await f.pay({ amount: 50, method: 'cash', concept: 'Gel' }, 'barberA');
  assert.equal(r.status, 200);
  assert.equal(r.data.staff_id, 'st_barberA', 'la venta queda a su nombre');
  r = await f.pay({ appointment_id: other.id, amount: 200, method: 'card' }, 'barberA2');
  assert.equal(r.status, 200, 'sesión PIN del barbero A2');
  r = await f.pay({ amount: 50, method: 'cash' }, 'clientA');
  assert.equal(r.status, 403, 'cliente no cobra');
});

test('listado: rango obligatorio, filtros y totales (solo paid, por forma de pago)', async () => {
  const f = await setup();
  const a1 = await f.appt();
  const a2 = await f.appt({ staff_id: 'st_barberA2', start_min: 700, end_min: 740 });
  await f.pay({ appointment_id: a1.id, amount: 200, tip: 20, method: 'cash' });
  await f.pay({ appointment_id: a2.id, amount: 300, tip: 30, method: 'card' });
  await f.pay({ amount: 150, method: 'transfer', staff_id: 'st_barberA' });
  const refunded = (await f.pay({ amount: 999, tip: 1, method: 'cash', staff_id: 'st_barberA' })).data;
  assert.equal((await f.call('POST', '/api/payments/' + refunded.id + '/refund', { as: 'ownerA', ...A })).status, 200);
  // Un pago de otro día (fuera del rango) no cuenta.
  await f.db.insert('payments', { id: 'pay_old', shop_id: 'shop_a', staff_id: 'st_barberA', amount: 5000, tip: 0, method: 'cash', status: 'paid', created_at: nowIso(), date: addDays(f.today, -10) });

  let r = await f.call('GET', '/api/payments', { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.from && r.error.fields.to);
  r = await f.call('GET', '/api/payments?from=2026-02-30&to=2026-03-01', { as: 'ownerA', ...A });
  assert.equal(r.status, 400, 'fecha imposible');
  r = await f.call('GET', '/api/payments?from=2026-03-05&to=2026-03-01', { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  r = await f.call('GET', '/api/payments?from=2024-01-01&to=2026-03-01', { as: 'ownerA', ...A });
  assert.equal(r.status, 400, 'rango máximo');

  r = await f.call('GET', '/api/payments' + f.range, { as: 'ownerA', ...A });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.items.length, 4);
  assert.equal(r.data.total, 4);
  assert.deepEqual(r.data.totals.by_method, { cash: 200, card: 300, transfer: 150, other: 0 });
  assert.equal(r.data.totals.amount, 650);
  assert.equal(r.data.totals.tip, 50);
  assert.equal(r.data.totals.count, 3);
  assert.equal(r.data.totals.total, 700);
  assert.equal(r.data.totals.refunded, 999);
  assert.equal(r.data.totals.refunded_count, 1);
  assert.equal(r.data.items[0].id, refunded.id, 'más reciente primero');

  r = await f.call('GET', '/api/payments' + f.range + '&method=card', { as: 'ownerA', ...A });
  assert.equal(r.data.items.length, 1);
  assert.equal(r.data.totals.amount, 300);
  r = await f.call('GET', '/api/payments' + f.range + '&method=paypal', { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  r = await f.call('GET', '/api/payments' + f.range + '&staff_id=st_barberA2', { as: 'ownerA', ...A });
  assert.equal(r.data.totals.amount, 300);

  // Barbero: solo lo suyo.
  r = await f.call('GET', '/api/payments' + f.range, { as: 'barberA', ...A });
  assert.equal(r.status, 200);
  assert.ok(r.data.items.every((p) => p.staff_id === 'st_barberA'));
  assert.equal(r.data.totals.amount, 350);
  assert.equal(r.data.totals.tip, 20);
  r = await f.call('GET', '/api/payments' + f.range + '&staff_id=st_barberA2', { as: 'barberA', ...A });
  assert.equal(r.status, 403);
  r = await f.call('GET', '/api/payments' + f.range, { as: 'clientA', ...A });
  assert.equal(r.status, 403);
  // Superadmin dentro de la barbería actúa como dueño.
  r = await f.call('GET', '/api/payments' + f.range, { as: 'super', ...A });
  assert.equal(r.status, 200);
  assert.equal(r.data.totals.amount, 650);
});

test('reembolso: solo dueño, una vez, con evento en la cita', async () => {
  const f = await setup();
  const a = await f.appt();
  const p = (await f.pay({ appointment_id: a.id, amount: 200, tip: 10, method: 'card' })).data;
  let r = await f.call('POST', '/api/payments/' + p.id + '/refund', { as: 'barberA', ...A });
  assert.equal(r.status, 403, 'barbero no reembolsa');
  r = await f.call('POST', '/api/payments/' + p.id + '/refund', { as: 'ownerA', ...A, body: { reason: 'Cliente inconforme' } });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.status, 'refunded');
  assert.equal(r.data.cash_movement_id, null, 'tarjeta: sin movimiento de caja');
  r = await f.call('POST', '/api/payments/' + p.id + '/refund', { as: 'ownerA', ...A });
  assert.equal(r.status, 409);
  assert.match(r.error.message, /ya fue reembolsado/);
  r = await f.call('POST', '/api/payments/pay_nope/refund', { as: 'ownerA', ...A });
  assert.equal(r.status, 404);
  const d = await f.call('GET', '/api/appointments/' + a.id, { as: 'ownerA', ...A });
  assert.equal(d.data.appointment.paid, 0);
  const ev = d.data.events.filter((e) => e.type === 'payment');
  assert.equal(ev.length, 2);
  assert.equal(ev[1].data.action, 'refund');
  assert.equal(ev[1].data.reason, 'Cliente inconforme');
});

test('caja: el efectivo se liga a la caja abierta; reembolso de efectivo de otra caja genera gasto', async () => {
  const f = await setup();
  const old = (await f.pay({ amount: 80, tip: 5, method: 'cash', concept: 'Shampoo' })).data;
  assert.equal(old.cash_session_id, null);
  const open = await f.call('POST', '/api/cash/open', { as: 'ownerA', ...A, body: { opening_float: 500 } });
  assert.equal(open.status, 200, open.body);
  const sid = open.data.session.id;
  const cash = (await f.pay({ amount: 100, method: 'cash' })).data;
  const card = (await f.pay({ amount: 100, method: 'card' })).data;
  assert.equal(cash.cash_session_id, sid);
  assert.equal(card.cash_session_id, null);
  let r = await f.call('POST', '/api/payments/' + old.id + '/refund', { as: 'ownerA', ...A });
  assert.equal(r.status, 200);
  assert.ok(r.data.cash_movement_id);
  const mv = await f.db.findOne('cash_movements', { id: r.data.cash_movement_id });
  assert.equal(mv.type, 'expense');
  assert.equal(mv.amount, 85);
  assert.equal(mv.cash_session_id, sid);
  r = await f.call('POST', '/api/payments/' + cash.id + '/refund', { as: 'ownerA', ...A });
  assert.equal(r.data.cash_movement_id, null, 'misma caja: el resumen ya lo descuenta');
  const cur = await f.call('GET', '/api/cash/current', { as: 'ownerA', ...A });
  assert.equal(cur.data.summary.cash_sales, 0);
  assert.equal(cur.data.summary.expense, 85);
  assert.equal(cur.data.summary.expected_cash, 415);
});

test('aislamiento: otra barbería no ve ni toca cobros ajenos (ni adivinando ids)', async () => {
  const f = await setup();
  const a = await f.appt();
  const p = (await f.pay({ appointment_id: a.id, amount: 200, method: 'cash' })).data;
  let r = await f.call('GET', '/api/payments' + f.range, { as: 'ownerB', ...A });
  assert.equal(r.status, 403, 'dueño B no entra a la barbería A');
  r = await f.call('GET', '/api/payments' + f.range, { as: 'ownerB', ...B });
  assert.equal(r.status, 200);
  assert.equal(r.data.items.length, 0);
  assert.equal(r.data.totals.amount, 0);
  r = await f.call('POST', '/api/payments/' + p.id + '/refund', { as: 'ownerB', ...B });
  assert.equal(r.status, 404);
  assert.equal((await f.db.findOne('payments', { id: p.id })).status, 'paid');
  r = await f.pay({ appointment_id: a.id, amount: 200, method: 'cash', complete: true }, 'ownerB', 'shop_b');
  assert.equal(r.status, 404, 'cita de otra barbería');
  assert.equal((await f.db.findOne('appointments', { id: a.id })).status, 'confirmed');
  r = await f.pay({ amount: 10, method: 'cash', shop_id: 'shop_a' }, 'ownerB', 'shop_b');
  assert.equal(r.status, 200);
  assert.equal(r.data.shop_id, 'shop_b', 'shop_id del cuerpo se ignora');
  r = await f.call('GET', '/api/payments' + f.range, { as: 'ownerA', ...A });
  assert.equal(r.data.items.length, 1);
});
