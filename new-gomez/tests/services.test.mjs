import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';

async function setup() {
  const f = await makeFixture();
  for (const [as, email] of [['ownerA', 'owner.a@t.mx'], ['barberA', 'barber.a@t.mx'], ['clientA', 'client.a@t.mx'], ['ownerB', 'owner.b@t.mx'], ['super', 'super@t.mx']]) await f.login(as, email);
  await f.db.update('services', { id: 'sv_barba' }, { sort: 1 });
  await f.db.insert('services', { id: 'sv_off', shop_id: 'shop_a', name: 'Tinte', duration_min: 60, price: 400, active: false, sort: 2, created_at: 'x' });
  return f;
}
const as = (who, extra) => Object.assign({ as: who, shop: who === 'ownerB' ? 'shop_b' : 'shop_a' }, extra || {});
const base = { name: 'Corte fade', duration_min: 45, price: 250 };

test('GET /api/services: activos para todos los roles; inactivos solo con ?all=1 y services.manage', async () => {
  const f = await setup();
  for (const who of ['ownerA', 'barberA', 'clientA']) {
    const r = await f.call('GET', '/api/services', as(who));
    assert.equal(r.status, 200, who + ' ' + r.body);
    assert.deepEqual(r.data.map((s) => s.id), ['sv_corte', 'sv_barba'], who);
    assert.ok(r.data.every((s) => Array.isArray(s.staff_ids)));
  }
  const all = await f.call('GET', '/api/services?all=1', as('ownerA'));
  assert.deepEqual(all.data.map((s) => s.id), ['sv_corte', 'sv_barba', 'sv_off']);
  for (const who of ['barberA', 'clientA']) {
    const r = await f.call('GET', '/api/services?all=1', as(who));
    assert.ok(!r.data.some((s) => s.id === 'sv_off'), who + ' no ve inactivos');
  }
  const b = await f.call('GET', '/api/services', as('ownerB'));
  assert.deepEqual(b.data.map((s) => s.id), ['sv_corteB']);
  assert.equal((await f.call('GET', '/api/services', { shop: 'shop_a' })).status, 401);
});

test('POST /api/services: solo el dueño y validaciones', async () => {
  const f = await setup();
  assert.equal((await f.call('POST', '/api/services', as('barberA', { body: base }))).status, 403);
  assert.equal((await f.call('POST', '/api/services', as('clientA', { body: base }))).status, 403);
  const cases = [
    [{ duration_min: 30, price: 1 }, 'name'], [{ ...base, name: 'A' }, 'name'], [{ ...base, name: 'x'.repeat(81) }, 'name'],
    [{ name: 'Corte', price: 100 }, 'duration_min'], [{ ...base, duration_min: 7 }, 'duration_min'], [{ ...base, duration_min: 0 }, 'duration_min'],
    [{ ...base, duration_min: 485 }, 'duration_min'], [{ ...base, duration_min: 'media hora' }, 'duration_min'],
    [{ name: 'Corte', duration_min: 30 }, 'price'], [{ ...base, price: -1 }, 'price'], [{ ...base, price: 100001 }, 'price'],
    [{ ...base, category: 'x'.repeat(41) }, 'category'], [{ ...base, description: 'x'.repeat(301) }, 'description'],
    [{ ...base, popular: 'sí' }, 'popular'], [{ ...base, staff_ids: 'st_barberA' }, 'staff_ids'],
    [{ ...base, staff_ids: ['st_ownerB'] }, 'staff_ids'], [{ ...base, staff_ids: ['st_barberA', 'st_fantasma'] }, 'staff_ids']
  ];
  for (const [body, field] of cases) {
    const r = await f.call('POST', '/api/services', as('ownerA', { body }));
    assert.equal(r.status, 400, JSON.stringify(body) + ' → ' + r.body);
    assert.ok(r.error.fields && r.error.fields[field], JSON.stringify(body) + ' esperaba ' + field + ': ' + r.body);
  }
  assert.equal(await f.db.count('services', { shop_id: 'shop_a' }), 3);
});

test('POST /api/services: crea con defaults, orden al final y barberos de la barbería', async () => {
  const f = await setup();
  const r = await f.call('POST', '/api/services', as('ownerA', { body: { ...base, name: '  Corte   fade ', price: '249.999', category: 'Cortes', staff_ids: ['st_barberA', 'st_barberA'], description: '' } }));
  assert.equal(r.status, 200, r.body);
  const s = r.data;
  assert.equal(s.name, 'Corte fade');
  assert.equal(s.price, 250);
  assert.equal(s.duration_min, 45);
  assert.equal(s.active, true);
  assert.equal(s.popular, false);
  assert.deepEqual(s.staff_ids, ['st_barberA']);
  assert.equal(s.description, null);
  assert.equal(s.shop_id, 'shop_a');
  assert.equal(s.sort, 3);
  const free = await f.call('POST', '/api/services', as('ownerA', { body: { name: 'Lavado', duration_min: 5, price: 0, popular: true } }));
  assert.equal(free.status, 200, free.body);
  assert.equal(free.data.price, 0);
  assert.equal(free.data.popular, true);
  // Superadmin actúa como dueño.
  assert.equal((await f.call('POST', '/api/services', as('super', { body: base }))).status, 200);
});

test('PATCH / DELETE /api/services/:id: parcial, validado y aislado entre barberías', async () => {
  const f = await setup();
  const r = await f.call('PATCH', '/api/services/sv_corte', as('ownerA', { body: { price: 220, active: false, staff_ids: [] } }));
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data.price, 220);
  assert.equal(r.data.active, false);
  assert.equal(r.data.name, 'Corte');
  assert.equal(r.data.duration_min, 40);
  assert.equal((await f.call('PATCH', '/api/services/sv_corte', as('ownerA', { body: { duration_min: 33 } }))).status, 400);
  assert.equal((await f.call('PATCH', '/api/services/sv_corte', as('ownerA', { body: {} }))).status, 400);
  assert.equal((await f.call('PATCH', '/api/services/sv_corte', as('barberA', { body: { price: 1 } }))).status, 403);
  // Ids de otra barbería → 404 y sin cambios.
  assert.equal((await f.call('PATCH', '/api/services/sv_corteB', as('ownerA', { body: { price: 1 } }))).status, 404);
  assert.equal((await f.call('DELETE', '/api/services/sv_corteB', as('ownerA'))).status, 404);
  assert.equal((await f.call('PATCH', '/api/services/sv_barba', as('ownerB', { body: { price: 1 } }))).status, 404);
  const b = await f.db.findOne('services', { id: 'sv_corteB' });
  assert.equal(b.price, 150);
  // DELETE borra definitivamente.
  assert.equal((await f.call('DELETE', '/api/services/sv_barba', as('barberA'))).status, 403);
  const d = await f.call('DELETE', '/api/services/sv_barba', as('ownerA'));
  assert.equal(d.status, 200, d.body);
  assert.equal(d.data, null);
  assert.equal(await f.db.findOne('services', { id: 'sv_barba' }), null);
  assert.equal((await f.call('DELETE', '/api/services/sv_barba', as('ownerA'))).status, 404);
});

test('POST /api/services/reorder: ordena, completa con el resto y rechaza ids ajenos', async () => {
  const f = await setup();
  const r = await f.call('POST', '/api/services/reorder', as('ownerA', { body: { ids: ['sv_off', 'sv_corte'] } }));
  assert.equal(r.status, 200, r.body);
  assert.equal(r.data, null);
  const all = await f.call('GET', '/api/services?all=1', as('ownerA'));
  assert.deepEqual(all.data.map((s) => s.id), ['sv_off', 'sv_corte', 'sv_barba']);
  assert.deepEqual(all.data.map((s) => s.sort), [0, 1, 2]);
  for (const body of [{}, { ids: [] }, { ids: 'sv_corte' }, { ids: ['sv_corte', 'sv_corte'] }, { ids: ['sv_corte', 'sv_corteB'] }, { ids: [1, 2] }]) {
    const x = await f.call('POST', '/api/services/reorder', as('ownerA', { body }));
    assert.equal(x.status, 400, JSON.stringify(body) + ' → ' + x.body);
  }
  assert.equal((await f.db.findOne('services', { id: 'sv_corteB' })).sort, 0);
  assert.equal((await f.call('POST', '/api/services/reorder', as('barberA', { body: { ids: ['sv_corte'] } }))).status, 403);
});
