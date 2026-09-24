import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture, PW } from './helpers.mjs';
import { listRoutes } from '../core/router.js';
import { scopedDb } from '../core/db.js';
import { addDays, nowInTz, newId } from '../core/util.js';

// Ruta GET de barbería (auth 'shop') que un dueño puede usar; la implementan otros módulos.
function shopRoute() {
  const rows = listRoutes().filter((r) => r.startsWith('GET ') && r.includes('[shop') && !r.includes(':') && !r.includes('my.appointments'));
  const row = rows.find((r) => r.startsWith('GET /api/context ')) || rows[0];
  return row ? row.split(/\s+/)[1] : null;
}
async function withSuper() {
  const f = await makeFixture();
  await f.login('super', 'super@t.mx');
  return f;
}
const today = () => nowInTz('America/Mexico_City').date;
async function addAppt(db, shop_id, date, status) {
  return scopedDb(db, shop_id).insert('appointments', {
    id: newId('ap'), folio: 'TB-' + newId().slice(-6), staff_id: 'st_x', date, start_min: 600, end_min: 640, duration_min: 40,
    services: [], total: 200, status, created_at: new Date().toISOString()
  });
}
async function addPay(db, shop_id, date, amount, status) {
  return scopedDb(db, shop_id).insert('payments', { id: newId('pm'), amount, tip: 10, method: 'cash', status: status || 'paid', date, created_at: new Date().toISOString() });
}

test('admin: solo superadmin (dueño, barbero, cliente, PIN → 403; sin sesión → 401)', async () => {
  const f = await makeFixture();
  await f.login('ownerA', 'owner.a@t.mx');
  await f.login('barberA', 'barber.a@t.mx');
  await f.login('clientA', 'client.a@t.mx');
  const pin = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } });
  f.tokens.pin = pin.data.token;
  const paths = [['GET', '/api/admin/stats'], ['GET', '/api/admin/shops'], ['POST', '/api/admin/shops'], ['PATCH', '/api/admin/shops/shop_a'], ['GET', '/api/admin/users'], ['PATCH', '/api/admin/users/u_ownerA']];
  for (const [m, p] of paths) {
    for (const as of ['ownerA', 'barberA', 'clientA', 'pin']) {
      const r = await f.call(m, p, { as, body: { status: 'suspended', name: 'X' } });
      assert.equal(r.status, 403, as + ' ' + m + ' ' + p);
    }
    assert.equal((await f.call(m, p, { body: {} })).status, 401, 'anon ' + p);
  }
  // Ningún intento cambió nada.
  assert.equal((await f.db.findOne('shops', { id: 'shop_a' })).status, 'active');
  // Ni con x-shop-id de su barbería el dueño obtiene rol de plataforma.
  assert.equal((await f.call('GET', '/api/admin/stats', { as: 'ownerA', shop: 'shop_a' })).status, 403);
});

test('admin/stats: conteos, citas e ingresos de 30 días y top de barberías', async () => {
  const f = await withSuper();
  const t = today();
  await addAppt(f.db, 'shop_a', t, 'completed');
  await addAppt(f.db, 'shop_a', addDays(t, -10), 'confirmed');
  await addAppt(f.db, 'shop_a', addDays(t, -5), 'cancelled');   // no cuenta
  await addAppt(f.db, 'shop_a', addDays(t, -40), 'completed');  // fuera de rango
  await addAppt(f.db, 'shop_b', addDays(t, -1), 'no_show');
  await addPay(f.db, 'shop_a', t, 200);
  await addPay(f.db, 'shop_a', addDays(t, -3), 150.5);
  await addPay(f.db, 'shop_a', addDays(t, -3), 999, 'refunded'); // no cuenta
  await addPay(f.db, 'shop_b', addDays(t, -60), 500);            // fuera de rango
  await addPay(f.db, 'shop_b', addDays(t, -2), 100);
  await f.db.update('shops', { id: 'shop_b' }, { status: 'suspended' });
  const r = await f.call('GET', '/api/admin/stats', { as: 'super' });
  assert.equal(r.status, 200);
  const d = r.data;
  assert.equal(d.shops, 2);
  assert.equal(d.active_shops, 1);
  assert.equal(d.suspended_shops, 1);
  assert.equal(d.users, 5);
  assert.equal(d.appointments_30d, 3);
  assert.equal(d.revenue_30d, 450.5);
  assert.deepEqual(d.top_shops.map((s) => [s.id, s.appointments_30d, s.revenue_30d]), [['shop_a', 2, 350.5], ['shop_b', 1, 100]]);
  assert.equal(d.range.to, t);
  assert.equal(d.range.from, addDays(t, -29));
});

test('admin/shops: lista con dueño, equipo, clientes y métricas; búsqueda por nombre, slug y correo del dueño', async () => {
  const f = await withSuper();
  await addAppt(f.db, 'shop_b', today(), 'confirmed');
  await addPay(f.db, 'shop_b', today(), 80);
  const all = await f.call('GET', '/api/admin/shops', { as: 'super' });
  assert.equal(all.status, 200);
  assert.equal(all.data.length, 2);
  const a = all.data.find((s) => s.id === 'shop_a');
  assert.equal(a.owner_email, 'owner.a@t.mx');
  assert.equal(a.staff_count, 3);
  assert.equal(a.clients_count, 1);
  assert.equal(a.appointments_30d, 0);
  assert.equal(a.revenue_30d, 0);
  assert.equal(a.slug, 'alfa');
  const b = all.data.find((s) => s.id === 'shop_b');
  assert.equal(b.appointments_30d, 1);
  assert.equal(b.revenue_30d, 80);
  const q1 = await f.call('GET', '/api/admin/shops?q=ALFA', { as: 'super' });
  assert.deepEqual(q1.data.map((s) => s.id), ['shop_a']);
  const q2 = await f.call('GET', '/api/admin/shops?q=owner.b', { as: 'super' });
  assert.deepEqual(q2.data.map((s) => s.id), ['shop_b']);
  const q3 = await f.call('GET', '/api/admin/shops?q=zzzz', { as: 'super' });
  assert.deepEqual(q3.data, []);
  // Paginado: limit/offset y total en x-total-count.
  const p1 = await f.call('GET', '/api/admin/shops?limit=1', { as: 'super' });
  const p2 = await f.call('GET', '/api/admin/shops?limit=1&offset=1', { as: 'super' });
  assert.equal(p1.data.length, 1);
  assert.equal(p1.headers['x-total-count'], '2');
  assert.notEqual(p1.data[0].id, p2.data[0].id);
  // Un término enorme o con comodines no rompe la búsqueda.
  const long = await f.call('GET', '/api/admin/shops?q=' + encodeURIComponent('%_' + 'á'.repeat(200)), { as: 'super' });
  assert.equal(long.status, 200);
});

test('admin crea barbería con dueño nuevo: puede entrar y queda con plantilla', async () => {
  const f = await withSuper();
  const r = await f.call('POST', '/api/admin/shops', { as: 'super', body: { name: 'Barber Club', owner_name: 'Rosa Díaz', owner_email: 'Rosa@Club.mx', owner_password: 'rosaclave1', phone: '3117778888', city: 'Guadalajara', plan: 'pro' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.shop.slug, 'barber-club');
  assert.equal(r.data.shop.plan, 'pro');
  assert.equal(r.data.linked_existing, false);
  assert.equal(r.data.owner.email, 'rosa@club.mx');
  const login = await f.call('POST', '/api/auth/login', { body: { email: 'rosa@club.mx', password: 'rosaclave1' } });
  assert.equal(login.status, 200);
  assert.deepEqual(login.data.contexts.map((c) => [c.shop_id, c.role]), [[r.data.shop.id, 'owner']]);
  assert.equal(await scopedDb(f.db, r.data.shop.id).count('services'), 6);
  // Slug explícito.
  const s = await f.call('POST', '/api/admin/shops', { as: 'super', body: { name: 'Otra', slug: 'la-otra', owner_name: 'Leo', owner_email: 'leo@club.mx', owner_password: 'leoclave12' } });
  assert.equal(s.data.shop.slug, 'la-otra');
  assert.equal(s.data.shop.plan, 'basic');
});

test('admin crea barbería para un correo existente: vincula sin cambiar su contraseña', async () => {
  const f = await withSuper();
  const before = (await f.db.findOne('users', { id: 'u_clientA' })).password_hash;
  const r = await f.call('POST', '/api/admin/shops', { as: 'super', body: { name: 'Nueva de Cliente', owner_email: 'client.a@t.mx', owner_password: 'ignorada123' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.linked_existing, true);
  assert.equal(r.data.owner.id, 'u_clientA');
  assert.equal((await f.db.findOne('users', { id: 'u_clientA' })).password_hash, before);
  const login = await f.call('POST', '/api/auth/login', { body: { email: 'client.a@t.mx', password: PW } });
  assert.equal(login.status, 200);
  const roles = Object.fromEntries(login.data.contexts.map((c) => [c.shop_id, c.role]));
  assert.equal(roles.shop_a, 'client');
  assert.equal(roles[r.data.shop.id], 'owner');
  const st = await scopedDb(f.db, r.data.shop.id).find('staff');
  assert.equal(st.length, 1);
  assert.equal(st[0].name, 'clientA'); // sin owner_name usa el nombre de la cuenta
});

test('admin crea barbería: validaciones y conflictos', async () => {
  const f = await withSuper();
  const v = await f.call('POST', '/api/admin/shops', { as: 'super', body: { name: '', owner_email: 'nuevo@x.mx', owner_password: '123', plan: 'gold', phone: '55', slug: 'Con Espacios' } });
  assert.equal(v.status, 400);
  assert.deepEqual(Object.keys(v.error.fields).sort(), ['name', 'owner_name', 'owner_password', 'phone', 'plan', 'slug']);
  const noEmail = await f.call('POST', '/api/admin/shops', { as: 'super', body: { name: 'Sin correo', owner_name: 'Ana', owner_password: 'clave12345' } });
  assert.equal(noEmail.status, 400);
  assert.ok(noEmail.error.fields.owner_email);
  const taken = await f.call('POST', '/api/admin/shops', { as: 'super', body: { name: 'Otra Alfa', slug: 'alfa', owner_name: 'Ana', owner_email: 'ana@x.mx', owner_password: 'clave12345' } });
  assert.equal(taken.status, 409);
  const reserved = await f.call('POST', '/api/admin/shops', { as: 'super', body: { name: 'Adm', slug: 'admin', owner_name: 'Ana', owner_email: 'ana@x.mx', owner_password: 'clave12345' } });
  assert.equal(reserved.status, 400);
  // Ningún intento dejó usuarios ni barberías a medias.
  assert.equal(await f.db.findOne('users', { email: 'ana@x.mx' }), null);
  assert.equal(await f.db.count('shops'), 2);
});

test('admin suspende una barbería: su equipo recibe 403 en rutas de barbería y no entra por PIN; al reactivar vuelve', async () => {
  const f = await withSuper();
  await f.login('ownerA', 'owner.a@t.mx');
  await f.login('ownerB', 'owner.b@t.mx');
  const path = shopRoute();
  if (path) assert.notEqual((await f.call('GET', path, { as: 'ownerA', shop: 'shop_a' })).status, 403);

  const r = await f.call('PATCH', '/api/admin/shops/shop_a', { as: 'super', body: { status: 'suspended' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.shop.status, 'suspended');
  assert.ok(r.data.shop.updated_at);

  const me = await f.call('GET', '/api/auth/me', { as: 'ownerA' });
  assert.equal(me.status, 200);
  assert.equal(me.data.contexts[0].shop_status, 'suspended');
  assert.equal((await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } })).status, 403);
  if (path) {
    const blocked = await f.call('GET', path, { as: 'ownerA', shop: 'shop_a' });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.error.code, 'shop_suspended', 'código propio (el panel no depende del texto)');
    assert.match(blocked.error.message, /suspendida/);
    // La otra barbería sigue funcionando.
    assert.notEqual((await f.call('GET', path, { as: 'ownerB', shop: 'shop_b' })).status, 403);
  }

  const back = await f.call('PATCH', '/api/admin/shops/shop_a', { as: 'super', body: { status: 'active' } });
  assert.equal(back.data.shop.status, 'active');
  assert.equal((await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } })).status, 200);
  if (path) assert.notEqual((await f.call('GET', path, { as: 'ownerA', shop: 'shop_a' })).status, 403);
});

test('admin PATCH barbería: plan, nombre, dominio (normalizado y único) y validaciones', async () => {
  const f = await withSuper();
  const r = await f.call('PATCH', '/api/admin/shops/shop_a', { as: 'super', body: { plan: 'pro', name: ' Alfa Premium ', domain: 'https://Alfa.TuBarberia.mx/reservar' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.shop.plan, 'pro');
  assert.equal(r.data.shop.name, 'Alfa Premium');
  assert.equal(r.data.shop.domain, 'alfa.tubarberia.mx');
  const saved = await f.db.findOne('shops', { id: 'shop_a' });
  assert.equal(saved.domain, 'alfa.tubarberia.mx');
  assert.equal(saved.slug, 'alfa'); // el slug no cambia
  const dup = await f.call('PATCH', '/api/admin/shops/shop_b', { as: 'super', body: { domain: 'alfa.tubarberia.mx' } });
  assert.equal(dup.status, 409);
  const clear = await f.call('PATCH', '/api/admin/shops/shop_a', { as: 'super', body: { domain: '' } });
  assert.equal(clear.data.shop.domain, null);
  const bad = await f.call('PATCH', '/api/admin/shops/shop_a', { as: 'super', body: { status: 'borrada', plan: 'oro', name: 'x', domain: 'no es dominio' } });
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.error.fields).sort(), ['domain', 'name', 'plan', 'status']);
  assert.equal((await f.call('PATCH', '/api/admin/shops/shop_a', { as: 'super', body: {} })).status, 400);
  assert.equal((await f.call('PATCH', '/api/admin/shops/sh_nope', { as: 'super', body: { plan: 'pro' } })).status, 404);
  // shop_id u otros campos no permitidos se ignoran.
  await f.call('PATCH', '/api/admin/shops/shop_a', { as: 'super', body: { plan: 'basic', id: 'shop_b', slug: 'hack', settings: { x: 1 } } });
  const s2 = await f.db.findOne('shops', { id: 'shop_a' });
  assert.equal(s2.slug, 'alfa');
  assert.equal(s2.plan, 'basic');
});

test('admin/users: lista con barberías y roles; búsqueda', async () => {
  const f = await withSuper();
  const r = await f.call('GET', '/api/admin/users', { as: 'super' });
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 5);
  assert.ok(r.data.every((u) => u.password_hash === undefined && u.status));
  const ownerA = r.data.find((u) => u.id === 'u_ownerA');
  assert.deepEqual(ownerA.shops.map((s) => [s.shop_id, s.role]), [['shop_a', 'owner']]);
  const clientA = r.data.find((u) => u.id === 'u_clientA');
  assert.deepEqual(clientA.shops.map((s) => [s.shop_id, s.role]), [['shop_a', 'client']]);
  assert.ok(r.data.find((u) => u.id === 'u_super').is_superadmin);
  const q = await f.call('GET', '/api/admin/users?q=BARBER.A', { as: 'super' });
  assert.deepEqual(q.data.map((u) => u.id), ['u_barberA']);
});

test('admin PATCH usuario: desactivar cierra sus sesiones; no puede desactivarse a sí mismo; restablecer contraseña', async () => {
  const f = await withSuper();
  await f.login('barberA', 'barber.a@t.mx');
  const r = await f.call('PATCH', '/api/admin/users/u_barberA', { as: 'super', body: { status: 'disabled' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.status, 'disabled');
  assert.equal((await f.call('GET', '/api/auth/me', { as: 'barberA' })).status, 401);
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'barber.a@t.mx', password: PW } })).status, 403);
  const self = await f.call('PATCH', '/api/admin/users/u_super', { as: 'super', body: { status: 'disabled' } });
  assert.equal(self.status, 400);
  await f.call('PATCH', '/api/admin/users/u_barberA', { as: 'super', body: { status: 'active', password: 'restablecida1' } });
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'barber.a@t.mx', password: 'restablecida1' } })).status, 200);
  assert.equal((await f.call('PATCH', '/api/admin/users/u_barberA', { as: 'super', body: { password: 'corta' } })).status, 400);
  assert.equal((await f.call('PATCH', '/api/admin/users/u_nope', { as: 'super', body: { status: 'active' } })).status, 404);
  // El superadmin sigue con sesión tras cambiar su propia contraseña.
  await f.call('PATCH', '/api/admin/users/u_super', { as: 'super', body: { password: 'superclave99' } });
  assert.equal((await f.call('GET', '/api/admin/stats', { as: 'super' })).status, 200);
});

test('admin PATCH usuario: desactivar o cambiar la contraseña también cierra las sesiones PIN de su staff', async () => {
  const f = await withSuper();
  const pin = () => f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } });
  const alive = async (tk) => (await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + f.day, { token: tk, shop: 'shop_a' })).status;
  // Desactivar la cuenta.
  const s1 = await pin();
  assert.equal(s1.status, 200, s1.body);
  assert.equal(await alive(s1.data.token), 200);
  assert.equal((await f.call('PATCH', '/api/admin/users/u_barberA', { as: 'super', body: { status: 'disabled' } })).status, 200);
  assert.equal(await alive(s1.data.token), 401);
  assert.equal((await f.call('GET', '/api/auth/me', { token: s1.data.token })).status, 401);
  assert.equal(await f.db.count('sessions', { kind: 'pin', staff_id: 'st_barberA' }), 0);
  // Reactivar y restablecer la contraseña.
  assert.equal((await f.call('PATCH', '/api/admin/users/u_barberA', { as: 'super', body: { status: 'active' } })).status, 200);
  const s2 = await pin();
  assert.equal(s2.status, 200, s2.body);
  const other = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'beta', pin: '2222' } }); // otra barbería: nada que ver
  assert.equal(other.status, 401);
  assert.equal((await f.call('PATCH', '/api/admin/users/u_barberA', { as: 'super', body: { password: 'restablecida1' } })).status, 200);
  assert.equal(await alive(s2.data.token), 401);
  // La sesión del superadmin que hizo el cambio sigue viva.
  assert.equal((await f.call('GET', '/api/admin/stats', { as: 'super' })).status, 200);
});
