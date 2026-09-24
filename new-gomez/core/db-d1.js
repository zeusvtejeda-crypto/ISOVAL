// Adaptador Cloudflare D1 (SQLite) con la misma interfaz que memoryDb() (ver db.js).
import { SCHEMA } from './schema.js';
import { tableDef, normalizeRow, cleanPatch, matches, sortRows, parseOrder } from './db.js';
import { HttpError } from './util.js';

const MAX_IN = 80; // D1 admite ~100 parámetros por sentencia: listas IN más largas se parten.

function encode(d, v) {
  if (v === null || v === undefined) return null;
  if (d.type === 'bool') return v ? 1 : 0;
  if (d.type === 'json') return JSON.stringify(v);
  return v;
}
function decodeRow(table, raw) {
  const def = tableDef(table);
  const out = {};
  for (const [c, d] of Object.entries(def.columns)) {
    let v = raw[c];
    if (v === undefined) v = null;
    if (v !== null) {
      if (d.type === 'bool') v = !!v;
      else if (d.type === 'json') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    }
    out[c] = v;
  }
  return out;
}

function buildWhere(table, where, params) {
  const def = tableDef(table);
  const parts = [];
  for (const [k, cond] of Object.entries(where || {})) {
    if (cond === undefined) continue;
    if (k === '$or') {
      const ors = cond.map((w) => '(' + (buildWhere(table, w, params) || '1=1') + ')');
      parts.push('(' + (ors.join(' OR ') || '1=0') + ')');
      continue;
    }
    const d = def.columns[k];
    if (!d) throw new Error('Columna desconocida ' + table + '.' + k);
    if (cond === null) { parts.push(k + ' IS NULL'); continue; }
    if (typeof cond !== 'object' || Array.isArray(cond)) { params.push(encode(d, cond)); parts.push(k + ' = ?'); continue; }
    for (const [op, x] of Object.entries(cond)) {
      if (op === 'in') {
        if (!x.length) { parts.push('1=0'); continue; }
        parts.push(k + ' IN (' + x.map(() => '?').join(',') + ')');
        x.forEach((v) => params.push(encode(d, v)));
      } else if (op === 'ne') { params.push(encode(d, x)); parts.push('(' + k + ' IS NULL OR ' + k + ' <> ?)'); }
      else if (op === 'gt') { params.push(encode(d, x)); parts.push(k + ' > ?'); }
      else if (op === 'gte') { params.push(encode(d, x)); parts.push(k + ' >= ?'); }
      else if (op === 'lt') { params.push(encode(d, x)); parts.push(k + ' < ?'); }
      else if (op === 'lte') { params.push(encode(d, x)); parts.push(k + ' <= ?'); }
      else if (op === 'like') { params.push('%' + String(x).toLowerCase().replace(/[%_]/g, '') + '%'); parts.push('LOWER(COALESCE(' + k + ",'')) LIKE ?"); }
      else if (op === 'isNull') parts.push(k + (x ? ' IS NULL' : ' IS NOT NULL'));
      else throw new Error('Operador no soportado: ' + op);
    }
  }
  return parts.join(' AND ');
}

function hasBigIn(where) {
  for (const [k, c] of Object.entries(where || {})) {
    if (k === '$or') { if (c.some(hasBigIn)) return true; continue; }
    if (c && typeof c === 'object' && Array.isArray(c.in) && c.in.length > MAX_IN) return true;
  }
  return false;
}
// Quita condiciones IN grandes (se aplican después en JS).
function stripBigIn(where) {
  const w = {};
  for (const [k, c] of Object.entries(where || {})) {
    if (k === '$or') { if (!c.some(hasBigIn)) w[k] = c; continue; }
    if (c && typeof c === 'object' && Array.isArray(c.in) && c.in.length > MAX_IN) continue;
    w[k] = c;
  }
  return w;
}

function wrapErr(e) {
  const msg = String(e && e.message || e);
  if (/UNIQUE constraint failed/i.test(msg)) return new HttpError(409, 'duplicate', 'Ya existe un registro con esos datos.');
  return e;
}

export function d1Db(D1) {
  const run = async (sql, params) => {
    try { return await D1.prepare(sql).bind(...params).run(); } catch (e) { throw wrapErr(e); }
  };
  const all = async (sql, params) => {
    try { const r = await D1.prepare(sql).bind(...params).all(); return r.results || []; } catch (e) { throw wrapErr(e); }
  };
  const orderSql = (order) => {
    const ord = parseOrder(order);
    return ord.length ? ' ORDER BY ' + ord.map((o) => o.col + (o.desc ? ' DESC' : ' ASC')).join(', ') : '';
  };
  const api = {
    kind: 'd1',
    async find(table, where, o) {
      o = o || {};
      if (hasBigIn(where)) {
        // Consulta amplia + filtro exacto en JS (listas IN enormes: raro, p. ej. reportes por muchos clientes).
        const params = [];
        const ws = buildWhere(table, stripBigIn(where), params);
        const raw = await all('SELECT * FROM ' + table + (ws ? ' WHERE ' + ws : ''), params);
        let rows = raw.map((r) => decodeRow(table, r)).filter((r) => matches(r, where));
        rows = sortRows(rows, o.order);
        if (o.offset) rows = rows.slice(o.offset);
        if (o.limit != null) rows = rows.slice(0, o.limit);
        return rows;
      }
      const params = [];
      const ws = buildWhere(table, where, params);
      let sql = 'SELECT * FROM ' + table + (ws ? ' WHERE ' + ws : '') + orderSql(o.order);
      if (o.limit != null) { sql += ' LIMIT ?'; params.push(o.limit | 0); }
      if (o.offset) { if (o.limit == null) sql += ' LIMIT -1'; sql += ' OFFSET ?'; params.push(o.offset | 0); }
      return (await all(sql, params)).map((r) => decodeRow(table, r));
    },
    async findOne(table, where) {
      const rows = await api.find(table, where, { limit: 1 });
      return rows[0] || null;
    },
    async count(table, where) {
      if (hasBigIn(where)) return (await api.find(table, where)).length;
      const params = [];
      const ws = buildWhere(table, where, params);
      const rows = await all('SELECT COUNT(*) AS n FROM ' + table + (ws ? ' WHERE ' + ws : ''), params);
      return rows[0] ? Number(rows[0].n) : 0;
    },
    async insert(table, row) {
      const r = normalizeRow(table, row);
      if (!r.id) throw new Error('insert sin id en ' + table);
      const def = tableDef(table);
      const cols = Object.keys(def.columns);
      await run('INSERT INTO ' + table + ' (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')', cols.map((c) => encode(def.columns[c], r[c])));
      return r;
    },
    async insertMany(table, rows) {
      if (!rows.length) return 0;
      const def = tableDef(table);
      const cols = Object.keys(def.columns);
      const sql = 'INSERT INTO ' + table + ' (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')';
      const stmts = rows.map((row) => { const r = normalizeRow(table, row); return D1.prepare(sql).bind(...cols.map((c) => encode(def.columns[c], r[c]))); });
      // D1 batch = transacción; se parte en lotes para no exceder límites.
      for (let i = 0; i < stmts.length; i += 50) {
        try { await D1.batch(stmts.slice(i, i + 50)); } catch (e) { throw wrapErr(e); }
      }
      return rows.length;
    },
    async update(table, where, patch) {
      const p = cleanPatch(table, patch);
      const keys = Object.keys(p);
      if (!keys.length) return 0;
      const def = tableDef(table);
      const params = keys.map((k) => encode(def.columns[k], p[k]));
      const ws = buildWhere(table, where, params);
      if (!ws) throw new Error('update sin where en ' + table);
      const r = await run('UPDATE ' + table + ' SET ' + keys.map((k) => k + ' = ?').join(', ') + ' WHERE ' + ws, params);
      return (r.meta && r.meta.changes) || 0;
    },
    async delete(table, where) {
      const params = [];
      const ws = buildWhere(table, where, params);
      if (!ws) throw new Error('delete sin where en ' + table);
      const r = await run('DELETE FROM ' + table + ' WHERE ' + ws, params);
      return (r.meta && r.meta.changes) || 0;
    }
  };
  return api;
}

export { SCHEMA };
