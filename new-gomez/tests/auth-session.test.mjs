// GET /api/auth/session: la comprobación de sesión con la que arranca el panel responde 200 aun sin sesión.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture, PW } from './helpers.mjs';

test('auth/session sin sesión: 200 con user null (sin 401 en la consola del navegador)', async () => {
  const f = await makeFixture();
  const r = await f.call('GET', '/api/auth/session');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { user: null, staff: null, contexts: [], session_kind: null });
  const bad = await f.call('GET', '/api/auth/session', { token: 'no-existe' });
  assert.equal(bad.status, 200);
  assert.equal(bad.data.user, null);
});

test('auth/session con sesión: mismos datos que auth/me; tras cerrar sesión vuelve a user null', async () => {
  const f = await makeFixture();
  const lg = await f.call('POST', '/api/auth/login', { body: { email: 'owner.a@t.mx', password: PW } });
  const s = await f.call('GET', '/api/auth/session', { token: lg.data.token });
  const me = await f.call('GET', '/api/auth/me', { token: lg.data.token });
  assert.equal(s.status, 200);
  assert.deepEqual(s.data, me.data);
  assert.equal(s.data.user.email, 'owner.a@t.mx');
  await f.call('POST', '/api/auth/logout', { token: lg.data.token });
  const after = await f.call('GET', '/api/auth/session', { token: lg.data.token });
  assert.equal(after.status, 200);
  assert.equal(after.data.user, null);
});
