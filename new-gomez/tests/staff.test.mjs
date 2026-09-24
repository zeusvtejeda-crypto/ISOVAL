import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture, PW } from './helpers.mjs';
import { scopedDb } from '../core/db.js';
import { verifySecret } from '../core/crypto.js';
import { newId, nowIso } from '../core/util.js';

async function setup() {
  const f = await makeFixture();
  for (const [as, email] of [['ownerA', 'owner.a@t.mx'], ['barberA', 'barber.a@t.mx'], ['clientA', 'client.a@t.mx'], ['ownerB', 'owner.b@t.mx'], ['super', 'super@t.mx']]) await f.login(as, email);
  return f;
}
const A = { shop: 'shop_a' };
const as = (who, extra) => Object.assign({ as: who }, A, extra || {});
const pinLogin = (f, pin, slug) => f.call('POST', '/api/auth/pin', { body: { shop_slug: slug || 'alfa', pin } });

test('GET /api/staff: dueño ve equipo con correo; barbero sin datos privados ajenos; cliente 403', async () => {
  const f = await setup();
  await f.db.update('staff', { id: 'st_barberA2' }, { phone: '3119998888', sort: 5 });
  const r = await f.call('GET', '/api/staff', as('ownerA'));
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.data.map((s) => s.id), ['st_barberA', 'st_ownerA', 'st_barberA2']); // sort, name
  const ba = r.data.find((s) => s.id === 'st_barberA');
  assert.equal(ba.email, 'barber.a@t.mx');
  assert.equal(ba.has_pin, true);
  assert.equal(ba.pin_hash, undefined);
  assert.ok(r.data.every((s) => s.shop_id === 'shop_a'));
  assert.equal(r.data.find((s) => s.id === 'st_barberA2').phone, '3119998888');

  const b = await f.call('GET', '/api/staff', as('barberA'));
  assert.equal(b.status, 200, b.body);
  const me = b.data.find((s) => s.id === 'st_barberA');
  const other = b.data.find((s) => s.id === 'st_ownerA');
  assert.equal(me.email, 'barber.a@t.mx');
  assert.equal(other.email, '');
  assert.equal(other.commission_pct, null);
  assert.equal(b.data.find((s) => s.id === 'st_barberA2').phone, null);

  assert.equal((await f.call('GET', '/api/staff', as('clientA'))).status, 403);
  const rb = await f.call('GET', '/api/staff', { as: 'ownerB', shop: 'shop_b' });
  assert.deepEqual(rb.data.map((s) => s.id), ['st_ownerB']);
});

test('POST /api/staff: valida entradas y solo el dueño', async () => {
  const f = await setup();
  assert.equal((await f.call('POST', '/api/staff', as('barberA', { body: { name: 'Nuevo' } }))).status, 403);
  assert.equal((await f.call('POST', '/api/staff', as('clientA', { body: { name: 'Nuevo' } }))).status, 403);
  const cases = [
    [{}, 'name'], [{ name: 'X' }, 'name'], [{ name: 'x'.repeat(61) }, 'name'], [{ name: 'Beto', role: 'admin' }, 'role'],
    [{ name: 'Beto', color: 'azul' }, 'color'], [{ name: 'Beto', commission_pct: 101 }, 'commission_pct'],
    [{ name: 'Beto', commission_pct: 'mucho' }, 'commission_pct'], [{ name: 'Beto', pin: '12' }, 'pin'],
    [{ name: 'Beto', pin: '12a4' }, 'pin'], [{ name: 'Beto', bio: 'x'.repeat(301) }, 'bio'],
    [{ name: 'Beto', phone: '123' }, 'phone'], [{ name: 'Beto', avatar_url: 'javascript:alert(1)' }, 'avatar_url'],
    [{ name: 'Beto', avatar_url: 'data:image/jpeg;base64,' + 'A'.repeat(80000) }, 'avatar_url'],
    [{ name: 'Beto', bookable: 'tal vez' }, 'bookable'], [{ name: 'Beto', email: 'malo' }, 'email'],
    [{ name: 'Beto', email: 'beto@t.mx' }, 'password'], [{ name: 'Beto', email: 'beto@t.mx', password: 'corta' }, 'password'],
    [{ name: 'Beto', password: 'secreto123' }, 'email']
  ];
  for (const [body, field] of cases) {
    const r = await f.call('POST', '/api/staff', as('ownerA', { body }));
    assert.equal(r.status, 400, JSON.stringify(body) + ' → ' + r.body);
    assert.ok(r.error.fields && r.error.fields[field], JSON.stringify(body) + ' esperaba ' + field + ': ' + r.body);
  }
  assert.equal(await f.db.count('staff', { shop_id: 'shop_a' }), 3);
  assert.equal(await f.db.count('users', { email: 'beto@t.mx' }), 0);
});

test('POST /api/staff: defaults, color libre, orden y disponibilidad = horario de la barbería', async () => {
  const f = await setup();
  await f.db.update('staff', { id: 'st_ownerA' }, { color: '#c8a24a' });
  const r = await f.call('POST', '/api/staff', as('ownerA', { body: { name: '  Beto   Ruiz ', phone: '311-222-3333', bio: 'Fades y diseño.', avatar_url: 'data:image/png;base64,iVBORw0KGgo=' } }));
  assert.equal(r.status, 200, r.body);
  const st = r.data;
  assert.equal(st.name, 'Beto Ruiz');
  assert.equal(st.role, 'barber');
  assert.equal(st.active, true);
  assert.equal(st.bookable, true);
  assert.equal(st.commission_pct, 50);
  assert.equal(st.phone, '3112223333');
  assert.equal(st.avatar_url, 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(st.has_pin, false);
  assert.equal(st.has_account, false);
  assert.equal(st.email, '');
  assert.match(st.color, /^#[0-9a-f]{6}$/);
  assert.notEqual(st.color, '#c8a24a', 'no repite un color en uso');
  assert.equal(st.shop_id, 'shop_a');
  const av = await scopedDb(f.db, 'shop_a').find('availability', { staff_id: st.id });
  assert.equal(av.length, 6); // fixture: lunes a sábado 10:00–20:00
  assert.ok(av.every((x) => x.start_min === 600 && x.end_min === 1200 && x.weekday >= 1));
  const r2 = await f.call('POST', '/api/staff', as('ownerA', { body: { name: 'Carla', role: 'owner', color: '#112233', bookable: false } }));
  assert.equal(r2.status, 200, r2.body);
  assert.equal(r2.data.commission_pct, 0);
  assert.equal(r2.data.color, '#112233');
  assert.equal(r2.data.bookable, false);
  assert.ok(r2.data.sort > st.sort);
});

test('POST /api/staff: PIN único en la barbería (no choca con otra barbería)', async () => {
  const f = await setup();
  const dup = await f.call('POST', '/api/staff', as('ownerA', { body: { name: 'Beto', pin: '2222' } })); // PIN de Barbero A
  assert.equal(dup.status, 409, dup.body);
  assert.equal(dup.error.code, 'duplicate');
  assert.ok(dup.error.fields.pin);
  const ok = await f.call('POST', '/api/staff', as('ownerA', { body: { name: 'Beto', pin: '4321' } }));
  assert.equal(ok.status, 200, ok.body);
  assert.equal(ok.data.has_pin, true);
  const row = await f.db.findOne('staff', { id: ok.data.id });
  assert.ok(await verifySecret('4321', row.pin_hash));
  const login = await pinLogin(f, '4321');
  assert.equal(login.status, 200, login.body);
  assert.equal(login.data.staff.id, ok.data.id);
  // El mismo PIN en otra barbería sí se permite.
  const b = await f.call('POST', '/api/staff', { as: 'ownerB', shop: 'shop_b', body: { name: 'Beto B', pin: '4321' } });
  assert.equal(b.status, 200, b.body);
});

test('POST /api/staff: correo nuevo crea acceso; correo existente se vincula sin tocar contraseña', async () => {
  const f = await setup();
  const r = await f.call('POST', '/api/staff', as('ownerA', { body: { name: 'Diego', email: 'Diego@T.mx', password: 'navaja2024' } }));
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.email, 'diego@t.mx');
  assert.equal(r.data.has_account, true);
  assert.equal(r.data.account, 'created');
  const lg = await f.call('POST', '/api/auth/login', { body: { email: 'diego@t.mx', password: 'navaja2024' } });
  assert.equal(lg.status, 200, lg.body);
  const ctxR = await f.call('GET', '/api/context', { token: lg.data.token, shop: 'shop_a' });
  assert.equal(ctxR.data.role, 'barber');
  assert.equal(ctxR.data.staff.id, r.data.id);

  // Dueño B (usuario existente) se une a A como barbero: se vincula, su contraseña no cambia.
  const before = (await f.db.findOne('users', { email: 'owner.b@t.mx' })).password_hash;
  const l = await f.call('POST', '/api/staff', as('ownerA', { body: { name: 'Dueño B', email: 'owner.b@t.mx', password: 'otracosa123' } }));
  assert.equal(l.status, 200, l.body);
  assert.equal(l.data.account, 'linked');
  assert.equal((await f.db.findOne('users', { email: 'owner.b@t.mx' })).password_hash, before);
  const lgB = await f.call('POST', '/api/auth/login', { body: { email: 'owner.b@t.mx', password: PW } });
  assert.equal(lgB.status, 200);
  assert.equal(lgB.data.contexts.length, 2);

  // Ya es parte del equipo → 409 (activo o desactivado).
  const d1 = await f.call('POST', '/api/staff', as('ownerA', { body: { name: 'Otra vez', email: 'barber.a@t.mx' } }));
  assert.equal(d1.status, 409, d1.body);
  assert.ok(d1.error.fields.email);
  await f.db.update('staff', { id: r.data.id }, { active: false });
  const d2 = await f.call('POST', '/api/staff', as('ownerA', { body: { name: 'Diego 2', email: 'diego@t.mx' } }));
  assert.equal(d2.status, 409);
  assert.match(d2.error.message, /desactivad/);
});

test('PATCH /api/staff/:id: barbero solo edita su perfil permitido', async () => {
  const f = await setup();
  const self = await f.call('PATCH', '/api/staff/st_barberA', as('barberA', { body: { name: 'Barbero Uno', phone: '3110001111', bio: 'Clásicos', color: '#223344', pin: '9876', role: 'barber', commission_pct: 50 } }));
  assert.equal(self.status, 200, self.body);
  assert.equal(self.data.name, 'Barbero Uno');
  assert.equal(self.data.color, '#223344');
  assert.ok(await verifySecret('9876', (await f.db.findOne('staff', { id: 'st_barberA' })).pin_hash));
  // Cambios de dueño → 403 y nada cambia.
  for (const body of [{ commission_pct: 90 }, { role: 'owner' }, { bookable: false }, { active: false }, { email: 'otro@t.mx' }, { password: 'nuevaclave1' }, { name: 'X Y', sort: 3 }]) {
    const r = await f.call('PATCH', '/api/staff/st_barberA', as('barberA', { body }));
    assert.equal(r.status, 403, JSON.stringify(body) + ' → ' + r.body);
  }
  const row = await f.db.findOne('staff', { id: 'st_barberA' });
  assert.equal(row.commission_pct, 50);
  assert.equal(row.role, 'barber');
  assert.equal(row.name, 'Barbero Uno');
  // A otro miembro → 403.
  assert.equal((await f.call('PATCH', '/api/staff/st_barberA2', as('barberA', { body: { name: 'Hack' } }))).status, 403);
  assert.equal((await f.call('PATCH', '/api/staff/st_barberA', as('clientA', { body: { name: 'Hack' } }))).status, 403);
  // Validación también para el barbero.
  const bad = await f.call('PATCH', '/api/staff/st_barberA', as('barberA', { body: { pin: '1' } }));
  assert.equal(bad.status, 400);
  assert.ok(bad.error.fields.pin);
});

test('PATCH /api/staff/:id: dueño edita todo; PIN duplicado 409; quitar PIN', async () => {
  const f = await setup();
  const r = await f.call('PATCH', '/api/staff/st_barberA2', as('ownerA', { body: { commission_pct: 45.5, role: 'owner', bookable: false, sort: 9, bio: '' } }));
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.commission_pct, 45.5);
  assert.equal(r.data.role, 'owner');
  assert.equal(r.data.bookable, false);
  assert.equal(r.data.bio, null);
  const dup = await f.call('PATCH', '/api/staff/st_barberA2', as('ownerA', { body: { pin: '2222' } }));
  assert.equal(dup.status, 409);
  assert.ok(dup.error.fields.pin);
  // Su propio PIN actual no cuenta como duplicado.
  assert.equal((await f.call('PATCH', '/api/staff/st_barberA', as('ownerA', { body: { pin: '2222' } }))).status, 200);
  const rm = await f.call('PATCH', '/api/staff/st_barberA', as('ownerA', { body: { pin: null } }));
  assert.equal(rm.data.has_pin, false);
  assert.equal((await pinLogin(f, '2222')).status, 401);
  assert.equal((await f.call('PATCH', '/api/staff/st_barberA', as('ownerA', { body: { nada: 1 } }))).status, 400);
});

test('PIN: los choques repetidos se limitan (no sirve para adivinar PINs ajenos)', async () => {
  const f = await setup();
  let last;
  for (let i = 0; i < 6; i++) last = await f.call('PATCH', '/api/staff/st_barberA2', as('ownerA', { body: { pin: '2222' } }));
  assert.equal(last.status, 429, last.body);
});

test('último dueño activo y auto-desactivación', async () => {
  const f = await setup();
  const self = await f.call('PATCH', '/api/staff/st_ownerA', as('ownerA', { body: { active: false } }));
  assert.equal(self.status, 409, self.body);
  assert.equal((await f.call('DELETE', '/api/staff/st_ownerA', as('ownerA'))).status, 409);
  assert.equal((await f.call('PATCH', '/api/staff/st_ownerA', as('ownerA', { body: { role: 'barber' } }))).status, 409);
  // Superadmin tampoco puede dejar la barbería sin dueño.
  assert.equal((await f.call('DELETE', '/api/staff/st_ownerA', as('super'))).status, 409);
  assert.equal((await f.call('PATCH', '/api/staff/st_ownerA', as('super', { body: { role: 'barber' } }))).status, 409);
  // Con un segundo dueño activo, el superadmin/otro dueño sí puede.
  await f.call('PATCH', '/api/staff/st_barberA2', as('ownerA', { body: { role: 'owner' } }));
  const d = await f.call('DELETE', '/api/staff/st_ownerA', as('super'));
  assert.equal(d.status, 200, d.body);
  assert.equal(d.data.active, false);
  // Ahora st_barberA2 es el último dueño activo.
  assert.equal((await f.call('PATCH', '/api/staff/st_barberA2', as('super', { body: { role: 'barber' } }))).status, 409);
  assert.equal((await f.db.findOne('staff', { id: 'st_ownerA' })).active, false);
  // Con la ficha desactivada, el dueño A ya no entra a la barbería.
  assert.equal((await f.call('GET', '/api/context', as('ownerA'))).status, 403);
});

test('DELETE /api/staff/:id desactiva, avisa citas próximas; reactivar lo devuelve a la reserva', async () => {
  const f = await setup();
  await scopedDb(f.db, 'shop_a').insert('appointments', { id: newId('ap'), folio: 'TB-X1', staff_id: 'st_barberA', date: f.day, start_min: 600, end_min: 640, duration_min: 40, services: [], total: 200, status: 'confirmed', created_at: nowIso() });
  const d = await f.call('DELETE', '/api/staff/st_barberA', as('ownerA'));
  assert.equal(d.status, 200, d.body);
  assert.equal(d.data.active, false);
  assert.equal(d.data.bookable, false);
  assert.equal(d.data.upcoming_appointments, 1);
  const list = await f.call('GET', '/api/staff', as('ownerA'));
  assert.ok(!list.data.some((s) => s.id === 'st_barberA'));
  const all = await f.call('GET', '/api/staff?all=1', as('ownerA'));
  assert.ok(all.data.some((s) => s.id === 'st_barberA' && !s.active));
  assert.equal((await pinLogin(f, '2222')).status, 401);
  assert.equal((await f.call('GET', '/api/context', as('barberA'))).status, 403);
  const re = await f.call('PATCH', '/api/staff/st_barberA', as('ownerA', { body: { active: true } }));
  assert.equal(re.status, 200, re.body);
  assert.equal(re.data.active, true);
  assert.equal(re.data.bookable, true);
  assert.equal((await pinLogin(f, '2222')).status, 200);
});

test('aislamiento: ids de otra barbería → 404 y nada cambia', async () => {
  const f = await setup();
  assert.equal((await f.call('PATCH', '/api/staff/st_ownerB', as('ownerA', { body: { name: 'Robado' } }))).status, 404);
  assert.equal((await f.call('DELETE', '/api/staff/st_ownerB', as('ownerA'))).status, 404);
  assert.equal((await f.call('POST', '/api/staff/st_ownerB/account', as('ownerA', { body: { email: 'x@t.mx', password: 'secreto123' } }))).status, 404);
  assert.equal((await f.call('PATCH', '/api/staff/st_barberA', { as: 'ownerB', shop: 'shop_b', body: { name: 'Robado' } })).status, 404);
  assert.equal((await f.call('PATCH', '/api/staff/st_barberA', { as: 'ownerB', shop: 'shop_a', body: { name: 'Robado' } })).status, 403);
  const b = await f.db.findOne('staff', { id: 'st_ownerB' });
  assert.equal(b.name, 'Dueño B');
  assert.equal(b.active, true);
  assert.equal((await f.db.findOne('staff', { id: 'st_barberA' })).name, 'Barbero A');
});

test('POST /api/staff/:id/account: crear, no resetear cuentas ajenas, quitar y proteger la propia', async () => {
  const f = await setup();
  const noEmail = await f.call('POST', '/api/staff/st_barberA2/account', as('ownerA', { body: { password: 'secreto123' } }));
  assert.equal(noEmail.status, 400);
  assert.ok(noEmail.error.fields.email);
  const c = await f.call('POST', '/api/staff/st_barberA2/account', as('ownerA', { body: { email: 'a2@t.mx', password: 'tijeras99' } }));
  assert.equal(c.status, 200, c.body);
  assert.equal(c.data.account, 'created');
  assert.equal(c.data.email, 'a2@t.mx');
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'a2@t.mx', password: 'tijeras99' } })).status, 200);
  // Cambiar la contraseña de una cuenta ya vinculada → 400 (solo la persona desde su perfil).
  const reset = await f.call('POST', '/api/staff/st_barberA/account', as('ownerA', { body: { email: 'barber.a@t.mx', password: 'robada1234' } }));
  assert.equal(reset.status, 400, reset.body);
  assert.ok(reset.error.fields.password);
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'barber.a@t.mx', password: PW } })).status, 200);
  // Vincular a un correo de alguien del equipo → 409.
  const dup = await f.call('POST', '/api/staff/st_barberA2/account', as('ownerA', { body: { email: 'barber.a@t.mx' } }));
  assert.equal(dup.status, 409);
  // Quitar acceso.
  const rm = await f.call('POST', '/api/staff/st_barberA2/account', as('ownerA', { body: { remove: true } }));
  assert.equal(rm.status, 200, rm.body);
  assert.equal(rm.data.has_account, false);
  assert.equal(rm.data.account, 'removed');
  const lg = await f.call('POST', '/api/auth/login', { body: { email: 'a2@t.mx', password: 'tijeras99' } });
  assert.equal(lg.data.contexts.length, 0);
  // El dueño no cambia ni quita su propio acceso aquí.
  assert.equal((await f.call('POST', '/api/staff/st_ownerA/account', as('ownerA', { body: { email: 'nuevo@t.mx', password: 'secreto123' } }))).status, 400);
  assert.equal((await f.call('POST', '/api/staff/st_ownerA/account', as('ownerA', { body: { remove: true } }))).status, 400);
  // Barbero no tiene acceso a esta ruta.
  assert.equal((await f.call('POST', '/api/staff/st_barberA/account', as('barberA', { body: { email: 'z@t.mx', password: 'secreto123' } }))).status, 403);
});
