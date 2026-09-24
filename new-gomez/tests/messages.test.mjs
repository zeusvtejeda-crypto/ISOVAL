import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { newId, nowIso, nowInTz, addDays } from '../core/util.js';
import { fmtDateEs } from '../core/domain/appointments.js';
import { renderTemplate, buildVars, waLink, fmtMoney, publicBase, firstName, usesVar } from '../core/domain/messages.js';

const CORTE = { id: 'sv_corte', name: 'Corte', price: 200, duration_min: 40 };
const BARBA = { id: 'sv_barba', name: 'Barba', price: 120, duration_min: 20 };
let seq = 0;

async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  await f.db.insert('clients', { id: 'cl_juan', shop_id: 'shop_a', name: 'juan Pérez López', phone: '3111234567', tags: [], source: 'manual', created_at: nowIso() });
  await f.db.insert('clients', { id: 'cl_nophone', shop_id: 'shop_a', name: 'Sin Teléfono', phone: null, tags: [], source: 'manual', created_at: nowIso() });
  await f.db.update('shops', { id: 'shop_a' }, { address: 'Av. México 123, Tepic' });
  f.tomorrow = addDays(nowInTz('America/Mexico_City').date, 1);
  f.A = (as, extra) => Object.assign({ as, shop: 'shop_a' }, extra || {});
  f.setWa = async (wa, shopId) => {
    const s = await f.db.findOne('shops', { id: shopId || 'shop_a' });
    await f.db.update('shops', { id: s.id }, { settings: Object.assign({}, s.settings, { whatsapp: Object.assign({}, (s.settings || {}).whatsapp, wa) }) });
  };
  return f;
}
async function mkAppt(f, o) {
  o = o || {};
  const services = o.services || [CORTE, BARBA];
  const dur = services.reduce((m, s) => m + s.duration_min, 0);
  const start = o.start_min == null ? 630 : o.start_min;
  return f.db.insert('appointments', {
    id: o.id || newId('ap'), shop_id: o.shop_id || 'shop_a', folio: o.folio || 'TB-T' + (++seq), client_id: o.client_id === undefined ? 'cl_juan' : o.client_id,
    staff_id: o.staff_id || 'st_barberA', date: o.date || f.day, start_min: start, end_min: start + dur, duration_min: dur, services,
    total: o.total == null ? services.reduce((m, s) => m + s.price, 0) : o.total, status: o.status || 'confirmed', source: 'manual',
    client_name: o.client_name == null ? 'juan Pérez López' : o.client_name, client_phone: o.client_phone == null ? '3111234567' : o.client_phone,
    reschedule_count: 0, reminder_sent_at: o.reminder_sent_at || null, manage_token_hash: o.manage_token_hash || null, created_at: nowIso()
  });
}
const tokenIn = (text) => { const m = /[?&]cita=([A-Za-z0-9]+)/.exec(text); return m ? m[1] : null; };

test('plantillas: variables en español, alias con acentos y líneas vacías', () => {
  assert.equal(renderTemplate('Hola {cliente}, {Barbería} · {reseña} · {desconocida}', { cliente: 'Ana', barberia: 'Alfa', resena: 'r' }), 'Hola Ana, Alfa · r · {desconocida}');
  assert.equal(renderTemplate('Hola\n📍 {direccion}\nAdiós', { direccion: '' }), 'Hola\nAdiós', 'quita la línea sin dirección');
  assert.equal(renderTemplate('Hola {cliente}, te esperamos', { cliente: '' }), 'Hola, te esperamos');
  assert.equal(renderTemplate('{cliente}{cliente}', { cliente: '{cliente}' }), '{cliente}{cliente}', 'los valores no se vuelven a procesar');
  assert.ok(usesVar('Gestiona: {Enlace}', 'enlace'));
  assert.ok(!usesVar('Sin link', 'enlace'));
  assert.equal(firstName('  juan  Pérez '), 'Juan');
  assert.equal(fmtMoney(320), '$320');
  assert.equal(fmtMoney(1250.5), '$1,250.50');
  assert.equal(fmtMoney(1500000), '$1,500,000');
  assert.equal(fmtMoney(300, 'USD'), '$300 USD');

  const shop = { name: 'Barbería Alfa', slug: 'alfa', address: 'Av. 1', currency: 'MXN', settings: {} };
  const appt = { date: '2020-10-05', start_min: 630, services: [CORTE, BARBA], total: 320, folio: 'TB-ABC', client_name: 'juan pérez' };
  const v = buildVars(shop, appt, { staffName: 'Barbero A', base: 'https://x.mx' });
  assert.deepEqual(v, {
    cliente: 'Juan', barberia: 'Barbería Alfa', fecha: 'lunes 5 de octubre', hora: '10:30', servicios: 'Corte + Barba', barbero: 'Barbero A',
    total: '$320', folio: 'TB-ABC', enlace: 'https://x.mx/?b=alfa', direccion: 'Av. 1', resena: 'https://x.mx/?b=alfa'
  });
  const v2 = buildVars(Object.assign({}, shop, { settings: { public: { review_url: 'https://g.page/r/alfa' } } }), appt, { link: 'https://x.mx/?cita=T', base: 'https://x.mx' });
  assert.equal(v2.enlace, 'https://x.mx/?cita=T');
  assert.equal(v2.resena, 'https://g.page/r/alfa');
  assert.equal(buildVars(shop, { start_min: 540 }, {}).hora, '09:00');
});

test('wa.me: 52 + 10 dígitos y texto codificado', () => {
  assert.equal(waLink('311 123 4567', 'Hola & adiós', '52'), 'https://wa.me/523111234567?text=Hola%20%26%20adi%C3%B3s');
  assert.equal(waLink('+52 1 311 123 4567', 'x'), 'https://wa.me/523111234567?text=x', 'quita 521 y vuelve a poner 52');
  assert.equal(waLink('3111234567', 'x', '1'), 'https://wa.me/13111234567?text=x');
  assert.equal(waLink('', 'hola'), 'https://wa.me/?text=hola');
});

test('base pública: PUBLIC_URL, host, demo y relativa', () => {
  assert.equal(publicBase({ PUBLIC_URL: 'https://gomez.tubarberia.mx/' }, { host: 'otro.mx' }), 'https://gomez.tubarberia.mx');
  assert.equal(publicBase({ PUBLIC_URL: 'https://x.mx/sub/' }), 'https://x.mx/sub');
  assert.equal(publicBase({ MODE: 'server' }, { host: 'App.TuBarberia.mx' }), 'https://app.tubarberia.mx');
  assert.equal(publicBase({ MODE: 'demo' }, { origin: 'http://localhost:8080', host: 'localhost:8080' }), 'http://localhost:8080');
  assert.equal(publicBase({ MODE: 'demo' }, { host: 'localhost:8080' }), 'http://localhost:8080');
  assert.equal(publicBase({ MODE: 'demo' }, {}), '');
  assert.equal(publicBase({ MODE: 'server' }, { host: 'evil.mx/x?y' }), '', 'host inválido → relativa');
  assert.equal(publicBase({ PUBLIC_URL: 'javascript:alert(1)' }, {}), '');
});

test('preparar confirmación: texto, wa_link, registro, historial y enlace de gestión estable', async () => {
  const f = await setup();
  f.env.MODE = 'server'; // enlace de producción: /?cita=<token> (la demo agrega ?b=<slug>)
  f.env.PUBLIC_URL = 'https://gomez.tubarberia.mx';
  const a = await mkAppt(f, { manage_token_hash: 'viejo' });
  const r = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a.id, kind: 'confirmation' } }));
  assert.equal(r.status, 200, r.body);
  const { message, body, to_phone, wa_link } = r.data;
  assert.equal(to_phone, '3111234567');
  assert.ok(body.startsWith('Hola Juan 👋 Tu cita en Barbería Alfa quedó confirmada.'), body);
  assert.ok(body.includes('📅 ' + fmtDateEs(f.day) + ' a las 10:30'), body);
  assert.ok(body.includes('✂️ Corte + Barba con Barbero A'));
  assert.ok(body.includes('💵 Total: $320'));
  assert.ok(body.includes('Folio: ' + a.folio));
  assert.ok(body.includes('Gestiona tu cita: https://gomez.tubarberia.mx/?cita='));
  assert.equal(wa_link, 'https://wa.me/523111234567?text=' + encodeURIComponent(body));
  assert.equal(message.status, 'prepared');
  assert.equal(message.kind, 'confirmation');
  assert.equal(message.client_id, 'cl_juan');
  assert.equal(message.client_name, 'juan Pérez López');
  assert.equal(message.appointment.folio, a.folio);
  assert.equal(message.body, body);
  assert.equal(message.shop_id, 'shop_a');
  // El enlace funciona y no reemplaza el hash de la cita (el enlace que el cliente ya tenía sigue sirviendo).
  const token = tokenIn(body);
  assert.match(token, /^[A-Za-z0-9]{20,80}$/);
  assert.equal((await f.db.findOne('appointments', { id: a.id })).manage_token_hash, 'viejo');
  let pub = await f.call('GET', '/api/public/appointments/' + token);
  assert.equal(pub.status, 200, pub.body);
  assert.equal(pub.data.appointment.id, a.id);
  // Evento en el historial.
  const ev = await f.db.find('appointment_events', { appointment_id: a.id, type: 'message' });
  assert.equal(ev.length, 1);
  assert.equal(ev[0].data.kind, 'confirmation');
  assert.equal(ev[0].actor_name, 'Dueño A');
  // Un segundo mensaje con enlace usa el mismo token: el de la confirmación sigue sirviendo.
  const r2 = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a.id, kind: 'reminder' } }));
  assert.equal(r2.status, 200);
  assert.equal(tokenIn(r2.data.body), token);
  assert.ok(r2.data.body.includes('📍 Av. México 123, Tepic'));
  assert.equal((await f.call('GET', '/api/public/appointments/' + token)).status, 200);
  // Un token con la firma alterada, de otra cita o con otro hash no abre nada.
  const bad = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
  assert.equal((await f.call('GET', '/api/public/appointments/' + bad)).status, 404);
  const other = await mkAppt(f, { manage_token_hash: 'viejo' });
  assert.equal((await f.call('GET', '/api/public/appointments/' + other.id.slice(3) + token.slice(-32))).status, 404);
  await f.db.update('appointments', { id: a.id }, { manage_token_hash: 'otro' });
  assert.equal((await f.call('GET', '/api/public/appointments/' + token)).status, 404);
});

test('enlace de gestión: la reserva, la confirmación y el recordatorio sirven a la vez; la demo lleva ?b=', async () => {
  const f = await setup();
  f.env.MODE = 'server'; // enlace de producción: /?cita=<token> (la demo agrega ?b=<slug>)
  f.env.PUBLIC_URL = 'https://gomez.tubarberia.mx';
  const b = await f.call('POST', '/api/public/shops/alfa/appointments', { body: { services: ['sv_corte'], staff_id: 'st_barberA', date: f.tomorrow, start_min: 700, name: 'Laura Gómez', phone: '5598765432' } });
  assert.equal(b.status, 200, b.body);
  const id = b.data.appointment.id, booked = b.data.manage_token;
  const hash = (await f.db.findOne('appointments', { id })).manage_token_hash;
  const tokens = [];
  for (const kind of ['confirmation', 'reminder', 'reschedule', 'no_show']) {
    const r = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: id, kind } }));
    assert.equal(r.status, 200, r.body);
    if (tokenIn(r.data.body)) tokens.push(tokenIn(r.data.body));
  }
  assert.ok(tokens.length >= 3, 'las plantillas con {enlace} llevan el de gestión');
  assert.equal(new Set(tokens).size, 1, 'el mismo enlace en todos los mensajes');
  assert.equal((await f.db.findOne('appointments', { id })).manage_token_hash, hash, 'mandar mensajes no toca el hash');
  for (const tk of [booked, tokens[0]]) {
    const r = await f.call('GET', '/api/public/appointments/' + tk);
    assert.equal(r.status, 200, tk);
    assert.equal(r.data.appointment.id, id);
  }
  // Se puede gestionar con el enlace del mensaje y el de la reserva sigue abriendo la cita ya movida.
  const mv = await f.call('POST', '/api/public/appointments/' + tokens[0] + '/reschedule', { body: { date: f.tomorrow, start_min: 800 } });
  assert.equal(mv.status, 200, mv.body);
  assert.equal((await f.call('GET', '/api/public/appointments/' + booked)).data.appointment.start_min, 800);

  // Cita agendada por el equipo (sin hash): se le asigna uno la primera vez y después es estable.
  const a = await mkAppt(f);
  const r1 = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a.id, kind: 'confirmation' } }));
  const h1 = (await f.db.findOne('appointments', { id: a.id })).manage_token_hash;
  assert.ok(h1);
  const r2 = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a.id, kind: 'reminder' } }));
  assert.equal(tokenIn(r2.data.body), tokenIn(r1.data.body));
  assert.equal((await f.db.findOne('appointments', { id: a.id })).manage_token_hash, h1);

  // Demo: el enlace lleva ?b=<slug> para que la página pública abra la cita guardada en el navegador.
  f.env.MODE = 'demo';
  const d = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a.id, kind: 'confirmation' } }));
  assert.ok(d.data.body.includes('https://gomez.tubarberia.mx/?b=alfa&cita=' + tokenIn(r1.data.body)), d.data.body);
});

test('preparar: cancelación/agradecimiento usan el link de reservas y no tocan el token', async () => {
  const f = await setup();
  const a = await mkAppt(f, { status: 'cancelled', manage_token_hash: 'hash-original' });
  let r = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a.id, kind: 'cancellation' } }));
  assert.equal(r.status, 200, r.body);
  assert.ok(r.data.body.includes('fue cancelada. Cuando quieras, reserva de nuevo: /?b=alfa'), r.data.body);
  assert.equal((await f.db.findOne('appointments', { id: a.id })).manage_token_hash, 'hash-original');
  // Agradecimiento solo con el cliente (sin cita) y con enlace de reseñas configurado.
  const s = await f.db.findOne('shops', { id: 'shop_a' });
  await f.db.update('shops', { id: 'shop_a' }, { settings: Object.assign({}, s.settings, { public: { review_url: 'https://g.page/r/alfa/review' } }) });
  r = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { client_id: 'cl_juan', kind: 'thanks' } }));
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.body, '¡Gracias por tu visita, Juan! 💈 Esperamos verte pronto en Barbería Alfa. Si te gustó el servicio, déjanos tu reseña: https://g.page/r/alfa/review');
  assert.equal(r.data.message.appointment_id, null);
  assert.equal(r.data.message.client_id, 'cl_juan');
});

test('preparar: plantilla propia de la barbería, texto libre y vista previa', async () => {
  const f = await setup();
  await f.setWa({ templates: { confirmation: 'Listo {Cliente}: {fecha} {hora} en {barbería}. {reseña}' } });
  const a = await mkAppt(f);
  let r = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a.id, kind: 'confirmation' } }));
  assert.equal(r.data.body, 'Listo Juan: ' + fmtDateEs(f.day) + ' 10:30 en Barbería Alfa. /?b=alfa');
  assert.equal((await f.db.findOne('appointments', { id: a.id })).manage_token_hash, null, 'sin {enlace} no rota el token');
  // Texto propio: se usa tal cual (recortando espacios).
  r = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a.id, kind: 'custom', body: '  Hola, ¿nos confirmas?\r\nGracias  ' } }));
  assert.equal(r.status, 200);
  assert.equal(r.data.body, 'Hola, ¿nos confirmas?\nGracias');
  assert.equal(r.data.message.kind, 'custom');
  // Vista previa: no registra nada.
  const before = await f.db.count('messages', {});
  r = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a.id, kind: 'reminder', preview: true } }));
  assert.equal(r.status, 200);
  assert.equal(r.data.message, null);
  assert.equal(r.data.preview, true);
  assert.ok(r.data.wa_link.startsWith('https://wa.me/523111234567?text='));
  assert.equal(await f.db.count('messages', {}), before);
});

test('preparar: validaciones y mensajes en español', async () => {
  const f = await setup();
  const a = await mkAppt(f);
  const prep = (body) => f.call('POST', '/api/messages/prepare', f.A('ownerA', { body }));
  let r = await prep({ appointment_id: a.id, kind: 'spam' });
  assert.equal(r.status, 400);
  assert.equal(r.error.fields.kind, 'Elige el tipo de mensaje.');
  r = await prep({ appointment_id: a.id, kind: 'custom' });
  assert.equal(r.status, 400);
  assert.equal(r.error.fields.body, 'Escribe el mensaje.');
  r = await prep({ appointment_id: a.id, kind: 'custom', body: '   ' });
  assert.equal(r.error.fields.body, 'Escribe el mensaje.');
  r = await prep({ appointment_id: a.id, kind: 'custom', body: 'x'.repeat(1001) });
  assert.equal(r.status, 400);
  assert.match(r.error.fields.body, /1000/);
  assert.equal((await prep({ appointment_id: a.id, kind: 'custom', body: 'x'.repeat(1000) })).status, 200);
  r = await prep({ appointment_id: a.id, kind: 'custom', body: { html: 1 } });
  assert.equal(r.error.fields.body, 'El mensaje no es válido.');
  r = await prep({ kind: 'custom', body: 'hola' });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.appointment_id);
  r = await prep({ client_id: 'cl_juan', kind: 'reminder' });
  assert.equal(r.error.fields.appointment_id, 'Elige la cita para este mensaje.');
  r = await prep({ appointment_id: 'ap_$$$', kind: 'reminder' });
  assert.equal(r.status, 400);
  r = await prep({ appointment_id: 'ap_noexiste', kind: 'reminder' });
  assert.equal(r.status, 404);
  assert.equal(r.error.message, 'No encontramos esa cita.');
  r = await prep({ appointment_id: a.id, client_id: 'cl_clientA', kind: 'reminder' });
  assert.equal(r.status, 400, 'cliente distinto al de la cita');
  // Sin teléfono (ni en la ficha ni en la cita).
  const b = await mkAppt(f, { client_id: 'cl_nophone', client_phone: '', start_min: 800 });
  r = await prep({ appointment_id: b.id, kind: 'reminder' });
  assert.equal(r.status, 400);
  assert.equal(r.error.message, 'Este cliente no tiene teléfono registrado.');
  r = await prep({ client_id: 'cl_nophone', kind: 'custom', body: 'hola' });
  assert.equal(r.error.message, 'Este cliente no tiene teléfono registrado.');
  // Walk-in sin ficha: usa el teléfono copiado en la cita.
  const w = await mkAppt(f, { client_id: null, client_name: 'Paco', client_phone: '3119998877', start_min: 900 });
  r = await prep({ appointment_id: w.id, kind: 'confirmation' });
  assert.equal(r.status, 200);
  assert.equal(r.data.to_phone, '3119998877');
  assert.ok(r.data.body.startsWith('Hola Paco'));
  // Cliente borrado (lógico) → 404 si se pide directo.
  await f.db.update('clients', { id: 'cl_juan' }, { deleted_at: nowIso() });
  r = await prep({ client_id: 'cl_juan', kind: 'custom', body: 'hola' });
  assert.equal(r.status, 404);
});

test('modo automático: el mensaje queda en cola (queued) y aun así devuelve wa_link', async () => {
  const f = await setup();
  await f.setWa({ mode: 'auto' });
  const a = await mkAppt(f);
  const r = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a.id, kind: 'confirmation' } }));
  assert.equal(r.status, 200);
  assert.equal(r.data.message.status, 'queued');
  assert.ok(r.data.wa_link.startsWith('https://wa.me/52'));
});

test('permisos y aislamiento: barbero solo lo suyo, cliente sin acceso, otra barbería no ve nada', async () => {
  const f = await setup();
  const mine = await mkAppt(f, { staff_id: 'st_barberA' });
  const other = await mkAppt(f, { staff_id: 'st_barberA2', client_id: 'cl_clientA', client_name: 'Cliente A', client_phone: '3110000001', start_min: 700 });
  const prep = (as, body, shop) => f.call('POST', '/api/messages/prepare', { as, shop: shop || 'shop_a', body });
  // Barbero
  assert.equal((await prep('barberA', { appointment_id: mine.id, kind: 'reminder' })).status, 200);
  assert.equal((await prep('barberA', { appointment_id: other.id, kind: 'reminder' })).status, 404);
  assert.equal((await prep('barberA', { client_id: 'cl_clientA', kind: 'custom', body: 'hola' })).status, 404, 'cliente que no ha atendido');
  assert.equal((await prep('barberA', { client_id: 'cl_juan', kind: 'custom', body: 'hola' })).status, 200, 'cliente suyo');
  // Dueño
  const own = await prep('ownerA', { appointment_id: other.id, kind: 'reminder' });
  assert.equal(own.status, 200);
  // Cliente: sin permiso
  assert.equal((await prep('clientA', { appointment_id: other.id, kind: 'reminder' })).status, 403);
  assert.equal((await f.call('GET', '/api/messages', { as: 'clientA', shop: 'shop_a' })).status, 403);
  // Otra barbería: sin acceso a la A, y desde la B no encuentra ids de la A.
  assert.equal((await prep('ownerB', { appointment_id: mine.id, kind: 'reminder' })).status, 403);
  assert.equal((await prep('ownerB', { appointment_id: mine.id, kind: 'reminder' }, 'shop_b')).status, 404);
  assert.equal((await prep('ownerB', { client_id: 'cl_juan', kind: 'custom', body: 'x' }, 'shop_b')).status, 404);
  assert.equal((await f.call('PATCH', '/api/messages/' + own.data.message.id, { as: 'ownerB', shop: 'shop_b', body: { status: 'sent' } })).status, 404);
  const listB = await f.call('GET', '/api/messages', { as: 'ownerB', shop: 'shop_b' });
  assert.deepEqual(listB.data, []);
  // Listados
  const all = await f.call('GET', '/api/messages', f.A('ownerA'));
  assert.equal(all.data.length, 3);
  const barber = await f.call('GET', '/api/messages', f.A('barberA'));
  assert.equal(barber.data.length, 2);
  assert.ok(barber.data.every((m) => m.appointment_id === mine.id || (m.appointment_id === null && m.client_id === 'cl_juan')));
  assert.equal((await f.call('PATCH', '/api/messages/' + own.data.message.id, f.A('barberA', { body: { status: 'sent' } }))).status, 404, 'mensaje de otro barbero');
  // Superadmin actúa como dueño
  const sup = await f.call('GET', '/api/messages', f.A('super'));
  assert.equal(sup.data.length, 3);
  // Filtros
  const byAppt = await f.call('GET', '/api/messages?appointment_id=' + other.id, f.A('ownerA'));
  assert.equal(byAppt.data.length, 1);
  const byStatus = await f.call('GET', '/api/messages?status=sent', f.A('ownerA'));
  assert.equal(byStatus.data.length, 0);
  assert.equal((await f.call('GET', '/api/messages?status=nope', f.A('ownerA'))).status, 400);
  assert.equal((await f.call('GET', '/api/messages?limit=1', f.A('ownerA'))).data.length, 1);
});

test('marcar estado: recordatorio abierto/enviado marca la cita; reglas de estado', async () => {
  const f = await setup();
  const a = await mkAppt(f);
  const r = await f.call('POST', '/api/messages/prepare', f.A('barberA', { body: { appointment_id: a.id, kind: 'reminder' } }));
  const id = r.data.message.id;
  const patch = (body, as) => f.call('PATCH', '/api/messages/' + id, f.A(as || 'barberA', { body }));
  let p = await patch({ status: 'queued' });
  assert.equal(p.status, 400);
  assert.equal(p.error.message, 'Elige un estado válido: abierto, enviado o fallido.');
  p = await patch({ status: 'opened' });
  assert.equal(p.status, 200);
  assert.equal(p.data.status, 'opened');
  assert.equal(p.data.sent_at, null);
  assert.ok((await f.db.findOne('appointments', { id: a.id })).reminder_sent_at);
  p = await patch({ status: 'sent' });
  assert.equal(p.data.status, 'sent');
  assert.ok(p.data.sent_at);
  assert.equal((await patch({ status: 'sent' })).status, 200, 'idempotente');
  p = await patch({ status: 'failed' });
  assert.equal(p.status, 409);
  assert.equal((await f.call('PATCH', '/api/messages/msg_nada', f.A('ownerA', { body: { status: 'sent' } }))).status, 404);
  // Un mensaje que no es recordatorio no toca reminder_sent_at.
  const b = await mkAppt(f, { start_min: 900 });
  const c = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: b.id, kind: 'confirmation' } }));
  await f.call('PATCH', '/api/messages/' + c.data.message.id, f.A('ownerA', { body: { status: 'sent' } }));
  assert.equal((await f.db.findOne('appointments', { id: b.id })).reminder_sent_at, null);
});

test('recordatorios: mañana por defecto, solo activas, sin rotar token, barbero solo las suyas', async () => {
  const f = await setup();
  const t = f.tomorrow;
  const a1 = await mkAppt(f, { date: t, start_min: 600, manage_token_hash: 'h1' });
  const a2 = await mkAppt(f, { date: t, start_min: 700, status: 'pending', staff_id: 'st_barberA2', client_id: 'cl_clientA', client_name: 'Cliente A', client_phone: '3110000001', reminder_sent_at: nowIso() });
  await mkAppt(f, { date: t, start_min: 800, status: 'cancelled' });
  await mkAppt(f, { date: t, start_min: 900, status: 'completed' });
  const nophone = await mkAppt(f, { date: t, start_min: 1000, client_id: 'cl_nophone', client_phone: '' });
  await mkAppt(f, { date: addDays(t, 1), start_min: 600 });
  await mkAppt(f, { date: t, shop_id: 'shop_b', staff_id: 'st_ownerB', client_id: 'cl_walkB', start_min: 600 });
  let r = await f.call('GET', '/api/reminders', f.A('ownerA'));
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.date, t);
  assert.deepEqual(r.data.items.map((i) => i.appointment.id), [a1.id, a2.id, nophone.id]);
  const [i1, i2, i3] = r.data.items;
  assert.equal(i1.reminded, false);
  assert.equal(i2.reminded, true);
  assert.equal(i1.appointment.staff_name, 'Barbero A');
  assert.equal(i1.appointment.manage_token_hash, undefined, 'vista sin hash');
  assert.ok(i1.body.startsWith('Hola Juan, te recordamos tu cita en Barbería Alfa:'), i1.body);
  assert.ok(i1.body.includes('📅 ' + fmtDateEs(t) + ' a las 10:00'));
  assert.ok(i1.body.includes('reagenda aquí: /?b=alfa'));
  assert.equal(i1.wa_link, 'https://wa.me/523111234567?text=' + encodeURIComponent(i1.body));
  assert.equal(i3.wa_link, null);
  assert.equal(i3.to_phone, '');
  assert.equal((await f.db.findOne('appointments', { id: a1.id })).manage_token_hash, 'h1', 'no genera token al listar');
  // Barbero: solo las suyas
  r = await f.call('GET', '/api/reminders', f.A('barberA'));
  assert.deepEqual(r.data.items.map((i) => i.appointment.id), [a1.id, nophone.id]);
  // Fecha explícita e inválida
  r = await f.call('GET', '/api/reminders?date=' + addDays(t, 1), f.A('ownerA'));
  assert.equal(r.data.items.length, 1);
  assert.equal((await f.call('GET', '/api/reminders?date=2026-02-30', f.A('ownerA'))).status, 400);
  assert.equal((await f.call('GET', '/api/reminders?date=mañana', f.A('ownerA'))).status, 400);
  // Otra barbería
  r = await f.call('GET', '/api/reminders', { as: 'ownerB', shop: 'shop_b' });
  assert.equal(r.data.items.length, 1);
  assert.equal(r.data.items[0].appointment.shop_id, 'shop_b');
  assert.equal((await f.call('GET', '/api/reminders', { as: 'clientA', shop: 'shop_a' })).status, 403);
  // Después de enviar uno, aparece como recordado.
  const p = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { appointment_id: a1.id, kind: 'reminder' } }));
  await f.call('PATCH', '/api/messages/' + p.data.message.id, f.A('ownerA', { body: { status: 'opened' } }));
  r = await f.call('GET', '/api/reminders', f.A('ownerA'));
  assert.equal(r.data.items[0].reminded, true);
});

test('recordatorios y plantilla propia con variables acentuadas', async () => {
  const f = await setup();
  await f.setWa({ templates: { reminder: 'Recordatorio para {Cliente} en {barbería}: {fecha} a las {hora} con {barbero}. Total {total}. Dirección: {dirección}' } });
  const a = await mkAppt(f, { date: f.tomorrow, start_min: 870 });
  const r = await f.call('GET', '/api/reminders', f.A('ownerA'));
  assert.equal(r.data.items[0].body, 'Recordatorio para Juan en Barbería Alfa: ' + fmtDateEs(f.tomorrow) + ' a las 14:30 con Barbero A. Total $320. Dirección: Av. México 123, Tepic');
  assert.equal(r.data.items[0].appointment.id, a.id);
});

// ── Regresiones de la revisión ──
test('vista previa: no toca el token de gestión; al enviar, el marcador {enlace} se vuelve el enlace real', async () => {
  const f = await setup();
  f.env.MODE = 'server'; // enlace de producción: /?cita=<token> (la demo agrega ?b=<slug>)
  f.env.PUBLIC_URL = 'https://gomez.tubarberia.mx';
  // Reserva en línea: el cliente ya tiene su enlace.
  const b = await f.call('POST', '/api/public/shops/alfa/appointments', { body: { services: ['sv_corte'], staff_id: 'st_barberA', date: f.day, start_min: 700, name: 'Laura Gómez', phone: '5598765432' } });
  assert.equal(b.status, 200, b.body);
  const id = b.data.appointment.id, tk = b.data.manage_token;
  const hash = (await f.db.findOne('appointments', { id })).manage_token_hash;
  // El editor abre la vista previa (y cambia de plantilla varias veces) y luego se cancela.
  for (const kind of ['reminder', 'confirmation', 'reschedule', 'no_show']) {
    const r = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { preview: true, kind, appointment_id: id } }));
    assert.equal(r.status, 200, r.body);
    assert.equal(r.data.preview, true);
    if (kind !== 'reschedule') assert.ok(r.data.body.includes('{enlace}'), kind + ': marcador en lugar del enlace: ' + r.data.body);
    assert.ok(!/\?cita=/.test(r.data.body));
  }
  assert.equal((await f.db.findOne('appointments', { id })).manage_token_hash, hash, 'la vista previa no toca el token');
  assert.equal((await f.call('GET', '/api/public/appointments/' + tk)).status, 200, 'el enlace del cliente sigue sirviendo');
  assert.equal(await f.db.count('messages', {}), 0);
  // Enviar el texto de la vista previa (editado): el marcador se reemplaza por un enlace de gestión que funciona.
  const pv = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { preview: true, kind: 'reminder', appointment_id: id } }));
  const edited = pv.data.body + '\n¡Te esperamos!';
  const r = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { kind: 'reminder', appointment_id: id, body: edited } }));
  assert.equal(r.status, 200, r.body);
  assert.ok(!r.data.body.includes('{enlace}'), r.data.body);
  assert.ok(r.data.body.endsWith('¡Te esperamos!'));
  const token = tokenIn(r.data.body);
  assert.ok(token, r.data.body);
  assert.ok(r.data.body.includes('https://gomez.tubarberia.mx/?cita=' + token));
  assert.equal(r.data.message.body, r.data.body);
  assert.equal(r.data.wa_link, 'https://wa.me/525598765432?text=' + encodeURIComponent(r.data.body));
  assert.equal((await f.call('GET', '/api/public/appointments/' + token)).status, 200);
  assert.equal((await f.call('GET', '/api/public/appointments/' + tk)).status, 200, 'el de la reserva también');
  // Texto libre con {enlace} en un tipo sin enlace de gestión → link de reservas (no toca el token).
  const h2 = (await f.db.findOne('appointments', { id })).manage_token_hash;
  const c = await f.call('POST', '/api/messages/prepare', f.A('ownerA', { body: { kind: 'custom', appointment_id: id, body: 'Reserva otra vez: {enlace}' } }));
  assert.equal(c.data.body, 'Reserva otra vez: https://gomez.tubarberia.mx/?b=alfa');
  assert.equal((await f.db.findOne('appointments', { id })).manage_token_hash, h2);
});
