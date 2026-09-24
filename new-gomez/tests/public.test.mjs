import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { sha256Hex } from '../core/crypto.js';
import { addDays, nowInTz, nowIso } from '../core/util.js';
import { fmtDateEs } from '../core/domain/appointments.js';

async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  f.today = nowInTz('America/Mexico_City').date;
  f.book = (body, opts) => f.call('POST', '/api/public/shops/alfa/appointments', Object.assign({ body: Object.assign({ services: ['sv_corte'], staff_id: 'st_barberA', date: f.day, start_min: 600, name: 'Laura Gómez', phone: '5598765432' }, body || {}) }, opts || {}));
  f.setBooking = async (booking, shopId) => {
    const s = await f.db.findOne('shops', { id: shopId || 'shop_a' });
    await f.db.update('shops', { id: s.id }, { settings: Object.assign({}, s.settings, { booking: Object.assign({}, s.settings.booking, booking) }) });
  };
  return f;
}

test('public home: dominio propio, barbería predeterminada y respaldo', async () => {
  const f = await setup();
  await f.db.update('shops', { id: 'shop_b' }, { domain: 'beta.tubarberia.mx' });
  let r = await f.call('GET', '/api/public/home?host=beta.tubarberia.mx');
  assert.equal(r.status, 200);
  assert.equal(r.data.shop.slug, 'beta');
  r = await f.call('GET', '/api/public/home', { token: undefined }); // cabecera host ausente → predeterminada
  assert.equal(r.data.shop.slug, 'alfa');
  r = await f.call('GET', '/api/public/home?host=www.beta.tubarberia.mx:443');
  assert.equal(r.data.shop.slug, 'beta', 'www y puerto se ignoran');
  f.env.DEFAULT_SHOP_SLUG = 'no-existe';
  r = await f.call('GET', '/api/public/home?host=localhost');
  assert.equal(r.status, 200);
  assert.equal(r.data.shop.slug, 'alfa', 'primera activa');
  await f.db.update('shops', {}, { status: 'suspended' });
  r = await f.call('GET', '/api/public/home');
  assert.equal(r.status, 404);
});

test('public shop: forma del contrato, solo servicios activos y barberos reservables', async () => {
  const f = await setup();
  await f.db.insert('services', { id: 'sv_off', shop_id: 'shop_a', name: 'Retirado', duration_min: 30, price: 1, active: false, created_at: nowIso() });
  await f.db.update('staff', { id: 'st_barberA2' }, { bookable: false });
  const r = await f.call('GET', '/api/public/shops/alfa');
  assert.equal(r.status, 200);
  const { shop, services, staff } = r.data;
  for (const k of ['id', 'slug', 'name', 'timezone', 'currency', 'hours', 'booking', 'public', 'payment_methods']) assert.ok(k in shop, k);
  assert.equal(shop.settings, undefined, 'no expone settings crudos');
  assert.deepEqual(services.map((s) => s.id).sort(), ['sv_barba', 'sv_corte']);
  assert.deepEqual(Object.keys(services[0]).sort(), ['category', 'description', 'duration_min', 'id', 'name', 'popular', 'price', 'staff_ids']);
  assert.deepEqual(staff.map((s) => s.id).sort(), ['st_barberA', 'st_ownerA']);
  assert.deepEqual(Object.keys(staff[0]).sort(), ['avatar_url', 'bio', 'color', 'id', 'name']);
  assert.equal((await f.call('GET', '/api/public/shops/no-existe')).status, 404);
  await f.db.update('shops', { id: 'shop_b' }, { status: 'suspended' });
  const s = await f.call('GET', '/api/public/shops/beta');
  assert.equal(s.status, 404);
  assert.equal(s.error.message, 'Esta barbería no está disponible.');
});

test('public days/slots: rango, cierre en domingo, duración y barbero', async () => {
  const f = await setup();
  let r = await f.call('GET', '/api/public/shops/alfa/days?services=sv_corte&staff=any&days=100');
  assert.equal(r.status, 200);
  assert.equal(r.data.days.length, 60, 'máximo 60 días');
  assert.equal(r.data.days[0].date, f.today);
  const sunday = r.data.days.find((d) => new Date(d.date + 'T12:00:00Z').getUTCDay() === 0);
  assert.deepEqual([sunday.open, sunday.available], [false, false]);
  const beyond = r.data.days.find((d) => d.date === addDays(f.today, 30));
  assert.equal(beyond.available, false, 'fuera de window_days (21)');
  assert.equal(beyond.open, false, 'no se ve como "lleno"');
  assert.equal(beyond.reason, 'out_of_window');
  r = await f.call('GET', '/api/public/shops/alfa/days?from=2020-01-01');
  assert.equal(r.status, 200, 'sin servicios: vista previa');
  assert.equal(r.data.days[0].date, f.today, 'no muestra días pasados');
  assert.equal(r.data.days.length, 14);
  r = await f.call('GET', '/api/public/shops/alfa/slots?date=' + f.day + '&services=sv_corte,sv_barba&staff=any');
  assert.equal(r.status, 200);
  assert.equal(r.data.duration_min, 60);
  assert.equal(r.data.closed, false);
  assert.equal(r.data.slots[0].start_min, 600);
  assert.deepEqual(r.data.slots[0].staff_ids, ['st_barberA', 'st_barberA2', 'st_ownerA'], 'orden sort → nombre');
  assert.equal(r.data.slots[r.data.slots.length - 1].start_min, 1140);
  r = await f.call('GET', '/api/public/shops/alfa/slots?date=' + f.day + '&services=sv_corte&staff=st_barberA2');
  assert.ok(r.data.slots.every((s) => s.staff_ids.join() === 'st_barberA2'));
  for (const q of ['date=x&services=sv_corte', 'date=' + f.day, 'date=' + f.day + '&services=sv_corteB', 'date=' + f.day + '&services=sv_corte&staff=st_ownerB']) {
    r = await f.call('GET', '/api/public/shops/alfa/slots?' + q);
    assert.equal(r.status, 400, q);
  }
  // Servicio restringido a un barbero.
  await f.db.update('services', { id: 'sv_barba' }, { staff_ids: ['st_barberA2'] });
  r = await f.call('GET', '/api/public/shops/alfa/slots?date=' + f.day + '&services=sv_barba&staff=any');
  assert.ok(r.data.slots.every((s) => s.staff_ids.join() === 'st_barberA2'));
  r = await f.call('GET', '/api/public/shops/alfa/slots?date=' + f.day + '&services=sv_barba&staff=st_barberA');
  assert.equal(r.status, 400);
  // Opción "cualquiera" desactivada.
  await f.setBooking({ allow_any_staff: false });
  r = await f.call('GET', '/api/public/shops/alfa/slots?date=' + f.day + '&services=sv_corte&staff=any');
  assert.equal(r.status, 400);
});

test('public reservar: crea cita, ficha, token de gestión, eventos y notificaciones', async () => {
  const f = await setup();
  const r = await f.book({ services: ['sv_corte', 'sv_barba'], email: 'Laura@Mail.com', note: 'Llego en bici', total: 1 });
  assert.equal(r.status, 200, r.body);
  const { appointment: a, manage_token } = r.data;
  assert.deepEqual(Object.keys(a).sort(), ['client_name', 'client_note', 'date', 'duration_min', 'end_min', 'folio', 'id', 'services', 'shop', 'staff_id', 'staff_name', 'start_min', 'status', 'total'].sort());
  assert.equal(a.total, 320);
  assert.equal(a.duration_min, 60);
  assert.equal(a.end_min, 660);
  assert.equal(a.status, 'confirmed');
  assert.equal(a.staff_name, 'Barbero A');
  assert.equal(a.client_note, 'Llego en bici');
  assert.deepEqual(a.shop.slug, 'alfa');
  assert.match(manage_token, /^[A-Za-z0-9]{40}$/);
  const row = await f.db.findOne('appointments', { id: a.id });
  assert.equal(row.manage_token_hash, await sha256Hex(manage_token));
  assert.equal(row.source, 'online');
  assert.equal(row.created_by, 'online');
  assert.equal(row.first_visit, true);
  assert.ok(row.confirmed_at);
  const cl = await f.db.findOne('clients', { id: row.client_id });
  assert.equal(cl.shop_id, 'shop_a');
  assert.equal(cl.phone, '5598765432');
  assert.equal(cl.email, 'laura@mail.com');
  assert.equal(cl.source, 'online');
  assert.equal(cl.user_id, null, 'sin sesión no se vincula');
  const nts = await f.db.find('notifications', { shop_id: 'shop_a', type: 'booking_new' });
  assert.deepEqual(nts.map((n) => n.staff_id).sort(), ['st_barberA', 'st_ownerA']);
  assert.equal(nts[0].link, '#/agenda?cita=' + a.id);
  assert.match(nts[0].body, /Laura Gómez/);
  const ev = await f.db.find('appointment_events', { appointment_id: a.id });
  assert.equal(ev[0].type, 'created');
  assert.equal(ev[0].actor_name, 'Cliente (en línea)');
  // Segunda reserva del mismo teléfono reutiliza la ficha.
  const r2 = await f.book({ start_min: 800 });
  assert.equal(r2.status, 200);
  assert.equal((await f.db.findOne('appointments', { id: r2.data.appointment.id })).client_id, row.client_id);
});

test('public reservar: pendiente si auto_confirm=false; any reparte; validaciones', async () => {
  const f = await setup();
  await f.setBooking({ auto_confirm: false });
  let r = await f.book({ staff_id: 'any' });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.appointment.status, 'pending');
  const first = r.data.appointment.staff_id;
  r = await f.book({ staff_id: 'any', phone: '5500000001' });
  assert.notEqual(r.data.appointment.staff_id, first, 'otro barbero libre con menos carga');
  const cases = [
    [{ name: 'L' }, 'name'], [{ phone: '12345' }, 'phone'], [{ phone: '' }, 'phone'], [{ email: 'no-es-correo' }, 'email'],
    [{ note: 'x'.repeat(501) }, 'note'], [{ date: '24/10/2026' }, 'date'], [{ start_min: 1500 }, 'start_min'], [{ services: [] }, 'services'],
    [{ services: ['sv_corteB'] }, 'services'], [{ staff_id: 'st_ownerB' }, 'staff_id']
  ];
  for (const [body, field] of cases) {
    r = await f.book(body);
    assert.equal(r.status, 400, JSON.stringify(body) + ' ' + r.body);
    assert.ok(r.error.fields && r.error.fields[field], field + ': ' + r.body);
  }
  await f.db.update('services', { id: 'sv_barba' }, { active: false });
  r = await f.book({ services: ['sv_barba'] });
  assert.equal(r.status, 400, 'servicio inactivo');
  await f.db.update('staff', { id: 'st_barberA2' }, { bookable: false });
  r = await f.book({ staff_id: 'st_barberA2', start_min: 900 });
  assert.equal(r.status, 400, 'barbero no reservable en línea');
  await f.setBooking({ require_phone: false });
  r = await f.book({ phone: '', start_min: 1000 });
  assert.equal(r.status, 200, 'teléfono opcional');
  await f.setBooking({ online_enabled: false });
  r = await f.book({ start_min: 1100 });
  assert.equal(r.status, 400);
  assert.match(r.error.message, /no recibe reservas en línea/);
});

test('public reservar: horario ocupado → 409 slot_taken; duplicado → 409 duplicate; fuera de reglas', async () => {
  const f = await setup();
  assert.equal((await f.book()).status, 200);
  let r = await f.book();
  assert.equal(r.status, 409);
  assert.equal(r.error.code, 'duplicate', 'mismo teléfono, fecha y hora');
  r = await f.book({ phone: '5511111111', start_min: 620 });
  assert.equal(r.status, 409);
  assert.equal(r.error.code, 'slot_taken');
  assert.equal(r.error.message, 'Ese horario acaba de ocuparse. Elige otro.');
  r = await f.book({ phone: '5511111111', start_min: 610 });
  assert.equal(r.status, 409, 'fuera de la rejilla');
  r = await f.book({ phone: '5511111111', start_min: 1180 });
  assert.equal(r.status, 409, 'termina después del cierre');
  r = await f.book({ phone: '5511111111', date: addDays(f.today, -1) });
  assert.equal(r.status, 400, 'fecha pasada');
  r = await f.book({ phone: '5511111111', date: addDays(f.today, 40) });
  assert.equal(r.status, 400, 'fuera de la ventana');
  // Descanso del barbero
  await f.db.insert('time_off', { id: 'to1', shop_id: 'shop_a', staff_id: 'st_barberA', date_from: f.day, date_to: f.day, start_min: 900, end_min: 960, created_at: nowIso() });
  r = await f.book({ phone: '5511111111', start_min: 920 });
  assert.equal(r.status, 409);
  // Cita cancelada libera el horario
  const row = await f.db.findOne('appointments', { shop_id: 'shop_a', start_min: 600 });
  await f.db.update('appointments', { id: row.id }, { status: 'cancelled' });
  r = await f.book({ phone: '5511111111', start_min: 600 });
  assert.equal(r.status, 200);
  // Lead time: con 2 días de anticipación mínima no se puede reservar para mañana a primera hora.
  await f.setBooking({ lead_min: 2 * 1440 + 1440 });
  r = await f.book({ phone: '5522222222', date: f.day, start_min: 1000 });
  assert.equal(r.status, 409);
});

test('public reservar: con sesión vincula la ficha a la cuenta (no la del equipo)', async () => {
  const f = await setup();
  let r = await f.book({ name: 'Cliente A', phone: '5577777777' }, { as: 'clientA' });
  assert.equal(r.status, 200, r.body);
  let row = await f.db.findOne('appointments', { id: r.data.appointment.id });
  assert.equal(row.client_id, 'cl_clientA', 'ficha de su cuenta');
  // Usuario sin ficha en esta barbería (dueño de B) → se crea ficha vinculada.
  r = await f.book({ name: 'Dueño B', phone: '5566666666', start_min: 700 }, { as: 'ownerB' });
  assert.equal(r.status, 200);
  row = await f.db.findOne('appointments', { id: r.data.appointment.id });
  const cl = await f.db.findOne('clients', { id: row.client_id });
  assert.equal(cl.user_id, 'u_ownerB');
  assert.equal(cl.shop_id, 'shop_a');
  // Personal de la barbería reservando por alguien más: no se vincula a su cuenta.
  r = await f.book({ name: 'Cliente de mostrador', phone: '5555555555', start_min: 800 }, { as: 'ownerA' });
  row = await f.db.findOne('appointments', { id: r.data.appointment.id });
  assert.equal((await f.db.findOne('clients', { id: row.client_id })).user_id, null);
});

test('public reservar: límite de 15 reservas por hora por IP', async () => {
  const f = await setup();
  f.env.MODE = 'server';
  for (let i = 0; i < 15; i++) {
    const r = await f.book({ staff_id: 'st_barberA', start_min: 600 + i * 40, services: ['sv_corte'], phone: '55000000' + String(i).padStart(2, '0') }, { ip: '9.9.9.9' });
    assert.equal(r.status, 200, 'reserva ' + i + ': ' + r.body);
  }
  let r = await f.book({ staff_id: 'st_barberA2', start_min: 600, phone: '5599999999' }, { ip: '9.9.9.9' });
  assert.equal(r.status, 429);
  assert.equal(r.error.code, 'too_many_requests');
  r = await f.book({ staff_id: 'st_barberA2', start_min: 600, phone: '5599999999' }, { ip: '8.8.8.8' });
  assert.equal(r.status, 200, 'otra IP sí');
});

test('public reservar: en modo servidor el aviso por correo no rompe la reserva', async () => {
  const f = await setup();
  f.env.MODE = 'server';
  const r = await f.book();
  assert.equal(r.status, 200, r.body);
});

test('enlace de gestión: ver, reagendar, cancelar y notificaciones', async () => {
  const f = await setup();
  const b = await f.book();
  const tk = b.data.manage_token;
  let r = await f.call('GET', '/api/public/appointments/' + tk);
  assert.equal(r.status, 200);
  assert.equal(r.data.appointment.id, b.data.appointment.id);
  assert.equal(r.data.can_cancel, true);
  assert.equal(r.data.can_reschedule, true);
  assert.match(r.data.deadline_text, /Puedes cancelar o reagendar hasta el/);
  assert.equal((await f.call('GET', '/api/public/appointments/xyz')).status, 404);
  assert.equal((await f.call('GET', '/api/public/appointments/' + 'A'.repeat(40))).status, 404);

  // Otra cita ocupa las 12:00 → reagendar ahí choca.
  await f.book({ phone: '5511111111', start_min: 720 });
  r = await f.call('POST', '/api/public/appointments/' + tk + '/reschedule', { body: { date: f.day, start_min: 720 } });
  assert.equal(r.status, 409);
  assert.equal(r.error.code, 'slot_taken');
  r = await f.call('POST', '/api/public/appointments/' + tk + '/reschedule', { body: { date: 'x' } });
  assert.equal(r.status, 400);
  r = await f.call('POST', '/api/public/appointments/' + tk + '/reschedule', { body: { date: f.day, start_min: 800, staff_id: 'st_barberA2' } });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.appointment.start_min, 800);
  assert.equal(r.data.appointment.staff_id, 'st_barberA2');
  const row = await f.db.findOne('appointments', { id: b.data.appointment.id });
  assert.equal(row.reschedule_count, 1);
  const rn = await f.db.find('notifications', { shop_id: 'shop_a', type: 'booking_rescheduled' });
  assert.deepEqual(rn.map((n) => n.staff_id).sort(), ['st_barberA', 'st_barberA2', 'st_ownerA'], 'dueño + barbero nuevo + anterior');
  // El aviso dice qué horario se liberó (mismo día → solo la hora; cambió de barbero → con quién era).
  assert.ok(rn.every((n) => n.body.endsWith(', 13:20 con Barbero A2 · Antes: 10:00 con Barbero A')), rn[0].body);
  // El horario anterior quedó libre.
  r = await f.book({ phone: '5522222222', start_min: 600 });
  assert.equal(r.status, 200);

  r = await f.call('POST', '/api/public/appointments/' + tk + '/cancel', { body: { reason: 'Me salió un viaje' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.appointment.status, 'cancelled');
  assert.equal(r.data.can_cancel, false);
  const c = await f.db.findOne('appointments', { id: b.data.appointment.id });
  assert.equal(c.cancelled_by, 'client');
  assert.equal(c.cancel_reason, 'Me salió un viaje');
  const cn = await f.db.find('notifications', { shop_id: 'shop_a', type: 'booking_cancelled' });
  assert.deepEqual(cn.map((n) => n.staff_id).sort(), ['st_barberA2', 'st_ownerA']);
  assert.match(cn[0].body, /Me salió un viaje/);
  r = await f.call('POST', '/api/public/appointments/' + tk + '/cancel', { body: {} });
  assert.equal(r.status, 409, 'ya estaba cancelada');
  r = await f.call('POST', '/api/public/appointments/' + tk + '/reschedule', { body: { date: f.day, start_min: 900 } });
  assert.equal(r.status, 409);
  const ev = await f.db.find('appointment_events', { appointment_id: b.data.appointment.id });
  assert.deepEqual(ev.map((e) => e.type), ['created', 'rescheduled', 'status']);
  assert.equal(ev[2].actor_name, 'Laura Gómez');
});

test('reagendar a otro día: el aviso al equipo incluye el día y la hora anteriores', async () => {
  const f = await setup();
  const b = await f.book({ start_min: 660 });
  let to = addDays(f.day, 2);
  while (new Date(to + 'T12:00:00Z').getUTCDay() === 0) to = addDays(to, 1);
  const r = await f.call('POST', '/api/public/appointments/' + b.data.manage_token + '/reschedule', { body: { date: to, start_min: 680 } });
  assert.equal(r.status, 200, r.body);
  const [n] = await f.db.find('notifications', { shop_id: 'shop_a', type: 'booking_rescheduled', staff_id: 'st_ownerA' });
  const d = new Date(f.day + 'T12:00:00Z'), t = new Date(to + 'T12:00:00Z');
  const day = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getUTCDay()] + ' ' + d.getUTCDate();
  const antes = d.getUTCMonth() === t.getUTCMonth() ? day : fmtDateEs(f.day);
  assert.equal(n.title, 'Cita reagendada por el cliente');
  assert.equal(n.body, 'Laura Gómez · Corte · ' + fmtDateEs(to) + ', 11:20 con Barbero A · Antes: ' + antes + ', 11:00');
});

test('reagendar: /slots y /days no cuentan la propia cita si se prueba que es suya (token del enlace o sesión)', async () => {
  const f = await setup();
  const b = await f.book({ start_min: 700 }, { as: 'clientA' }); // 11:40–12:20, ficha de Cliente A
  const tk = b.data.manage_token;
  const id = b.data.appointment.id;
  await f.book({ phone: '5511111111', start_min: 740 }); // otra cita 12:20–13:00
  const q = '/api/public/shops/alfa/slots?date=' + f.day + '&services=sv_corte&staff=st_barberA';
  const starts = async (extra, opts) => {
    const r = await f.call('GET', q + extra, opts);
    assert.equal(r.status, 200, r.body);
    return r.data.slots.map((s) => s.start_min);
  };
  const plain = await starts('');
  assert.ok(!plain.includes(680) && !plain.includes(700), 'sin prueba, la propia cita ocupa');
  const moved = await starts('&token=' + tk);
  assert.ok(moved.includes(680) && moved.includes(700), 'se puede correr 20 minutos (o dejarla igual)');
  assert.ok(!moved.includes(720), 'la otra cita sigue ocupando');
  assert.deepEqual(await starts('&exclude=' + id, { as: 'clientA' }), moved, 'sesión del cliente dueño');
  // Sin prueba válida se ignora: token inválido, id sin sesión, sesión de otra persona, id de otra barbería.
  assert.deepEqual(await starts('&token=' + 'A'.repeat(40)), plain);
  assert.deepEqual(await starts('&token=nada'), plain);
  assert.deepEqual(await starts('&exclude=' + id), plain);
  assert.deepEqual(await starts('&exclude=' + id, { as: 'ownerB' }), plain);
  // Y la reagenda acepta ese horario.
  const r = await f.call('POST', '/api/public/appointments/' + tk + '/reschedule', { body: { date: f.day, start_min: 680 } });
  assert.equal(r.status, 200, r.body);

  // /days: un día cuyo único hueco es el de la propia cita sale disponible solo con la prueba.
  await f.db.insert('time_off', { id: 'to_x', shop_id: 'shop_a', staff_id: 'st_barberA', date_from: f.day, date_to: f.day, start_min: 720, end_min: 1200, reason: 'Curso' });
  await f.db.insert('time_off', { id: 'to_y', shop_id: 'shop_a', staff_id: 'st_barberA', date_from: f.day, date_to: f.day, start_min: 600, end_min: 680, reason: 'Trámite' });
  const day = async (extra, opts) => (await f.call('GET', '/api/public/shops/alfa/days?from=' + f.day + '&days=1&services=sv_corte&staff=st_barberA' + extra, opts)).data.days[0];
  assert.equal((await day('')).available, false);
  assert.equal((await day('&token=' + tk)).available, true);
  assert.equal((await day('&exclude=' + id, { as: 'clientA' })).available, true);
});

test('enlace de gestión: política cancel_hours y barbería suspendida', async () => {
  const f = await setup();
  const b = await f.book();
  await f.setBooking({ cancel_hours: 24 * 30 });
  let r = await f.call('GET', '/api/public/appointments/' + b.data.manage_token);
  assert.equal(r.data.can_cancel, false);
  assert.equal(r.data.can_reschedule, false);
  assert.match(r.data.deadline_text, /720 horas de anticipación/);
  r = await f.call('POST', '/api/public/appointments/' + b.data.manage_token + '/cancel', { body: {} });
  assert.equal(r.status, 409);
  assert.match(r.error.message, /Ya no es posible cancelar/);
  r = await f.call('POST', '/api/public/appointments/' + b.data.manage_token + '/reschedule', { body: { date: f.day, start_min: 800 } });
  assert.equal(r.status, 409);
  const row = await f.db.findOne('appointments', { id: b.data.appointment.id });
  assert.equal(row.status, 'confirmed', 'no cambió');
  await f.db.update('shops', { id: 'shop_a' }, { status: 'suspended' });
  r = await f.call('GET', '/api/public/appointments/' + b.data.manage_token);
  assert.equal(r.status, 404);
});

test('aislamiento público: la reserva en beta no ve ni usa datos de alfa', async () => {
  const f = await setup();
  await f.book();
  let r = await f.call('GET', '/api/public/shops/beta/slots?date=' + f.day + '&services=sv_corte&staff=st_barberA');
  assert.equal(r.status, 400, 'servicio de alfa en beta');
  r = await f.call('GET', '/api/public/shops/beta/slots?date=' + f.day + '&services=sv_corteB&staff=any');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.slots[0].staff_ids, ['st_ownerB']);
  assert.equal(r.data.slots[0].start_min, 600, 'la cita de alfa no ocupa a beta');
  r = await f.call('POST', '/api/public/shops/beta/appointments', { body: { services: ['sv_corteB'], staff_id: 'st_barberA', date: f.day, start_min: 600, name: 'X Y', phone: '5512121212' } });
  assert.equal(r.status, 400);
  r = await f.call('POST', '/api/public/shops/beta/appointments', { body: { services: ['sv_corteB'], staff_id: 'any', date: f.day, start_min: 600, name: 'Laura Gómez', phone: '5598765432', shop_id: 'shop_a' } });
  assert.equal(r.status, 200);
  const row = await f.db.findOne('appointments', { id: r.data.appointment.id });
  assert.equal(row.shop_id, 'shop_b');
  const cl = await f.db.findOne('clients', { id: row.client_id });
  assert.equal(cl.shop_id, 'shop_b', 'ficha propia en beta aunque el teléfono exista en alfa');
});

// ── Regresiones de la revisión ──
test('public reservar: en la demo no aplica el límite por IP (todas comparten la IP "demo")', async () => {
  const f = await setup();
  assert.equal(f.env.MODE, 'demo');
  for (let i = 0; i < 17; i++) {
    const r = await f.book({ staff_id: i < 13 ? 'st_barberA' : 'st_barberA2', start_min: 600 + (i % 13) * 40, phone: '55000001' + String(i).padStart(2, '0') }, { ip: 'demo' });
    assert.equal(r.status, 200, 'reserva ' + i + ': ' + r.body);
  }
  assert.equal(await f.db.count('login_attempts', {}), 0, 'no se registran intentos');
});

test('public: cerrar un día (o acortar) el horario de la barbería cierra la reserva en línea aunque el barbero tenga el suyo', async () => {
  const f = await setup();
  const wd = new Date(f.day + 'T12:00:00Z').getUTCDay();
  const s = await f.db.findOne('shops', { id: 'shop_a' });
  const setHours = (h) => f.db.update('shops', { id: 'shop_a' }, { settings: Object.assign({}, s.settings, { hours: Object.assign({}, s.settings.hours, { [wd]: h }) }) });
  await setHours([]);
  let r = await f.call('GET', '/api/public/shops/alfa/slots?date=' + f.day + '&services=sv_corte&staff=any');
  assert.equal(r.status, 200);
  assert.equal(r.data.closed, true, r.body);
  assert.equal(r.data.slots.length, 0);
  r = await f.call('GET', '/api/public/shops/alfa/days?services=sv_corte&staff=any&from=' + f.day + '&days=1');
  assert.deepEqual([r.data.days[0].open, r.data.days[0].available], [false, false]);
  r = await f.book({ start_min: 600 });
  assert.ok(r.status === 400 || r.status === 409, r.body);
  assert.equal(await f.db.count('appointments', { shop_id: 'shop_a' }), 0);
  // El panel sí puede agendar (horario del barbero).
  r = await f.call('POST', '/api/appointments', { as: 'ownerA', shop: 'shop_a', body: { staff_id: 'st_barberA', date: f.day, start_min: 600, services: ['sv_corte'], client: { name: 'Especial' } } });
  assert.equal(r.status, 200, r.body);
  // Horario más corto (12:00–18:00): solo esas horas en línea.
  await setHours([[720, 1080]]);
  r = await f.call('GET', '/api/public/shops/alfa/slots?date=' + f.day + '&services=sv_corte&staff=st_barberA2');
  assert.equal(r.data.slots[0].start_min, 720);
  assert.equal(r.data.slots[r.data.slots.length - 1].start_min, 1040);
  r = await f.book({ staff_id: 'st_barberA2', start_min: 680 });
  assert.equal(r.status, 409, 'antes de que abra la barbería');
  r = await f.book({ staff_id: 'st_barberA2', start_min: 720 });
  assert.equal(r.status, 200, r.body);
});

test('enlace de gestión: cancelar y reagendar devuelven también la política (can_cancel, can_reschedule, deadline_text)', async () => {
  const f = await setup();
  const b = await f.book();
  assert.equal(b.status, 200, b.body);
  let r = await f.call('POST', '/api/public/appointments/' + b.data.manage_token + '/reschedule', { body: { date: f.day, start_min: 700 } });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(Object.keys(r.data).sort(), ['appointment', 'can_cancel', 'can_reschedule', 'deadline_text']);
  assert.equal(r.data.appointment.start_min, 700);
  r = await f.call('POST', '/api/public/appointments/' + b.data.manage_token + '/cancel', { body: {} });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(Object.keys(r.data).sort(), ['appointment', 'can_cancel', 'can_reschedule', 'deadline_text']);
  assert.equal(r.data.can_cancel, false);
});
