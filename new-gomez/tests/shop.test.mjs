import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { scopedDb } from '../core/db.js';
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from '../core/domain/settings.js';
import { newId, nowIso } from '../core/util.js';
import { permissionsFor } from '../core/permissions.js';

async function setup() {
  const f = await makeFixture();
  for (const [as, email] of [['ownerA', 'owner.a@t.mx'], ['barberA', 'barber.a@t.mx'], ['clientA', 'client.a@t.mx'], ['ownerB', 'owner.b@t.mx'], ['super', 'super@t.mx']]) await f.login(as, email);
  return f;
}
const note = (db, shop, to) => scopedDb(db, shop).insert('notifications', Object.assign({ id: newId('nt'), type: 'system', title: 'x', created_at: nowIso() }, to));
const patch = (f, as, body, shop) => f.call('PATCH', '/api/shop', { as, shop: shop || 'shop_a', body });

test('context: dueño recibe barbería completa con ajustes por defecto, permisos, su ficha y no leídas', async () => {
  const f = await setup();
  await note(f.db, 'shop_a', { staff_id: 'st_ownerA' });
  await note(f.db, 'shop_a', { staff_id: 'st_ownerA' });
  await note(f.db, 'shop_a', { staff_id: 'st_ownerA', read_at: nowIso() });
  await note(f.db, 'shop_a', { staff_id: 'st_barberA' });
  await note(f.db, 'shop_b', { staff_id: 'st_ownerA' }); // otra barbería: no cuenta
  const r = await f.call('GET', '/api/context', { as: 'ownerA', shop: 'shop_a' });
  assert.equal(r.status, 200, r.body);
  const d = r.data;
  assert.equal(d.shop.id, 'shop_a');
  assert.equal(d.shop.slug, 'alfa');
  assert.equal(d.shop.settings.booking.lead_min, 0);                                   // guardado
  assert.equal(d.shop.settings.booking.step_min, DEFAULT_SETTINGS.booking.step_min);   // por defecto
  assert.deepEqual(d.shop.settings.payments.methods, DEFAULT_SETTINGS.payments.methods);
  assert.equal(d.role, 'owner');
  assert.ok(d.permissions.includes('shop.update') && d.permissions.includes('staff.manage'));
  assert.ok(!d.permissions.includes('platform.manage'));
  assert.equal(d.staff.id, 'st_ownerA');
  assert.equal(d.staff.email, 'owner.a@t.mx');
  assert.equal(d.staff.pin_hash, undefined);
  assert.equal(d.client, null);
  assert.equal(d.unread, 2);
});

test('context: barbero por PIN, cliente y superadmin', async () => {
  const f = await setup();
  const pin = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } });
  assert.equal(pin.status, 200, pin.body);
  await note(f.db, 'shop_a', { staff_id: 'st_barberA' });
  const b = await f.call('GET', '/api/context', { token: pin.data.token });
  assert.equal(b.status, 200, b.body);
  assert.equal(b.data.role, 'barber');
  assert.equal(b.data.staff.id, 'st_barberA');
  assert.equal(b.data.staff.has_pin, true);
  assert.equal(b.data.staff.pin_hash, undefined);
  assert.ok(!b.data.permissions.includes('staff.manage'));
  assert.ok(b.data.permissions.includes('appointments.read.own'));
  assert.equal(b.data.unread, 1);

  await f.db.update('shops', { id: 'shop_a' }, { settings: { hours: {}, notify_email: 'dueno@alfa.mx' } });
  await f.db.update('clients', { id: 'cl_clientA' }, { notes: 'Llega tarde', tags: ['Difícil'] });
  await note(f.db, 'shop_a', { client_id: 'cl_clientA' });
  const c = await f.call('GET', '/api/context', { as: 'clientA' });
  assert.equal(c.status, 200, c.body);
  assert.equal(c.data.role, 'client');
  assert.equal(c.data.client.id, 'cl_clientA');
  assert.equal(c.data.client.name, 'Cliente A');
  assert.equal(c.data.client.notes, undefined, 'el cliente no ve las notas internas');
  assert.equal(c.data.client.tags, undefined);
  assert.equal(c.data.staff, null);
  assert.equal(c.data.unread, 1);
  assert.equal(c.data.shop.settings.notify_email, '');   // el cliente no ve el correo interno
  assert.deepEqual(c.data.permissions, permissionsFor('client'));
  assert.ok(!c.data.permissions.includes('clients.read.all'));
  const o = await f.call('GET', '/api/context', { as: 'ownerA' });
  assert.equal(o.data.shop.settings.notify_email, 'dueno@alfa.mx');

  const s = await f.call('GET', '/api/context', { as: 'super', shop: 'shop_b' });
  assert.equal(s.status, 200, s.body);
  assert.equal(s.data.role, 'superadmin');
  assert.equal(s.data.shop.id, 'shop_b');
  assert.equal(s.data.staff, null);
  assert.equal(s.data.unread, 0);
  assert.ok(s.data.permissions.includes('platform.manage'));
});

test('context: sin sesión 401; barbería ajena 403', async () => {
  const f = await setup();
  assert.equal((await f.call('GET', '/api/context', { shop: 'shop_a' })).status, 401);
  assert.equal((await f.call('GET', '/api/context', { as: 'ownerA', shop: 'shop_b' })).status, 403);
  assert.equal((await f.call('GET', '/api/context', { as: 'clientA', shop: 'shop_b' })).status, 403);
});

test('PATCH /api/shop: solo el dueño (o superadmin); barbero y cliente 403', async () => {
  const f = await setup();
  assert.equal((await patch(f, 'barberA', { name: 'Hackeada' })).status, 403);
  assert.equal((await patch(f, 'clientA', { name: 'Hackeada' })).status, 403);
  assert.equal((await f.db.findOne('shops', { id: 'shop_a' })).name, 'Barbería Alfa');
  const s = await patch(f, 'super', { tagline: 'Desde plataforma' }, 'shop_a');
  assert.equal(s.status, 200, s.body);
  assert.equal(s.data.shop.tagline, 'Desde plataforma');
});

test('PATCH /api/shop: lista blanca, normalización y aislamiento', async () => {
  const f = await setup();
  const r = await patch(f, 'ownerA', {
    name: '  Barbería   Alfa Centro ', phone: '+52 1 (311) 123-4567', whatsapp: '311 765 4321', email: 'HOLA@Alfa.MX',
    brand_color: '#AABBCC', currency: 'usd', timezone: 'America/Tijuana', maps_url: 'https://maps.app.goo.gl/abc',
    logo_url: '/img/logo.png', cover_url: 'data:image/png;base64,iVBORw0KGgo=', tagline: '',
    status: 'suspended', plan: 'pro', id: 'shop_b', shop_id: 'shop_b', domain: 'evil.com', created_at: 'x'
  });
  assert.equal(r.status, 200, r.body);
  const s = r.data.shop;
  assert.equal(s.id, 'shop_a');
  assert.equal(s.name, 'Barbería Alfa Centro');
  assert.equal(s.phone, '3111234567');
  assert.equal(s.whatsapp, '3117654321');
  assert.equal(s.email, 'hola@alfa.mx');
  assert.equal(s.brand_color, '#aabbcc');
  assert.equal(s.currency, 'USD');
  assert.equal(s.timezone, 'America/Tijuana');
  assert.equal(s.logo_url, '/img/logo.png');
  assert.equal(s.tagline, null);
  assert.equal(s.status, 'active');
  assert.equal(s.plan, 'basic');
  assert.equal(s.domain, null);
  assert.ok(s.settings.booking && s.settings.whatsapp, 'ajustes mezclados');
  const b = await f.db.findOne('shops', { id: 'shop_b' });
  assert.equal(b.name, 'Barbería Beta');
  assert.equal(b.phone, null);
  // Vacío → 400
  assert.equal((await patch(f, 'ownerA', {})).status, 400);
  // El dueño de B edita solo B aunque mande x-shop-id de A → 403
  assert.equal((await patch(f, 'ownerB', { name: 'Robada' }, 'shop_a')).status, 403);
});

test('PATCH /api/shop: validaciones de campos', async () => {
  const f = await setup();
  const cases = [
    [{ name: 'A' }, 'name'], [{ name: null }, 'name'], [{ phone: '12345' }, 'phone'], [{ whatsapp: 'abc' }, 'whatsapp'],
    [{ email: 'no-es-correo' }, 'email'], [{ brand_color: 'red' }, 'brand_color'], [{ brand_color: '#abc' }, 'brand_color'],
    [{ currency: 'EUR' }, 'currency'], [{ timezone: 'Marte/Base' }, 'timezone'], [{ maps_url: 'javascript:alert(1)' }, 'maps_url'],
    [{ maps_url: '/relativo' }, 'maps_url'], [{ logo_url: 'javascript:alert(1)' }, 'logo_url'],
    [{ cover_url: 'data:image/svg+xml;base64,PHN2Zz4=' }, 'cover_url'], [{ description: 'x'.repeat(1001) }, 'description'],
    [{ tagline: { a: 1 } }, 'tagline'], [{ settings: 'x' }, 'settings'], [{ logo_url: '//evil.com/logo.png' }, 'logo_url'],
    [{ logo_url: 'data:image/png;base64,' + 'A'.repeat(140000) }, 'logo_url']
  ];
  for (const [body, field] of cases) {
    const r = await patch(f, 'ownerA', body);
    assert.equal(r.status, 400, JSON.stringify(body) + ' → ' + r.body);
    assert.equal(r.error.code, 'bad_request');
    assert.ok(r.error.fields && r.error.fields[field], JSON.stringify(body) + ' sin fields.' + field + ': ' + r.body);
    assert.ok(typeof r.error.message === 'string' && r.error.message.length > 5);
  }
  assert.equal((await f.db.findOne('shops', { id: 'shop_a' })).name, 'Barbería Alfa');
});

test('PATCH /api/shop: slug válido, único y no reservado', async () => {
  const f = await setup();
  for (const slug of ['admin', 'demo', 'www', 'b', 'Mi Barbería', 'ab', '-alfa', 'alfa-', 'al--fa', 'x'.repeat(41)]) {
    const r = await patch(f, 'ownerA', { slug });
    assert.equal(r.status, 400, slug + ' → ' + r.body);
    assert.ok(r.error.fields.slug);
  }
  const dup = await patch(f, 'ownerA', { slug: 'beta' });
  assert.equal(dup.status, 409);
  assert.equal(dup.error.code, 'duplicate');
  assert.ok(dup.error.fields.slug);
  // Mismo slug (sin cambio) no falla, aunque sea el actual.
  assert.equal((await patch(f, 'ownerA', { slug: 'alfa', name: 'Alfa' })).status, 200);
  const ok = await patch(f, 'ownerA', { slug: '  Alfa-Centro-2 ' });
  assert.equal(ok.status, 200, ok.body);
  assert.equal(ok.data.shop.slug, 'alfa-centro-2');
  assert.equal((await f.db.findOne('shops', { slug: 'alfa-centro-2' })).id, 'shop_a');
  // Una barbería con slug reservado (p. ej. la demo) puede guardar otros cambios sin tocarlo.
  await f.db.update('shops', { id: 'shop_b' }, { slug: 'demo' });
  const d = await patch(f, 'ownerB', { slug: 'demo', tagline: 'Demo' }, 'shop_b');
  assert.equal(d.status, 200, d.body);
});

test('PATCH /api/shop: settings con merge profundo', async () => {
  const f = await setup();
  const r1 = await patch(f, 'ownerA', { settings: { booking: { step_min: 15, auto_confirm: false }, hours: { 1: [[540, 840], ['15:00', '20:00']] } } });
  assert.equal(r1.status, 200, r1.body);
  let st = r1.data.shop.settings;
  assert.equal(st.booking.step_min, 15);
  assert.equal(st.booking.lead_min, 0, 'conserva lo guardado antes');
  assert.equal(st.booking.auto_confirm, false);
  assert.equal(st.booking.window_days, DEFAULT_SETTINGS.booking.window_days);
  assert.deepEqual(st.hours[1], [[540, 840], [900, 1200]]);
  assert.deepEqual(st.hours[2], [[600, 1200]], 'los demás días no cambian');
  const r2 = await patch(f, 'ownerA', { settings: { whatsapp: { templates: { reminder: 'Hola {cliente}, te esperamos {fecha}' }, country_code: '+52' }, public: { instagram: '@alfa.barber', rating: 4.87, reviews_count: '120' } } });
  assert.equal(r2.status, 200, r2.body);
  st = r2.data.shop.settings;
  assert.equal(st.booking.step_min, 15);
  assert.equal(st.whatsapp.templates.reminder, 'Hola {cliente}, te esperamos {fecha}');
  assert.equal(st.whatsapp.templates.confirmation, DEFAULT_TEMPLATES.confirmation);
  assert.equal(st.whatsapp.country_code, '52');
  assert.equal(st.public.instagram, 'https://instagram.com/alfa.barber');
  assert.equal(st.public.rating, 4.9);
  assert.equal(st.public.reviews_count, 120);
  // Plantilla vacía = volver al texto original. Día vacío = cerrado.
  const r3 = await patch(f, 'ownerA', { settings: { whatsapp: { templates: { reminder: '' } }, hours: { 1: [] }, payments: { methods: ['transfer', 'cash', 'cash'] }, notify_email: 'Avisos@Alfa.mx', basura: { x: 1 } } });
  assert.equal(r3.status, 200, r3.body);
  st = r3.data.shop.settings;
  assert.equal(st.whatsapp.templates.reminder, DEFAULT_TEMPLATES.reminder);
  assert.deepEqual(st.hours[1], []);
  assert.deepEqual(st.payments.methods, ['cash', 'transfer']);
  assert.equal(st.notify_email, 'avisos@alfa.mx');
  const raw = (await f.db.findOne('shops', { id: 'shop_a' })).settings;
  assert.equal(raw.basura, undefined, 'claves desconocidas no se guardan');
  assert.equal(raw.booking.step_min, 15);
});

test('PATCH /api/shop: validación estricta de settings', async () => {
  const f = await setup();
  const cases = [
    [{ hours: { 1: [[600, 900], [800, 1000]] } }, 'settings.hours.1'],
    [{ hours: { 2: [[900, 600]] } }, 'settings.hours.2'],
    [{ hours: { 3: [[-10, 600]] } }, 'settings.hours.3'],
    [{ hours: { 4: [[600, 1500]] } }, 'settings.hours.4'],
    [{ hours: { 5: [[600]] } }, 'settings.hours.5'],
    [{ hours: { 6: 'todo el día' } }, 'settings.hours.6'],
    [{ hours: { 7: [[600, 900]] } }, 'settings.hours'],
    [{ hours: [] }, 'settings.hours'],
    [{ booking: { step_min: 3 } }, 'settings.booking.step_min'],
    [{ booking: { step_min: 12.5 } }, 'settings.booking.step_min'],
    [{ booking: { lead_min: 3000 } }, 'settings.booking.lead_min'],
    [{ booking: { window_days: 0 } }, 'settings.booking.window_days'],
    [{ booking: { window_days: 181 } }, 'settings.booking.window_days'],
    [{ booking: { buffer_min: 121 } }, 'settings.booking.buffer_min'],
    [{ booking: { cancel_hours: 169 } }, 'settings.booking.cancel_hours'],
    [{ booking: { auto_confirm: 'quizá' } }, 'settings.booking.auto_confirm'],
    [{ booking: 5 }, 'settings.booking'],
    [{ whatsapp: { mode: 'robot' } }, 'settings.whatsapp.mode'],
    [{ whatsapp: { country_code: '52a' } }, 'settings.whatsapp.country_code'],
    [{ whatsapp: { reminder_hours: 0 } }, 'settings.whatsapp.reminder_hours'],
    [{ whatsapp: { reminder_hours: 73 } }, 'settings.whatsapp.reminder_hours'],
    [{ whatsapp: { templates: { reminder: 'x'.repeat(1001) } } }, 'settings.whatsapp.templates.reminder'],
    [{ whatsapp: { templates: { thanks: 42 } } }, 'settings.whatsapp.templates.thanks'],
    [{ payments: { methods: [] } }, 'settings.payments.methods'],
    [{ payments: { methods: ['cash', 'bitcoin'] } }, 'settings.payments.methods'],
    [{ payments: { tips: 'si' } }, 'settings.payments.tips'],
    [{ public: { rating: 6 } }, 'settings.public.rating'],
    [{ public: { reviews_count: 2.5 } }, 'settings.public.reviews_count'],
    [{ public: { review_url: 'javascript:alert(1)' } }, 'settings.public.review_url'],
    [{ public: { instagram: 'mi usuario con espacios' } }, 'settings.public.instagram'],
    [{ public: { policies: 'x'.repeat(501) } }, 'settings.public.policies'],
    [{ public: { gallery: ['https://ok.mx/a.jpg', 'javascript:1'] } }, 'settings.public.gallery.1'],
    [{ public: { gallery: new Array(13).fill('https://ok.mx/a.jpg') } }, 'settings.public.gallery'],
    [{ public: { gallery: ['data:image/png;base64,iVBORw0KGgo='] } }, 'settings.public.gallery.0'],
    [{ notify_email: 'no' }, 'settings.notify_email']
  ];
  for (const [settings, field] of cases) {
    const r = await patch(f, 'ownerA', { settings });
    assert.equal(r.status, 400, JSON.stringify(settings) + ' → ' + r.body);
    assert.ok(r.error.fields && r.error.fields[field], JSON.stringify(settings) + ' esperaba fields.' + field + ': ' + r.body);
  }
  const saved = (await f.db.findOne('shops', { id: 'shop_a' })).settings;
  assert.deepEqual(saved.booking, { lead_min: 0 }, 'nada inválido se guardó');
});
