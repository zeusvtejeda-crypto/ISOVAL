import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { addDays, nowInTz, nowIso } from '../core/util.js';

async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  const today = nowInTz('America/Mexico_City').date;
  let past = addDays(today, -2);
  while (new Date(past + 'T12:00:00Z').getUTCDay() === 0) past = addDays(past, -1);
  f.past = past;
  // Citas de la cliente A (vía panel) y de otro cliente.
  const mk = async (body) => {
    const r = await f.call('POST', '/api/appointments', { as: 'ownerA', shop: 'shop_a', body: Object.assign({ staff_id: 'st_barberA', date: f.day, start_min: 600, services: ['sv_corte'], client_id: 'cl_clientA' }, body) });
    if (r.status !== 200) throw new Error(r.body);
    return r.data;
  };
  f.up = await mk({});
  f.up2 = await mk({ date: addDays(f.day, 1), start_min: 700 });
  f.old = await mk({ date: past, status: 'completed' });
  f.cancelled = await mk({ start_min: 900 });
  await f.call('POST', '/api/appointments/' + f.cancelled.id + '/status', { as: 'ownerA', shop: 'shop_a', body: { status: 'cancelled' } });
  f.other = await mk({ start_min: 1000, client_id: undefined, client: { name: 'Otra Persona', phone: '5544443333' } });
  f.setBooking = async (booking) => {
    const s = await f.db.findOne('shops', { id: 'shop_a' });
    await f.db.update('shops', { id: s.id }, { settings: Object.assign({}, s.settings, { booking: Object.assign({}, s.settings.booking, booking) }) });
  };
  return f;
}
const A = { shop: 'shop_a' };
const me = { as: 'clientA', ...A };

test('mis citas: próximas y pasadas solo de mi ficha, con política de cambios', async () => {
  const f = await setup();
  const r = await f.call('GET', '/api/my/appointments', me);
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.data.upcoming.map((a) => a.id), [f.up.id, f.up2.id]);
  assert.deepEqual(r.data.past.map((a) => a.id).sort(), [f.old.id, f.cancelled.id].sort());
  assert.ok(![...r.data.upcoming, ...r.data.past].some((a) => a.id === f.other.id), 'no ve citas de otros');
  const u = r.data.upcoming[0];
  assert.equal(u.can_cancel, true);
  assert.equal(u.can_reschedule, true);
  assert.ok(u.deadline_text);
  assert.equal(u.staff_name, 'Barbero A');
  assert.equal(u.shop.slug, 'alfa');
  assert.equal(u.internal_note, undefined, 'vista pública, sin notas internas');
  assert.equal(u.manage_token_hash, undefined);
});

test('mis citas: permisos — solo rol cliente y solo en su barbería', async () => {
  const f = await setup();
  assert.equal((await f.call('GET', '/api/my/appointments', { as: 'ownerA', ...A })).status, 403);
  assert.equal((await f.call('GET', '/api/my/appointments', { as: 'barberA', ...A })).status, 403);
  assert.equal((await f.call('GET', '/api/my/appointments', { as: 'super', ...A })).status, 403);
  assert.equal((await f.call('GET', '/api/my/appointments', { as: 'clientA', shop: 'shop_b' })).status, 403, 'no es cliente de B');
  assert.equal((await f.call('GET', '/api/my/appointments')).status, 401);
});

test('mis citas: cancelar la mía; la de otro (o adivinada) → 404', async () => {
  const f = await setup();
  let r = await f.call('POST', '/api/my/appointments/' + f.other.id + '/cancel', { ...me, body: {} });
  assert.equal(r.status, 404);
  r = await f.call('POST', '/api/my/appointments/ap_inventada/cancel', { ...me, body: {} });
  assert.equal(r.status, 404);
  r = await f.call('POST', '/api/my/appointments/' + f.up.id + '/cancel', { ...me, body: { reason: 'x'.repeat(301) } });
  assert.equal(r.status, 400);
  r = await f.call('POST', '/api/my/appointments/' + f.up.id + '/cancel', { ...me, body: { reason: 'Trabajo' } });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.appointment.status, 'cancelled');
  assert.equal(r.data.appointment.can_cancel, false);
  const row = await f.db.findOne('appointments', { id: f.up.id });
  assert.equal(row.cancelled_by, 'client');
  assert.equal(row.cancel_reason, 'Trabajo');
  const ev = await f.db.find('appointment_events', { appointment_id: f.up.id, type: 'status' });
  assert.equal(ev[0].actor_name, 'clientA');
  const n = await f.db.find('notifications', { shop_id: 'shop_a', type: 'booking_cancelled' });
  assert.ok(n.some((x) => x.staff_id === 'st_ownerA') && n.some((x) => x.staff_id === 'st_barberA'));
  r = await f.call('POST', '/api/my/appointments/' + f.up.id + '/cancel', { ...me, body: {} });
  assert.equal(r.status, 409, 'ya cancelada');
  r = await f.call('POST', '/api/my/appointments/' + f.old.id + '/cancel', { ...me, body: {} });
  assert.equal(r.status, 409, 'una atendida no se cancela');
});

test('mis citas: reagendar con reglas públicas y política de horas', async () => {
  const f = await setup();
  let r = await f.call('POST', '/api/my/appointments/' + f.up.id + '/reschedule', { ...me, body: { date: f.day, start_min: 1000 } });
  assert.equal(r.status, 409, 'ocupado por otro cliente');
  assert.equal(r.error.code, 'slot_taken');
  assert.equal(r.error.message, 'Ese horario acaba de ocuparse. Elige otro.', 'sin datos del otro cliente');
  r = await f.call('POST', '/api/my/appointments/' + f.up.id + '/reschedule', { ...me, body: { date: f.day, start_min: 1180 } });
  assert.equal(r.status, 409, 'termina después del cierre');
  r = await f.call('POST', '/api/my/appointments/' + f.up.id + '/reschedule', { ...me, body: { date: f.day, start_min: 1420 } });
  assert.equal(r.status, 400, 'cruza medianoche');
  r = await f.call('POST', '/api/my/appointments/' + f.up.id + '/reschedule', { ...me, body: { date: f.day } });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.start_min);
  r = await f.call('POST', '/api/my/appointments/' + f.up.id + '/reschedule', { ...me, body: { date: addDays(f.day, 60), start_min: 600 } });
  assert.equal(r.status, 400, 'fuera de la ventana');
  r = await f.call('POST', '/api/my/appointments/' + f.up.id + '/reschedule', { ...me, body: { date: f.day, start_min: '11:20' } });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.appointment.start_min, 680);
  assert.equal(r.data.appointment.end_min, 720);
  const n = await f.db.find('notifications', { shop_id: 'shop_a', type: 'booking_rescheduled' });
  assert.ok(n.length >= 2);
  r = await f.call('POST', '/api/my/appointments/' + f.other.id + '/reschedule', { ...me, body: { date: f.day, start_min: 620 } });
  assert.equal(r.status, 404);
  await f.setBooking({ cancel_hours: 24 * 60 });
  r = await f.call('POST', '/api/my/appointments/' + f.up2.id + '/reschedule', { ...me, body: { date: f.day, start_min: 800 } });
  assert.equal(r.status, 409);
  assert.match(r.error.message, /Ya no es posible/);
  r = await f.call('POST', '/api/my/appointments/' + f.up2.id + '/cancel', { ...me, body: {} });
  assert.equal(r.status, 409);
  const list = await f.call('GET', '/api/my/appointments', me);
  assert.ok(list.data.upcoming.every((a) => a.can_cancel === false));
});

test('mis citas: una reserva en línea con sesión aparece en el portal', async () => {
  const f = await setup();
  const b = await f.call('POST', '/api/public/shops/alfa/appointments', { as: 'clientA', body: { services: ['sv_barba'], staff_id: 'any', date: f.day, start_min: 1100, name: 'Cliente A', phone: '3110000001' } });
  assert.equal(b.status, 200, b.body);
  const r = await f.call('GET', '/api/my/appointments', me);
  assert.ok(r.data.upcoming.some((a) => a.id === b.data.appointment.id));
});

test('mi perfil: actualizar nombre, teléfono, marketing y cumpleaños con validación', async () => {
  const f = await setup();
  let r = await f.call('PATCH', '/api/my/profile', { ...me, body: { name: '  Ana   María  ', phone: '(55) 1234-0000', marketing_ok: false, birthday: '1990-05-01' } });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.data.client, { id: 'cl_clientA', name: 'Ana María', phone: '5512340000', email: '', birthday: '1990-05-01', marketing_ok: false, created_at: r.data.client.created_at });
  const row = await f.db.findOne('clients', { id: 'cl_clientA' });
  assert.equal(row.name, 'Ana María');
  assert.equal(row.marketing_ok, false);
  for (const [body, field] of [[{ name: 'A' }, 'name'], [{ phone: '123' }, 'phone'], [{ marketing_ok: 'si' }, 'marketing_ok'], [{ birthday: '2999-01-01' }, 'birthday'], [{ birthday: 'ayer' }, 'birthday']]) {
    r = await f.call('PATCH', '/api/my/profile', { ...me, body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.ok(r.error.fields[field]);
  }
  r = await f.call('PATCH', '/api/my/profile', { ...me, body: { phone: '5544443333' } });
  assert.equal(r.status, 409, 'teléfono de otro cliente');
  assert.equal(r.error.code, 'duplicate');
  // El teléfono de un cliente de OTRA barbería no cuenta como duplicado.
  r = await f.call('PATCH', '/api/my/profile', { ...me, body: { phone: '3110000002' } });
  assert.equal(r.status, 200);
  r = await f.call('PATCH', '/api/my/profile', { ...me, body: { shop_id: 'shop_b', user_id: 'u_ownerA', notes: 'hack', tags: ['VIP'] } });
  assert.equal(r.status, 200);
  const after = await f.db.findOne('clients', { id: 'cl_clientA' });
  assert.equal(after.shop_id, 'shop_a');
  assert.equal(after.user_id, 'u_clientA');
  assert.equal(after.notes, null);
  assert.deepEqual(after.tags, []);
  assert.equal((await f.call('PATCH', '/api/my/profile', { as: 'ownerA', ...A, body: { name: 'X Y' } })).status, 403);
});

test('mis citas: ficha borrada → sin acceso al portal', async () => {
  const f = await setup();
  await f.db.update('clients', { id: 'cl_clientA' }, { deleted_at: nowIso() });
  const r = await f.call('GET', '/api/my/appointments', me);
  assert.ok(r.status === 403 || r.status === 404, String(r.status));
});
