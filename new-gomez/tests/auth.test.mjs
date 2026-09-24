import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture, PW } from './helpers.mjs';
import { handle, listRoutes } from '../core/router.js';
import { scopedDb } from '../core/db.js';
import { hashSecret } from '../core/crypto.js';
import { DEFAULT_HOURS } from '../core/domain/settings.js';
import { createShopWithOwner, uniqueSlug, TEMPLATE_SERVICES } from '../core/api/auth.js';
import { attemptsWhere } from '../core/session.js';

// Ruta GET de barbería (auth 'shop') que un dueño puede usar, para probar acceso/aislamiento a nivel router.
// Las implementan otros módulos; si aún no existe ninguna, esas aserciones se omiten.
function shopRoute() {
  const rows = listRoutes().filter((r) => r.startsWith('GET ') && r.includes('[shop') && !r.includes(':') && !r.includes('my.appointments'));
  const row = rows.find((r) => r.startsWith('GET /api/context ')) || rows[0];
  return row ? row.split(/\s+/)[1] : null;
}
const cookieOf = (res) => [].concat(res.headers['set-cookie'] || []).join('\n');
const tokenFromCookie = (res) => (/tb_sid=([^;]*)/.exec(cookieOf(res)) || [])[1];
// Llamada con cookie (flujo de navegador) en lugar de Bearer.
async function cookieCall(f, method, path, { cookie, body, csrf } = {}) {
  const headers = {};
  if (cookie) headers.cookie = 'tb_sid=' + cookie;
  if (csrf) headers['x-requested-with'] = 'tb';
  const res = await handle({ method, path, query: {}, body, headers, ip: '1.1.1.1' }, { db: f.db, env: f.env });
  return Object.assign({ json: JSON.parse(res.body) }, res);
}
const signupBody = (over) => Object.assign({ shop_name: 'Barbería Nueva', owner_name: 'Paco Nuevo', email: 'paco@nueva.mx', password: 'nuevaclave1', phone: '(311) 123-4567', city: 'Tepic' }, over || {});

// ── Login ──
test('login correcto: usuario, contextos, token (demo) y cookie HttpOnly de 30 días', async () => {
  const f = await makeFixture();
  const r = await f.call('POST', '/api/auth/login', { body: { email: '  OWNER.A@T.MX ', password: PW } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.email, 'owner.a@t.mx');
  assert.equal(r.data.user.password_hash, undefined);
  assert.deepEqual(r.data.contexts.map((c) => [c.shop_id, c.role, c.staff_id]), [['shop_a', 'owner', 'st_ownerA']]);
  assert.ok(r.data.token && r.data.token.length >= 20);
  const ck = cookieOf(r);
  assert.match(ck, /tb_sid=/);
  assert.match(ck, /HttpOnly/);
  assert.match(ck, /Max-Age=2592000/);
  assert.ok((await f.db.findOne('users', { id: 'u_ownerA' })).last_login_at);
  const me = await f.call('GET', '/api/auth/me', { token: r.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.data.session_kind, 'password');
  assert.equal(me.data.user.id, 'u_ownerA');
  assert.equal(me.data.staff, null);
});

test('login incorrecto: mismo mensaje genérico exista o no el correo', async () => {
  const f = await makeFixture();
  const a = await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: 'malamala1' } });
  const b = await f.call('POST', '/api/auth/login', { body: { email: 'nadie@t.mx', password: 'malamala1' } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.error.message, 'Correo o contraseña incorrectos.');
  assert.equal(b.error.message, a.error.message);
  assert.equal(a.data, undefined);
  assert.equal(cookieOf(a), '');
});

test('login valida campos vacíos y formato de correo', async () => {
  const f = await makeFixture();
  const r = await f.call('POST', '/api/auth/login', { body: {} });
  assert.equal(r.status, 400);
  assert.ok(r.error.fields.email && r.error.fields.password);
  const r2 = await f.call('POST', '/api/auth/login', { body: { email: 'no-es-correo', password: 'x' } });
  assert.equal(r2.status, 400);
  assert.ok(r2.error.fields.email);
  const r3 = await f.call('POST', '/api/auth/login', { body: { email: { $ne: 1 }, password: ['x'] } });
  assert.equal(r3.status, 400);
});

test('bloqueo tras 5 fallos por correo (15 min); otro correo desde la misma IP sigue entrando', async () => {
  const f = await makeFixture();
  for (let i = 0; i < 5; i++) {
    const r = await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: 'incorrecta' + i } });
    assert.equal(r.status, 401);
  }
  const locked = await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW } });
  assert.equal(locked.status, 429);
  assert.match(locked.error.message, /Intenta de nuevo en 1[45] min/);
  const other = await f.call('POST', '/api/auth/login', { body: { email: 'barber.a@t.mx', password: PW } });
  assert.equal(other.status, 200);
  // Pasado el bloqueo (los intentos ya tienen más de 15 min), vuelve a entrar y el contador se reinicia.
  assert.equal(await f.db.count('login_attempts', attemptsWhere('pw:owner.a@t.mx')), 5);
  await f.db.update('login_attempts', attemptsWhere('pw:owner.a@t.mx'), { first_at: new Date(Date.now() - 16 * 60000).toISOString() });
  const ok = await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW } });
  assert.equal(ok.status, 200);
  assert.equal(await f.db.count('login_attempts', attemptsWhere('pw:owner.a@t.mx')), 0);
});

test('bloqueo por IP tras 30 fallos con correos distintos; otra IP no se afecta', async () => {
  const f = await makeFixture();
  for (let i = 0; i < 30; i++) {
    const r = await f.call('POST', '/api/auth/login', { body: { email: 'x' + i + '@t.mx', password: 'nada12345' }, ip: '9.9.9.9' });
    assert.equal(r.status, 401);
  }
  const r = await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW }, ip: '9.9.9.9' });
  assert.equal(r.status, 429);
  const r2 = await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW }, ip: '8.8.8.8' });
  assert.equal(r2.status, 200);
});

test('usuario desactivado → 403 solo con la contraseña correcta', async () => {
  const f = await makeFixture();
  await f.db.update('users', { id: 'u_barberA' }, { status: 'disabled' });
  const bad = await f.call('POST', '/api/auth/login', { body: { email: 'barber.a@t.mx', password: 'otraclave1' } });
  assert.equal(bad.status, 401);
  const r = await f.call('POST', '/api/auth/login', { body: { email: 'barber.a@t.mx', password: PW } });
  assert.equal(r.status, 403);
  assert.match(r.error.message, /desactivada/);
});

test('fuera de la demo no se devuelve el token (solo cookie Secure)', async () => {
  const f = await makeFixture();
  f.env.MODE = 'server';
  const r = await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW } });
  assert.equal(r.status, 200);
  assert.equal(r.data.token, undefined);
  assert.match(cookieOf(r), /Secure/);
});

test('flujo con cookie: me funciona, escrituras exigen x-requested-with, logout borra la sesión', async () => {
  const f = await makeFixture();
  const lg = await cookieCall(f, 'POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW } });
  assert.equal(lg.status, 200);
  const tk = tokenFromCookie(lg);
  assert.ok(tk);
  assert.equal((await cookieCall(f, 'GET', '/api/auth/me', { cookie: tk })).status, 200);
  assert.equal((await cookieCall(f, 'POST', '/api/auth/logout', { cookie: tk })).status, 403); // CSRF
  const out = await cookieCall(f, 'POST', '/api/auth/logout', { cookie: tk, csrf: true });
  assert.equal(out.status, 200);
  assert.match(cookieOf(out), /Max-Age=0/);
  assert.equal((await cookieCall(f, 'GET', '/api/auth/me', { cookie: tk })).status, 401);
});

test('iniciar sesión otra vez con cookie reemplaza la sesión anterior del navegador', async () => {
  const f = await makeFixture();
  const a = await cookieCall(f, 'POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW } });
  const tkA = tokenFromCookie(a);
  const b = await cookieCall(f, 'POST', '/api/auth/login', { cookie: tkA, csrf: true, body: { email: 'barber.a@t.mx', password: PW } });
  assert.equal(b.status, 200);
  assert.equal((await cookieCall(f, 'GET', '/api/auth/me', { cookie: tkA })).status, 401);
  const meB = await cookieCall(f, 'GET', '/api/auth/me', { cookie: tokenFromCookie(b) });
  assert.equal(meB.json.data.user.email, 'barber.a@t.mx');
});

// ── Logout / me ──
test('logout invalida el token; logout sin sesión también responde bien', async () => {
  const f = await makeFixture();
  await f.login('ownerA', 'owner.a@t.mx');
  assert.equal((await f.call('GET', '/api/auth/me', { as: 'ownerA' })).status, 200);
  const r = await f.call('POST', '/api/auth/logout', { as: 'ownerA' });
  assert.equal(r.status, 200);
  assert.equal(r.data, null);
  assert.match(cookieOf(r), /Max-Age=0/);
  assert.equal((await f.call('GET', '/api/auth/me', { as: 'ownerA' })).status, 401);
  assert.equal((await f.call('POST', '/api/auth/logout')).status, 200);
});

test('me sin sesión → 401; con token inventado → 401', async () => {
  const f = await makeFixture();
  assert.equal((await f.call('GET', '/api/auth/me')).status, 401);
  assert.equal((await f.call('GET', '/api/auth/me', { token: 'x'.repeat(40) })).status, 401);
});

// ── PIN ──
test('PIN correcto: sesión de barbero fija a su barbería (12 h)', async () => {
  const f = await makeFixture();
  const r = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'ALFA', pin: '2222' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user, null);
  assert.deepEqual(r.data.staff, { id: 'st_barberA', name: 'Barbero A', role: 'barber', shop_id: 'shop_a' });
  assert.equal(r.data.contexts.length, 1);
  assert.equal(r.data.contexts[0].role, 'barber');
  assert.equal(r.data.contexts[0].staff_id, 'st_barberA');
  assert.match(cookieOf(r), /Max-Age=43200/);
  const s = await f.db.findOne('sessions', { staff_id: 'st_barberA' });
  assert.equal(s.kind, 'pin');
  assert.equal(s.shop_id, 'shop_a');
  assert.equal(s.user_id, null);
  const me = await f.call('GET', '/api/auth/me', { token: r.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.data.session_kind, 'pin');
  assert.equal(me.data.user, null);
  assert.equal(me.data.staff.id, 'st_barberA');
  // Una sesión PIN no puede editar perfil ni contraseña de usuario.
  assert.equal((await f.call('PATCH', '/api/auth/profile', { token: r.data.token, body: { name: 'Hack' } })).status, 403);
  assert.equal((await f.call('POST', '/api/auth/password', { token: r.data.token, body: { current: 'x', next: 'yyyyyyyy' } })).status, 403);
});

test('PIN incorrecto, de otra barbería o con formato inválido', async () => {
  const f = await makeFixture();
  const wrong = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '9999' } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.error.message, 'PIN incorrecto.');
  // El PIN 2222 existe en Alfa, pero no sirve en Beta.
  const other = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'beta', pin: '2222' } });
  assert.equal(other.status, 401);
  for (const pin of ['12', '1234567', '12a4', '', null]) {
    const r = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin } });
    assert.equal(r.status, 400, 'pin ' + pin);
    assert.ok(r.error.fields.pin);
  }
  assert.equal((await f.call('POST', '/api/auth/pin', { body: { pin: '2222' } })).status, 400);
  assert.equal((await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'no-existe', pin: '2222' } })).status, 404);
});

test('PIN: staff inactivo no entra; barbería suspendida → 403; sesión PIN muere si desactivan al barbero', async () => {
  const f = await makeFixture();
  const ok = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } });
  await f.db.update('staff', { id: 'st_barberA' }, { active: false });
  assert.equal((await f.call('GET', '/api/auth/me', { token: ok.data.token })).status, 401);
  assert.equal((await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } })).status, 401);
  await f.db.update('staff', { id: 'st_barberA' }, { active: true });
  await f.db.update('shops', { id: 'shop_a' }, { status: 'suspended' });
  const r = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } });
  assert.equal(r.status, 403);
});

test('PIN: 8 fallos por barbería+IP bloquean; otra IP sigue pudiendo', async () => {
  const f = await makeFixture();
  for (let i = 0; i < 8; i++) assert.equal((await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '000' + i } })).status, 401);
  assert.equal((await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } })).status, 429);
  assert.equal((await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' }, ip: '2.2.2.2' })).status, 200);
});

// ── Registro de clientes ──
test('registro sin barbería: cuenta sin contextos y sesión iniciada', async () => {
  const f = await makeFixture();
  const r = await f.call('POST', '/api/auth/register', { body: { name: 'Ana López', email: 'Ana@Correo.MX', password: 'clave1234' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.email, 'ana@correo.mx');
  assert.deepEqual(r.data.contexts, []);
  assert.ok(r.data.token);
  assert.equal((await f.call('GET', '/api/auth/me', { token: r.data.token })).status, 200);
  const login = await f.call('POST', '/api/auth/login', { body: { email: 'ana@correo.mx', password: 'clave1234' } });
  assert.equal(login.status, 200);
});

test('registro con barbería: crea ficha de cliente, contexto cliente y avisa a los dueños', async () => {
  const f = await makeFixture();
  const r = await f.call('POST', '/api/auth/register', { body: { name: 'Beto Ruiz', email: 'beto@correo.mx', password: 'clave1234', phone: '311 555 0001', shop_slug: 'alfa' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.contexts.length, 1);
  const c = r.data.contexts[0];
  assert.equal(c.shop_id, 'shop_a');
  assert.equal(c.role, 'client');
  const cl = await scopedDb(f.db, 'shop_a').findOne('clients', { id: c.client_id });
  assert.equal(cl.user_id, r.data.user.id);
  assert.equal(cl.phone, '3115550001');
  assert.equal(cl.email, 'beto@correo.mx');
  assert.equal(cl.source, 'online');
  const nts = await scopedDb(f.db, 'shop_a').find('notifications', { type: 'client_new' });
  assert.deepEqual(nts.map((n) => n.staff_id), ['st_ownerA']);
  // Nada se creó en la otra barbería.
  assert.equal(await scopedDb(f.db, 'shop_b').count('clients', { email: 'beto@correo.mx' }), 0);
});

test('registro vincula una ficha existente SOLO por correo (sin cuenta), nunca por teléfono', async () => {
  const f = await makeFixture();
  const sdb = scopedDb(f.db, 'shop_a');
  await sdb.insert('clients', { id: 'cl_mail', name: 'Carla', email: 'carla@correo.mx', phone: null, tags: [], created_at: 'x' });
  await sdb.insert('clients', { id: 'cl_phone', name: 'Víctima', email: null, phone: '3119990000', tags: [], created_at: 'x' });
  await sdb.insert('clients', { id: 'cl_taken', name: 'Dani', email: 'dani@correo.mx', user_id: 'u_otro', tags: [], created_at: 'x' });

  const a = await f.call('POST', '/api/auth/register', { body: { name: 'Carla M', email: 'carla@correo.mx', password: 'clave1234', phone: '3111112222', shop_slug: 'alfa' } });
  assert.equal(a.status, 200);
  assert.equal(a.data.contexts[0].client_id, 'cl_mail');
  const carla = await sdb.findOne('clients', { id: 'cl_mail' });
  assert.equal(carla.user_id, a.data.user.id);
  assert.equal(carla.phone, '3111112222');

  const b = await f.call('POST', '/api/auth/register', { body: { name: 'Intruso', email: 'intruso@correo.mx', password: 'clave1234', phone: '3119990000', shop_slug: 'alfa' } });
  assert.equal(b.status, 200);
  assert.notEqual(b.data.contexts[0].client_id, 'cl_phone');
  assert.equal((await sdb.findOne('clients', { id: 'cl_phone' })).user_id, null);

  const c = await f.call('POST', '/api/auth/register', { body: { name: 'Dani 2', email: 'dani@correo.mx', password: 'clave1234', shop_slug: 'alfa' } });
  assert.equal(c.status, 200);
  assert.notEqual(c.data.contexts[0].client_id, 'cl_taken');
  assert.equal((await sdb.findOne('clients', { id: 'cl_taken' })).user_id, 'u_otro');
});

test('registro: validaciones, correo duplicado y barbería inexistente', async () => {
  const f = await makeFixture();
  const r = await f.call('POST', '/api/auth/register', { body: { name: 'A', email: 'malo', password: 'corta', phone: '123' } });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.error.fields).sort(), ['email', 'name', 'password', 'phone']);
  assert.match(r.error.fields.password, /al menos 8/);
  const dup = await f.call('POST', '/api/auth/register', { body: { name: 'Otro', email: 'OWNER.A@t.mx', password: 'clave1234' } });
  assert.equal(dup.status, 409);
  assert.equal(dup.error.code, 'duplicate'); // el panel ofrece "Inicia sesión" con este código
  assert.match(dup.error.message, /inicia sesión/i);
  assert.doesNotMatch(dup.error.message, /Ya existe/);
  const nf = await f.call('POST', '/api/auth/register', { body: { name: 'Eva', email: 'eva@correo.mx', password: 'clave1234', shop_slug: 'zzz' } });
  assert.equal(nf.status, 404);
  assert.equal(await f.db.findOne('users', { email: 'eva@correo.mx' }), null);
});

test('registro: máximo 10 por IP por hora', async () => {
  const f = await makeFixture();
  for (let i = 0; i < 10; i++) {
    const r = await f.call('POST', '/api/auth/register', { body: { name: 'Persona ' + i, email: 'p' + i + '@correo.mx', password: 'clave1234' }, ip: '5.5.5.5' });
    assert.equal(r.status, 200);
  }
  const r = await f.call('POST', '/api/auth/register', { body: { name: 'Once', email: 'once@correo.mx', password: 'clave1234' }, ip: '5.5.5.5' });
  assert.equal(r.status, 429);
});

// ── Alta de barbería (signup) ──
test('signup crea barbería, dueño, staff, servicios de plantilla, horario y bienvenida', async () => {
  const f = await makeFixture();
  const r = await f.call('POST', '/api/auth/signup', { body: signupBody() });
  assert.equal(r.status, 200);
  const { shop, user, contexts, token } = r.data;
  assert.equal(shop.slug, 'barberia-nueva');
  assert.equal(shop.name, 'Barbería Nueva');
  assert.equal(shop.status, 'active');
  assert.equal(shop.timezone, 'America/Mexico_City');
  assert.equal(shop.phone, '3111234567');
  assert.equal(shop.city, 'Tepic');
  assert.deepEqual(shop.settings, {});
  assert.equal(user.email, 'paco@nueva.mx');
  assert.equal(user.is_superadmin, false);
  assert.ok(token);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].shop_id, shop.id);
  assert.equal(contexts[0].role, 'owner');

  const sdb = scopedDb(f.db, shop.id);
  const staff = await sdb.find('staff');
  assert.equal(staff.length, 1);
  assert.equal(staff[0].role, 'owner');
  assert.equal(staff[0].user_id, user.id);
  assert.equal(staff[0].bookable, true);
  assert.equal(staff[0].commission_pct, 0);
  assert.ok(staff[0].color);
  assert.equal(contexts[0].staff_id, staff[0].id);

  const services = await sdb.find('services', {}, { order: 'sort asc' });
  assert.deepEqual(services.map((s) => [s.name, s.duration_min, s.price, s.popular]), [
    ['Corte de cabello', 40, 200, true], ['Corte y barba', 60, 320, true], ['Arreglo de barba', 30, 150, false],
    ['Cejas', 10, 60, false], ['Diseño / líneas', 20, 80, false], ['Corte infantil', 30, 150, false]
  ]);
  assert.ok(services.every((s) => s.active && s.shop_id === shop.id));

  const avail = await sdb.find('availability', { staff_id: staff[0].id });
  const expected = [];
  for (let wd = 0; wd <= 6; wd++) for (const [s, e] of DEFAULT_HOURS[wd]) expected.push([wd, s, e]);
  assert.deepEqual(avail.map((a) => [a.weekday, a.start_min, a.end_min]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), expected);

  const nts = await sdb.find('notifications', {});
  assert.equal(nts.length, 1);
  assert.equal(nts[0].type, 'system');
  assert.equal(nts[0].staff_id, staff[0].id);

  const me = await f.call('GET', '/api/auth/me', { token });
  assert.equal(me.data.contexts[0].shop_id, shop.id);
  // La contraseña quedó con hash y sirve para entrar.
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'paco@nueva.mx', password: 'nuevaclave1' } })).status, 200);
});

test('signup: la barbería nueva queda aislada de las demás', async () => {
  const f = await makeFixture();
  const TABLES = ['staff', 'services', 'availability', 'notifications', 'clients'];
  const snap = async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await f.db.find(t, {}, { order: 'id asc' })])));
  const before = await snap();
  const r = await f.call('POST', '/api/auth/signup', { body: signupBody() });
  const shopId = r.data.shop.id;
  const after = await snap();
  for (const t of TABLES) {
    // Las filas previas quedan intactas y todas las nuevas llevan el shop_id de la barbería nueva.
    const old = after[t].filter((x) => x.shop_id !== shopId);
    assert.deepEqual(old, before[t], t);
    if (t !== 'clients') assert.ok(after[t].some((x) => x.shop_id === shopId), t);
  }
  const ownerA = await f.login('ownerA', 'owner.a@t.mx');
  assert.ok(ownerA.contexts.every((c) => c.shop_id !== shopId));
  assert.ok(r.data.contexts.every((c) => c.shop_id === shopId));
  const path = shopRoute();
  if (path) {
    const intruder = await f.call('GET', path, { token: r.data.token, shop: 'shop_a' });
    assert.equal(intruder.status, 403);
    const ownerIntruder = await f.call('GET', path, { as: 'ownerA', shop: shopId });
    assert.equal(ownerIntruder.status, 403);
  }
});

test('signup: slug único con sufijos y palabras reservadas', async () => {
  const f = await makeFixture();
  const a = await f.call('POST', '/api/auth/signup', { body: signupBody() });
  const b = await f.call('POST', '/api/auth/signup', { body: signupBody({ email: 'otro@nueva.mx' }) });
  const c = await f.call('POST', '/api/auth/signup', { body: signupBody({ email: 'tres@nueva.mx' }) });
  assert.deepEqual([a.data.shop.slug, b.data.shop.slug, c.data.shop.slug], ['barberia-nueva', 'barberia-nueva-2', 'barberia-nueva-3']);
  const d = await f.call('POST', '/api/auth/signup', { body: signupBody({ shop_name: 'Demo', email: 'demo@nueva.mx' }) });
  assert.equal(d.data.shop.slug, 'demo-2');
  const e = await f.call('POST', '/api/auth/signup', { body: signupBody({ shop_name: 'Alfa', email: 'alfa@nueva.mx' }), ip: '7.7.7.7' });
  assert.equal(e.data.shop.slug, 'alfa-2');
});

test('signup: validaciones, correo existente, zona horaria, desactivado y límite por IP', async () => {
  const f = await makeFixture();
  const v = await f.call('POST', '/api/auth/signup', { body: { shop_name: '', owner_name: '', email: 'x', password: '123', phone: '12', timezone: 'Marte/Base' } });
  assert.equal(v.status, 400);
  assert.deepEqual(Object.keys(v.error.fields).sort(), ['email', 'owner_name', 'password', 'phone', 'shop_name', 'timezone']);
  const dup = await f.call('POST', '/api/auth/signup', { body: signupBody({ email: 'owner.b@t.mx' }) });
  assert.equal(dup.status, 409);
  const tz = await f.call('POST', '/api/auth/signup', { body: signupBody({ email: 'tz@nueva.mx', timezone: 'America/Tijuana' }), ip: '3.3.3.3' });
  assert.equal(tz.data.shop.timezone, 'America/Tijuana');

  f.env.ALLOW_SIGNUP = '0';
  const off = await f.call('POST', '/api/auth/signup', { body: signupBody({ email: 'off@nueva.mx' }), ip: '4.4.4.4' });
  assert.equal(off.status, 403);
  assert.equal(await f.db.findOne('users', { email: 'off@nueva.mx' }), null);
  delete f.env.ALLOW_SIGNUP;

  for (let i = 0; i < 5; i++) assert.equal((await f.call('POST', '/api/auth/signup', { body: signupBody({ email: 'lim' + i + '@nueva.mx' }), ip: '6.6.6.6' })).status, 200);
  const lim = await f.call('POST', '/api/auth/signup', { body: signupBody({ email: 'lim9@nueva.mx' }), ip: '6.6.6.6' });
  assert.equal(lim.status, 429);
});

test('createShopWithOwner: reutilizable (usuario existente, slug fijo, sin plantilla)', async () => {
  const f = await makeFixture();
  const r = await createShopWithOwner(f.db, { name: 'Sucursal Norte', slug: 'demo', allow_reserved: true, owner_email: 'owner.a@t.mx', link_existing: true, services: false, welcome: false, plan: 'demo' });
  assert.equal(r.user_created, false);
  assert.equal(r.user.id, 'u_ownerA');
  assert.equal(r.shop.slug, 'demo');
  assert.equal(r.shop.plan, 'demo');
  assert.equal(r.services.length, 0);
  assert.equal(await scopedDb(f.db, r.shop.id).count('notifications'), 0);
  await assert.rejects(createShopWithOwner(f.db, { name: 'X', owner_email: 'owner.b@t.mx', password: 'clave1234' }), (e) => e.status === 409);
  await assert.rejects(createShopWithOwner(f.db, { name: 'X', slug: 'alfa', owner_email: 'nuevo@t.mx', password: 'clave1234' }), (e) => e.status === 409);
  // El usuario del intento fallido no quedó huérfano.
  assert.equal(await f.db.findOne('users', { email: 'nuevo@t.mx' }), null);
  assert.equal(await uniqueSlug(f.db, 'Alfa'), 'alfa-2');
  assert.equal(TEMPLATE_SERVICES.length, 6);
  // Ahora el dueño A ve sus dos barberías.
  const me = await f.login('ownerA', 'owner.a@t.mx');
  assert.deepEqual(me.contexts.map((c) => c.shop_id).sort(), ['shop_a', r.shop.id].sort());
});

// ── Perfil y contraseña ──
test('perfil: cambia nombre y teléfono con validación', async () => {
  const f = await makeFixture();
  await f.login('clientA', 'client.a@t.mx');
  const r = await f.call('PATCH', '/api/auth/profile', { as: 'clientA', body: { name: '  Cliente Nuevo ', phone: '+52 1 311 000 0009' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.name, 'Cliente Nuevo');
  assert.equal(r.data.user.phone, '3110000009');
  assert.equal((await f.db.findOne('users', { id: 'u_clientA' })).name, 'Cliente Nuevo');
  const bad = await f.call('PATCH', '/api/auth/profile', { as: 'clientA', body: { name: 'x', phone: '12' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.error.fields.name && bad.error.fields.phone);
  assert.equal((await f.call('PATCH', '/api/auth/profile', { as: 'clientA', body: {} })).status, 400);
  const clear = await f.call('PATCH', '/api/auth/profile', { as: 'clientA', body: { phone: '' } });
  assert.equal(clear.data.user.phone, '');
  assert.equal((await f.call('PATCH', '/api/auth/profile', { body: { name: 'Nadie' } })).status, 401);
});

test('cambio de contraseña: verifica la actual y cierra las demás sesiones', async () => {
  const f = await makeFixture();
  await f.login('a1', 'owner.a@t.mx');
  await f.login('a2', 'owner.a@t.mx');
  const wrong = await f.call('POST', '/api/auth/password', { as: 'a1', body: { current: 'noesesta1', next: 'nuevaclave9' } });
  assert.equal(wrong.status, 400);
  assert.ok(wrong.error.fields.current);
  const short = await f.call('POST', '/api/auth/password', { as: 'a1', body: { current: PW, next: 'corta' } });
  assert.equal(short.status, 400);
  assert.ok(short.error.fields.next);
  const same = await f.call('POST', '/api/auth/password', { as: 'a1', body: { current: PW, next: PW } });
  assert.equal(same.status, 400);
  const ok = await f.call('POST', '/api/auth/password', { as: 'a1', body: { current: PW, next: 'nuevaclave9' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data, null);
  assert.equal((await f.call('GET', '/api/auth/me', { as: 'a1' })).status, 200);
  assert.equal((await f.call('GET', '/api/auth/me', { as: 'a2' })).status, 401);
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW } })).status, 401);
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: 'nuevaclave9' } })).status, 200);
  // Las sesiones de otros usuarios no se tocan.
  await f.login('b', 'owner.b@t.mx');
  await f.call('POST', '/api/auth/password', { as: 'a1', body: { current: 'nuevaclave9', next: 'otraclave99' } });
  assert.equal((await f.call('GET', '/api/auth/me', { as: 'b' })).status, 200);
});

test('cambio de contraseña: adivinar la actual también se bloquea', async () => {
  const f = await makeFixture();
  await f.login('a', 'owner.a@t.mx');
  for (let i = 0; i < 5; i++) assert.equal((await f.call('POST', '/api/auth/password', { as: 'a', body: { current: 'intento' + i, next: 'nuevaclave9' } })).status, 400);
  assert.equal((await f.call('POST', '/api/auth/password', { as: 'a', body: { current: PW, next: 'nuevaclave9' } })).status, 429);
});

test('usuario sin contraseña (p. ej. staff sin cuenta completa) no puede entrar', async () => {
  const f = await makeFixture();
  await f.db.insert('users', { id: 'u_nopw', email: 'nopw@t.mx', name: 'Sin clave', password_hash: null, status: 'active', created_at: 'x' });
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'nopw@t.mx', password: 'cualquiera' } })).status, 401);
  // Y un hash válido de otro usuario no sirve para éste.
  await f.db.update('users', { id: 'u_nopw' }, { password_hash: await hashSecret('clave-propia', 1000) });
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'nopw@t.mx', password: PW } })).status, 401);
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'nopw@t.mx', password: 'clave-propia' } })).status, 200);
});

// ── Regresiones de la revisión de seguridad ──
test('cambio de contraseña: cierra también las sesiones PIN de sus fichas de staff (otros dispositivos)', async () => {
  const f = await makeFixture();
  await f.login('barberA', 'barber.a@t.mx');
  const p = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } });
  assert.equal(p.status, 200);
  assert.equal((await f.call('GET', '/api/auth/me', { token: p.data.token })).status, 200);
  const r = await f.call('POST', '/api/auth/password', { as: 'barberA', body: { current: PW, next: 'nuevaclave99' } });
  assert.equal(r.status, 200, r.body);
  assert.equal((await f.call('GET', '/api/auth/me', { token: p.data.token })).status, 401);
  assert.equal((await f.call('GET', '/api/auth/me', { as: 'barberA' })).status, 200, 'la sesión actual sigue');
});

test('sesión PIN: deja de servir si la cuenta vinculada se desactiva o si al miembro le quitan el PIN (aunque la fila siga)', async () => {
  const f = await makeFixture();
  const p = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } });
  const appts = () => f.call('GET', '/api/appointments?from=' + f.day + '&to=' + f.day, { token: p.data.token, shop: 'shop_a' });
  assert.equal((await appts()).status, 200);
  await f.db.update('users', { id: 'u_barberA' }, { status: 'disabled' }); // directo en la base: sin revocar filas
  assert.equal((await appts()).status, 403);
  assert.equal((await f.call('GET', '/api/auth/me', { token: p.data.token })).status, 401);
  await f.db.update('users', { id: 'u_barberA' }, { status: 'active' });
  const q = await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' } });
  await f.db.update('staff', { id: 'st_barberA' }, { pin_hash: null });
  assert.equal((await f.call('GET', '/api/appointments?from=' + f.day + '&to=' + f.day, { token: q.data.token, shop: 'shop_a' })).status, 403);
  assert.equal((await f.call('GET', '/api/auth/me', { token: q.data.token })).status, 401);
});

test('registro/alta con correo existente: 409 duplicate sin afirmar de más, y los sondeos cuentan para el límite por IP', async () => {
  const f = await makeFixture();
  const probe = (email, ip) => f.call('POST', '/api/auth/register', { ip, body: { name: 'Sonda', email, password: 'clave1234' } });
  for (let i = 0; i < 10; i++) {
    const r = await probe(i % 2 ? 'owner.a@t.mx' : 'x' + i + '@correo.mx', '4.4.4.4');
    assert.equal(r.status, i % 2 ? 409 : 200, r.body);
    if (i % 2) { assert.equal(r.error.code, 'duplicate'); assert.doesNotMatch(r.error.message, /Ya existe/); }
  }
  assert.equal((await probe('owner.b@t.mx', '4.4.4.4')).status, 429, 'el 11.º sondeo de la hora se bloquea');
  const s = await f.call('POST', '/api/auth/signup', { ip: '4.4.4.5', body: signupBody({ email: 'owner.a@t.mx' }) });
  assert.equal(s.status, 409);
  assert.equal(s.error.code, 'duplicate');
  assert.doesNotMatch(s.error.message, /Ya existe/);
});
