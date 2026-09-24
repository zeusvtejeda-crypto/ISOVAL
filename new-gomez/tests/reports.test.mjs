import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { nowInTz, newId, nowIso } from '../core/util.js';

const A = { shop: 'shop_a' };
const B = { shop: 'shop_b' };
const FROM = '2026-03-02', TO = '2026-03-08'; // lunes a domingo
const Q = '?from=' + FROM + '&to=' + TO;
const CORTE = { id: 'sv_corte', name: 'Corte', price: 200, duration_min: 40 };
const BARBA = { id: 'sv_barba', name: 'Barba', price: 120, duration_min: 20 };

// Datos conocidos (ver cálculo esperado en cada prueba).
async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  f.tokens.barberA2 = await createSession(f.db, { kind: 'pin', staff_id: 'st_barberA2', shop_id: 'shop_a' });
  f.today = nowInTz('America/Mexico_City').date;
  const ap = (id, staff_id, date, start_min, status, client_id, services, extra) => f.db.insert('appointments', Object.assign({
    id, shop_id: 'shop_a', folio: 'TB-' + id.toUpperCase(), client_id, staff_id, date, start_min,
    end_min: start_min + services.reduce((m, s) => m + s.duration_min, 0), duration_min: services.reduce((m, s) => m + s.duration_min, 0),
    services, total: services.reduce((m, s) => m + s.price, 0), status, source: 'manual', client_name: 'Cliente ' + client_id, created_at: nowIso()
  }, extra || {}));
  const pay = (id, o) => f.db.insert('payments', Object.assign({ id, shop_id: 'shop_a', tip: 0, status: 'paid', created_at: nowIso() }, o));
  for (const c of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) await f.db.insert('clients', { id: c, shop_id: 'shop_a', name: 'Cliente ' + c, phone: '55000000' + c.slice(1).padStart(2, '0'), tags: ['VIP'], source: 'manual', created_at: '2026-01-05T18:00:00.000Z' });
  // Rango actual
  await ap('a1', 'st_barberA', '2026-03-02', 600, 'completed', 'c1', [CORTE]);
  await ap('a2', 'st_barberA', '2026-03-02', 660, 'completed', 'c2', [CORTE, BARBA]);
  await ap('a3', 'st_barberA2', '2026-03-05', 600, 'confirmed', 'c1', [CORTE]);
  await ap('a4', 'st_barberA2', '2026-03-05', 700, 'cancelled', 'c3', [CORTE]);
  await ap('a5', 'st_barberA', '2026-03-06', 900, 'no_show', 'c4', [CORTE]);
  await ap('a6', 'st_ownerA', '2026-03-07', 1000, 'completed', 'c5', [CORTE, BARBA]);
  await ap('a7', 'st_barberA', '2026-03-04', 600, 'completed', 'c2', [CORTE]);
  await pay('p1', { appointment_id: 'a1', client_id: 'c1', staff_id: 'st_barberA', amount: 200, tip: 20, method: 'cash', date: '2026-03-02', concept: 'Corte' });
  await pay('p2', { appointment_id: 'a6', client_id: 'c5', staff_id: 'st_ownerA', amount: 300, method: 'card', date: '2026-03-07', concept: 'Corte, Barba' });
  await pay('p3', { appointment_id: 'a7', client_id: 'c2', staff_id: 'st_barberA', amount: 200, method: 'cash', date: '2026-03-04', status: 'refunded' });
  await pay('p4', { staff_id: null, amount: 150, method: 'transfer', date: '2026-03-06', concept: '=HYPERLINK("http://x")' });
  // Rango anterior (2026-02-23 … 2026-03-01)
  await ap('b1', 'st_barberA', '2026-02-24', 600, 'completed', 'c6', [CORTE]);
  await ap('b2', 'st_barberA', '2026-02-25', 600, 'cancelled', 'c1', [CORTE]);
  await pay('p6', { staff_id: null, amount: 100, method: 'card', date: '2026-02-26' });
  // Historial: c2 ya venía; c4 solo tenía una cancelada (sigue siendo nuevo).
  await ap('h1', 'st_barberA2', '2026-01-10', 600, 'completed', 'c2', [CORTE]);
  await ap('h2', 'st_barberA', '2026-01-15', 600, 'cancelled', 'c4', [CORTE]);
  // Descansos: A2 todo el martes; toda la barbería el miércoles 10:00–11:00.
  await f.db.insert('time_off', { id: 'to1', shop_id: 'shop_a', staff_id: 'st_barberA2', date_from: '2026-03-03', date_to: '2026-03-03', created_at: nowIso() });
  await f.db.insert('time_off', { id: 'to2', shop_id: 'shop_a', staff_id: null, date_from: '2026-03-04', date_to: '2026-03-04', start_min: 600, end_min: 660, created_at: nowIso() });
  // Hoy
  await ap('t1', 'st_barberA', f.today, 1100, 'confirmed', 'c1', [CORTE]);
  await ap('t2', 'st_barberA2', f.today, 700, 'completed', 'c2', [CORTE, BARBA]);
  await ap('t3', 'st_barberA', f.today, 800, 'cancelled', 'c3', [CORTE]);
  await ap('t4', 'st_barberA', f.today, 650, 'no_show', 'c4', [CORTE]);
  // Otra barbería
  await f.db.insert('appointments', { id: 'bx', shop_id: 'shop_b', folio: 'TB-BX', staff_id: 'st_ownerB', date: '2026-03-03', start_min: 600, end_min: 630, duration_min: 30, services: [], total: 999, status: 'completed', created_at: nowIso() });
  await f.db.insert('payments', { id: 'pbx', shop_id: 'shop_b', staff_id: 'st_ownerB', amount: 777, tip: 0, method: 'cash', status: 'paid', created_at: nowIso(), date: '2026-03-03' });
  f.dash = (as, extra, shop) => f.call('GET', '/api/reports/dashboard' + Q + (extra || ''), { as, shop: shop || 'shop_a' });
  return f;
}

test('dashboard del dueño: valores exactos con datos conocidos', async () => {
  const f = await setup();
  const r = await f.dash('ownerA');
  assert.equal(r.status, 200, r.body);
  const d = r.data;
  assert.deepEqual(d.range, { from: FROM, to: TO, days: 7, prev_from: '2026-02-23', prev_to: '2026-03-01' });
  assert.deepEqual(d.kpis, {
    revenue: 970,            // p1 200 + p2 300 + p4 150 + a2 sin pago 320 (a7 tiene pago reembolsado → 0)
    revenue_prev: 300,       // b1 sin pago 200 + p6 100
    appointments: 6, appointments_prev: 1,
    completed: 4, cancelled: 1, no_show: 1,
    avg_ticket: 242.5,       // 970 / (a1, a6, p4, a2)
    tips: 20,
    new_clients: 3, returning_clients: 1,  // nuevos c1, c4, c5 · recurrente c2
    occupancy_pct: 2.8,      // 280 min / (3×6×600 − 600 − 3×60) = 280/10020
    cancel_rate: 14.3,       // 1/7
    no_show_rate: 20         // 1/(4+1)
  });
  assert.deepEqual(d.series, [
    { date: '2026-03-02', revenue: 520, appointments: 2, completed: 2 },
    { date: '2026-03-03', revenue: 0, appointments: 0, completed: 0 },
    { date: '2026-03-04', revenue: 0, appointments: 1, completed: 1 },
    { date: '2026-03-05', revenue: 0, appointments: 1, completed: 0 },
    { date: '2026-03-06', revenue: 150, appointments: 1, completed: 0 },
    { date: '2026-03-07', revenue: 300, appointments: 1, completed: 1 },
    { date: '2026-03-08', revenue: 0, appointments: 0, completed: 0 }
  ]);
  assert.deepEqual(d.by_staff, [
    { staff_id: 'st_barberA', name: 'Barbero A', color: '', appointments: 4, completed: 3, revenue: 520, occupancy_pct: 5.1 },   // 180/3540
    { staff_id: 'st_ownerA', name: 'Dueño A', color: '', appointments: 1, completed: 1, revenue: 300, occupancy_pct: 1.7 },      // 60/3540
    { staff_id: 'st_barberA2', name: 'Barbero A2', color: '', appointments: 1, completed: 0, revenue: 0, occupancy_pct: 1.4 }    // 40/2940
  ]);
  assert.deepEqual(d.top_staff, { staff_id: 'st_barberA', name: 'Barbero A', color: '', appointments: 4, completed: 3, revenue: 520 });
  assert.deepEqual(d.by_service, [
    { service_id: 'sv_corte', name: 'Corte', count: 4, revenue: 800 },
    { service_id: 'sv_barba', name: 'Barba', count: 2, revenue: 240 }
  ]);
  assert.deepEqual(d.by_status, { pending: 0, confirmed: 1, completed: 4, cancelled: 1, no_show: 1 });
  assert.deepEqual(d.by_hour, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((hour) => ({ hour, count: { 10: 3, 11: 1, 15: 1, 16: 1 }[hour] || 0 })));
  assert.deepEqual(d.by_weekday, [
    { weekday: 0, count: 0, revenue: 0 }, { weekday: 1, count: 2, revenue: 520 }, { weekday: 2, count: 0, revenue: 0 },
    { weekday: 3, count: 1, revenue: 0 }, { weekday: 4, count: 1, revenue: 0 }, { weekday: 5, count: 1, revenue: 150 },
    { weekday: 6, count: 1, revenue: 300 }
  ]);
  assert.deepEqual(d.by_method, { cash: 200, card: 300, transfer: 150, other: 0 });
  // Hoy: sin canceladas, por hora; esperado = pendientes/confirmadas/atendidas (no el no-show).
  assert.equal(d.today.date, f.today);
  assert.deepEqual(d.today.appointments.map((a) => a.id), ['t4', 't2', 't1']);
  assert.equal(d.today.count, 3);
  assert.equal(d.today.expected_revenue, 520);
  assert.equal(d.today.appointments[0].staff_name, 'Barbero A');
  assert.equal(d.today.appointments[0].manage_token_hash, undefined);
  assert.ok('balance' in d.today.appointments[0]);
});

test('dashboard: el barbero ve solo su versión; el dueño puede filtrar por barbero', async () => {
  const f = await setup();
  let r = await f.dash('barberA');
  assert.equal(r.status, 200, r.body);
  const d = r.data;
  assert.equal(d.kpis.revenue, 520);        // p1 200 + a2 320
  assert.equal(d.kpis.revenue_prev, 200);   // b1 (p6 no tiene barbero)
  assert.equal(d.kpis.appointments, 4);
  assert.equal(d.kpis.tips, 20);
  assert.equal(d.kpis.occupancy_pct, 5.1);
  assert.equal(d.kpis.new_clients, 2);      // c1, c4
  assert.equal(d.kpis.returning_clients, 1); // c2 (historial con otro barbero)
  assert.deepEqual(d.by_staff.map((s) => s.staff_id), ['st_barberA']);
  assert.equal(d.top_staff.staff_id, 'st_barberA');
  assert.deepEqual(d.by_method, { cash: 200, card: 0, transfer: 0, other: 0 });
  assert.deepEqual(d.today.appointments.map((a) => a.id), ['t4', 't1']);
  assert.equal(d.today.expected_revenue, 200);
  r = await f.dash('barberA', '&staff_id=st_barberA2');
  assert.equal(r.status, 403, 'no puede ver a otro barbero');
  r = await f.dash('barberA2');
  assert.equal(r.status, 200, 'sesión PIN');
  assert.equal(r.data.kpis.appointments, 1);
  assert.equal(r.data.kpis.occupancy_pct, 1.4);
  r = await f.dash('ownerA', '&staff_id=st_barberA2');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.by_staff.map((s) => s.staff_id), ['st_barberA2']);
  assert.equal(r.data.kpis.revenue, 0);
  assert.equal(r.data.kpis.cancel_rate, 50);
  r = await f.dash('ownerA', '&staff_id=st_ownerB');
  assert.equal(r.status, 404, 'barbero de otra barbería');
  r = await f.dash('clientA');
  assert.equal(r.status, 403);
  r = await f.dash('super');
  assert.equal(r.status, 200, 'superadmin como dueño');
  assert.equal(r.data.kpis.revenue, 970);
});

test('dashboard: validaciones del rango y rango sin datos', async () => {
  const f = await setup();
  let r = await f.call('GET', '/api/reports/dashboard', { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.from && r.error.fields.to);
  r = await f.call('GET', '/api/reports/dashboard?from=2026-02-30&to=2026-03-02', { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.from);
  r = await f.call('GET', '/api/reports/dashboard?from=2025-01-01&to=2026-03-01', { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  assert.match(r.error.fields.to, /400 días/);
  r = await f.call('GET', '/api/reports/dashboard?from=2025-01-01&to=2025-01-31', { as: 'ownerA', ...A });
  assert.equal(r.status, 200);
  assert.equal(r.data.series.length, 31);
  assert.equal(r.data.kpis.revenue, 0);
  assert.equal(r.data.kpis.avg_ticket, 0);
  assert.equal(r.data.top_staff, null);
  assert.deepEqual(r.data.by_service, []);
});

test('dashboard: aislamiento entre barberías', async () => {
  const f = await setup();
  let r = await f.dash('ownerB');
  assert.equal(r.status, 403, 'dueño B en barbería A');
  r = await f.dash('ownerB', '', 'shop_b');
  assert.equal(r.status, 200);
  assert.equal(r.data.kpis.revenue, 1776, 'su pago suelto 777 + su cita atendida sin pago 999');
  assert.equal(r.data.kpis.appointments, 1);
  assert.equal(r.data.today.count, 0);
  const ownerA = await f.dash('ownerA');
  assert.equal(ownerA.data.kpis.revenue, 970, 'A no ve lo de B');
});

test('export CSV: BOM, encabezados en español, nombre de archivo y protección contra fórmulas', async () => {
  const f = await setup();
  const exp = (type, as, extra) => f.call('GET', '/api/reports/export' + Q + '&type=' + type + (extra || ''), { as: as || 'ownerA', ...A });
  let r = await exp('payments');
  assert.equal(r.status, 200, r.body);
  assert.equal(r.headers['content-type'], 'text/csv; charset=utf-8');
  assert.equal(r.headers['content-disposition'], 'attachment; filename="alfa-payments-2026-03-02_2026-03-08.csv"');
  assert.ok(r.body.startsWith('﻿'));
  let lines = r.body.slice(1).split('\r\n');
  assert.equal(lines[0], 'Fecha,Hora,Folio de cita,Cliente,Barbero,Concepto,Forma de pago,Monto,Propina,Total,Estado,Registró');
  assert.equal(lines.length, 5, 'encabezado + p1..p4');
  assert.ok(lines.some((l) => l.includes(',TB-A1,Cliente c1,Barbero A,Corte,Efectivo,200,20,220,Pagado,')));
  assert.ok(lines.some((l) => l.includes('Reembolsado')));
  assert.ok(lines.some((l) => l.includes('"\'=HYPERLINK(""http://x"")"')), 'fórmula neutralizada');

  r = await exp('appointments');
  assert.equal(r.status, 200);
  lines = r.body.slice(1).split('\r\n');
  assert.match(lines[0], /^Folio,Fecha,Hora,Fin,Duración \(min\),Barbero,Cliente,Teléfono,Servicios,Total,Pagado,Saldo,Estado/);
  assert.equal(lines.length, 8);
  assert.ok(lines.some((l) => l.startsWith('TB-A2,2026-03-02,11:00,12:00,60,Barbero A,Cliente c2,,Corte + Barba,320,0,320,Atendida,')));
  assert.ok(lines.some((l) => l.startsWith('TB-A1,2026-03-02,10:00,10:40,40,Barbero A,Cliente c1,,Corte,200,200,0,Atendida,')));

  r = await exp('clients');
  assert.equal(r.status, 200);
  lines = r.body.slice(1).split('\r\n');
  assert.match(lines[0], /^Nombre,Teléfono,Correo/);
  const c2 = lines.find((l) => l.startsWith('Cliente c2,'));
  assert.equal(c2, 'Cliente c2,5500000002,,,VIP,Panel,Sí,2026-01-05,2,2,0,2026-03-04,');

  r = await exp('commissions');
  assert.equal(r.status, 200);
  lines = r.body.slice(1).split('\r\n');
  assert.equal(lines[0], 'Barbero,% comisión,Servicios atendidos,Ventas,Comisión,Propinas,Pagado,Saldo');
  assert.ok(lines.includes('Barbero A,50,3,200,100,20,0,120'));
  assert.equal(lines[lines.length - 1], 'Total,,4,500,100,20,0,120');

  r = await exp('secretos');
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.type);
  r = await f.call('GET', '/api/reports/export?type=payments', { as: 'ownerA', ...A });
  assert.equal(r.status, 400);
  r = await exp('payments', 'barberA');
  assert.equal(r.status, 403, 'barbero no exporta');
  r = await f.call('GET', '/api/reports/export' + Q + '&type=payments', { as: 'ownerB', ...B });
  assert.equal(r.status, 200);
  assert.equal(r.body.slice(1).split('\r\n').length, 2, 'B solo exporta lo suyo');
  assert.ok(!r.body.includes('Cliente c1'));
});
