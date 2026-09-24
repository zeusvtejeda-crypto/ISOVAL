// Limitador de intentos (core/session.js → rateHit/rateCheck/rateFail) con peticiones SIMULTÁNEAS, en la base
// en memoria y en D1 (D1 falso sobre node:sqlite con latencia por consulta, como en producción).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture, PW } from './helpers.mjs';
import { memoryDb } from '../core/db.js';
import { d1Db } from '../core/db-d1.js';
import { migrateSchema } from '../core/d1-migrate.js';
import { rateHit, rateRelease, rateCheck, rateFail, rateReset, attemptsWhere } from '../core/session.js';
import { LIMITS } from '../core/api/auth.js';

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { /* Node sin node:sqlite */ }
const tD1 = DatabaseSync ? test : test.skip;

// D1 falso: cada consulta es un viaje de red (1–6 ms), así las peticiones se intercalan de verdad.
async function latentD1() {
  const sq = new DatabaseSync(':memory:');
  const isRead = (sql) => /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql);
  const lat = () => new Promise((r) => setTimeout(r, 1 + Math.random() * 5));
  const exec1 = (sql, params) => {
    const st = sq.prepare(sql);
    if (isRead(sql)) return { success: true, results: st.all(...params).map((r) => Object.assign({}, r)), meta: { changes: 0 } };
    const r = st.run(...params);
    return { success: true, results: [], meta: { changes: Number(r.changes) } };
  };
  class Stmt {
    constructor(sql, params) { this.sql = sql; this.params = params || []; }
    bind(...p) { return new Stmt(this.sql, p); }
    async run() { await lat(); try { return exec1(this.sql, this.params); } catch (e) { throw new Error('D1_ERROR: ' + e.message); } }
    async all() { return this.run(); }
    async first(col) { const r = (await this.all()).results[0]; return r ? (col ? r[col] : r) : null; }
  }
  const D1 = {
    prepare: (sql) => new Stmt(sql),
    async batch(stmts) { await lat(); sq.exec('BEGIN'); try { const o = stmts.map((s) => exec1(s.sql, s.params)); sq.exec('COMMIT'); return o; } catch (e) { sq.exec('ROLLBACK'); throw e; } }
  };
  await migrateSchema(D1);
  return d1Db(D1);
}
const tally = (rs) => rs.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// N intentos simultáneos que se cuentan con rateHit y "tardan" (como PBKDF2) antes de terminar.
async function burst(db, key, lim, n, { work = 20, release = false } = {}) {
  let passed = 0, blocked = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    try {
      const h = await rateHit(db, key, lim);
      passed++;
      await sleep(work);
      if (release) await rateRelease(db, h);
    } catch (e) { if (e.status === 429) blocked++; else throw e; }
  }));
  return { passed, blocked };
}

for (const [label, mk, T] of [['memoria', async () => memoryDb(), test], ['D1', latentD1, tD1]]) {
  T('rateHit (' + label + '): con 50 intentos simultáneos nunca pasan más del máximo; el conteo no se pierde', async () => {
    const db = await mk();
    const lim = { max: 8, windowMin: 15, lockMin: 15 };
    // Por debajo del límite, todos los simultáneos pasan (no hay falsos 429).
    const ok = await burst(db, 'pin:shop_x:5.5.5.5', lim, lim.max - 2);
    assert.deepEqual([ok.passed, ok.blocked], [lim.max - 2, 0]);
    // Ráfaga muy por encima: nunca pasan más del máximo (si todos se ven en vuelo, se rechazan todos: falla cerrado).
    const r = await burst(db, 'pin:shop_x:4.4.4.4', lim, 50);
    assert.ok(r.passed <= lim.max, 'pasaron ' + r.passed);
    assert.equal(r.passed + r.blocked, 50);
    assert.equal(await db.count('login_attempts', attemptsWhere('pin:shop_x:4.4.4.4')), r.passed, 'quedan contados exactamente los que pasaron');
    // Pasada la ráfaga, los rechazados no dejaron rastro: se puede seguir hasta el máximo.
    let more = 0;
    for (let i = 0; i < lim.max; i++) { try { await rateHit(db, 'pin:shop_x:4.4.4.4', lim); more++; } catch (e) { assert.equal(e.status, 429); } }
    assert.equal(r.passed + more, lim.max);
    // A 1 del máximo: de otra ráfaga solo pasa 1 como mucho.
    const key = 'pw:casi@t.mx';
    for (let i = 0; i < lim.max - 1; i++) await rateFail(db, key, lim);
    const r2 = await burst(db, key, lim, 30);
    assert.ok(r2.passed <= 1, 'pasaron ' + r2.passed);
    assert.equal(await db.count('login_attempts', attemptsWhere(key)), lim.max - 1 + r2.passed);
    if (!r2.passed) await rateHit(db, key, lim);
    await assert.rejects(rateCheck(db, key, lim), (e) => e.status === 429);
    await assert.rejects(rateHit(db, key, lim), (e) => e.status === 429);
    await rateReset(db, key);
    assert.equal(await db.count('login_attempts', attemptsWhere(key)), 0);
    await rateCheck(db, key, lim);
  });

  T('rateFail (' + label + '): conteos simultáneos no se pisan; rateRelease retira solo el suyo', async () => {
    const db = await mk();
    const lim = { max: 100, windowMin: 15, lockMin: 15 };
    await Promise.all(Array.from({ length: 40 }, () => rateFail(db, 'reg:1.2.3.4', lim)));
    assert.equal(await db.count('login_attempts', attemptsWhere('reg:1.2.3.4')), 40);
    const h = await rateHit(db, 'reg:1.2.3.4', lim);
    assert.equal(await db.count('login_attempts', attemptsWhere('reg:1.2.3.4')), 41);
    await rateRelease(db, h);
    assert.equal(await db.count('login_attempts', attemptsWhere('reg:1.2.3.4')), 40);
  });
}

test('limitador: ventana deslizante, claves que no se mezclan y filas del formato anterior', async () => {
  const db = memoryDb();
  const lim = { max: 3, windowMin: 15, lockMin: 15 };
  for (let i = 0; i < 3; i++) await rateHit(db, 'pw:a@b.co', lim);
  await assert.rejects(rateHit(db, 'pw:a@b.co', lim), (e) => e.status === 429 && /en 15 min/.test(e.message));
  // Un correo con '#' que "empieza" igual no cae en el rango de otra clave.
  await rateHit(db, 'pw:a@b.co#x', lim);
  await rateHit(db, 'pw:a@b.co%23x', lim);
  assert.equal(await db.count('login_attempts', attemptsWhere('pw:a@b.co')), 3);
  assert.equal(await db.count('login_attempts', attemptsWhere('pw:a@b.co#x')), 1);
  // Pasada la ventana, los intentos viejos se descartan (y se borran).
  await db.update('login_attempts', attemptsWhere('pw:a@b.co'), { first_at: new Date(Date.now() - 16 * 60000).toISOString() });
  await rateHit(db, 'pw:a@b.co', lim);
  assert.equal(await db.count('login_attempts', attemptsWhere('pw:a@b.co')), 1);
  // Fila del formato anterior (id = clave, count, locked_until): se respeta mientras siga vigente.
  const now = Date.now();
  await db.insert('login_attempts', { id: 'pin:s:1', count: 8, first_at: new Date(now - 60000).toISOString(), locked_until: new Date(now + 14 * 60000).toISOString() });
  await assert.rejects(rateHit(db, 'pin:s:1', LIMITS.pin), (e) => e.status === 429);
  await db.insert('login_attempts', { id: 'pin:s:2', count: 7, first_at: new Date(now - 60000).toISOString(), locked_until: null });
  await rateHit(db, 'pin:s:2', LIMITS.pin);
  await assert.rejects(rateHit(db, 'pin:s:2', LIMITS.pin), (e) => e.status === 429);
  await rateReset(db, 'pin:s:2');
  assert.equal(await db.findOne('login_attempts', { id: 'pin:s:2' }), null);
});

test('login/PIN/registro en ráfaga desde una IP: no se verifican más intentos que el límite', async () => {
  // PIN: 200 PIN erróneos + el correcto a la vez (máx. 8 por barbería+IP).
  let f = await makeFixture();
  let reqs = [];
  for (let i = 0; i < 200; i++) reqs.push(f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: String(3000 + i) }, ip: '6.6.6.6' }));
  reqs.push(f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' }, ip: '6.6.6.6' }));
  let t = tally(await Promise.all(reqs));
  assert.ok((t[401] || 0) + (t[200] || 0) <= LIMITS.pin.max, JSON.stringify(t));
  // Contraseña: 50 erróneas + la correcta a la vez, desde IPs distintas (máx. 5 por correo).
  f = await makeFixture();
  reqs = [];
  for (let i = 0; i < 50; i++) reqs.push(f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: 'mala-' + i + 'xx' }, ip: '7.7.7.' + i }));
  reqs.push(f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW }, ip: '7.7.8.1' }));
  t = tally(await Promise.all(reqs));
  assert.ok((t[401] || 0) + (t[200] || 0) <= LIMITS.pw.max, JSON.stringify(t));
  // Registro: 40 a la vez desde una IP (máx. 10 por hora).
  f = await makeFixture();
  reqs = [];
  for (let i = 0; i < 40; i++) reqs.push(f.call('POST', '/api/auth/register', { body: { name: 'Spam ' + i, email: 'spam' + i + '@x.mx', password: 'secreto123' }, ip: '5.5.5.5' }));
  await Promise.all(reqs);
  const created = (await f.db.find('users', {})).filter((u) => /^spam/.test(u.email)).length;
  assert.ok(created <= LIMITS.reg.max, 'cuentas creadas: ' + created);
});

test('los accesos correctos no cuentan para el límite por IP (se retiran), los fallidos sí', async () => {
  const f = await makeFixture();
  for (let i = 0; i < LIMITS.ip.max + 5; i++) {
    const r = await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW }, ip: '3.3.3.3' });
    assert.equal(r.status, 200, 'login correcto ' + i + ': ' + r.body);
  }
  for (let i = 0; i < 5; i++) assert.equal((await f.call('POST', '/api/auth/pin', { body: { shop_slug: 'alfa', pin: '2222' }, ip: '3.3.3.3' })).status, 200);
  assert.equal(await f.db.count('login_attempts', attemptsWhere('ip:3.3.3.3')), 0);
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: 'malamala1' }, ip: '3.3.3.3' })).status, 401);
  assert.equal(await f.db.count('login_attempts', attemptsWhere('ip:3.3.3.3')), 1);
  // Si la clave del correo está bloqueada, el intento no se cuenta en la IP.
  for (let i = 0; i < 5; i++) await f.call('POST', '/api/auth/login', { body: { email: 'barber.a@t.mx', password: 'malamala1' }, ip: '3.3.3.4' });
  assert.equal((await f.call('POST', '/api/auth/login', { body: { email: 'barber.a@t.mx', password: PW }, ip: '3.3.3.4' })).status, 429);
  assert.equal(await f.db.count('login_attempts', attemptsWhere('ip:3.3.3.4')), 5);
});
