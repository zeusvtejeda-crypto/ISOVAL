import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { newId, nowIso, nowInTz, addDays } from '../core/util.js';
import { MAX_REMINDERS_PER_RUN } from '../core/api/automation.js';

const KEY = 'llave-de-automatizacion-1234567890';
const SVC = [{ id: 'sv_corte', name: 'Corte', price: 200, duration_min: 40 }];
let seq = 0;

async function setup() {
  const f = await makeFixture();
  f.env.AUTOMATION_KEY = KEY;
  f.env.PUBLIC_URL = 'https://app.tubarberia.mx';
  for (const k of ['ownerA', 'barberA', 'ownerB', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  await f.db.insert('clients', { id: 'cl_juan', shop_id: 'shop_a', name: 'Juan Pérez', phone: '3111234567', tags: [], source: 'manual', created_at: nowIso() });
  f.auto = (method, path, body, key) => f.call(method, path, { token: key === undefined ? KEY : key, body });
  f.setWa = async (shopId, wa, extra) => {
    const s = await f.db.findOne('shops', { id: shopId });
    await f.db.update('shops', { id: shopId }, Object.assign({ settings: Object.assign({}, s.settings, { whatsapp: Object.assign({}, (s.settings || {}).whatsapp, wa) }) }, extra || {}));
  };
  f.tomorrowIn = (tz) => addDays(nowInTz(tz || 'America/Mexico_City').date, 1);
  return f;
}
function mkAppt(f, o) {
  const start = o.start_min == null ? 600 : o.start_min;
  return f.db.insert('appointments', {
    id: newId('ap'), shop_id: o.shop_id || 'shop_a', folio: 'TB-A' + (++seq), client_id: o.client_id === undefined ? 'cl_juan' : o.client_id,
    staff_id: o.staff_id || 'st_barberA', date: o.date, start_min: start, end_min: start + 40, duration_min: 40, services: SVC, total: 200,
    status: o.status || 'confirmed', source: 'online', client_name: o.client_name || 'Juan Pérez', client_phone: o.client_phone == null ? '3111234567' : o.client_phone,
    reschedule_count: 0, reminder_sent_at: o.reminder_sent_at || null, manage_token_hash: null, created_at: nowIso()
  });
}
function mkMsg(f, o) {
  return f.db.insert('messages', Object.assign({
    id: newId('msg'), shop_id: 'shop_a', appointment_id: null, client_id: 'cl_juan', channel: 'whatsapp', kind: 'custom', to_phone: '3111234567',
    body: 'Hola', status: 'queued', created_at: new Date(Date.now() - 60000 + (++seq)).toISOString()
  }, o));
}

test('automatización: la llave es obligatoria y exacta', async () => {
  const f = await setup();
  for (const [path, method] of [['/api/automation/outbox', 'GET'], ['/api/automation/reminders/run', 'POST'], ['/api/automation/outbox/msg_x', 'POST']]) {
    assert.equal((await f.auto(method, path, {}, null)).status, 401, path + ' sin llave');
    assert.equal((await f.auto(method, path, {}, 'otra-llave')).status, 401, path + ' llave incorrecta');
    const r = await f.auto(method, path, {}, f.tokens.ownerA);
    assert.equal(r.status, 401, path + ' sesión de dueño no sirve');
    assert.equal(r.error.message, 'Llave de automatización inválida.');
  }
  delete f.env.AUTOMATION_KEY;
  assert.equal((await f.auto('GET', '/api/automation/outbox', undefined, '')).status, 401, 'sin AUTOMATION_KEY configurada nadie entra');
  assert.equal((await f.auto('GET', '/api/automation/outbox', undefined, 'undefined')).status, 401);
});

test('outbox: mensajes en cola de todas las barberías activas, los más antiguos primero', async () => {
  const f = await setup();
  const m1 = await mkMsg(f, { body: 'Uno' });
  const m2 = await mkMsg(f, { shop_id: 'shop_b', client_id: 'cl_walkB', to_phone: '3110000002', body: 'Dos', kind: 'reminder' });
  await mkMsg(f, { status: 'prepared' });
  await mkMsg(f, { status: 'sent' });
  const r = await f.auto('GET', '/api/automation/outbox');
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.data.map((m) => m.id), [m1.id, m2.id]);
  assert.deepEqual(Object.keys(r.data[0]).sort(), ['appointment_id', 'body', 'client_id', 'created_at', 'id', 'kind', 'shop_id', 'shop_name', 'to_phone', 'wa_number']);
  assert.equal(r.data[0].wa_number, '523111234567');
  assert.equal(r.data[1].shop_id, 'shop_b');
  assert.equal((await f.auto('GET', '/api/automation/outbox?limit=1')).data.length, 1);
  assert.equal((await f.auto('GET', '/api/automation/outbox?limit=x')).status, 400);
  // Barbería suspendida: sus mensajes no salen.
  await f.db.update('shops', { id: 'shop_b' }, { status: 'suspended' });
  assert.deepEqual((await f.auto('GET', '/api/automation/outbox')).data.map((m) => m.id), [m1.id]);
});

test('outbox: reporte del proveedor (enviado / fallido) y reglas', async () => {
  const f = await setup();
  const a = await mkAppt(f, { date: f.tomorrowIn() });
  const rem = await mkMsg(f, { appointment_id: a.id, kind: 'reminder' });
  let r = await f.auto('POST', '/api/automation/outbox/' + rem.id, { status: 'sent', provider_id: 'wamid.123' });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.status, 'sent');
  assert.equal(r.data.provider_id, 'wamid.123');
  assert.ok(r.data.sent_at);
  assert.equal(r.data.shop_id, 'shop_a');
  assert.ok((await f.db.findOne('appointments', { id: a.id })).reminder_sent_at, 'recordatorio entregado marca la cita');
  assert.equal((await f.db.find('appointment_events', { appointment_id: a.id, type: 'message' })).length, 1);
  assert.equal((await f.auto('POST', '/api/automation/outbox/' + rem.id, { status: 'sent' })).status, 200, 'idempotente');
  r = await f.auto('POST', '/api/automation/outbox/' + rem.id, { status: 'failed' });
  assert.equal(r.status, 409);
  // Fallido: guarda el error, avisa a los dueños y la cita vuelve a "sin recordatorio".
  const b = await mkAppt(f, { date: f.tomorrowIn(), start_min: 700, reminder_sent_at: nowIso() });
  const rem2 = await mkMsg(f, { appointment_id: b.id, kind: 'reminder' });
  r = await f.auto('POST', '/api/automation/outbox/' + rem2.id, { status: 'failed', error: 'Número sin WhatsApp' });
  assert.equal(r.data.status, 'failed');
  assert.equal(r.data.error, 'Número sin WhatsApp');
  assert.equal((await f.db.findOne('appointments', { id: b.id })).reminder_sent_at, null);
  const nts = await f.db.find('notifications', { shop_id: 'shop_a', type: 'system' });
  assert.equal(nts.length, 1);
  assert.equal(nts[0].staff_id, 'st_ownerA');
  assert.match(nts[0].body, /Recordatorio para Juan Pérez/);
  assert.equal((await f.db.find('notifications', { shop_id: 'shop_b' })).length, 0);
  // Reintento exitoso después de un fallo.
  r = await f.auto('POST', '/api/automation/outbox/' + rem2.id, { status: 'sent' });
  assert.equal(r.data.status, 'sent');
  assert.equal(r.data.error, null);
  // Validaciones
  const q = await mkMsg(f, {});
  assert.equal((await f.auto('POST', '/api/automation/outbox/' + q.id, { status: 'opened' })).status, 400);
  assert.equal((await f.auto('POST', '/api/automation/outbox/' + q.id, { status: 'sent', provider_id: 'x'.repeat(201) })).status, 400);
  assert.equal((await f.auto('POST', '/api/automation/outbox/' + q.id, { status: 'failed', error: { a: 1 } })).status, 400);
  assert.equal((await f.auto('POST', '/api/automation/outbox/msg_noexiste', { status: 'sent' })).status, 404);
  const manual = await mkMsg(f, { status: 'prepared' });
  r = await f.auto('POST', '/api/automation/outbox/' + manual.id, { status: 'sent' });
  assert.equal(r.status, 409, 'un mensaje manual no está en la cola');
});

test('recordatorios automáticos: encola los de mañana en modo auto, una sola vez', async () => {
  const f = await setup();
  f.env.MODE = 'server'; // el cron corre en el servidor: enlace sin ?b= (ese solo va en la demo)
  await f.setWa('shop_a', { mode: 'auto' });
  const t = f.tomorrowIn();
  const ok1 = await mkAppt(f, { date: t, start_min: 600 });
  const ok2 = await mkAppt(f, { date: t, start_min: 700, status: 'pending', client_id: null, client_name: 'Paco', client_phone: '3119998877', staff_id: 'st_barberA2' });
  await mkAppt(f, { date: t, start_min: 800, status: 'cancelled' });
  await mkAppt(f, { date: t, start_min: 900, reminder_sent_at: nowIso() });
  const prior = await mkAppt(f, { date: t, start_min: 1000 });
  await mkMsg(f, { appointment_id: prior.id, kind: 'reminder', status: 'failed' });
  await mkAppt(f, { date: t, start_min: 1100, client_id: null, client_phone: '' }); // sin teléfono
  await mkAppt(f, { date: addDays(t, 1), start_min: 600 });
  await mkAppt(f, { date: t, shop_id: 'shop_b', staff_id: 'st_ownerB', client_id: 'cl_walkB', client_phone: '3110000002' }); // B en modo manual

  let r = await f.auto('POST', '/api/automation/reminders/run');
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.queued, 2);
  assert.equal(r.data.shops, 1);
  assert.equal(r.data.skipped, 1);
  const msgs = await f.db.find('messages', { shop_id: 'shop_a', kind: 'reminder', status: 'queued' }, { order: 'created_at asc' });
  assert.deepEqual(msgs.map((m) => m.appointment_id).sort(), [ok1.id, ok2.id].sort());
  const m1 = msgs.find((m) => m.appointment_id === ok1.id);
  assert.equal(m1.to_phone, '3111234567');
  assert.equal(m1.created_by, 'automation');
  assert.ok(m1.body.startsWith('Hola Juan, te recordamos tu cita en Barbería Alfa:'), m1.body);
  // El enlace del recordatorio es de gestión y funciona (la cita no tenía hash: se le asignó uno).
  const token = /\/\?cita=([A-Za-z0-9]+)/.exec(m1.body)[1];
  assert.ok(m1.body.includes('https://app.tubarberia.mx/?cita=' + token));
  assert.ok((await f.db.findOne('appointments', { id: ok1.id })).manage_token_hash);
  const pub = await f.call('GET', '/api/public/appointments/' + token);
  assert.equal(pub.status, 200);
  assert.equal(pub.data.appointment.id, ok1.id);
  assert.ok((await f.db.findOne('appointments', { id: ok1.id })).reminder_sent_at);
  assert.ok(msgs.find((m) => m.appointment_id === ok2.id).body.startsWith('Hola Paco'));
  // Aparecen en el outbox; y una segunda corrida no duplica.
  assert.equal((await f.auto('GET', '/api/automation/outbox')).data.filter((m) => m.kind === 'reminder').length, 2);
  r = await f.auto('POST', '/api/automation/reminders/run');
  assert.equal(r.data.queued, 0);
  assert.equal(await f.db.count('messages', { shop_id: 'shop_a', kind: 'reminder' }), 3);
  // La barbería B (manual) no recibe mensajes en cola…
  assert.equal(await f.db.count('messages', { shop_id: 'shop_b' }), 0);
});

test('recordatorios en modo manual: aviso "reminder_due" una vez por fecha a dueños y barberos', async () => {
  const f = await setup();
  const t = f.tomorrowIn();
  await mkAppt(f, { date: t, start_min: 600, staff_id: 'st_barberA' });
  await mkAppt(f, { date: t, start_min: 700, staff_id: 'st_barberA' });
  await mkAppt(f, { date: t, start_min: 800, staff_id: 'st_ownerA' });
  let r = await f.auto('POST', '/api/automation/reminders/run');
  assert.equal(r.data.queued, 0);
  assert.equal(r.data.notified, 2);
  const owner = await f.call('GET', '/api/notifications', { as: 'ownerA', shop: 'shop_a' });
  assert.equal(owner.data.items[0].type, 'reminder_due');
  assert.equal(owner.data.items[0].body, 'Mañana hay 3 citas sin recordatorio. Envíalos por WhatsApp en un toque.');
  assert.equal(owner.data.items[0].link, '#/mensajes');
  const barber = await f.call('GET', '/api/notifications', { as: 'barberA', shop: 'shop_a' });
  assert.equal(barber.data.items[0].body, 'Mañana tienes 2 citas sin recordatorio. Envíalos por WhatsApp en un toque.');
  r = await f.auto('POST', '/api/automation/reminders/run');
  assert.equal(r.data.notified, 0, 'no repite el aviso');
  assert.equal(await f.db.count('messages', {}), 0);
});

test('recordatorios automáticos: "mañana" en la zona horaria de CADA barbería', async () => {
  const f = await setup();
  const tz = 'Pacific/Kiritimati'; // UTC+14
  await f.setWa('shop_b', { mode: 'auto' }, { timezone: tz });
  const tB = f.tomorrowIn(tz);
  const inB = await mkAppt(f, { shop_id: 'shop_b', staff_id: 'st_ownerB', client_id: 'cl_walkB', client_phone: '3110000002', date: tB });
  const otherDay = addDays(tB, -1);
  const notB = await mkAppt(f, { shop_id: 'shop_b', staff_id: 'st_ownerB', client_id: 'cl_walkB', client_phone: '3110000002', date: otherDay, start_min: 700 });
  const r = await f.auto('POST', '/api/automation/reminders/run');
  assert.equal(r.data.queued, 1);
  assert.equal(r.data.shops, 1);
  const msgs = await f.db.find('messages', { shop_id: 'shop_b' });
  assert.deepEqual(msgs.map((m) => m.appointment_id), [inB.id]);
  assert.ok(msgs[0].body.includes('Barbería Beta'));
  assert.equal((await f.db.findOne('appointments', { id: notB.id })).reminder_sent_at, null);
  // Suspendida: no se procesa.
  await f.db.update('shops', { id: 'shop_b' }, { status: 'suspended' });
  await mkAppt(f, { shop_id: 'shop_b', staff_id: 'st_ownerB', client_id: 'cl_walkB', client_phone: '3110000002', date: tB, start_min: 900 });
  assert.equal((await f.auto('POST', '/api/automation/reminders/run')).data.queued, 0);
});

test('recordatorios automáticos: tope por corrida y continuación en la siguiente', async () => {
  const f = await setup();
  await f.setWa('shop_a', { mode: 'auto' });
  const t = f.tomorrowIn();
  for (let i = 0; i < MAX_REMINDERS_PER_RUN + 3; i++) await mkAppt(f, { date: t, start_min: i % 1400 });
  let r = await f.auto('POST', '/api/automation/reminders/run');
  assert.deepEqual([r.data.queued, r.data.more], [MAX_REMINDERS_PER_RUN, true]);
  r = await f.auto('POST', '/api/automation/reminders/run');
  assert.deepEqual([r.data.queued, r.data.more], [3, false]);
  r = await f.auto('POST', '/api/automation/reminders/run');
  assert.deepEqual([r.data.queued, r.data.more], [0, false]);
});

test('preparar en modo auto → outbox → proveedor reporta enviado → recordatorio marcado', async () => {
  const f = await setup();
  await f.setWa('shop_a', { mode: 'auto' });
  const a = await mkAppt(f, { date: f.tomorrowIn() });
  const p = await f.call('POST', '/api/messages/prepare', { as: 'ownerA', shop: 'shop_a', body: { appointment_id: a.id, kind: 'reminder' } });
  assert.equal(p.data.message.status, 'queued');
  assert.equal((await f.db.findOne('appointments', { id: a.id })).reminder_sent_at, null, 'aún no se envía');
  const box = await f.auto('GET', '/api/automation/outbox');
  assert.equal(box.data[0].id, p.data.message.id);
  assert.equal(box.data[0].body, p.data.body);
  await f.auto('POST', '/api/automation/outbox/' + p.data.message.id, { status: 'sent', provider_id: 'wamid.9' });
  assert.ok((await f.db.findOne('appointments', { id: a.id })).reminder_sent_at);
  const list = await f.call('GET', '/api/messages', { as: 'ownerA', shop: 'shop_a' });
  assert.equal(list.data[0].status, 'sent');
  assert.equal(list.data[0].provider_id, 'wamid.9');
});

// ── Mismo flujo sobre el adaptador D1 real (SQL) usando SQLite de Node (si está disponible) ──
let sqlite = null;
try { sqlite = await import('node:sqlite'); } catch (e) { /* Node < 22.13: se omite */ }

test('D1 (SQLite): mensajes, outbox, recordatorios, notificaciones e importación con SQL real', { skip: !sqlite && 'node:sqlite no disponible' }, async () => {
  const { toSQL, TABLES } = await import('../core/schema.js');
  const { d1Db } = await import('../core/db-d1.js');
  const { handle } = await import('../core/router.js');
  const sq = new sqlite.DatabaseSync(':memory:');
  sq.exec(toSQL());
  const shim = {
    prepare(sql) {
      return { args: [], bind(...a) { this.args = a; return this; },
        async run() { return { meta: { changes: Number(sq.prepare(sql).run(...this.args).changes) } }; },
        async all() { return { results: sq.prepare(sql).all(...this.args) }; } };
    },
    async batch(stmts) { sq.exec('BEGIN'); try { for (const s of stmts) await s.run(); sq.exec('COMMIT'); } catch (e) { sq.exec('ROLLBACK'); throw e; } }
  };
  const f = await setup();
  const db = d1Db(shim);
  const data = f.db.dump();
  for (const t of TABLES) if (data[t].length) await db.insertMany(t, data[t]);
  const env = Object.assign({}, f.env, { MODE: 'server' });
  const call = async (method, path, o) => {
    const [p, qs] = path.split('?');
    const headers = {};
    const tk = o.as ? f.tokens[o.as] : o.token;
    if (tk) headers.authorization = 'Bearer ' + tk;
    if (o.shop) headers['x-shop-id'] = o.shop;
    const r = await handle({ method, path: p, query: Object.fromEntries(new URLSearchParams(qs || '')), body: o.body, headers }, { db, env });
    return { status: r.status, data: JSON.parse(r.body).data, body: r.body };
  };
  const t = f.tomorrowIn();
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const id = newId('ap'); ids.push(id);
    await db.insert('appointments', { id, shop_id: 'shop_a', folio: 'TB-D' + i, client_id: 'cl_juan', staff_id: 'st_barberA', date: t, start_min: 600 + i * 60, end_min: 640 + i * 60, duration_min: 40, services: SVC, total: 200, status: 'confirmed', source: 'manual', client_name: 'Juan Pérez', client_phone: '3111234567', created_at: nowIso() });
  }
  const A = { as: 'ownerA', shop: 'shop_a' };
  const p = await call('POST', '/api/messages/prepare', Object.assign({ body: { appointment_id: ids[0], kind: 'confirmation' } }, A));
  assert.equal(p.status, 200, p.body);
  const token = /cita=([A-Za-z0-9]+)/.exec(p.data.body)[1];
  assert.equal((await call('GET', '/api/public/appointments/' + token, {})).data.appointment.id, ids[0]);
  assert.equal((await call('GET', '/api/messages', { as: 'barberA', shop: 'shop_a' })).data.length, 1);
  assert.equal((await call('PATCH', '/api/messages/' + p.data.message.id, { as: 'barberA', shop: 'shop_a', body: { status: 'sent' } })).data.status, 'sent');
  assert.equal((await call('GET', '/api/reminders', A)).data.items.length, 3);
  await db.insert('notifications', { id: 'nt_d1', shop_id: 'shop_a', staff_id: 'st_ownerA', type: 'system', title: 'x', created_at: nowIso() });
  assert.equal((await call('GET', '/api/notifications?unread=1', A)).data.unread, 1);
  assert.deepEqual((await call('POST', '/api/notifications/read', Object.assign({ body: { ids: ['nt_d1', 'nt_x'] } }, A))).data, { unread: 0, updated: 1 });
  await db.update('shops', { id: 'shop_a' }, { settings: Object.assign({}, data.shops[0].settings, { whatsapp: { mode: 'auto' } }) });
  assert.equal((await call('POST', '/api/automation/reminders/run', { token: KEY })).data.queued, 3);
  const box = (await call('GET', '/api/automation/outbox', { token: KEY })).data;
  assert.equal(box.length, 3);
  assert.equal((await call('POST', '/api/automation/outbox/' + box[0].id, { token: KEY, body: { status: 'sent', provider_id: 'w1' } })).data.status, 'sent');
  // Importación con más de 80 folios (lista IN grande → consulta amplia + filtro).
  const citas = [];
  for (let i = 0; i < 200; i++) citas.push({ id: 'NG-' + String(i).padStart(4, '0'), fecha: '2025-01-' + String(1 + (i % 28)).padStart(2, '0'), inicio: 600, dur: 40, barbero: i % 2 ? 'angel' : 'any', servicios: ['Corte'], total: 200, nombre: 'C' + (i % 40), telefono: '31200' + String(i % 40).padStart(5, '0'), estado: 'atendida' });
  let r = await call('POST', '/api/import/legacy', Object.assign({ body: { citas, staff: [{ id: 'angel', nombre: 'Angel', rol: 'owner' }] } }, A));
  assert.equal(r.status, 200, r.body);
  assert.deepEqual([r.data.imported, r.data.staff_created, r.data.clients_created], [200, 1, 40]);
  r = await call('POST', '/api/import/legacy', Object.assign({ body: { citas } }, A));
  assert.deepEqual([r.data.imported, r.data.skipped], [0, 200]);
});

test('reminders/run: una cita reagendada después de su recordatorio recibe uno nuevo', async () => {
  const { makeFixture } = await import('./helpers.mjs');
  const { addDays, nowInTz, newId, nowIso } = await import('../core/util.js');
  const f = await makeFixture();
  f.env.AUTOMATION_KEY = 'llave-auto-123456';
  await f.db.update('shops', { id: 'shop_a' }, { settings: { hours: { 0: [], 1: [[600, 1200]], 2: [[600, 1200]], 3: [[600, 1200]], 4: [[600, 1200]], 5: [[600, 1200]], 6: [[600, 1200]] }, booking: { lead_min: 0 }, whatsapp: { mode: 'auto' } } });
  const tomorrow = addDays(nowInTz('America/Mexico_City').date, 1);
  const ap = await f.db.insert('appointments', { id: 'ap_rm', shop_id: 'shop_a', folio: 'TB-RM', client_id: 'cl_clientA', staff_id: 'st_barberA', date: tomorrow, start_min: 660, end_min: 700, duration_min: 40, services: [], total: 200, status: 'confirmed', source: 'manual', client_name: 'Cliente A', client_phone: '3110000001', created_at: nowIso() });
  // Recordatorio viejo (antes de la reagenda) y luego un evento de reagenda.
  await f.db.insert('messages', { id: newId('ms'), shop_id: 'shop_a', appointment_id: ap.id, client_id: 'cl_clientA', kind: 'reminder', body: 'x', status: 'sent', channel: 'whatsapp', created_at: '2020-01-01T00:00:00.000Z' });
  await f.db.insert('appointment_events', { id: newId('ev'), shop_id: 'shop_a', appointment_id: ap.id, type: 'rescheduled', data: {}, created_at: '2020-01-02T00:00:00.000Z' });
  const r = await f.call('POST', '/api/automation/reminders/run', { token: 'llave-auto-123456' });
  assert.equal(r.status, 200, r.body);
  const msgs = await f.db.find('messages', { appointment_id: ap.id, kind: 'reminder', status: 'queued' });
  assert.equal(msgs.length, 1, 'se encoló un recordatorio nuevo');
});
