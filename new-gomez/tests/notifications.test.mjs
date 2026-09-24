import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { createSession } from '../core/session.js';
import { newId } from '../core/util.js';
import { sendBookingEmail, bookingEmailContent, emailConfig, escapeHtml } from '../core/domain/email.js';

async function setup() {
  const f = await makeFixture();
  for (const k of ['ownerA', 'barberA', 'ownerB', 'clientA', 'super']) f.tokens[k] = await createSession(f.db, { kind: 'password', user_id: 'u_' + k });
  let t = Date.parse('2026-09-01T12:00:00Z');
  f.notif = (shop_id, to, extra) => f.db.insert('notifications', Object.assign({
    id: newId('nt'), shop_id, staff_id: to.staff || null, client_id: to.client || null, type: 'system', title: 'Aviso', body: '', link: '', data: null,
    read_at: null, created_at: new Date(t += 60000).toISOString()
  }, extra || {}));
  f.get = (as, qs, shop) => f.call('GET', '/api/notifications' + (qs ? '?' + qs : ''), { as, shop: shop || 'shop_a' });
  f.read = (as, body, shop) => f.call('POST', '/api/notifications/read', { as, shop: shop || 'shop_a', body });
  return f;
}

test('notificaciones: cada quien ve solo las suyas (dueño, barbero, cliente, otra barbería)', async () => {
  const f = await setup();
  const o1 = await f.notif('shop_a', { staff: 'st_ownerA' }, { title: 'Primera' });
  const o2 = await f.notif('shop_a', { staff: 'st_ownerA' }, { title: 'Segunda' });
  const b1 = await f.notif('shop_a', { staff: 'st_barberA' });
  const c1 = await f.notif('shop_a', { client: 'cl_clientA' });
  await f.notif('shop_b', { staff: 'st_ownerB' });
  await f.notif('shop_b', { staff: 'st_ownerA' }, { title: 'Fila mal formada en B' }); // no debe filtrarse a la A

  let r = await f.get('ownerA');
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.data.items.map((n) => n.id), [o2.id, o1.id], 'más recientes primero');
  assert.equal(r.data.unread, 2);
  r = await f.get('barberA');
  assert.deepEqual(r.data.items.map((n) => n.id), [b1.id]);
  r = await f.get('clientA');
  assert.deepEqual(r.data.items.map((n) => n.id), [c1.id]);
  assert.equal(r.data.unread, 1);
  r = await f.get('ownerB', '', 'shop_b');
  assert.equal(r.data.items.length, 1);
  assert.equal(r.data.items[0].shop_id, 'shop_b');
  // Sin acceso a otra barbería
  assert.equal((await f.get('ownerB', '', 'shop_a')).status, 403);
  assert.equal((await f.get('clientA', '', 'shop_b')).status, 403);
  // Superadmin sin ficha de staff: bandeja vacía
  r = await f.get('super');
  assert.deepEqual(r.data, { items: [], unread: 0 });
  assert.deepEqual((await f.read('super', { all: true })).data, { unread: 0, updated: 0 });
  // Sin sesión
  assert.equal((await f.call('GET', '/api/notifications', { shop: 'shop_a' })).status, 401);
});

test('notificaciones: leídas/no leídas, límite y paginación', async () => {
  const f = await setup();
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push((await f.notif('shop_a', { staff: 'st_ownerA' }, { title: 'N' + i })).id);
  const other = await f.notif('shop_a', { staff: 'st_barberA' });
  const inB = await f.notif('shop_b', { staff: 'st_ownerB' });

  let r = await f.read('ownerA', { ids: [ids[0], ids[1], other.id, inB.id, 'nt_inventado'] });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.data, { unread: 3, updated: 2 }, 'solo marca las propias');
  assert.equal((await f.db.findOne('notifications', { id: other.id })).read_at, null);
  assert.equal((await f.db.findOne('notifications', { id: inB.id })).read_at, null);
  r = await f.get('ownerA', 'unread=1');
  assert.deepEqual(r.data.items.map((n) => n.id), [ids[4], ids[3], ids[2]]);
  assert.equal(r.data.unread, 3);
  r = await f.get('ownerA', 'limit=2');
  assert.equal(r.data.items.length, 2);
  r = await f.get('ownerA', 'limit=1000');
  assert.equal(r.data.items.length, 5, 'límite máximo 100');
  r = await f.get('ownerA', 'before=' + encodeURIComponent(r.data.items[1].created_at));
  assert.deepEqual(r.data.items.map((n) => n.id), [ids[2], ids[1], ids[0]]);
  assert.equal((await f.get('ownerA', 'limit=abc')).status, 400);
  assert.equal((await f.get('ownerA', 'before=ayer')).status, 400);
  // Validaciones de /read
  r = await f.read('ownerA', {});
  assert.equal(r.status, 400);
  assert.equal(r.error.message, 'Indica qué notificaciones marcar como leídas.');
  assert.equal((await f.read('ownerA', { ids: [] })).status, 400);
  assert.equal((await f.read('ownerA', { ids: [123] })).status, 400);
  assert.equal((await f.read('ownerA', { ids: 'nt_1' })).status, 400);
  assert.equal((await f.read('ownerA', { ids: new Array(501).fill('x') })).status, 400);
  // all
  r = await f.read('ownerA', { all: true });
  assert.deepEqual(r.data, { unread: 0, updated: 3 });
  assert.equal((await f.get('barberA')).data.unread, 1, 'no toca las de otros');
  assert.equal((await f.get('ownerB', '', 'shop_b')).data.unread, 1, 'ni las de otra barbería');
  // Cliente marca las suyas
  await f.notif('shop_a', { client: 'cl_clientA' });
  assert.deepEqual((await f.read('clientA', { all: true })).data, { unread: 0, updated: 1 });
});

test('notificaciones: una reserva en línea llega al dueño y al barbero', async () => {
  const f = await setup();
  const r = await f.call('POST', '/api/public/shops/alfa/appointments', { body: { services: ['sv_corte'], staff_id: 'st_barberA', date: f.day, start_min: 600, name: 'Laura Gómez', phone: '5598765432' } });
  assert.equal(r.status, 200, r.body);
  for (const who of ['ownerA', 'barberA']) {
    const n = await f.get(who);
    assert.equal(n.data.unread, 1, who);
    assert.equal(n.data.items[0].type, 'booking_new');
    assert.match(n.data.items[0].body, /Laura Gómez/);
  }
  assert.equal((await f.get('ownerB', '', 'shop_b')).data.unread, 0);
});

// ── Correo (Resend) ──
function stubFetch(impl) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init, payload: init && init.body ? JSON.parse(init.body) : null }); return impl(url, init); };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}
const SHOP = { id: 'shop_x', name: 'Barbería <Alfa>', slug: 'alfa', currency: 'MXN', settings: { notify_email: 'dueno@alfa.mx' } };
const APPT = { id: 'ap_1', folio: 'TB-ABC123', client_name: 'Laura <script>alert(1)</script>', client_phone: '5598765432', date: '2020-10-05', start_min: 630, staff_name: 'Ángel', services: [{ name: 'Corte' }, { name: 'Barba & bigote' }], total: 1320, client_note: 'Llego 5 min "tarde"', status: 'confirmed' };

test('correo: demo o sin configuración → not_configured sin tocar la red', async () => {
  const s = stubFetch(() => { throw new Error('no debería llamarse'); });
  try {
    assert.deepEqual(await sendBookingEmail({ MODE: 'demo', RESEND_API_KEY: 'k', DEST_EMAIL: 'a@b.mx' }, SHOP, APPT), { ok: false, error: 'not_configured' });
    assert.deepEqual(await sendBookingEmail({ DEST_EMAIL: 'a@b.mx' }, SHOP, APPT), { ok: false, error: 'not_configured' });
    assert.deepEqual(await sendBookingEmail({ RESEND_API_KEY: 'k' }, { name: 'X', settings: {} }, APPT), { ok: false, error: 'not_configured' });
    assert.deepEqual(await sendBookingEmail({ RESEND_API_KEY: 'k', DEST_EMAIL: 'no-es-correo' }, { name: 'X' }, APPT), { ok: false, error: 'not_configured' });
    assert.deepEqual(await sendBookingEmail(undefined, undefined, undefined), { ok: false, error: 'not_configured' });
    assert.equal(s.calls.length, 0);
  } finally { s.restore(); }
});

test('correo: envía a notify_email (o DEST_EMAIL) con HTML escapado', async () => {
  const s = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ id: 'em_123' }) }));
  try {
    const env = { MODE: 'server', RESEND_API_KEY: 're_key', DEST_EMAIL: 'respaldo@t.mx', PUBLIC_URL: 'https://app.tubarberia.mx' };
    let r = await sendBookingEmail(env, SHOP, APPT);
    assert.deepEqual(r, { ok: true, id: 'em_123' });
    const c = s.calls[0];
    assert.equal(c.url, 'https://api.resend.com/emails');
    assert.equal(c.init.method, 'POST');
    assert.equal(c.init.headers.Authorization, 'Bearer re_key');
    assert.deepEqual(c.payload.to, ['dueno@alfa.mx']);
    assert.equal(c.payload.from, 'Barbería Alfa <onboarding@resend.dev>', 'sin < > en el nombre del remitente');
    assert.equal(c.payload.subject, 'Nueva cita: Laura <script>alert(1)</script> — lunes 5 de octubre 10:30');
    assert.ok(!c.payload.html.includes('<script>'));
    assert.ok(c.payload.html.includes('Laura &lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(c.payload.html.includes('Corte + Barba &amp; bigote — $1,320 MXN'));
    assert.ok(c.payload.html.includes('con Ángel'));
    assert.ok(c.payload.html.includes('&quot;tarde&quot;'));
    assert.ok(c.payload.html.includes('https://app.tubarberia.mx/app/#/agenda?cita=ap_1'));
    assert.ok(c.payload.text.includes('lunes 5 de octubre a las 10:30 con Ángel'));
    // Sin notify_email → DEST_EMAIL; FROM_EMAIL manda.
    r = await sendBookingEmail(Object.assign({}, env, { FROM_EMAIL: 'Avisos <avisos@tubarberia.mx>' }), { name: 'Beta', settings: {} }, APPT);
    assert.equal(r.ok, true);
    assert.deepEqual(s.calls[1].payload.to, ['respaldo@t.mx']);
    assert.equal(s.calls[1].payload.from, 'Avisos <avisos@tubarberia.mx>');
  } finally { s.restore(); }
});

test('correo: errores del proveedor nunca lanzan y los textos se recortan', async () => {
  let s = stubFetch(async () => ({ ok: false, status: 422, json: async () => ({}) }));
  const env = { RESEND_API_KEY: 'k', DEST_EMAIL: 'a@b.mx' };
  try { assert.deepEqual(await sendBookingEmail(env, SHOP, APPT), { ok: false, error: 'send_failed', status: 422 }); } finally { s.restore(); }
  s = stubFetch(async () => { throw new Error('sin red'); });
  try { assert.deepEqual(await sendBookingEmail(env, SHOP, APPT), { ok: false, error: 'exception' }); } finally { s.restore(); }
  s = stubFetch(async () => ({ ok: true, status: 200, json: async () => { throw new Error('no json'); } }));
  try { assert.deepEqual(await sendBookingEmail(env, SHOP, { services: 'raro', start_min: 'x', date: 'nope' }), { ok: true, id: null }); } finally { s.restore(); }
  const long = bookingEmailContent(SHOP, Object.assign({}, APPT, { client_name: 'x'.repeat(500), client_note: 'n'.repeat(2000), services: new Array(30).fill({ name: 's'.repeat(200) }) }));
  assert.ok(long.subject.length <= 200);
  assert.ok(!long.html.includes('x'.repeat(121)));
  assert.ok(!long.html.includes('n'.repeat(501)));
  assert.equal((long.text.match(/s{80}/g) || []).length, 10, '10 servicios de máximo 80 caracteres');
  assert.equal(escapeHtml(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  assert.equal(emailConfig({ RESEND_API_KEY: 'k' }, SHOP).to, 'dueno@alfa.mx');
  const pending = bookingEmailContent(SHOP, Object.assign({}, APPT, { status: 'pending' }));
  assert.ok(pending.html.includes('Pendiente de confirmar'));
});
