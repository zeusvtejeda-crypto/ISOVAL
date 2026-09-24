import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { addDays, nowInTz, nowIso } from '../core/util.js';
import { summarize } from '../core/api/cash.js';

const A = { shop: 'shop_a' };
const B = { shop: 'shop_b' };

async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  f.today = nowInTz('America/Mexico_City').date;
  f.cash = (action, body, as, shop) => f.call(action === 'current' || action === 'sessions' ? 'GET' : 'POST', '/api/cash/' + action + (body && body.qs ? body.qs : ''), { as: as || 'ownerA', shop: shop || 'shop_a', body });
  f.pay = (body, as) => f.call('POST', '/api/payments', { as: as || 'ownerA', ...A, body });
  f.move = (body, as, shop) => f.call('POST', '/api/cash/movements', { as: as || 'ownerA', shop: shop || 'shop_a', body });
  return f;
}

test('resumen puro: fórmula del efectivo esperado', () => {
  const s = summarize({ opening_float: 500 },
    [{ type: 'income', amount: 100 }, { type: 'expense', amount: 50.5 }, { type: 'withdrawal', amount: 100 }],
    [{ method: 'cash', amount: 200, tip: 20, status: 'paid' }, { method: 'cash', amount: 999, tip: 9, status: 'refunded' },
      { method: 'card', amount: 300, tip: 10, status: 'paid' }, { method: 'transfer', amount: 150, tip: 0, status: 'paid' }, { method: 'other', amount: 40, tip: 0, status: 'paid' }]);
  assert.equal(s.expected_cash, 669.5);
  assert.equal(s.cash_sales, 200);
  assert.equal(s.cash_tips, 20);
  assert.equal(s.card_sales, 300);
  assert.equal(s.card_tips, 10);
  assert.equal(s.transfer_sales, 150);
  assert.equal(s.other_sales, 40);
  assert.equal(s.payments_count, 4);
});

test('sin caja abierta: estado vacío y movimientos/cierre → 409', async () => {
  const f = await setup();
  let r = await f.cash('current');
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.session, null);
  assert.equal(r.data.summary.expected_cash, 0);
  assert.deepEqual(r.data.movements, []);
  assert.deepEqual(r.data.payments, []);
  assert.equal(r.data.last_session, null);
  r = await f.move({ type: 'expense', amount: 10, concept: 'Café' });
  assert.equal(r.status, 409);
  assert.match(r.error.message, /Abre la caja/);
  r = await f.cash('close', { counted_cash: 0 });
  assert.equal(r.status, 409);
  assert.match(r.error.message, /No hay una caja abierta/);
});

test('abrir: validaciones, una sola caja abierta, auditoría con el actor', async () => {
  const f = await setup();
  let r = await f.cash('open', { opening_float: -1 });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.opening_float);
  r = await f.cash('open', { opening_float: 'mucho', notes: 'x'.repeat(301) });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.opening_float && r.error.fields.notes);
  r = await f.cash('open', { opening_float: '500', notes: 'Fondo de monedas' });
  assert.equal(r.status, 200, r.body);
  const s = r.data.session;
  assert.equal(s.status, 'open');
  assert.equal(s.opening_float, 500);
  assert.equal(s.opened_by, 'st_ownerA');
  assert.equal(s.opened_by_name, 'Dueño A');
  assert.equal(s.date, f.today);
  assert.equal(s.shop_id, 'shop_a');
  assert.equal(r.data.summary.expected_cash, 500);
  r = await f.cash('open', { opening_float: 100 });
  assert.equal(r.status, 409);
  assert.equal(await f.db.count('cash_sessions', { shop_id: 'shop_a', status: 'open' }), 1);
  r = await f.cash('open', {});
  assert.equal(r.status, 409);
  // Sin fondo: 0 por defecto (en otra barbería, que es independiente).
  r = await f.cash('open', {}, 'ownerB', 'shop_b');
  assert.equal(r.status, 200, 'la caja de B es independiente de la de A');
  assert.equal(r.data.session.opening_float, 0);
});

test('flujo completo: cobros + movimientos → resumen exacto → corte con faltante y notificación', async () => {
  const f = await setup();
  await f.cash('open', { opening_float: 500 });
  await f.pay({ amount: 200, tip: 20, method: 'cash', staff_id: 'st_barberA' });
  await f.pay({ amount: 300, tip: 10, method: 'card', staff_id: 'st_barberA' });
  await f.pay({ amount: 150, method: 'transfer' });
  let r = await f.move({ type: 'income', amount: 100, concept: 'Venta de gel' });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.type, 'income');
  assert.equal(r.data.created_by_name, 'Dueño A');
  r = await f.move({ type: 'expense', amount: '50', concept: 'Garrafón de agua' });
  assert.equal(r.status, 200);
  r = await f.move({ type: 'withdrawal', amount: 100, concept: 'Retiro a banco' });
  assert.equal(r.status, 200);
  r = await f.cash('current');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.summary, {
    opening_float: 500, cash_sales: 200, cash_tips: 20, income: 100, expense: 50, withdrawal: 100, expected_cash: 670,
    card_sales: 300, transfer_sales: 150, other_sales: 0, card_tips: 10, transfer_tips: 0, payments_count: 3
  });
  assert.equal(r.data.movements.length, 3);
  assert.equal(r.data.payments.length, 3);
  assert.ok(r.data.payments.every((p) => 'staff_name' in p));

  r = await f.cash('close', { counted_cash: 650, notes: 'Faltaron monedas' });
  assert.equal(r.status, 200, r.body);
  const s = r.data.session;
  assert.equal(s.status, 'closed');
  assert.equal(s.expected_cash, 670);
  assert.equal(s.counted_cash, 650);
  assert.equal(s.difference, -20);
  assert.equal(s.closed_by, 'st_ownerA');
  assert.ok(s.closed_at);
  assert.match(s.notes, /Cierre: Faltaron monedas/);
  const nts = await f.db.find('notifications', { shop_id: 'shop_a', type: 'cash_closed' });
  assert.equal(nts.length, 1, 'un aviso por dueño activo');
  assert.equal(nts[0].staff_id, 'st_ownerA');
  assert.match(nts[0].title, /faltante de \$20\.00/);
  assert.match(nts[0].body, /Esperado \$670\.00/);
  assert.equal(nts[0].data.difference, -20);
  assert.equal(nts[0].link, '#/caja');
  // Ya cerrada: current vuelve a vacío con el último corte.
  r = await f.cash('current');
  assert.equal(r.data.session, null);
  assert.equal(r.data.last_session.id, s.id);
  r = await f.cash('close', { counted_cash: 1 });
  assert.equal(r.status, 409);
  // El efectivo cobrado sin caja abierta ya no se liga.
  const p = await f.pay({ amount: 10, method: 'cash' });
  assert.equal(p.data.cash_session_id, null);
});

test('corte exacto: sin notificación; reembolso dentro de la caja se descuenta', async () => {
  const f = await setup();
  await f.cash('open', { opening_float: 100 });
  const p = (await f.pay({ amount: 200, tip: 0, method: 'cash' })).data;
  await f.pay({ amount: 50, method: 'cash' });
  await f.call('POST', '/api/payments/' + p.id + '/refund', { as: 'ownerA', ...A });
  let r = await f.cash('current');
  assert.equal(r.data.summary.cash_sales, 50);
  assert.equal(r.data.summary.expected_cash, 150);
  assert.equal(r.data.payments.length, 2, 'la lista muestra también el reembolsado');
  r = await f.cash('close', { counted_cash: 150 });
  assert.equal(r.status, 200);
  assert.equal(r.data.session.difference, 0);
  assert.equal(await f.db.count('notifications', { type: 'cash_closed' }), 0);
  // Sobrante.
  await f.cash('open', { opening_float: 100 });
  r = await f.cash('close', { counted_cash: 130.5 });
  assert.equal(r.data.session.difference, 30.5);
  const n = await f.db.findOne('notifications', { type: 'cash_closed' });
  assert.match(n.title, /sobrante de \$30\.50/);
});

test('movimientos: validaciones y no sale más efectivo del que hay', async () => {
  const f = await setup();
  await f.cash('open', { opening_float: 100 });
  let r = await f.move({ type: 'robo', amount: 0, concept: 'x' });
  assert.equal(r.status, 400);
  for (const k of ['type', 'amount', 'concept']) assert.ok(r.error.fields[k], k);
  r = await f.move({ type: 'expense', amount: -5, concept: 'x'.repeat(121) });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.amount && r.error.fields.concept);
  r = await f.move({ type: 'withdrawal', amount: 100.01, concept: 'Retiro' });
  assert.equal(r.status, 400);
  assert.match(r.error.fields.amount, /\$100\.00/);
  r = await f.move({ type: 'withdrawal', amount: 100, concept: 'Retiro' });
  assert.equal(r.status, 200);
  r = await f.move({ type: 'expense', amount: 1, concept: 'Café' });
  assert.equal(r.status, 400, 'caja en cero');
  r = await f.move({ type: 'income', amount: 1, concept: 'Cambio' });
  assert.equal(r.status, 200, 'un ingreso siempre se puede');
});

test('historial de cortes por fecha (desc) y validaciones del rango', async () => {
  const f = await setup();
  const mk = (id, date, status) => f.db.insert('cash_sessions', { id, shop_id: 'shop_a', status, opened_at: date + 'T15:00:00.000Z', opening_float: 0, date, closed_at: status === 'closed' ? date + 'T23:00:00.000Z' : null });
  await mk('cs_1', addDays(f.today, -40), 'closed');
  await mk('cs_2', addDays(f.today, -5), 'closed');
  await mk('cs_3', addDays(f.today, -1), 'closed');
  await f.db.insert('cash_sessions', { id: 'cs_b', shop_id: 'shop_b', status: 'closed', opened_at: nowIso(), opening_float: 0, date: addDays(f.today, -1) });
  let r = await f.cash('sessions');
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.data.map((s) => s.id), ['cs_3', 'cs_2'], 'por defecto: últimos 30 días, sin otras barberías');
  r = await f.cash('sessions', { qs: '?from=' + addDays(f.today, -60) + '&to=' + f.today });
  assert.deepEqual(r.data.map((s) => s.id), ['cs_3', 'cs_2', 'cs_1']);
  r = await f.cash('sessions', { qs: '?from=' + f.today });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.to);
  r = await f.cash('sessions', { qs: '?from=hoy&to=' + f.today });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.from);
});

test('permisos: solo el dueño (y superadmin) opera la caja; aislamiento entre barberías', async () => {
  const f = await setup();
  for (const as of ['barberA', 'clientA']) {
    assert.equal((await f.cash('current', null, as)).status, 403, as);
    assert.equal((await f.cash('open', { opening_float: 1 }, as)).status, 403, as);
    assert.equal((await f.move({ type: 'income', amount: 1, concept: 'xx' }, as)).status, 403, as);
    assert.equal((await f.cash('sessions', null, as)).status, 403, as);
  }
  assert.equal((await f.cash('current', null, 'ownerB')).status, 403, 'dueño B en barbería A');
  let r = await f.cash('open', { opening_float: 300 }, 'super');
  assert.equal(r.status, 200, 'superadmin actúa como dueño');
  assert.equal(r.data.session.opened_by, 'u_super');
  await f.move({ type: 'income', amount: 50, concept: 'Aporte' });
  r = await f.cash('current', null, 'ownerB', 'shop_b');
  assert.equal(r.data.session, null, 'B no ve la caja de A');
  r = await f.move({ type: 'income', amount: 50, concept: 'Aporte' }, 'ownerB', 'shop_b');
  assert.equal(r.status, 409, 'B no tiene caja abierta');
  r = await f.cash('close', { counted_cash: 0 }, 'ownerB', 'shop_b');
  assert.equal(r.status, 409, 'B no puede cerrar la caja de A');
  assert.equal((await f.db.findOne('cash_sessions', { shop_id: 'shop_a' })).status, 'open');
  r = await f.cash('current');
  assert.equal(r.data.summary.expected_cash, 350);
});
