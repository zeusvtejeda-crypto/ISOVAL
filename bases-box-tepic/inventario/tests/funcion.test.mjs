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

  r = await json(env, '/api/setup', 'POST', { nombre: 'Bases Box', pinLocal: '482159', pinTienda: '730518', catalogo: { bases: true } });
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

test('SETUP_KEY del entorno se exige en el primer arranque', async () => {
  const env = { DB: new D1Falsa(), SETUP_KEY: 'ABCD-EFGH-JKLM' };
  let r = await json(env, '/api/ping', 'GET');
  assert.equal((await r.json()).requiereClave, true);
  r = await json(env, '/api/setup', 'POST', { pinLocal: '482159', pinTienda: '730518' });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error.code, 'clave_instalacion');
  r = await json(env, '/api/setup', 'POST', { clave: 'abcd-efgh-jklm', pinLocal: '482159', pinTienda: '730518' });
  assert.equal(r.status, 200);
});

test('cuerpo inválido o demasiado grande', async () => {
  const env = { DB: new D1Falsa() };
  let r = await llamar(env, '/api/login', { method: 'POST', body: '{no es json' });
  assert.equal(r.status, 400);
  r = await llamar(env, '/api/login', { method: 'POST', headers: { 'content-length': '70000' }, body: '{}' });
  assert.equal(r.status, 413);
});

test('seguridad HTTP: origen ajeno, cuerpo sin content-length, JSON que no es objeto y cabeceras', async () => {
  const env = { DB: new D1Falsa() };
  let r = await llamar(env, '/api/setup', { method: 'POST', headers: { origin: 'https://sitio-malo.example' }, body: '{}' });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error.code, 'origen');
  // el mismo origen de la app sí pasa
  r = await llamar(env, '/api/ping', { method: 'GET', headers: { origin: 'http://inventario.test' } });
  assert.equal(r.status, 200);
  for (const h of ['x-content-type-options', 'strict-transport-security', 'content-security-policy', 'x-frame-options']) assert.ok(r.headers.get(h), h);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  // cuerpo enorme enviado por tramos (sin content-length confiable)
  const grande = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"a":"' + 'x'.repeat(70000) + '"}')); c.close(); } });
  r = await llamar(env, '/api/login', { method: 'POST', body: grande, duplex: 'half', headers: { 'content-type': 'application/json' } });
  assert.equal(r.status, 413);
  for (const raro of ['[]', 'null', '"texto"', '5']) {
    r = await llamar(env, '/api/login', { method: 'POST', body: raro });
    assert.equal(r.status, 400, raro);
  }
});
