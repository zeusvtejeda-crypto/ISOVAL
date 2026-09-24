// d1Db (core/db-d1.js), ensureSchema (core/d1-migrate.js) y la Pages Function contra un D1 FALSO
// construido sobre node:sqlite (SQLite real). Sin node:sqlite (Node < 22.5) las pruebas se saltan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSQL, SCHEMA, TABLES } from '../core/schema.js';
import { d1Db } from '../core/db-d1.js';
import { memoryDb, scopedDb } from '../core/db.js';
import { HttpError } from '../core/util.js';
import { ensureSchema, migrateSchema, resetSchemaCache, splitSQL, columnsFromCreate, schemaStatements, addColumnSQL } from '../core/d1-migrate.js';

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { /* Node sin node:sqlite */ }
const t = DatabaseSync ? test : test.skip;

// ── D1 falso: prepare().bind().run()/all()/first() y batch() transaccional, con los límites de D1 que importan ──
export function fakeD1(opts) {
  opts = opts || {};
  const sq = new DatabaseSync(':memory:');
  const log = [];
  const isRead = (sql) => /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql);
  const d1err = (e) => new Error('D1_ERROR: ' + (e && e.message || e));
  const exec1 = (sql, params) => {
    log.push({ sql, n: params.length });
    if (params.length > 100) throw new Error('too many SQL variables (' + params.length + ')');
    if (opts.failOn && opts.failOn.test(sql)) throw new Error('falla simulada');
    const st = sq.prepare(sql);
    if (isRead(sql)) return { success: true, results: st.all(...params).map((r) => Object.assign({}, r)), meta: { changes: 0 } };
    const r = st.run(...params);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  };
  class Stmt {
    constructor(sql, params) { this.sql = sql; this.params = params || []; }
    bind(...p) {
      for (const v of p) if (v === undefined || typeof v === 'boolean' || (v !== null && typeof v === 'object')) throw new TypeError("D1_TYPE_ERROR: Type '" + typeof v + "' not supported");
      return new Stmt(this.sql, p);
    }
    async run() { try { return exec1(this.sql, this.params); } catch (e) { throw d1err(e); } }
    async all() { try { return exec1(this.sql, this.params); } catch (e) { throw d1err(e); } }
    async first(col) { const r = (await this.all()).results[0]; return r ? (col ? r[col] : r) : null; }
  }
  return {
    sqlite: sq, log,
    prepare: (sql) => new Stmt(sql),
    async batch(stmts) {
      if (opts.failBatch) throw d1err('batch deshabilitado');
      sq.exec('BEGIN');
      try { const out = stmts.map((s) => exec1(s.sql, s.params)); sq.exec('COMMIT'); return out; } catch (e) { sq.exec('ROLLBACK'); throw d1err(e); }
    }
  };
}
async function freshD1() {
  const D1 = fakeD1();
  await migrateSchema(D1);
  return { D1, db: d1Db(D1) };
}
const now = '2026-09-24T12:00:00.000Z';
const client = (id, shop_id, extra) => Object.assign({ id, shop_id, name: 'Cliente ' + id, phone: null, tags: [], created_at: now }, extra || {});

t('toSQL() en sqlite real: todas las tablas e índices del esquema', async () => {
  const { D1 } = await freshD1();
  const names = D1.sqlite.prepare("SELECT type, name FROM sqlite_master WHERE type IN ('table','index')").all();
  for (const tb of TABLES) assert.ok(names.some((r) => r.type === 'table' && r.name === tb), 'falta tabla ' + tb);
  for (const s of schemaStatements().filter((x) => x.kind === 'index')) assert.ok(names.some((r) => r.name === s.name), 'falta índice ' + s.name);
  // La migración generada coincide con el esquema (npm run migration)
  const { readFileSync } = await import('node:fs');
  const file = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
  assert.ok(file.endsWith(toSQL()), 'migrations/0001_init.sql desactualizado: corre npm run migration');
});

t('d1Db: insert/find con bool, json, real y defaults del esquema', async () => {
  const { db } = await freshD1();
  const ins = await db.insert('services', { id: 'sv1', shop_id: 's1', name: 'Corte', duration_min: 40, price: 180.5, staff_ids: ['st1', 'st2'], created_at: now });
  assert.equal(ins.active, true);
  assert.equal(ins.popular, false);
  assert.equal(ins.sort, 0);
  const r = await db.findOne('services', { id: 'sv1' });
  assert.deepEqual(r.staff_ids, ['st1', 'st2']);
  assert.equal(r.active, true);
  assert.equal(r.popular, false);
  assert.equal(r.price, 180.5);
  assert.equal(r.description, null);
  await db.insert('shops', { id: 'sh1', slug: 'x', name: 'X', settings: { hours: { 1: [[600, 900]] }, public: { rating: 5 } }, created_at: now });
  const sh = await db.findOne('shops', { id: 'sh1' });
  assert.deepEqual(sh.settings, { hours: { 1: [[600, 900]] }, public: { rating: 5 } });
  assert.equal(sh.timezone, 'America/Mexico_City');
  assert.equal(await db.findOne('shops', { id: 'nada' }), null);
  // JSON corrupto en la base → null (no revienta la lectura)
  const raw = fakeD1(); await migrateSchema(raw);
  raw.sqlite.exec("INSERT INTO services (id, shop_id, name, duration_min, price, staff_ids, created_at) VALUES ('x','s','n',10,1,'{roto','t')");
  assert.equal((await d1Db(raw).findOne('services', { id: 'x' })).staff_ids, null);
  // Filtro por bool
  await db.insert('services', { id: 'sv2', shop_id: 's1', name: 'Barba', duration_min: 20, price: 100, active: false, created_at: now });
  assert.deepEqual((await db.find('services', { active: false })).map((s) => s.id), ['sv2']);
  assert.deepEqual((await db.find('services', { active: true })).map((s) => s.id), ['sv1']);
});

// Mismo conjunto de datos en memoria y en D1: toda consulta debe dar exactamente lo mismo.
async function parityPair() {
  const { db } = await freshD1();
  const mem = memoryDb();
  const rows = [];
  const names = ['Ana López', 'beto ruiz', 'Carla', 'DANIEL', 'Eva', 'Fer', 'Gil 100%', 'hugo_x', 'Iris', 'Juan'];
  names.forEach((n, i) => rows.push(client('c' + String(i).padStart(2, '0'), i % 3 ? 's1' : 's2', {
    name: n, phone: i % 4 ? '31100000' + String(i).padStart(2, '0') : null, email: i % 2 ? 'u' + i + '@x.mx' : null,
    marketing_ok: i % 2 === 0, deleted_at: i === 9 ? now : null, tags: i % 2 ? ['VIP'] : [], birthday: i % 5 ? '1990-0' + (1 + (i % 9)) + '-15' : null
  })));
  await db.insertMany('clients', rows);
  await mem.insertMany('clients', rows);
  return { db, mem };
}
const WHERES = [
  {}, { shop_id: 's1' }, { phone: null }, { phone: { isNull: false } }, { deleted_at: { isNull: true } },
  { id: { in: ['c01', 'c03', 'c99'] } }, { id: { in: [] } }, { shop_id: { ne: 's1' } }, { email: { ne: 'u1@x.mx' } },
  { birthday: { gt: '1990-03-01' } }, { birthday: { gte: '1990-03-15', lte: '1990-06-15' } }, { birthday: { lt: '1990-04-01' } },
  { name: { like: 'AN' } }, { name: { like: 'z' } }, { name: { like: 'ruiz' } }, { marketing_ok: true },
  { $or: [{ shop_id: 's2' }, { name: { like: 'eva' } }] }, { shop_id: 's1', $or: [{ phone: null }, { email: null }] },
  { $or: [] }
];
t('d1Db vs memoryDb: mismos resultados con todos los operadores, orden, límite y desplazamiento', async () => {
  const { db, mem } = await parityPair();
  for (const w of WHERES) {
    for (const o of [{ order: 'id asc' }, { order: ['shop_id desc', 'name asc'], limit: 3 }, { order: ['birthday desc', 'id asc'], offset: 2 }, { order: 'id', limit: 2, offset: 1 }]) {
      const a = (await db.find('clients', w, o)).map((r) => r.id);
      const b = (await mem.find('clients', w, o)).map((r) => r.id);
      assert.deepEqual(a, b, JSON.stringify(w) + ' ' + JSON.stringify(o));
    }
    assert.equal(await db.count('clients', w), await mem.count('clients', w), 'count ' + JSON.stringify(w));
  }
  // like es "contiene" (sin comodines del usuario)
  assert.deepEqual((await db.find('clients', { name: { like: 'gil 100' } })).map((r) => r.id), ['c06']);
  for (const q of ['go_', 'GIL', '100%', 'ó']) assert.deepEqual((await db.find('clients', { name: { like: q } })).map((r) => r.id), (await mem.find('clients', { name: { like: q } })).map((r) => r.id), 'like ' + q);
});

t('d1Db: IN con más de 80 valores (sin pasar de 100 parámetros por sentencia)', async () => {
  const { D1, db } = await freshD1();
  const rows = [];
  for (let i = 0; i < 150; i++) rows.push(client('c' + String(i).padStart(3, '0'), i % 2 ? 's1' : 's2', { phone: String(3110000000 + i) }));
  await db.insertMany('clients', rows); // 150 filas → 3 lotes de 50
  assert.equal(await db.count('clients'), 150);
  const ids = rows.slice(0, 120).map((r) => r.id).concat(['no-existe']);
  D1.log.length = 0;
  const found = await db.find('clients', { id: { in: ids }, shop_id: 's1' }, { order: 'id desc', limit: 10, offset: 5 });
  const expect = rows.slice(0, 120).filter((r) => r.shop_id === 's1').map((r) => r.id).sort().reverse().slice(5, 15);
  assert.deepEqual(found.map((r) => r.id), expect);
  assert.equal(await db.count('clients', { id: { in: ids } }), 120);
  assert.equal(await db.count('clients', { $or: [{ id: { in: ids } }, { shop_id: 's2' }] }), 135);
  assert.ok(D1.log.every((x) => x.n <= 100), 'ninguna sentencia con más de 100 parámetros');
  // Exactamente 80: todavía va en SQL
  D1.log.length = 0;
  assert.equal((await db.find('clients', { id: { in: rows.slice(0, 80).map((r) => r.id) } })).length, 80);
  assert.equal(D1.log[0].n, 80);
});

t('d1Db: update/delete devuelven filas afectadas y exigen where; unique → HttpError 409', async () => {
  const { db } = await freshD1();
  await db.insertMany('clients', [client('a', 's1'), client('b', 's1'), client('c', 's2')]);
  assert.equal(await db.update('clients', { shop_id: 's1' }, { notes: 'hola', tags: ['VIP'], marketing_ok: false, id: 'hack', shop_id: 's2', nope: 1 }), 2);
  const a = await db.findOne('clients', { id: 'a' });
  assert.equal(a.notes, 'hola');
  assert.deepEqual(a.tags, ['VIP']);
  assert.equal(a.marketing_ok, false);
  assert.equal(a.shop_id, 's1', 'id y shop_id no se cambian con update');
  assert.equal(await db.update('clients', { id: 'zzz' }, { notes: 'x' }), 0);
  assert.equal(await db.update('clients', { id: 'a' }, {}), 0);
  await assert.rejects(db.update('clients', {}, { notes: 'x' }), /sin where/);
  await assert.rejects(db.delete('clients', {}), /sin where/);
  assert.equal(await db.delete('clients', { id: { in: ['a', 'b'] } }), 2);
  assert.equal(await db.count('clients'), 1);
  // Únicos: shops.slug y users.email
  await db.insert('shops', { id: 'sh1', slug: 'uno', name: 'Uno', created_at: now });
  await db.insert('shops', { id: 'sh2', slug: 'dos', name: 'Dos', created_at: now });
  await assert.rejects(db.insert('shops', { id: 'sh3', slug: 'uno', name: 'Otra', created_at: now }), (e) => e instanceof HttpError && e.status === 409 && e.code === 'duplicate');
  await assert.rejects(db.update('shops', { id: 'sh2' }, { slug: 'uno' }), (e) => e instanceof HttpError && e.status === 409);
  await assert.rejects(db.insert('shops', { id: 'sh1', slug: 'tres', name: 'PK', created_at: now }), (e) => e instanceof HttpError && e.status === 409);
  // insertMany es transaccional por lote: un duplicado no deja filas a medias
  await db.insert('users', { id: 'u1', email: 'a@x.mx', name: 'A', created_at: now });
  await assert.rejects(db.insertMany('users', [{ id: 'u2', email: 'b@x.mx', name: 'B', created_at: now }, { id: 'u3', email: 'a@x.mx', name: 'C', created_at: now }]), (e) => e.status === 409);
  assert.equal(await db.count('users'), 1);
  // NOT NULL faltante es error de programación (no 409)
  await assert.rejects(db.insert('services', { id: 'sx', shop_id: 's1', name: null, duration_min: 10, created_at: now }), (e) => !(e instanceof HttpError));
});

t('scopedDb sobre D1: una barbería no ve, cambia ni borra datos de otra', async () => {
  const { db } = await freshD1();
  const A = scopedDb(db, 'shop_a');
  const B = scopedDb(db, 'shop_b');
  await A.insert('clients', client('ca', 'shop_b')); // el shop_id del llamador se ignora
  await B.insertMany('clients', [client('cb1', 'shop_a'), client('cb2', null)]);
  assert.equal((await db.findOne('clients', { id: 'ca' })).shop_id, 'shop_a');
  assert.deepEqual((await B.find('clients', {}, { order: 'id' })).map((c) => c.id), ['cb1', 'cb2']);
  assert.equal(await B.findOne('clients', { id: 'ca' }), null);
  assert.equal(await B.count('clients', { id: 'ca' }), 0);
  assert.equal(await B.update('clients', { id: 'ca' }, { name: 'robado' }), 0);
  assert.equal(await B.delete('clients', { id: 'ca' }), 0);
  // Ni con $or ni con shop_id en el where se escapa del scope
  assert.equal((await B.find('clients', { $or: [{ id: 'ca' }, { shop_id: 'shop_a' }] })).length, 0);
  assert.deepEqual((await B.find('clients', { shop_id: 'shop_a' }, { order: 'id' })).map((c) => c.shop_id + ':' + c.id), ['shop_b:cb1', 'shop_b:cb2']);
  assert.equal((await db.findOne('clients', { id: 'ca' })).name, 'Cliente ca');
  assert.throws(() => A.find('users'), /global/);
  assert.throws(() => scopedDb(db, ''), /sin shopId/);
});

t('ensureSchema: base antigua → agrega tablas, columnas e índices sin borrar nada; idempotente', async () => {
  const D1 = fakeD1();
  // Versión "vieja": shops sin domain/settings/…, users sin phone, staff sin role/bookable, y una columna extra.
  D1.sqlite.exec(`
    CREATE TABLE shops (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL, legacy_col TEXT);
    CREATE UNIQUE INDEX ux_shops_slug ON shops (slug);
    CREATE TABLE "users" ("id" TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, password_hash TEXT, is_superadmin INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, last_login_at TEXT, CONSTRAINT x UNIQUE (email));
    CREATE TABLE staff (id TEXT PRIMARY KEY, shop_id TEXT NOT NULL, user_id TEXT, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    INSERT INTO shops (id, slug, name, created_at, legacy_col) VALUES ('sh1', 'vieja', 'Vieja', '2020-01-01', 'conservar');
    INSERT INTO staff (id, shop_id, name, created_at) VALUES ('st1', 'sh1', 'Pepe', '2020-01-01');
  `);
  const r = await migrateSchema(D1);
  assert.deepEqual(r.errors, []);
  assert.ok(r.columns.includes('shops.domain') && r.columns.includes('shops.settings') && r.columns.includes('users.phone'));
  assert.ok(r.columns.includes('staff.role') && r.columns.includes('staff.bookable') && r.columns.includes('staff.commission_pct'));
  assert.ok(!r.columns.some((c) => c.startsWith('users.email') || c === 'shops.slug'));
  assert.ok(r.tables.includes('appointments') && r.tables.includes('clients') && !r.tables.includes('shops'));
  assert.ok(r.indexes.includes('ix_shops_domain') && r.indexes.includes('ux_users_email') && !r.indexes.includes('ux_shops_slug'));
  const cols = (tb) => D1.sqlite.prepare('PRAGMA table_info(' + tb + ')').all().map((c) => c.name);
  for (const [tb, def] of Object.entries(SCHEMA)) for (const c of Object.keys(def.columns)) assert.ok(cols(tb).includes(c), tb + '.' + c);
  assert.ok(cols('shops').includes('legacy_col'), 'no borra columnas viejas');
  // Datos intactos y defaults aplicados a filas existentes
  const db = d1Db(D1);
  const sh = await db.findOne('shops', { id: 'sh1' });
  assert.equal(sh.name, 'Vieja');
  assert.equal(sh.status, 'active');
  assert.equal(sh.plan, 'basic');
  assert.equal(D1.sqlite.prepare("SELECT legacy_col FROM shops WHERE id='sh1'").get().legacy_col, 'conservar');
  const st = await db.findOne('staff', { id: 'st1' });
  assert.equal(st.bookable, true);
  assert.equal(st.commission_pct, 50);
  assert.equal(st.role, null, 'NOT NULL sin default se agrega como columna opcional');
  // La base funciona completa con el adaptador
  await db.insert('staff', { id: 'st2', shop_id: 'sh1', name: 'Nuevo', role: 'barber', created_at: now });
  assert.equal((await db.findOne('staff', { id: 'st2' })).role, 'barber');
  // Segunda vez: nada que hacer, 1 sola consulta (sqlite_master)
  D1.log.length = 0;
  const again = await migrateSchema(D1);
  assert.deepEqual(again, { tables: [], columns: [], indexes: [], errors: [] });
  assert.equal(D1.log.length, 1);
});

t('ensureSchema: base vacía en un solo lote; caché por isolate; reintenta si falla', async () => {
  resetSchemaCache();
  const D1 = fakeD1();
  const [a, b] = await Promise.all([ensureSchema(D1), ensureSchema(D1)]);
  assert.equal(a, b);
  assert.equal(a.tables.length, TABLES.length);
  const n = D1.log.length;
  await ensureSchema(D1);
  assert.equal(D1.log.length, n, 'en caché: no vuelve a consultar');
  resetSchemaCache();
  // Falla (sin binding) → no queda en caché
  await assert.rejects(ensureSchema(null), /binding/);
  const D2 = fakeD1();
  assert.equal((await ensureSchema(D2)).tables.length, TABLES.length);
  resetSchemaCache();
});

t('ensureSchema: si el lote falla, aplica sentencia por sentencia; un índice imposible no tumba la app', async () => {
  const D1 = fakeD1();
  D1.sqlite.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
    INSERT INTO users VALUES ('u1','a@x.mx','A','t'), ('u2','a@x.mx','B','t');`);
  const r = await migrateSchema(D1);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].name, 'ux_users_email');
  assert.equal(r.tables.length, TABLES.length - 1);
  assert.ok(r.columns.includes('users.is_superadmin'));
  // Tabla imposible de crear → error fatal
  const D3 = fakeD1({ failOn: /CREATE TABLE IF NOT EXISTS appointments/ });
  await assert.rejects(migrateSchema(D3), /appointments/);
  // Sin batch disponible también funciona
  const D4 = Object.assign(fakeD1(), {});
  D4.batch = async () => { throw new Error('D1_ERROR: batch no disponible'); };
  const r4 = await migrateSchema(D4);
  assert.equal(r4.tables.length, TABLES.length);
  assert.deepEqual(r4.errors, []);
});

t('d1-migrate: utilidades de SQL', () => {
  assert.deepEqual(splitSQL("CREATE TABLE a (x TEXT DEFAULT 'a;b');\nCREATE INDEX i ON a (x);\n"), ["CREATE TABLE a (x TEXT DEFAULT 'a;b')", 'CREATE INDEX i ON a (x)']);
  assert.deepEqual([...columnsFromCreate('CREATE TABLE "t" ("a b" TEXT, `c` INT, [d] REAL, e TEXT DEFAULT \'x,y\', f NUMERIC(10, 2), PRIMARY KEY (a), CONSTRAINT u UNIQUE (c), CHECK (e <> \'\'))')], ['a b', 'c', 'd', 'e', 'f']);
  assert.equal(columnsFromCreate('basura'), null);
  assert.equal(addColumnSQL('staff', 'role', SCHEMA.staff.columns.role), 'ALTER TABLE staff ADD COLUMN role TEXT');
  assert.equal(addColumnSQL('staff', 'bookable', SCHEMA.staff.columns.bookable), 'ALTER TABLE staff ADD COLUMN bookable INTEGER NOT NULL DEFAULT 1');
  assert.equal(addColumnSQL('shops', 'timezone', SCHEMA.shops.columns.timezone), "ALTER TABLE shops ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Mexico_City'");
  const st = schemaStatements();
  assert.equal(st.filter((s) => s.kind === 'table').length, TABLES.length);
  assert.equal(st.map((s) => s.sql + ';').join('\n') + '\n', toSQL());
});

// ── Pages Function (functions/api/[[path]].js) con el D1 falso ──
const fn = await import('../functions/api/[[path]].js');
function req(method, path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'cf-connecting-ip': '9.9.9.9' }, opts.headers || {});
  let body = opts.raw;
  if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers['content-type'] = 'application/json'; }
  return new Request('https://gomez.tubarberia.mx' + path, { method, headers, body });
}
async function callFn(env, method, path, opts) {
  let nextCalled = false;
  const res = await fn.onRequest({ request: req(method, path, opts), env, next: async () => { nextCalled = true; return new Response('estático'); }, waitUntil: () => {} });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* no JSON */ }
  return { res, status: res.status, json, text, nextCalled };
}

t('Pages Function: sin D1 → 503; health; cuerpo inválido/enorme; cabeceras de seguridad; solo /api/*', async () => {
  resetSchemaCache();
  let r = await callFn({}, 'GET', '/api/health');
  assert.equal(r.status, 503);
  assert.deepEqual(r.json, { ok: false, error: { code: 'backend_not_configured', message: 'El servidor aún no tiene base de datos configurada.' } });
  const env = { DB: fakeD1() };
  r = await callFn(env, 'GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.data.backend, 'd1');
  assert.equal(r.json.data.mode, 'server');
  assert.equal(r.res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.res.headers.get('cache-control'), 'no-store');
  r = await callFn(env, 'POST', '/api/auth/login', { raw: '{"email":', headers: { 'content-type': 'application/json' } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'bad_request');
  r = await callFn(env, 'POST', '/api/auth/login', { raw: 'x'.repeat(1024 * 1024 + 10) });
  assert.equal(r.status, 413);
  r = await callFn(env, 'POST', '/api/auth/login', { body: { email: 'no', password: '' } });
  assert.equal(r.status, 400);
  assert.ok(r.json.error.fields.email);
  r = await callFn(env, 'GET', '/api/no-existe');
  assert.equal(r.status, 404);
  r = await callFn(env, 'GET', '/app/index.html');
  assert.ok(r.nextCalled);
  // La base quedó creada por ensureSchema
  assert.ok(env.DB.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='appointments'").get());
  resetSchemaCache();
});

t('Pages Function: setup + login con cookie + CSRF + barbería activa + logout sobre D1', async () => {
  resetSchemaCache();
  const env = { DB: fakeD1(), SETUP_KEY: 'llave-de-prueba' };
  let r = await callFn(env, 'GET', '/api/setup/status');
  assert.deepEqual(r.json.data, { needs_setup: true, has_setup_key: true, has_demo: false });
  r = await callFn(env, 'POST', '/api/setup', { body: { key: 'llave-de-prueba', email: 'zeus@tubarberia.mx', password: 'superseguro1', name: 'Zeus', pins: { angel: '1234', alexis: '5678' } } });
  assert.equal(r.status, 200, r.text);
  const shopId = r.json.data.shop.id;
  r = await callFn(env, 'POST', '/api/auth/login', { body: { email: 'zeus@tubarberia.mx', password: 'superseguro1' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.data.token, undefined, 'en servidor el token solo va en la cookie');
  const setCookie = r.res.headers.getSetCookie();
  assert.equal(setCookie.length, 1);
  assert.match(setCookie[0], /^tb_sid=.+HttpOnly; SameSite=Lax; Secure/);
  const cookie = setCookie[0].split(';')[0];
  r = await callFn(env, 'GET', '/api/services', { headers: { cookie, 'x-shop-id': shopId } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.length, 10);
  // CSRF: escritura con cookie sin x-requested-with → 403
  r = await callFn(env, 'POST', '/api/auth/logout', { headers: { cookie } });
  assert.equal(r.status, 403);
  r = await callFn(env, 'POST', '/api/auth/logout', { headers: { cookie, 'x-requested-with': 'tb' } });
  assert.equal(r.status, 200);
  assert.match(r.res.headers.getSetCookie()[0], /Max-Age=0/);
  r = await callFn(env, 'GET', '/api/auth/me', { headers: { cookie } });
  assert.equal(r.status, 401);
  // Reserva pública sobre D1 en la barbería creada
  r = await callFn(env, 'GET', '/api/public/shops/new-gomez');
  assert.equal(r.status, 200);
  assert.equal(r.json.data.services.length, 10);
  resetSchemaCache();
});
