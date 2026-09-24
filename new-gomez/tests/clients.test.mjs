import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { scopedDb } from '../core/db.js';
import { newId, addDays, nowInTz } from '../core/util.js';

const today = () => nowInTz('America/Mexico_City').date;

// Escenario CRM (barbería A):
//   Juan  — 3 atendidas (una pagada 250, una sin pagos 300, una con pago reembolsado), 1 cancelada, 1 no-show,
//           1 próxima, más una venta suelta de 100 (sin cita). Barbero A atendió 2 de las 3.
//   María — 1 atendida con el dueño (500). Cliente A — 1 pendiente con Barbero A. Pedro — sin citas. Borrado — oculto.
async function setup() {
  const f = await makeFixture();
  for (const [as, email] of [['ownerA', 'owner.a@t.mx'], ['barberA', 'barber.a@t.mx'], ['clientA', 'client.a@t.mx'], ['ownerB', 'owner.b@t.mx'], ['super', 'super@t.mx']]) await f.login(as, email);
  const A = scopedDb(f.db, 'shop_a');
  const t = today();
  const d = (n) => addDays(t, n);
  await A.insert('clients', { id: 'cl_juan', name: 'Juan Pérez', phone: '3111111111', email: 'juan@correo.mx', tags: ['VIP', 'Barba'], source: 'online', created_at: '2026-01-01T00:00:00.000Z' });
  await A.insert('clients', { id: 'cl_maria', name: 'María López', phone: '3112222222', tags: ['vip'], source: 'manual', created_at: '2026-02-01T00:00:00.000Z' });
  await A.insert('clients', { id: 'cl_pedro', name: 'Pedro Gómez', phone: '3113333333', tags: [], source: 'manual', created_at: '2026-03-01T00:00:00.000Z' });
  await A.insert('clients', { id: 'cl_del', name: 'Borrado Ruiz', phone: '3114444444', tags: ['Oculta'], deleted_at: '2026-04-01T00:00:00.000Z', created_at: '2026-01-15T00:00:00.000Z' });
  const ap = (id, client_id, staff_id, date, status, total) => A.insert('appointments', {
    id, folio: 'TB-' + id.slice(-4).toUpperCase(), client_id, staff_id, date, start_min: 600, end_min: 640, duration_min: 40,
    services: [{ id: 'sv_corte', name: 'Corte', price: total, duration_min: 40 }], total, status, client_name: 'Juan Viejo', created_at: '2026-01-01T00:00:00.000Z'
  });
  await ap('ap_a1', 'cl_juan', 'st_barberA', d(-10), 'completed', 200);
  await ap('ap_a2', 'cl_juan', 'st_ownerA', d(-5), 'completed', 300);
  await ap('ap_a3', 'cl_juan', 'st_barberA', d(-20), 'completed', 150);
  await ap('ap_a4', 'cl_juan', 'st_barberA', d(-3), 'cancelled', 200);
  await ap('ap_a5', 'cl_juan', 'st_ownerA', d(-2), 'no_show', 200);
  await ap('ap_a6', 'cl_juan', 'st_barberA', f.day, 'confirmed', 200);
  await ap('ap_m1', 'cl_maria', 'st_ownerA', d(-1), 'completed', 500);
  await ap('ap_c1', 'cl_clientA', 'st_barberA', f.day, 'pending', 120);
  const pay = (id, o) => A.insert('payments', Object.assign({ id, tip: 0, method: 'cash', status: 'paid', date: t, created_at: '2026-05-0' + id.slice(-1) + 'T00:00:00.000Z' }, o));
  await pay('pm_1', { appointment_id: 'ap_a1', client_id: 'cl_juan', staff_id: 'st_barberA', amount: 250, tip: 30 });
  await pay('pm_2', { appointment_id: 'ap_a3', client_id: 'cl_juan', staff_id: 'st_barberA', amount: 150, status: 'refunded' });
  await pay('pm_3', { appointment_id: null, client_id: 'cl_juan', staff_id: 'st_ownerA', amount: 100, concept: 'Cera' });
  const msg = (id, o) => A.insert('messages', Object.assign({ id, kind: 'custom', body: 'Hola', status: 'sent', created_at: '2026-06-0' + id.slice(-1) + 'T00:00:00.000Z' }, o));
  await msg('ms_1', { appointment_id: 'ap_a1', client_id: 'cl_juan', created_by: 'st_barberA' });
  await msg('ms_2', { appointment_id: 'ap_a2', client_id: 'cl_juan', created_by: 'st_ownerA' });
  await msg('ms_3', { appointment_id: null, client_id: 'cl_juan', created_by: 'st_barberA' });
  await msg('ms_4', { appointment_id: null, client_id: 'cl_juan', created_by: 'st_ownerA' });
  // Barbería B: una cita del cliente de B.
  await scopedDb(f.db, 'shop_b').insert('appointments', { id: 'ap_b1', folio: 'TB-B1', client_id: 'cl_walkB', staff_id: 'st_ownerB', date: d(-1), start_min: 600, end_min: 630, duration_min: 30, services: [], total: 150, status: 'completed', created_at: '2026-01-01T00:00:00.000Z' });
  return { f, d };
}
const A = (who, extra) => Object.assign({ as: who, shop: 'shop_a' }, extra || {});
const ids = (r) => r.data.items.map((c) => c.id);

test('GET /api/clients: permisos (cliente 403) y estadísticas correctas para el dueño', async () => {
  const { f, d } = await setup();
  assert.equal((await f.call('GET', '/api/clients', A('clientA'))).status, 403);
  assert.equal((await f.call('GET', '/api/clients', { shop: 'shop_a' })).status, 401);
  const r = await f.call('GET', '/api/clients', A('ownerA'));
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.total, 4);
  assert.ok(!ids(r).includes('cl_del'));
  assert.deepEqual(r.data.tags, ['Barba', 'VIP']);
  const juan = r.data.items.find((c) => c.id === 'cl_juan');
  assert.deepEqual(juan.stats, {
    visits: 3, completed: 3, cancelled: 1, no_shows: 1, total_spent: 650, last_visit: d(-5), next_visit: f.day, first_visit: d(-20),
    avg_ticket: 216.67, appointments: 6
  });
  const maria = r.data.items.find((c) => c.id === 'cl_maria');
  assert.equal(maria.stats.total_spent, 500);
  assert.equal(maria.stats.visits, 1);
  const pedro = r.data.items.find((c) => c.id === 'cl_pedro');
  assert.equal(pedro.stats.visits, 0);
  assert.equal(pedro.stats.last_visit, null);
  assert.equal(pedro.stats.avg_ticket, 0);
  const ca = r.data.items.find((c) => c.id === 'cl_clientA');
  assert.equal(ca.stats.next_visit, f.day);
  assert.ok(r.data.items.every((c) => c.shop_id === 'shop_a'));
});

test('GET /api/clients: orden, paginación, búsqueda y etiquetas', async () => {
  const { f } = await setup();
  const q = async (qs) => { const r = await f.call('GET', '/api/clients' + qs, A('ownerA')); assert.equal(r.status, 200, r.body); return r; };
  assert.deepEqual(ids(await q('')), ['cl_maria', 'cl_juan', 'cl_clientA', 'cl_pedro']);          // recent (por defecto)
  assert.deepEqual(ids(await q('?sort=visits')), ['cl_juan', 'cl_maria', 'cl_clientA', 'cl_pedro']);
  assert.deepEqual(ids(await q('?sort=spent')), ['cl_juan', 'cl_maria', 'cl_clientA', 'cl_pedro']);
  assert.deepEqual(ids(await q('?sort=name')), ['cl_clientA', 'cl_juan', 'cl_maria', 'cl_pedro']);
  const page = await q('?sort=name&limit=2&offset=1');
  assert.deepEqual(ids(page), ['cl_juan', 'cl_maria']);
  assert.equal(page.data.total, 4);
  assert.equal(page.data.items[0].stats.total_spent, 650, 'stats correctas también paginando por nombre');
  const page2 = await q('?sort=spent&limit=1&offset=1');
  assert.deepEqual(ids(page2), ['cl_maria']);
  assert.deepEqual(ids(await q('?q=perez')), ['cl_juan']);                 // sin acentos
  assert.deepEqual(ids(await q('?q=' + encodeURIComponent('JUAN PÉR'))), ['cl_juan']);
  assert.deepEqual(ids(await q('?q=3112222')), ['cl_maria']);
  assert.deepEqual(ids(await q('?q=' + encodeURIComponent('+52 311 222 2222'))), ['cl_maria']);
  assert.deepEqual(ids(await q('?q=juan@correo')), ['cl_juan']);
  assert.equal((await q('?q=borrado')).data.total, 0);
  const vip = await q('?tag=vip&sort=name');
  assert.deepEqual(ids(vip), ['cl_juan', 'cl_maria']);
  assert.equal(vip.data.total, 2);
  assert.deepEqual(vip.data.tags, ['Barba', 'VIP'], 'tags: todas las usadas, no solo las filtradas');
  assert.equal((await q('?limit=999')).data.items.length, 4);
  assert.equal((await f.call('GET', '/api/clients?sort=raro', A('ownerA'))).status, 400);
});

test('barbero (.own): solo clientes con citas suyas; estadísticas y ficha con SUS citas y cobros', async () => {
  const { f, d } = await setup();
  const r = await f.call('GET', '/api/clients?sort=name', A('barberA'));
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(ids(r), ['cl_clientA', 'cl_juan']);
  assert.equal(r.data.total, 2);
  assert.deepEqual(r.data.tags, ['Barba', 'VIP']);
  const juan = r.data.items.find((c) => c.id === 'cl_juan');
  assert.equal(juan.stats.visits, 2);
  assert.equal(juan.stats.total_spent, 250);  // su cobro pagado; el reembolsado no suma; la venta del dueño no cuenta
  assert.equal(juan.stats.no_shows, 0);
  assert.equal(juan.stats.cancelled, 1);
  assert.equal(juan.stats.last_visit, d(-10));
  assert.equal(juan.stats.avg_ticket, 125);
  const det = await f.call('GET', '/api/clients/cl_juan', A('barberA'));
  assert.equal(det.status, 200, det.body);
  assert.deepEqual(det.data.appointments.map((a) => a.id), ['ap_a6', 'ap_a4', 'ap_a1', 'ap_a3']);
  assert.ok(det.data.appointments.every((a) => a.staff_id === 'st_barberA' && a.manage_token_hash === undefined));
  assert.deepEqual(det.data.payments.map((p) => p.id).sort(), ['pm_1', 'pm_2']);
  assert.deepEqual(det.data.messages.map((m) => m.id).sort(), ['ms_1', 'ms_3']);
  assert.equal(det.data.client.stats.visits, 2);
  for (const id of ['cl_maria', 'cl_pedro', 'cl_walkB', 'cl_del']) {
    assert.equal((await f.call('GET', '/api/clients/' + id, A('barberA'))).status, 404, id);
    assert.equal((await f.call('PATCH', '/api/clients/' + id, A('barberA', { body: { notes: 'x' } }))).status, 404, id);
  }
});

test('GET /api/clients/:id: dueño ve historial completo (citas desc, pagos, mensajes)', async () => {
  const { f } = await setup();
  const r = await f.call('GET', '/api/clients/cl_juan', A('ownerA'));
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.data.appointments.map((a) => a.id), ['ap_a6', 'ap_a5', 'ap_a4', 'ap_a2', 'ap_a1', 'ap_a3']);
  const a1 = r.data.appointments.find((a) => a.id === 'ap_a1');
  assert.equal(a1.staff_name, 'Barbero A');
  assert.equal(a1.paid, 250);
  assert.deepEqual(r.data.payments.map((p) => p.id), ['pm_3', 'pm_2', 'pm_1']);
  assert.deepEqual(r.data.messages.map((m) => m.id), ['ms_4', 'ms_3', 'ms_2', 'ms_1']);
  assert.equal(r.data.client.stats.total_spent, 650);
  assert.equal((await f.call('GET', '/api/clients/cl_del', A('ownerA'))).status, 404);
});

test('aislamiento: ids de otra barbería → 404 (leer, editar, borrar) y nada cambia', async () => {
  const { f } = await setup();
  assert.equal((await f.call('GET', '/api/clients/cl_walkB', A('ownerA'))).status, 404);
  assert.equal((await f.call('PATCH', '/api/clients/cl_walkB', A('ownerA', { body: { name: 'Robado' } }))).status, 404);
  assert.equal((await f.call('DELETE', '/api/clients/cl_walkB', A('ownerA'))).status, 404);
  const B = { as: 'ownerB', shop: 'shop_b' };
  assert.equal((await f.call('GET', '/api/clients/cl_juan', B)).status, 404);
  assert.equal((await f.call('PATCH', '/api/clients/cl_juan', Object.assign({ body: { name: 'Robado' } }, B))).status, 404);
  assert.equal((await f.call('DELETE', '/api/clients/cl_juan', B)).status, 404);
  assert.equal((await f.call('GET', '/api/clients', { as: 'ownerB', shop: 'shop_a' })).status, 403);
  const lb = await f.call('GET', '/api/clients', B);
  assert.deepEqual(ids(lb), ['cl_walkB']);
  assert.equal(lb.data.items[0].stats.total_spent, 150);
  assert.equal((await f.db.findOne('clients', { id: 'cl_walkB' })).name, 'Cliente B');
  assert.equal((await f.db.findOne('clients', { id: 'cl_juan' })).deleted_at, null);
});

test('POST /api/clients: validaciones, teléfono único por barbería y borrado lógico', async () => {
  const { f, d } = await setup();
  assert.equal((await f.call('POST', '/api/clients', A('clientA', { body: { name: 'Nuevo' } }))).status, 403);
  const cases = [
    [{}, 'name'], [{ name: 'J' }, 'name'], [{ name: 'x'.repeat(81) }, 'name'], [{ name: 'Luis', phone: '311123' }, 'phone'],
    [{ name: 'Luis', email: 'luis@' }, 'email'], [{ name: 'Luis', birthday: '1990-02-30' }, 'birthday'],
    [{ name: 'Luis', birthday: '15/02/1990' }, 'birthday'], [{ name: 'Luis', birthday: d(1) }, 'birthday'],
    [{ name: 'Luis', notes: 'x'.repeat(1001) }, 'notes'], [{ name: 'Luis', tags: 'x'.repeat(21) }, 'tags'],
    [{ name: 'Luis', tags: Array.from({ length: 11 }, (_, i) => 't' + i) }, 'tags'], [{ name: 'Luis', tags: [{}] }, 'tags'],
    [{ name: 'Luis', marketing_ok: 'quizá' }, 'marketing_ok']
  ];
  for (const [body, field] of cases) {
    const r = await f.call('POST', '/api/clients', A('ownerA', { body }));
    assert.equal(r.status, 400, JSON.stringify(body) + ' → ' + r.body);
    assert.ok(r.error.fields && r.error.fields[field], JSON.stringify(body) + ' esperaba ' + field + ': ' + r.body);
  }
  const ok = await f.call('POST', '/api/clients', A('ownerA', { body: { name: ' Luis  Mora ', phone: '+52 311 555 6666', email: 'LUIS@Correo.MX', birthday: '1990-02-15', notes: 'Prefiere tijera.\n\nAlérgico a X', tags: ['VIP', 'vip', ' Barba ', ''], marketing_ok: false, source: 'online', user_id: 'u_super' } }));
  assert.equal(ok.status, 200, ok.body);
  const c = ok.data;
  assert.equal(c.name, 'Luis Mora');
  assert.equal(c.phone, '3115556666');
  assert.equal(c.email, 'luis@correo.mx');
  assert.deepEqual(c.tags, ['VIP', 'Barba']);
  assert.equal(c.marketing_ok, false);
  assert.equal(c.source, 'manual');
  assert.equal(c.user_id, null);
  assert.equal(c.notes, 'Prefiere tijera.\n\nAlérgico a X');
  assert.equal(c.stats.visits, 0);
  // Duplicado de teléfono en la misma barbería → 409 con el nombre.
  const dup = await f.call('POST', '/api/clients', A('barberA', { body: { name: 'Otro', phone: '311 111 1111' } }));
  assert.equal(dup.status, 409);
  assert.equal(dup.error.code, 'duplicate');
  assert.equal(dup.error.message, 'Ya tienes un cliente con ese teléfono: Juan Pérez');
  assert.ok(dup.error.fields.phone);
  // El teléfono de un cliente de OTRA barbería sí se puede usar; y el de un cliente borrado también.
  assert.equal((await f.call('POST', '/api/clients', A('ownerA', { body: { name: 'Homónimo', phone: '3110000002' } }))).status, 200);
  assert.equal((await f.call('POST', '/api/clients', A('ownerA', { body: { name: 'Regresa', phone: '3114444444' } }))).status, 200);
  // Borrar: solo el dueño; lógico.
  assert.equal((await f.call('DELETE', '/api/clients/cl_pedro', A('barberA'))).status, 403);
  const del = await f.call('DELETE', '/api/clients/cl_pedro', A('ownerA'));
  assert.equal(del.status, 200, del.body);
  assert.equal(del.data, null);
  const row = await f.db.findOne('clients', { id: 'cl_pedro' });
  assert.ok(row && row.deleted_at);
  assert.ok(!ids(await f.call('GET', '/api/clients', A('ownerA'))).includes('cl_pedro'));
  assert.equal((await f.call('GET', '/api/clients/cl_pedro', A('ownerA'))).status, 404);
  assert.equal((await f.call('DELETE', '/api/clients/cl_pedro', A('ownerA'))).status, 404);
  assert.equal((await f.call('POST', '/api/clients', A('ownerA', { body: { name: 'Pedro Nuevo', phone: '3113333333' } }))).status, 200);
});

test('PATCH /api/clients/:id: parcial, teléfono único y copia del nombre en sus citas', async () => {
  const { f } = await setup();
  const r = await f.call('PATCH', '/api/clients/cl_juan', A('ownerA', { body: { name: 'Juan Pérez Soto', tags: ['VIP'], notes: '', birthday: null } }));
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.name, 'Juan Pérez Soto');
  assert.deepEqual(r.data.tags, ['VIP']);
  assert.equal(r.data.notes, null);
  assert.equal(r.data.phone, '3111111111');
  assert.equal(r.data.stats.visits, 3);
  const appts = await scopedDb(f.db, 'shop_a').find('appointments', { client_id: 'cl_juan' });
  assert.ok(appts.every((a) => a.client_name === 'Juan Pérez Soto'));
  const dup = await f.call('PATCH', '/api/clients/cl_juan', A('ownerA', { body: { phone: '3112222222' } }));
  assert.equal(dup.status, 409);
  assert.match(dup.error.message, /María López/);
  assert.equal((await f.call('PATCH', '/api/clients/cl_juan', A('ownerA', { body: { phone: '3111111111' } }))).status, 200);
  assert.equal((await f.call('PATCH', '/api/clients/cl_juan', A('ownerA', { body: {} }))).status, 400);
  assert.equal((await f.call('PATCH', '/api/clients/cl_juan', A('ownerA', { body: { name: '' } }))).status, 400);
  // Barbero puede editar a SU cliente.
  const b = await f.call('PATCH', '/api/clients/cl_juan', A('barberA', { body: { notes: 'Degradado bajo' } }));
  assert.equal(b.status, 200, b.body);
  assert.equal(b.data.stats.visits, 2, 'stats del barbero: solo sus citas');
  assert.equal((await f.call('PATCH', '/api/clients/cl_juan', A('clientA', { body: { notes: 'x' } }))).status, 403);
});

// ── domain/clients.js → findOrCreateClient: reservas con sesión y "cliente sin registro" ──
import { findOrCreateClient, WALKIN } from '../core/domain/clients.js';
import { nowIso } from '../core/util.js';

const bookOnline = (f, as, body, ip) => f.call('POST', '/api/public/shops/alfa/appointments', {
  as, ip: ip || '8.8.8.8', body: Object.assign({ services: ['sv_barba'], staff_id: 'st_barberA2', date: f.day, start_min: 900 }, body)
});

test('reserva en línea con sesión: nunca se queda con la ficha de otra persona por teléfono o correo', async () => {
  const f = await makeFixture();
  await f.login('ownerA', 'owner.a@t.mx');
  const sdb = scopedDb(f.db, 'shop_a');
  // Ficha de la víctima (sin cuenta) y una cita suya con nota privada.
  await sdb.insert('clients', { id: 'cl_victima', name: 'Víctima', phone: '5512345678', email: 'victima@correo.mx', tags: [], source: 'manual', created_at: nowIso() });
  const ap = await f.call('POST', '/api/appointments', A('ownerA', { body: { client_id: 'cl_victima', staff_id: 'st_barberA', date: f.day, start_min: 700, services: ['sv_corte'], client_note: 'secreto' } }));
  assert.equal(ap.status, 200, ap.body);
  // Atacante: cuenta nueva, sin ficha en la barbería A.
  const reg = await f.call('POST', '/api/auth/register', { ip: '9.9.9.9', body: { name: 'Atacante', email: 'evil@t.mx', password: 'secreto123' } });
  assert.equal(reg.status, 200, reg.body);
  f.tokens.evil = reg.data.token;
  // Reserva con el teléfono de la víctima y otra con su correo.
  const b1 = await bookOnline(f, 'evil', { name: 'Atacante', phone: '5512345678' });
  assert.equal(b1.status, 200, b1.body);
  const b2 = await bookOnline(f, 'evil', { name: 'Atacante', phone: '5500000009', email: 'victima@correo.mx', start_min: 960 });
  assert.equal(b2.status, 200, b2.body);

  const victim = await sdb.findOne('clients', { id: 'cl_victima' });
  assert.equal(victim.user_id, null, 'la ficha de la víctima sigue sin cuenta');
  const mine = await sdb.find('clients', { user_id: reg.data.user.id });
  assert.equal(mine.length, 1, 'el atacante queda con UNA ficha propia');
  assert.equal(mine[0].name, 'Atacante');
  assert.equal(mine[0].phone, '5500000009', 'solo su propio teléfono (libre); el de la víctima no se duplica');
  assert.equal(mine[0].email, null, 'el correo de otra ficha no se duplica');
  assert.equal(await sdb.count('clients', { phone: '5512345678' }), 1);
  const citas = await sdb.find('appointments', { id: { in: [b1.data.appointment.id, b2.data.appointment.id] } });
  assert.ok(citas.every((a) => a.client_id === mine[0].id), 'sus reservas quedan en su ficha');

  const ctxR = await f.call('GET', '/api/context', { as: 'evil', shop: 'shop_a' });
  assert.equal(ctxR.status, 200, ctxR.body);
  assert.equal(ctxR.data.client.id, mine[0].id);
  const my = await f.call('GET', '/api/my/appointments', { as: 'evil', shop: 'shop_a' });
  assert.equal(my.status, 200, my.body);
  const seen = my.data.upcoming.concat(my.data.past).map((a) => a.id).sort();
  assert.deepEqual(seen, [b1.data.appointment.id, b2.data.appointment.id].sort(), 'solo ve sus propias citas');
  const cancel = await f.call('POST', '/api/my/appointments/' + ap.data.id + '/cancel', { as: 'evil', shop: 'shop_a', body: {} });
  assert.notEqual(cancel.status, 200);
  assert.equal((await sdb.findOne('appointments', { id: ap.data.id })).status, 'confirmed');
});

test('reserva en línea sin sesión: no agrega un correo a la ficha existente (no se puede reclamar después al registrarse)', async () => {
  const f = await makeFixture();
  const sdb = scopedDb(f.db, 'shop_a');
  await sdb.insert('clients', { id: 'cl_victima', name: 'Víctima', phone: '5512345678', tags: [], source: 'manual', created_at: nowIso() });
  const b = await bookOnline(f, undefined, { name: 'Quien sea', phone: '5512345678', email: 'evil@t.mx' });
  assert.equal(b.status, 200, b.body);
  assert.equal((await sdb.findOne('appointments', { id: b.data.appointment.id })).client_id, 'cl_victima', 'la cita sí queda en la ficha por teléfono');
  assert.equal((await sdb.findOne('clients', { id: 'cl_victima' })).email, null);
  const reg = await f.call('POST', '/api/auth/register', { ip: '9.9.9.9', body: { name: 'Atacante', email: 'evil@t.mx', password: 'secreto123', shop_slug: 'alfa' } });
  assert.equal(reg.status, 200, reg.body);
  assert.notEqual(reg.data.contexts[0].client_id, 'cl_victima');
  assert.equal((await sdb.findOne('clients', { id: 'cl_victima' })).user_id, null);
});

test('reserva en línea sin sesión: nunca cae en una ficha con cuenta (su dueño vería citas ajenas)', async () => {
  const f = await makeFixture();
  await f.login('clientA', 'client.a@t.mx');
  const sdb = scopedDb(f.db, 'shop_a');
  // Cliente A tiene cuenta y su ficha tiene el teléfono 3110000001. Alguien reserva sin sesión con ese teléfono.
  const b = await bookOnline(f, undefined, { name: 'Otra Persona', phone: '3110000001', email: 'otra@correo.mx' });
  assert.equal(b.status, 200, b.body);
  const cid = (await sdb.findOne('appointments', { id: b.data.appointment.id })).client_id;
  assert.notEqual(cid, 'cl_clientA');
  const my = await f.call('GET', '/api/my/appointments', { as: 'clientA', shop: 'shop_a' });
  assert.ok(!my.data.upcoming.some((a) => a.id === b.data.appointment.id), 'no aparece en «Mis citas» de Cliente A');
  // Otra reserva sin sesión con el mismo teléfono reutiliza esa ficha sin cuenta (no crea otra).
  const b2 = await bookOnline(f, undefined, { name: 'Otra Persona', phone: '3110000001', start_min: 960 });
  assert.equal((await sdb.findOne('appointments', { id: b2.data.appointment.id })).client_id, cid);
  // Desde el panel (el equipo sí conoce al cliente) se sigue usando la ficha por teléfono.
  const r = await findOrCreateClient(sdb, { name: 'Cliente A', phone: '3110000001', source: 'manual' });
  assert.equal(r.client.id, 'cl_clientA');
});

test('findOrCreateClient: con user_id solo SU ficha; nunca reclama otra por teléfono ni por correo', async () => {
  const f = await makeFixture();
  const sdb = scopedDb(f.db, 'shop_a');
  // Ya tiene ficha → esa, aunque escriba el teléfono de otra persona (que no se copia).
  let r = await findOrCreateClient(sdb, { name: 'Otro Nombre', phone: '3110000009', user_id: 'u_clientA', source: 'online' });
  assert.equal(r.client.id, 'cl_clientA');
  assert.equal(r.created, false);
  assert.equal(r.client.name, 'Cliente A');
  await sdb.insert('clients', { id: 'cl_mail', name: 'Carla', email: 'carla@correo.mx', phone: '3117776666', tags: [], source: 'manual', created_at: nowIso() });
  // El correo o el teléfono escritos en el formulario no bastan para reclamarla (tampoco si es el de su cuenta:
  // no está verificado).
  r = await findOrCreateClient(sdb, { name: 'Carla', email: 'carla@correo.mx', phone: '3117776666', user_id: 'u_otro', source: 'online' });
  assert.notEqual(r.client.id, 'cl_mail');
  assert.equal(r.created, true);
  assert.equal(r.client.user_id, 'u_otro');
  assert.deepEqual([r.client.phone, r.client.email], [null, null], 'no duplica los datos de otra ficha');
  assert.equal((await sdb.findOne('clients', { id: 'cl_mail' })).user_id, null);
  // Sin user_id (panel): por teléfono como siempre, y completa el correo que falta.
  r = await findOrCreateClient(sdb, { name: 'X', phone: '3110000001', email: 'nuevo@correo.mx', source: 'manual' });
  assert.equal(r.client.id, 'cl_clientA');
  assert.equal(r.client.email, 'nuevo@correo.mx');
});

test('cita con "cliente sin registro" (solo nombre): una sola ficha genérica por barbería y client_name con el nombre escrito', async () => {
  const f = await makeFixture();
  await f.login('ownerA', 'owner.a@t.mx');
  await f.login('barberA', 'barber.a@t.mx');
  const sdb = scopedDb(f.db, 'shop_a');
  const before = await sdb.count('clients', {});
  const mk = (as, body) => f.call('POST', '/api/appointments', A(as, { body: Object.assign({ staff_id: 'st_barberA', date: f.day, services: ['sv_corte'] }, body) }));
  const r1 = await mk('ownerA', { start_min: 600, client: { name: 'Don Pepe' } });
  const r2 = await mk('ownerA', { start_min: 700, client: { name: 'Señor del sombrero' }, source: 'walkin' });
  const r3 = await mk('barberA', { start_min: 800, client: { name: 'Otro de paso' } });
  for (const r of [r1, r2, r3]) assert.equal(r.status, 200, r.body);
  assert.equal(await sdb.count('clients', {}), before + 1, 'una sola ficha nueva para todas');
  const g = await sdb.findOne('clients', { id: r1.data.client_id });
  assert.deepEqual([g.name, g.source, g.tags, g.phone, g.email, g.user_id, g.marketing_ok], [WALKIN.name, 'walkin', ['Sin registro'], null, null, null, false]);
  assert.equal(r2.data.client_id, g.id);
  assert.equal(r3.data.client_id, g.id);
  assert.deepEqual([r1.data.client_name, r2.data.client_name, r3.data.client_name], ['Don Pepe', 'Señor del sombrero', 'Otro de paso']);
  // Con teléfono se usa (o crea) la ficha real de la persona.
  const r4 = await mk('ownerA', { start_min: 900, client: { name: 'Juan Real', phone: '5512345678' } });
  assert.equal(r4.status, 200, r4.body);
  assert.notEqual(r4.data.client_id, g.id);
  assert.equal((await sdb.findOne('clients', { id: r4.data.client_id })).name, 'Juan Real');
  // Otra barbería tiene su propia ficha genérica.
  await f.login('ownerB', 'owner.b@t.mx');
  const rb = await f.call('POST', '/api/appointments', { as: 'ownerB', shop: 'shop_b', body: { staff_id: 'st_ownerB', date: f.day, start_min: 600, services: ['sv_corteB'], client: { name: 'Paso B' } } });
  assert.equal(rb.status, 200, rb.body);
  assert.notEqual(rb.data.client_id, g.id);
  assert.equal((await scopedDb(f.db, 'shop_b').findOne('clients', { id: rb.data.client_id })).name, WALKIN.name);
  // La reserva en línea sin teléfono ni correo NO usa la ficha genérica (crea la del cliente).
  const shop = await f.db.findOne('shops', { id: 'shop_a' });
  await f.db.update('shops', { id: 'shop_a' }, { settings: Object.assign({}, shop.settings, { booking: { lead_min: 0, require_phone: false } }) });
  const on = await bookOnline(f, undefined, { name: 'Rosa en línea' });
  assert.equal(on.status, 200, on.body);
  const onRow = await sdb.findOne('appointments', { id: on.data.appointment.id });
  assert.notEqual(onRow.client_id, g.id);
  assert.equal((await sdb.findOne('clients', { id: onRow.client_id })).name, 'Rosa en línea');
});
