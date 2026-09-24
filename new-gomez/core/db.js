// Capa de datos común. Dos implementaciones con la MISMA interfaz asíncrona:
//   - memoryDb(): en memoria (+ persistencia opcional en localStorage) → demo en el navegador y tests.
//   - d1Db(env.DB) (db-d1.js): Cloudflare D1 → producción.
//
// Interfaz:
//   find(table, where?, opts?)   → filas          opts: { order: 'col desc' | ['a asc','b desc'], limit, offset }
//   findOne(table, where)        → fila | null
//   count(table, where?)         → número
//   insert(table, row)           → fila (con defaults aplicados)
//   insertMany(table, rows)      → número
//   update(table, where, patch)  → filas cambiadas
//   delete(table, where)         → filas borradas
//
// where: { col: valor }            igualdad (null → IS NULL)
//        { col: { in: [...] } }    { col: { ne: v } }   { col: { gt|gte|lt|lte: v } }
//        { col: { like: 'texto' } } contiene, sin distinguir mayúsculas
//        { col: { isNull: true|false } }
//        { $or: [ where, where ] }
import { SCHEMA } from './schema.js';
import { HttpError } from './util.js';

export function tableDef(table) {
  const def = SCHEMA[table];
  if (!def) throw new Error('Tabla desconocida: ' + table);
  return def;
}

// Aplica defaults del esquema y descarta columnas desconocidas.
export function normalizeRow(table, row) {
  const def = tableDef(table);
  const out = {};
  for (const [c, d] of Object.entries(def.columns)) {
    let v = row[c];
    if (v === undefined) v = d.default !== undefined ? d.default : null;
    if (v !== null && d.type === 'bool') v = !!v;
    if (v !== null && (d.type === 'int' || d.type === 'real')) v = Number(v);
    out[c] = v;
  }
  return out;
}
export function cleanPatch(table, patch) {
  const def = tableDef(table);
  const out = {};
  for (const k of Object.keys(patch || {})) {
    if (!(k in def.columns) || k === 'id' || k === 'shop_id') continue;
    let v = patch[k];
    const d = def.columns[k];
    if (v === undefined) continue;
    if (v !== null && d.type === 'bool') v = !!v;
    if (v !== null && (d.type === 'int' || d.type === 'real')) v = Number(v);
    out[k] = v;
  }
  return out;
}

// ── Coincidencia en memoria (también la usa db-d1 para filtros que no caben en SQL) ──
function matchCond(v, cond) {
  if (cond === null) return v === null || v === undefined;
  if (typeof cond !== 'object' || Array.isArray(cond)) return v === cond;
  for (const [op, x] of Object.entries(cond)) {
    if (op === 'in') { if (!x.includes(v)) return false; }
    else if (op === 'ne') { if (v === x) return false; }
    else if (op === 'gt') { if (!(v !== null && v > x)) return false; }
    else if (op === 'gte') { if (!(v !== null && v >= x)) return false; }
    else if (op === 'lt') { if (!(v !== null && v < x)) return false; }
    else if (op === 'lte') { if (!(v !== null && v <= x)) return false; }
    else if (op === 'like') { if (!String(v == null ? '' : v).toLowerCase().includes(String(x).toLowerCase())) return false; }
    else if (op === 'isNull') { if ((v === null || v === undefined) !== !!x) return false; }
    else throw new Error('Operador no soportado: ' + op);
  }
  return true;
}
export function matches(row, where) {
  for (const [k, cond] of Object.entries(where || {})) {
    if (k === '$or') { if (!cond.some((w) => matches(row, w))) return false; continue; }
    if (cond === undefined) continue;
    if (!matchCond(row[k], cond)) return false;
  }
  return true;
}
export function parseOrder(order) {
  if (!order) return [];
  return (Array.isArray(order) ? order : [order]).map((o) => {
    const [col, dir] = String(o).trim().split(/\s+/);
    return { col, desc: (dir || '').toLowerCase() === 'desc' };
  });
}
export function sortRows(rows, order) {
  const ord = parseOrder(order);
  if (!ord.length) return rows;
  return rows.sort((a, b) => {
    for (const { col, desc } of ord) {
      const x = a[col], y = b[col];
      if (x === y) continue;
      if (x === null || x === undefined) return desc ? 1 : -1;
      if (y === null || y === undefined) return desc ? -1 : 1;
      const r = x < y ? -1 : 1;
      return desc ? -r : r;
    }
    return 0;
  });
}
const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

// ── Adaptador en memoria ──
// opts.load(): objeto {tabla: filas} inicial; opts.save(data): se llama (con debounce) tras cada escritura.
export function memoryDb(opts) {
  opts = opts || {};
  let data = {};
  const initial = opts.load ? opts.load() : null;
  for (const t of Object.keys(SCHEMA)) data[t] = (initial && Array.isArray(initial[t])) ? initial[t] : [];
  let timer = null;
  const persist = () => {
    if (!opts.save) return;
    clearTimeout(timer);
    timer = setTimeout(() => { try { opts.save(data); } catch (e) { /* cuota llena, etc. */ } }, opts.debounce == null ? 150 : opts.debounce);
  };
  const tbl = (t) => { tableDef(t); return data[t]; };
  const api = {
    kind: 'memory',
    async find(table, where, o) {
      o = o || {};
      let rows = tbl(table).filter((r) => matches(r, where));
      rows = sortRows(rows.slice(), o.order);
      if (o.offset) rows = rows.slice(o.offset);
      if (o.limit != null) rows = rows.slice(0, o.limit);
      return clone(rows);
    },
    async findOne(table, where) { const r = tbl(table).find((x) => matches(x, where)); return r ? clone(r) : null; },
    async count(table, where) { return tbl(table).filter((r) => matches(r, where)).length; },
    async insert(table, row) {
      const r = normalizeRow(table, row);
      if (!r.id) throw new Error('insert sin id en ' + table);
      checkUnique(table, r);
      tbl(table).push(r); persist();
      return clone(r);
    },
    async insertMany(table, rows) {
      const t = tbl(table);
      for (const row of rows) { const r = normalizeRow(table, row); t.push(r); }
      persist();
      return rows.length;
    },
    async update(table, where, patch) {
      const p = cleanPatch(table, patch);
      let n = 0;
      for (const r of tbl(table)) if (matches(r, where)) {
        const next = Object.assign({}, r, p);
        checkUnique(table, next, r);
        Object.assign(r, p); n++;
      }
      if (n) persist();
      return n;
    },
    async delete(table, where) {
      const before = tbl(table).length;
      data[table] = tbl(table).filter((r) => !matches(r, where));
      const n = before - data[table].length;
      if (n) persist();
      return n;
    },
    // Solo memoria: exportar/reemplazar todo (demo → "Reiniciar demo").
    dump() { return data; },
    replace(next) { data = {}; for (const t of Object.keys(SCHEMA)) data[t] = (next && next[t]) || []; persist(); },
    flush() { if (opts.save) { clearTimeout(timer); opts.save(data); } }
  };
  function checkUnique(table, r, self) {
    for (const cols of (tableDef(table).unique || [])) {
      const dup = data[table].find((x) => x !== self && cols.every((c) => x[c] === r[c]));
      if (dup) throw new HttpError(409, 'duplicate', 'Ya existe un registro con ese ' + cols.join(', ') + '.');
    }
  }
  return api;
}

// ── Aislamiento por barbería ──
// Todas las lecturas/escrituras de tablas `scoped` pasan por aquí con el shop_id de la SESIÓN.
// Pedir una tabla global a través de un scopedDb es un error de programación (se lanza).
export function scopedDb(db, shopId) {
  if (!shopId) throw new Error('scopedDb sin shopId');
  const guard = (table) => { if (!tableDef(table).scoped) throw new Error('Tabla global "' + table + '" pedida por scopedDb'); };
  const w = (where) => Object.assign({}, where || {}, { shop_id: shopId });
  return {
    kind: db.kind,
    shopId,
    find(table, where, o) { guard(table); return db.find(table, w(where), o); },
    findOne(table, where) { guard(table); return db.findOne(table, w(where)); },
    count(table, where) { guard(table); return db.count(table, w(where)); },
    insert(table, row) { guard(table); return db.insert(table, Object.assign({}, row, { shop_id: shopId })); },
    insertMany(table, rows) { guard(table); return db.insertMany(table, rows.map((r) => Object.assign({}, r, { shop_id: shopId }))); },
    update(table, where, patch) { guard(table); return db.update(table, w(where), patch); },
    delete(table, where) { guard(table); return db.delete(table, w(where)); }
  };
}
