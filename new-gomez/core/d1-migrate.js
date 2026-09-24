// Auto-migración ADITIVA de Cloudflare D1 a partir de core/schema.js: el dueño del proyecto no corre
// ningún comando; la primera petición de cada isolate deja la base al día.
//
//   await ensureSchema(env.DB)   → una vez por isolate (el resultado queda en caché del módulo)
//   await migrateSchema(D1)      → sin caché (pruebas, scripts)
//
// Crea las tablas e índices que falten (las mismas sentencias de toSQL()) y agrega las columnas nuevas
// con ALTER TABLE ADD COLUMN. Nunca borra, renombra ni cambia tipos: una columna que ya no está en el
// esquema se queda en la base sin usarse. Con la base al día cuesta 1 consulta (sqlite_master).
import { SCHEMA, toSQL } from './schema.js';

const SQL_TYPE = { text: 'TEXT', int: 'INTEGER', real: 'REAL', bool: 'INTEGER', json: 'TEXT' };

let cached = null;
export function ensureSchema(D1) {
  if (!cached) cached = migrateSchema(D1).catch((e) => { cached = null; throw e; });
  return cached;
}
export function resetSchemaCache() { cached = null; }

// Parte un script SQL en sentencias (respeta ';' dentro de cadenas '...').
export function splitSQL(sql) {
  const out = [];
  let cur = '', q = false;
  for (const ch of String(sql || '')) {
    if (ch === "'") q = !q;
    if (ch === ';' && !q) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Sentencias de toSQL() etiquetadas: { sql, kind: 'table'|'index', name }.
export function schemaStatements() {
  return splitSQL(toSQL()).map((sql) => {
    const m = /^CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\s+(\w+)/i.exec(sql);
    if (!m) throw new Error('Sentencia inesperada en toSQL(): ' + sql.slice(0, 60));
    return { sql, kind: m[1].toLowerCase(), name: m[2].toLowerCase() };
  });
}

const literal = (d) => {
  const v = d.type === 'bool' ? (d.default ? 1 : 0) : d.default;
  return typeof v === 'string' ? "'" + v.replace(/'/g, "''") + "'" : String(v);
};
// Definición de una columna para ALTER TABLE ADD COLUMN. SQLite no permite agregar PRIMARY KEY/UNIQUE,
// ni NOT NULL sin un DEFAULT no nulo: en ese caso la columna queda sin NOT NULL (la app siempre la llena).
export function addColumnSQL(table, col, d) {
  let s = 'ALTER TABLE ' + table + ' ADD COLUMN ' + col + ' ' + SQL_TYPE[d.type];
  const hasDefault = d.default !== undefined && d.default !== null;
  if (d.notNull && !d.pk && hasDefault) s += ' NOT NULL';
  if (hasDefault) s += ' DEFAULT ' + literal(d);
  return s;
}

// Nombres de columna (en minúsculas) de un CREATE TABLE guardado en sqlite_master; null si no se entiende.
// SQLite reescribe ese texto con cada ALTER TABLE ADD COLUMN, así que refleja las columnas actuales.
export function columnsFromCreate(sql) {
  const a = String(sql || '').indexOf('('), b = String(sql || '').lastIndexOf(')');
  if (a < 0 || b <= a) return null;
  const parts = [];
  let depth = 0, cur = '', q = null;
  for (const ch of sql.slice(a + 1, b)) {
    if (q) { if (ch === q) q = null; cur += ch; continue; }
    if (ch === "'" || ch === '"' || ch === '`') q = ch;
    else if (ch === '[') q = ']';
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  const cols = new Set();
  for (const p of parts) {
    const m = /^\s*(?:"((?:[^"]|"")+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))/.exec(p);
    if (!m) continue;
    if (m[4] && /^(constraint|primary|unique|check|foreign)$/i.test(m[4])) continue;
    cols.add((m[1] || m[2] || m[3] || m[4]).replace(/""/g, '"').toLowerCase());
  }
  return cols.size ? cols : null;
}

async function all(D1, sql) { const r = await D1.prepare(sql).all(); return (r && r.results) || []; }
const benign = (e) => /duplicate column name|already exists/i.test(String(e && e.message || e));

// → { tables:[creadas], columns:['tabla.columna'], indexes:[creados], errors:[{ name, message }] }
export async function migrateSchema(D1) {
  if (!D1 || typeof D1.prepare !== 'function') throw new Error('migrateSchema: falta el binding de D1');
  const res = { tables: [], columns: [], indexes: [], errors: [] };
  const master = await all(D1, "SELECT type, name, sql FROM sqlite_master WHERE type IN ('table','index')");
  const tables = new Map();
  const indexes = new Set();
  for (const r of master) {
    const n = String(r.name || '').toLowerCase();
    if (r.type === 'table') tables.set(n, r.sql || ''); else indexes.add(n);
  }

  // Columnas faltantes en tablas existentes: sospecha barata con sqlite_master, confirmación con PRAGMA table_info.
  const todo = [];
  for (const [t, def] of Object.entries(SCHEMA)) {
    if (!tables.has(t)) continue;
    const quick = columnsFromCreate(tables.get(t));
    if (quick && Object.keys(def.columns).every((c) => quick.has(c))) continue;
    const have = new Set((await all(D1, 'PRAGMA table_info(' + t + ')')).map((r) => String(r.name).toLowerCase()));
    for (const [c, d] of Object.entries(def.columns)) {
      if (!have.has(c)) todo.push({ sql: addColumnSQL(t, c, d), kind: 'column', name: t + '.' + c });
    }
  }
  // Tablas e índices faltantes (en el orden de toSQL(): cada tabla antes que sus índices, y después de los ALTER).
  for (const s of schemaStatements()) {
    if (s.kind === 'table' ? !tables.has(s.name) : !indexes.has(s.name)) todo.push(s);
  }
  if (!todo.length) return res;

  const done = (s) => { (s.kind === 'table' ? res.tables : s.kind === 'column' ? res.columns : res.indexes).push(s.name); };
  try {
    // Un solo lote = una transacción: o queda todo o nada.
    await D1.batch(todo.map((s) => D1.prepare(s.sql)));
    todo.forEach(done);
  } catch (e) {
    // Otro isolate migrando a la vez, o un índice único imposible con los datos actuales: sentencia por sentencia.
    const fatal = [];
    for (const s of todo) {
      try { await D1.prepare(s.sql).run(); done(s); } catch (err) {
        if (benign(err)) continue;
        if (s.kind === 'table') fatal.push(s.name);
        res.errors.push({ name: s.name, message: String(err && err.message || err) });
        if (typeof console !== 'undefined') console.error('[d1-migrate] ' + s.name + ': ' + (err && err.message || err));
      }
    }
    if (fatal.length) throw new Error('No se pudieron crear las tablas: ' + fatal.join(', '));
  }
  return res;
}
