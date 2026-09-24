import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { addDays, nowInTz, newId, nowIso } from '../core/util.js';

const A = { shop: 'shop_a' };
const B = { shop: 'shop_b' };
const FROM = '2026-03-02', TO = '2026-03-08';
const Q = '?from=' + FROM + '&to=' + TO;

async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  await f.db.update('staff', { id: 'st_barberA2' }, { pin_hash: 'pbkdf2$1000$prueba$prueba' }); // una sesión PIN exige PIN configurado
  f.tokens.barberA2 = await createSession(f.db, { kind: 'pin', staff_id: 'st_barberA2', shop_id: 'shop_a' });
  f.today = nowInTz('America/Mexico_City').date;
  const appt = (staff_id, date, status, shop_id) => f.db.insert('appointments', {
    id: newId('ap'), shop_id: shop_id || 'shop_a', folio: 'TB-X', staff_id, date, start_min: 600, end_min: 640, duration_min: 40,
    services: [{ id: 'sv_corte', name: 'Corte', price: 200, duration_min: 40 }], total: 200, status, created_at: nowIso()
  });
  const pay = (staff_id, date, amount, tip, status, shop_id) => f.db.insert('payments', {
    id: newId('pay'), shop_id: shop_id || 'shop_a', staff_id, amount, tip, method: 'cash', status: status || 'paid', created_at: nowIso(), date
  });
  const payout = (staff_id, period_from, period_to, amount) => f.db.insert('commission_payouts', {
    id: newId('po'), shop_id: 'shop_a', staff_id, period_from, period_to, amount, created_at: nowIso()
  });
  // Barbero A (50 %): 2 atendidas; cobros 200+20 y 120; uno reembolsado y otro fuera de rango no cuentan.
  await appt('st_barberA', '2026-03-02', 'completed');
  await appt('st_barberA', '2026-03-04', 'completed');
  await appt('st_barberA', '2026-03-05', 'no_show');
  await appt('st_barberA', '2026-03-06', 'confirmed');
  await appt('st_barberA', '2026-03-01', 'completed');
  await pay('st_barberA', '2026-03-02', 200, 20);
  await pay('st_barberA', '2026-03-04', 120, 0);
  await pay('st_barberA', '2026-03-04', 999, 9, 'refunded');
  await pay('st_barberA', '2026-03-09', 500, 50);
  await payout('st_barberA', '2026-03-02', '2026-03-08', 100);
  await payout('st_barberA', '2026-02-23', '2026-03-01', 777);
  // Barbero A2 (40 %): 1 atendida, cobro 300+30.
  await appt('st_barberA2', '2026-03-03', 'completed');
  await pay('st_barberA2', '2026-03-03', 300, 30);
  // Venta sin barbero: no se atribuye.
  await pay(null, '2026-03-03', 80, 0);
  // Otra barbería: nunca aparece.
  await appt('st_ownerB', '2026-03-03', 'completed', 'shop_b');
  await pay('st_ownerB', '2026-03-03', 5000, 0, 'paid', 'shop_b');
  return f;
}

test('comisiones: conteo, ventas, comisión, propinas, pagos y saldo exactos', async () => {
  const f = await setup();
  const r = await f.call('GET', '/api/commissions' + Q, { as: 'ownerA', ...A });
  assert.equal(r.status, 200, r.body);
  const by = Object.fromEntries(r.data.items.map((x) => [x.staff_id, x]));
  assert.deepEqual(Object.keys(by).sort(), ['st_barberA', 'st_barberA2', 'st_ownerA']);
  const pick = (x) => [x.commission_pct, x.services_count, x.revenue, x.commission, x.tips, x.payouts, x.balance];
  assert.deepEqual(pick(by.st_barberA), [50, 2, 320, 160, 20, 100, 80]);
  assert.deepEqual(pick(by.st_barberA2), [40, 1, 300, 120, 30, 0, 150]);
  assert.deepEqual(pick(by.st_ownerA), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(by.st_barberA.staff_name, 'Barbero A');
  assert.deepEqual(r.data.totals, { services_count: 3, revenue: 620, commission: 280, tips: 50, refunds: 999, payouts: 100, balance: 230 });
  assert.equal(by.st_barberA.refunds, 999, 'cobro y reembolso en el mismo periodo: neto cero, pero se informa');
  assert.deepEqual(r.data.range, { from: FROM, to: TO, days: 7 });
  // Filtro por barbero (dueño).
  const one = await f.call('GET', '/api/commissions' + Q + '&staff_id=st_barberA2', { as: 'ownerA', ...A });
  assert.equal(one.data.items.length, 1);
  assert.equal(one.data.totals.balance, 150);
  const ext = await f.call('GET', '/api/commissions' + Q + '&staff_id=st_ownerB', { as: 'ownerA', ...A });
  assert.equal(ext.status, 404, 'barbero de otra barbería');
});

test('comisiones: redondeo a centavos e inactivos solo si tienen movimientos', async () => {
  const f = await setup();
  await f.db.update('staff', { id: 'st_barberA2' }, { commission_pct: 33.33, active: false });
  await f.db.insert('staff', { id: 'st_old', shop_id: 'shop_a', name: 'Ex barbero', role: 'barber', active: false, commission_pct: 50, created_at: nowIso() });
  const r = await f.call('GET', '/api/commissions' + Q, { as: 'ownerA', ...A });
  const by = Object.fromEntries(r.data.items.map((x) => [x.staff_id, x]));
  assert.ok(by.st_barberA2, 'inactivo con movimientos');
  assert.equal(by.st_barberA2.active, false);
  assert.equal(by.st_barberA2.commission, 99.99, '300 × 33.33 %');
  assert.equal(by.st_barberA2.balance, 129.99);
  assert.ok(!by.st_old, 'inactivo sin movimientos no aparece');
});

test('comisiones: rango obligatorio y válido', async () => {
  const f = await setup();
  let r = await f.call('GET', '/api/commissions', { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.from && r.error.fields.to);
  r = await f.call('GET', '/api/commissions?from=2026-03-08&to=2026-03-01', { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.to);
});

test('barbero: solo sus comisiones y sus pagos; no registra pagos', async () => {
  const f = await setup();
  let r = await f.call('GET', '/api/commissions' + Q, { as: 'barberA', ...A });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.items.length, 1);
  assert.equal(r.data.items[0].staff_id, 'st_barberA');
  assert.equal(r.data.totals.balance, 80);
  r = await f.call('GET', '/api/commissions' + Q + '&staff_id=st_barberA2', { as: 'barberA', ...A });
  assert.equal(r.status, 403);
  r = await f.call('GET', '/api/commissions/payouts', { as: 'barberA', ...A });
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 2);
  assert.ok(r.data.every((p) => p.staff_id === 'st_barberA'));
  r = await f.call('GET', '/api/commissions/payouts?staff_id=st_barberA2', { as: 'barberA', ...A });
  assert.equal(r.status, 403);
  r = await f.call('GET', '/api/commissions' + Q, { as: 'barberA2', ...A });
  assert.equal(r.data.items[0].staff_id, 'st_barberA2', 'sesión PIN');
  r = await f.call('POST', '/api/commissions/payouts', { as: 'barberA', ...A, body: { staff_id: 'st_barberA', period_from: FROM, period_to: TO, amount: 80 } });
  assert.equal(r.status, 403);
  r = await f.call('GET', '/api/commissions' + Q, { as: 'clientA', ...A });
  assert.equal(r.status, 403);
});

test('registrar pago de comisión: validaciones, saldo en cero y pago desde caja', async () => {
  const f = await setup();
  const post = (body, as, shop) => f.call('POST', '/api/commissions/payouts', { as: as || 'ownerA', shop: shop || 'shop_a', body });
  let r = await post({});
  assert.equal(r.status, 400);
  for (const k of ['staff_id', 'period_from', 'period_to', 'amount']) assert.ok(r.error.fields[k], k);
  r = await post({ staff_id: 'st_ownerB', period_from: FROM, period_to: TO, amount: 10 });
  assert.equal(r.status, 400, 'barbero de otra barbería');
  assert.ok(r.error.fields.staff_id);
  r = await post({ staff_id: 'st_barberA', period_from: TO, period_to: FROM, amount: 0, note: 'x'.repeat(201) });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.period_to && r.error.fields.amount && r.error.fields.note);
  r = await post({ staff_id: 'st_barberA', period_from: addDays(f.today, 3), period_to: addDays(f.today, 5), amount: 10 });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.period_from, 'periodo futuro');

  r = await post({ staff_id: 'st_barberA2', period_from: FROM, period_to: TO, amount: '150', note: 'Semana 10' });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.amount, 150);
  assert.equal(r.data.staff_name, 'Barbero A2');
  assert.equal(r.data.created_by, 'st_ownerA');
  assert.equal(r.data.shop_id, 'shop_a');
  assert.equal(r.data.cash_movement_id, null);
  const c = await f.call('GET', '/api/commissions' + Q + '&staff_id=st_barberA2', { as: 'ownerA', ...A });
  assert.equal(c.data.items[0].balance, 0, 'pagado el periodo, el saldo queda en cero');

  // Desde caja: requiere caja abierta y efectivo suficiente → retiro.
  r = await post({ staff_id: 'st_barberA', period_from: FROM, period_to: TO, amount: 80, from_cash: true });
  assert.equal(r.status, 409);
  await f.call('POST', '/api/cash/open', { as: 'ownerA', ...A, body: { opening_float: 50 } });
  r = await post({ staff_id: 'st_barberA', period_from: FROM, period_to: TO, amount: 80, from_cash: true });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.amount);
  r = await post({ staff_id: 'st_barberA', period_from: FROM, period_to: TO, amount: 50, from_cash: true });
  assert.equal(r.status, 200, r.body);
  const mv = await f.db.findOne('cash_movements', { id: r.data.cash_movement_id });
  assert.equal(mv.type, 'withdrawal');
  assert.equal(mv.amount, 50);
  assert.match(mv.concept, /Pago de comisión · Barbero A/);

  const list = await f.call('GET', '/api/commissions/payouts', { as: 'ownerA', ...A });
  assert.equal(list.status, 200);
  assert.equal(list.data.length, 4);
  assert.equal(list.data[0].amount, 50, 'más reciente primero');
  const filtered = await f.call('GET', '/api/commissions/payouts?staff_id=st_barberA2', { as: 'ownerA', ...A });
  assert.equal(filtered.data.length, 1);
});

test('aislamiento: la barbería B no ve ni paga comisiones de A', async () => {
  const f = await setup();
  let r = await f.call('GET', '/api/commissions' + Q, { as: 'ownerB', ...A });
  assert.equal(r.status, 403);
  r = await f.call('GET', '/api/commissions' + Q, { as: 'ownerB', ...B });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.items.map((x) => x.staff_id), ['st_ownerB']);
  assert.equal(r.data.totals.revenue, 5000);
  r = await f.call('GET', '/api/commissions/payouts', { as: 'ownerB', ...B });
  assert.deepEqual(r.data, []);
  r = await f.call('POST', '/api/commissions/payouts', { as: 'ownerB', ...B, body: { staff_id: 'st_barberA', period_from: FROM, period_to: TO, amount: 10 } });
  assert.equal(r.status, 400);
  assert.equal(await f.db.count('commission_payouts', { shop_id: 'shop_b' }), 0);
});

// ── Regresiones de la revisión ──
test('reembolso: resta en el periodo en que se reembolsa (refunded_at), sin cambiar un periodo ya liquidado', async () => {
  const f = await setup();
  const D = f.today;
  const sale = addDays(D, -10);
  await f.db.insert('payments', { id: 'pold', shop_id: 'shop_a', staff_id: 'st_barberA', amount: 400, tip: 40, method: 'card', status: 'paid', created_at: nowIso(), date: sale });
  const P1 = '?from=' + addDays(D, -14) + '&to=' + addDays(D, -6);
  const P2 = '?from=' + addDays(D, -5) + '&to=' + D;
  const get = async (q) => (await f.call('GET', '/api/commissions' + q + '&staff_id=st_barberA', { as: 'ownerA', ...A })).data.items[0];
  let p1 = await get(P1);
  assert.deepEqual([p1.revenue, p1.commission, p1.tips, p1.balance], [400, 200, 40, 240]);
  const po = await f.call('POST', '/api/commissions/payouts', { as: 'ownerA', ...A, body: { staff_id: 'st_barberA', period_from: addDays(D, -14), period_to: addDays(D, -6), amount: 240 } });
  assert.equal(po.status, 200, po.body);
  assert.equal((await get(P1)).balance, 0, 'periodo liquidado');
  const rf = await f.call('POST', '/api/payments/pold/refund', { as: 'ownerA', ...A, body: { reason: 'Queja' } });
  assert.equal(rf.status, 200, rf.body);
  p1 = await get(P1);
  assert.deepEqual([p1.revenue, p1.commission, p1.tips, p1.payouts, p1.balance, p1.refunds], [400, 200, 40, 240, 0, 0], 'el periodo cerrado no cambia');
  const p2 = await get(P2);
  assert.deepEqual([p2.revenue, p2.commission, p2.tips, p2.payouts, p2.balance, p2.refunds], [-400, -200, -40, 0, -240, 400], 'se descuenta en el periodo del reembolso');
  // Todo el rango: neto cero.
  const all = await get('?from=' + addDays(D, -14) + '&to=' + D);
  assert.deepEqual([all.revenue, all.commission, all.tips, all.balance], [0, 0, 0, -240]);
});
