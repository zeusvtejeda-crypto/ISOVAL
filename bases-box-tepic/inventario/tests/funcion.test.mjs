// Capa HTTP de la API (functions/api/[[path]].js) con una D1 simulada: métodos, cuerpos, cabeceras y errores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { D1Falsa } from './d1-shim.mjs';
import { onRequest } from '../functions/api/[[path]].js';

const llamar = (env, ruta, init) => onRequest({ request: new Request('http://inventario.test' + ruta, init), env });
const json = (env, ruta, metodo, cuerpo, token) =>
  llamar(env, ruta, {
    method: metodo,
    headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });

test('sin base D1 enlazada responde 503 con un mensaje claro', async () => {
  const r = await llamar({}, '/api/ping');
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error.code, 'sin_base_de_datos');
});

test('solo acepta GET y POST', async () => {
  const r = await llamar({ DB: new D1Falsa() }, '/api/ping', { method: 'DELETE' });
  assert.equal(r.status, 405);
});

test('flujo completo por HTTP: setup, sesión con Bearer, estado y operación', async () => {
  const env = { DB: new D1Falsa() };
  let r = await json(env, '/api/ping', 'GET');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).configurado, false);
  assert.equal(r.headers.get('cache-control'), 'no-store');

  r = await json(env, '/api/setup', 'POST', { nombre: 'Bases Box', pinLocal: '4821', pinTienda: '7305', catalogo: { bases: true } });
  assert.equal(r.status, 200);
  const { token } = await r.json();

  assert.equal((await json(env, '/api/estado', 'GET')).status, 401);
  r = await json(env, '/api/estado?tz=-420', 'GET', null, token);
  assert.equal(r.status, 200);
  const est = await r.json();
  assert.equal(est.productos.length, 32);

  r = await json(env, '/api/op', 'POST', { op: 'mov.entrada', lineas: [{ id: est.productos[0].id, cant: 3 }] }, token);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).estado.productos.find((p) => p.id === est.productos[0].id).stock_local, 3);

  r = await json(env, '/api/movs?limite=1', 'GET', null, token);
  assert.equal((await r.json()).items.length, 1);
  assert.equal((await json(env, '/api/no-existe', 'GET', null, token)).status, 404);
});

test('cuerpo inválido o demasiado grande', async () => {
  const env = { DB: new D1Falsa() };
  let r = await llamar(env, '/api/login', { method: 'POST', body: '{no es json' });
  assert.equal(r.status, 400);
  r = await llamar(env, '/api/login', { method: 'POST', headers: { 'content-length': '70000' }, body: '{}' });
  assert.equal(r.status, 413);
});
