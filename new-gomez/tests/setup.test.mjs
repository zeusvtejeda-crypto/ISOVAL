// Primer arranque: GET /api/setup/status y POST /api/setup (superadmin + NEW GOMEZ + demo opcional).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDb, scopedDb } from '../core/db.js';
import { handle } from '../core/router.js';
import { hashSecret } from '../core/crypto.js';
import { newId, nowIso } from '../core/util.js';
import { createNewGomez, NEW_GOMEZ_HOURS, NEW_GOMEZ_SERVICES } from '../core/api/setup.js';

const KEY = 'llave-secreta-de-prueba-123';
const GOOD = { key: KEY, email: 'Zeus@TuBarberia.mx ', password: 'superseguro1', name: 'Zeus', pins: { angel: '1234', alexis: '5678' } };

function fresh(envExtra, dbOverride) {
  const db = dbOverride || memoryDb();
  const env = Object.assign({ MODE: 'demo', DEFAULT_SHOP_SLUG: 'new-gomez', SETUP_KEY: KEY }, envExtra || {});
  const tokens = {};
  async function call(method, path, opts) {
    opts = opts || {};
    const [p, qs] = path.split('?');
    const headers = {};
    const tk = opts.as ? tokens[opts.as] : opts.token;
    if (tk) headers.authorization = 'Bearer ' + tk;
    if (opts.shop) headers['x-shop-id'] = opts.shop;
    const res = await handle({ method, path: p, query: Object.fromEntries(new URLSearchParams(qs || '')), body: opts.body, headers, ip: opts.ip || '2.2.2.2' }, { db, env });
    const json = JSON.parse(res.body);
    return { status: res.status, json, data: json.data, error: json.error };
  }
  async function login(as, email, password) {
    const r = await call('POST', '/api/auth/login', { body: { email, password } });
    assert.equal(r.status, 200, 'login ' + email + ': ' + JSON.stringify(r.error));
    tokens[as] = r.data.token;
    return r.data;
  }
  async function pin(as, pinCode) {
    const r = await call('POST', '/api/auth/pin', { body: { shop_slug: 'new-gomez', pin: pinCode } });
    assert.equal(r.status, 200, 'pin ' + pinCode + ': ' + JSON.stringify(r.error));
    tokens[as] = r.data.token;
    return r.data;
  }
  return { db, env, call, login, pin, tokens };
}
async function counts(db) {
  return { users: await db.count('users'), shops: await db.count('shops'), staff: await db.count('staff'), services: await db.count('services') };
}

test('setup/status: base vacía, llave configurada o no', async () => {
  let f = fresh();
  let r = await f.call('GET', '/api/setup/status');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { needs_setup: true, has_setup_key: true, has_demo: false });
  f = fresh({ SETUP_KEY: '' });
  r = await f.call('GET', '/api/setup/status');
  assert.deepEqual(r.data, { needs_setup: true, has_setup_key: false, has_demo: false });
});

test('setup: sin SETUP_KEY en el servidor o con llave incorrecta → 403 y no crea nada; límite de intentos', async () => {
  let f = fresh({ SETUP_KEY: undefined });
  let r = await f.call('POST', '/api/setup', { body: GOOD });
  assert.equal(r.status, 403);
  assert.match(r.error.message, /SETUP_KEY/);
  f = fresh();
  for (const key of [undefined, '', 'otra', KEY + ' ', 12345, { k: KEY }, [KEY], 'x'.repeat(600)]) {
    r = await f.call('POST', '/api/setup', { body: Object.assign({}, GOOD, { key }), ip: '3.3.3.' + String(key).length });
    assert.equal(r.status, 403, 'llave ' + JSON.stringify(key));
    assert.equal(r.error.message, 'La llave de configuración no es correcta.');
  }
  assert.deepEqual(await counts(f.db), { users: 0, shops: 0, staff: 0, services: 0 });
  // 10 fallos desde la misma IP → bloqueo (ni la llave correcta pasa mientras dure)
  for (let i = 0; i < 10; i++) assert.equal((await f.call('POST', '/api/setup', { body: Object.assign({}, GOOD, { key: 'mala' + i }), ip: '4.4.4.4' })).status, 403);
  r = await f.call('POST', '/api/setup', { body: GOOD, ip: '4.4.4.4' });
  assert.equal(r.status, 429);
  assert.equal((await f.call('GET', '/api/setup/status')).data.needs_setup, true);
  // Otra IP sí puede
  assert.equal((await f.call('POST', '/api/setup', { body: GOOD, ip: '5.5.5.5' })).status, 200);
});

test('setup: validación por campo (correo, contraseña, nombre, PIN, demo) sin crear nada', async () => {
  const f = fresh();
  const cases = [
    [{ email: 'no-es-correo' }, 'email'], [{ email: '' }, 'email'], [{ password: 'corta' }, 'password'], [{ password: 12345678 }, 'password'],
    [{ password: 'x'.repeat(200) }, 'password'], [{ name: 'Z' }, 'name'], [{ name: 'x'.repeat(121) }, 'name'],
    [{ pins: { angel: '12' } }, 'pins.angel'], [{ pins: { alexis: 'abcd' } }, 'pins.alexis'], [{ pins: { angel: '1234567' } }, 'pins.angel'],
    [{ pins: { angel: '1111', alexis: '1111' } }, 'pins.alexis'], [{ pins: '1234' }, 'pins'], [{ pins: ['1234'] }, 'pins'],
    [{ demo: 'si' }, 'demo']
  ];
  for (const [patch, field] of cases) {
    const r = await f.call('POST', '/api/setup', { body: Object.assign({}, GOOD, patch) });
    assert.equal(r.status, 400, JSON.stringify(patch));
    assert.equal(r.error.code, 'bad_request');
    assert.ok(r.error.fields && r.error.fields[field], JSON.stringify(patch) + ' → ' + JSON.stringify(r.error.fields));
  }
  // Varios errores a la vez: todos en fields
  const r = await f.call('POST', '/api/setup', { body: { key: KEY, email: 'x', password: '1' } });
  assert.ok(r.error.fields.email && r.error.fields.password);
  assert.deepEqual(await counts(f.db), { users: 0, shops: 0, staff: 0, services: 0 });
});

test('setup: crea superadmin y NEW GOMEZ con sus datos, 10 servicios, horario y equipo; es idempotente', async () => {
  const f = fresh();
  const r = await f.call('POST', '/api/setup', { body: GOOD });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  const d = r.data;
  assert.equal(d.setup, true);
  assert.equal(d.user.email, 'zeus@tubarberia.mx');
  assert.equal(d.user.is_superadmin, true);
  assert.equal(d.shop.slug, 'new-gomez');
  assert.equal(d.shop_created, true);
  assert.equal(d.services, 10);
  assert.equal(d.demo, null);
  assert.deepEqual(d.staff.map((s) => [s.name, s.role, s.has_pin]), [['Angel', 'owner', true], ['Alexis', 'barber', true]]);

  const u = await f.db.findOne('users', { email: 'zeus@tubarberia.mx' });
  assert.equal(u.is_superadmin, true);
  assert.ok(u.password_hash && !u.password_hash.includes('superseguro1'));
  const shop = await f.db.findOne('shops', { slug: 'new-gomez' });
  assert.equal(shop.name, 'NEW GOMEZ');
  assert.equal(shop.tagline, 'Barbería en Tepic · Cortes, barba y tinte');
  assert.equal(shop.phone, '3111585540');
  assert.equal(shop.address, 'Tuxpan 45, Col. Morelos, 63160 Tepic, Nayarit');
  assert.equal(shop.city, 'Tepic');
  assert.equal(shop.timezone, 'America/Mazatlan');
  assert.equal(shop.domain, 'gomez.tubarberia.mx');
  assert.equal(shop.logo_url, '/img/logo.jpg');
  assert.equal(shop.status, 'active');
  assert.match(shop.maps_url, /^https:\/\/www\.google\.com\/maps/);
  assert.deepEqual(shop.settings.hours, NEW_GOMEZ_HOURS);
  const pub = shop.settings.public;
  assert.equal(pub.rating, 5);
  assert.equal(pub.reviews_count, 145);
  assert.match(pub.review_url, /ludocid=16017407076252956381#lrd=/);
  assert.equal(pub.instagram, 'https://www.instagram.com/angel_newgomez');
  assert.match(pub.fresha, /^https:\/\/www\.fresha\.com\//);

  const sdb = scopedDb(f.db, shop.id);
  const svcs = await sdb.find('services', {}, { order: 'sort asc' });
  assert.equal(svcs.length, 10);
  assert.deepEqual(svcs.map((s) => [s.name, s.duration_min, s.price, s.popular]), NEW_GOMEZ_SERVICES.map((s) => [s.name, s.duration_min, s.price, s.popular]));
  assert.deepEqual(svcs.slice(0, 2).map((s) => s.name), ['Corte de pelo', 'Corte de pelo y barba']);
  assert.ok(svcs.every((s) => s.active && s.description && s.description.length > 5 && s.category));
  assert.equal(svcs.find((s) => s.name === 'Limpieza de contornos').description, 'Delineado con máquina, navaja y gel.');
  assert.equal(svcs.find((s) => s.name === 'Corte, barba y tinte').price, 540);

  const staff = await sdb.find('staff', {}, { order: 'sort asc' });
  const [angel, alexis] = staff;
  assert.equal(angel.role, 'owner');
  assert.equal(angel.avatar_url, '/img/angel.jpg');
  assert.equal(angel.commission_pct, 0);
  assert.equal(alexis.role, 'barber');
  assert.equal(alexis.avatar_url, '/img/alexis.jpg');
  assert.equal(alexis.commission_pct, 50);
  assert.ok(staff.every((s) => s.active && s.bookable && !s.user_id && s.pin_hash && !s.pin_hash.includes('1234')));
  for (const s of staff) {
    const av = await sdb.find('availability', { staff_id: s.id });
    assert.equal(av.length, 11, 'lun–vie 2 bloques + sábado 1');
    for (let wd = 0; wd <= 6; wd++) {
      assert.deepEqual(av.filter((a) => a.weekday === wd).map((a) => [a.start_min, a.end_min]).sort((a, b) => a[0] - b[0]), NEW_GOMEZ_HOURS[wd]);
    }
  }
  // Aviso de bienvenida al dueño
  assert.equal(await sdb.count('notifications', { staff_id: angel.id }), 1);

  // Idempotente: segundo intento → 409 y nada cambia
  const before = await counts(f.db);
  for (const body of [GOOD, Object.assign({}, GOOD, { email: 'otro@x.mx' }), { key: KEY }]) {
    const again = await f.call('POST', '/api/setup', { body });
    assert.equal(again.status, 409);
    assert.equal(again.error.code, 'already_setup');
  }
  assert.deepEqual(await counts(f.db), before);
  assert.equal((await f.call('GET', '/api/setup/status')).data.needs_setup, false);
  // Llave incorrecta sigue dando 403 aunque ya esté configurado (no revela el estado)
  assert.equal((await f.call('POST', '/api/setup', { body: Object.assign({}, GOOD, { key: 'mala' }) })).status, 403);
});

test('setup: el superadmin entra a new-gomez con x-shop-id; PIN de Angel (dueño) y Alexis (barbero); reserva pública', async () => {
  const f = fresh();
  const shopId = (await f.call('POST', '/api/setup', { body: GOOD })).data.shop.id;
  const me = await f.login('super', 'zeus@tubarberia.mx', 'superseguro1');
  assert.equal(me.user.is_superadmin, true);
  assert.deepEqual(me.contexts, [], 'el superadmin no es dueño: entra por ser superadmin');
  let r = await f.call('GET', '/api/context', { as: 'super', shop: shopId });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.role, 'superadmin');
  assert.equal(r.data.shop.slug, 'new-gomez');
  r = await f.call('GET', '/api/services', { as: 'super', shop: shopId });
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 10);
  r = await f.call('GET', '/api/staff', { as: 'super', shop: shopId });
  assert.deepEqual(r.data.map((s) => s.name), ['Angel', 'Alexis']);
  assert.ok(r.data.every((s) => s.pin_hash === undefined && s.has_pin === true));
  // Sin barbería elegida → 400; barbería inexistente → 403
  assert.equal((await f.call('GET', '/api/services', { as: 'super' })).status, 400);
  assert.equal((await f.call('GET', '/api/services', { as: 'super', shop: 'sh_no_existe' })).status, 403);
  // Plataforma
  r = await f.call('GET', '/api/admin/shops', { as: 'super' });
  assert.equal(r.status, 200);
  assert.ok(r.data.some((s) => s.slug === 'new-gomez'));

  const angel = await f.pin('angel', '1234');
  assert.equal(angel.contexts[0].role, 'owner');
  assert.equal(angel.contexts[0].shop_id, shopId);
  const alexis = await f.pin('alexis', '5678');
  assert.equal(alexis.contexts[0].role, 'barber');
  assert.equal((await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'new-gomez', pin: '9999' } })).status, 401);
  // Permisos: el barbero no administra servicios; el dueño sí
  assert.equal((await f.call('POST', '/api/services', { as: 'alexis', shop: shopId, body: { name: 'Tinte', duration_min: 30, price: 200 } })).status, 403);
  assert.equal((await f.call('POST', '/api/services', { as: 'angel', shop: shopId, body: { name: 'Tinte', duration_min: 30, price: 200 } })).status, 200);
  // Ninguno llega a la plataforma
  for (const as of ['angel', 'alexis']) assert.equal((await f.call('GET', '/api/admin/shops', { as })).status, 403);

  // Página pública: predeterminada (DEFAULT_SHOP_SLUG) y por slug
  r = await f.call('GET', '/api/public/home');
  assert.equal(r.status, 200);
  assert.equal(r.data.shop.slug, 'new-gomez');
  r = await f.call('GET', '/api/public/shops/new-gomez');
  assert.equal(r.data.shop.public.reviews_count, 145);
  assert.equal(r.data.services.length, 11);
  assert.deepEqual(r.data.staff.map((s) => s.name), ['Angel', 'Alexis']);
});

test('setup: otra barbería no puede entrar a NEW GOMEZ (ni adivinando su id)', async () => {
  const f = fresh();
  const shopId = (await f.call('POST', '/api/setup', { body: GOOD })).data.shop.id;
  // Barbería ajena con su dueño
  const now = nowIso();
  await f.db.insert('shops', { id: 'sh_otra', slug: 'otra', name: 'Otra', timezone: 'America/Mexico_City', created_at: now });
  await f.db.insert('users', { id: 'us_otro', email: 'otro@x.mx', name: 'Otro', password_hash: await hashSecret('clave1234', 1000), created_at: now });
  await f.db.insert('staff', { id: 'st_otro', shop_id: 'sh_otra', user_id: 'us_otro', name: 'Otro', role: 'owner', created_at: now });
  await f.login('otro', 'otro@x.mx', 'clave1234');
  for (const [m, p] of [['GET', '/api/context'], ['GET', '/api/services'], ['GET', '/api/staff'], ['GET', '/api/appointments']]) {
    assert.equal((await f.call(m, p, { as: 'otro', shop: shopId })).status, 403, p);
  }
  const ng = await f.db.findOne('shops', { slug: 'new-gomez' });
  const svc = (await scopedDb(f.db, ng.id).find('services'))[0];
  let r = await f.call('PATCH', '/api/services/' + svc.id, { as: 'otro', shop: 'sh_otra', body: { price: 1 } });
  assert.equal(r.status, 404);
  assert.equal((await f.db.findOne('services', { id: svc.id })).price, svc.price);
  r = await f.call('GET', '/api/services', { as: 'otro', shop: 'sh_otra' });
  assert.deepEqual(r.data, []);
  // El PIN de Angel no sirve en otra barbería
  assert.equal((await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'otra', pin: '1234' } })).status, 401);
});

test('setup: si falla crear NEW GOMEZ no queda nada a medias (se puede reintentar)', async () => {
  const mem = memoryDb();
  let broken = true;
  const db = Object.assign({}, mem, { insertMany: async (t, rows) => { if (broken && t === 'services') throw new Error('falla simulada'); return mem.insertMany(t, rows); } });
  const f = fresh({}, db);
  const origError = console.error;
  console.error = () => {};
  try { assert.equal((await f.call('POST', '/api/setup', { body: GOOD })).status, 500); } finally { console.error = origError; }
  assert.deepEqual(await counts(mem), { users: 0, shops: 0, staff: 0, services: 0 });
  assert.equal(await mem.count('availability'), 0);
  assert.equal(await mem.count('notifications'), 0);
  broken = false;
  assert.equal((await f.call('POST', '/api/setup', { body: GOOD })).status, 200);
  assert.equal(await mem.count('services'), 10);
});

test('createNewGomez: reutilizable e idempotente; sin PIN; dominio ocupado → sin dominio', async () => {
  const db = memoryDb();
  await db.insert('shops', { id: 'sh_x', slug: 'x', name: 'X', domain: 'gomez.tubarberia.mx', created_at: nowIso() });
  const a = await createNewGomez(db);
  assert.equal(a.created, true);
  assert.equal(a.shop.domain, null);
  assert.ok(a.staff.every((s) => s.pin_hash === null));
  const b = await createNewGomez(db, { pins: { angel: '4321' } });
  assert.equal(b.created, false);
  assert.equal(b.shop.id, a.shop.id);
  assert.equal(b.services.length, 10);
  assert.equal(await db.count('services'), 10);
  assert.equal(await db.count('staff'), 2);
  assert.ok((await db.find('staff')).every((s) => s.pin_hash === null), 'no toca una barbería existente');
});

// ── Demo (core/seed-demo.js lo implementa otro módulo; aquí se prueba la integración) ──
test('setup demo: carga la demo sin superadmin público, la aísla de NEW GOMEZ y no se duplica', async () => {
  const f = fresh();
  const setup = await f.call('POST', '/api/setup', { body: GOOD });
  const ngId = setup.data.shop.id;
  const r = await f.call('POST', '/api/setup', { body: { key: KEY, demo: true } });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.setup, false);
  const demo = r.data.demo;
  assert.ok(demo, 'respuesta con demo');
  if (!demo.ok) {
    // La siembra falló (módulo en construcción): el error vuelve capturado y no queda nada a medias.
    assert.match(demo.error, /demo/i);
    assert.equal(await f.db.findOne('shops', { slug: 'demo' }), null);
    return;
  }
  assert.equal(demo.shop.slug, 'demo');
  assert.equal(demo.credentials.superadmin, undefined);
  assert.equal(demo.credentials.owner.email, 'dueno@demo.mx');
  // Un solo superadmin en toda la plataforma: el del setup
  const supers = await f.db.find('users', { is_superadmin: true });
  assert.deepEqual(supers.map((u) => u.email), ['zeus@tubarberia.mx']);
  assert.equal(await f.db.findOne('users', { email: 'admin@demo.mx', status: 'active' }), null);
  // El dueño demo entra a la demo, pero no a NEW GOMEZ
  const owner = await f.login('demoOwner', demo.credentials.owner.email, demo.credentials.owner.password);
  const ctxDemo = owner.contexts.find((c) => c.shop_slug === 'demo');
  assert.ok(ctxDemo && ctxDemo.role === 'owner');
  assert.equal((await f.call('GET', '/api/context', { as: 'demoOwner', shop: ctxDemo.shop_id })).status, 200);
  assert.equal((await f.call('GET', '/api/context', { as: 'demoOwner', shop: ngId })).status, 403);
  assert.equal((await f.call('GET', '/api/admin/shops', { as: 'demoOwner' })).status, 403);
  assert.equal((await f.call('GET', '/api/setup/status')).data.has_demo, true);
  // Segunda vez → 409
  const again = await f.call('POST', '/api/setup', { body: { key: KEY, demo: true } });
  assert.equal(again.status, 409);
  assert.equal(again.error.code, 'already_setup');
});

test('setup demo: en el primer arranque junto con NEW GOMEZ; un fallo de la siembra no rompe el setup', async () => {
  const f = fresh();
  // Un usuario con el correo del dueño demo hace fallar la siembra a la mitad.
  const r0 = await f.call('POST', '/api/setup', { body: Object.assign({}, GOOD, { demo: true }) });
  assert.equal(r0.status, 200, JSON.stringify(r0.error));
  assert.equal(r0.data.setup, true);
  assert.ok(r0.data.demo);
  assert.equal(r0.data.demo.ok, !!(await f.db.findOne('shops', { slug: 'demo' })));

  const g = fresh();
  await g.db.insert('users', { id: newId('us'), email: 'dueno@demo.mx', name: 'Ya existía', password_hash: null, created_at: nowIso() });
  const origError = console.error;
  console.error = () => {};
  let r;
  try { r = await g.call('POST', '/api/setup', { body: { key: KEY, demo: true } }); } finally { console.error = origError; }
  assert.equal(r.status, 200);
  assert.equal(r.data.demo.ok, false);
  assert.match(r.data.demo.error, /^No se pudo cargar la demo/);
  assert.equal(await g.db.findOne('shops', { slug: 'demo' }), null, 'la demo a medias se limpió');
  assert.equal(await g.db.count('staff'), 0);
  assert.equal(await g.db.count('appointments'), 0);
  assert.equal((await g.db.findOne('users', { email: 'dueno@demo.mx' })).name, 'Ya existía', 'no toca usuarios previos');
  assert.equal(await g.db.count('users', { is_superadmin: true }), 0);
});
