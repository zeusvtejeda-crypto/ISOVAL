// Una base D1 creada con la versión anterior (sin la columna de envío) debe actualizarse sola, sin perder datos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { D1Falsa } from './d1-shim.mjs';
import { crearRepoD1 } from '../functions/_d1.js';

const Core = createRequire(import.meta.url)('../public/core.js');

test('base anterior sin columna envio: se migra y conserva las ventas', async () => {
  const viejo = new D1Falsa();
  const c0 = { token: '', repo: await crearRepoD1(viejo) };
  const s = await Core.handle(c0.repo, { method: 'POST', path: '/setup', body: { nombre: 'X', pinLocal: '48215959', pinTienda: '73051818', catalogo: { bases: true } } }, { now: Date.now() });
  assert.equal(s.status, 200);
  viejo.db.exec('ALTER TABLE movs DROP COLUMN envio; DROP TABLE gastos; DROP TABLE intentos;'); // deja el esquema como estaba antes
  assert.throws(() => viejo.db.prepare('SELECT envio FROM movs').all());
  // otro "isolate" abre la misma base
  const nuevo = new D1Falsa(); nuevo.db = viejo.db;
  const repo = await crearRepoD1(nuevo);
  assert.doesNotThrow(() => nuevo.db.prepare('SELECT envio FROM movs').all());
  // y una segunda apertura no falla (la columna ya existe)
  const otro = new D1Falsa(); otro.db = viejo.db;
  await crearRepoD1(otro);
  const r = await Core.handle(repo, { method: 'POST', path: '/login', body: { rol: 'local', pin: '48215959' } }, { now: Date.now() });
  assert.equal(r.status, 200);
  const tok = r.json.token;
  const g = await Core.handle(repo, { method: 'POST', path: '/op', body: { op: 'gasto.crear', monto: 50, cat: 'comida' }, token: tok }, { now: Date.now() });
  assert.equal(g.status, 200, JSON.stringify(g.json));
  assert.equal((await Core.handle(repo, { method: 'GET', path: '/gastos', token: tok }, { now: Date.now() })).json.items.length, 1);
});
