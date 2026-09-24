import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers.mjs';
import { scopedDb } from '../core/db.js';

test('health responde', async () => {
  const f = await makeFixture();
  const r = await f.call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.backend, 'memory');
});

test('ruta desconocida → 404', async () => {
  const f = await makeFixture();
  const r = await f.call('GET', '/api/no-existe');
  assert.equal(r.status, 404);
});

test('scopedDb nunca ve datos de otra barbería', async () => {
  const f = await makeFixture();
  const a = scopedDb(f.db, 'shop_a');
  const svcs = await a.find('services');
  assert.ok(svcs.length > 0 && svcs.every((s) => s.shop_id === 'shop_a'));
  assert.equal(await a.findOne('services', { id: 'sv_corteB' }), null);
  assert.equal(await a.update('services', { id: 'sv_corteB' }, { price: 1 }), 0);
  assert.equal(await a.delete('clients', { id: 'cl_walkB' }), 0);
  const ins = await a.insert('clients', { id: 'cl_x', shop_id: 'shop_b', name: 'X', created_at: 'x' });
  assert.equal(ins.shop_id, 'shop_a');
  assert.throws(() => a.find('users'));
});
