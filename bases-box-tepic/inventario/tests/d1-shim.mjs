// Imita lo mínimo de D1 (prepare/bind/all/first/run/batch) sobre node:sqlite, para probar
// functions/_d1.js sin Cloudflare. Requiere Node 22.13 o más reciente.
import { DatabaseSync } from 'node:sqlite';

class Sentencia {
  constructor(db, sql, args) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) { return new Sentencia(this.db, this.sql, args); }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args), success: true }; }
  async first() {
    const r = this.db.prepare(this.sql).get(...this.args);
    return r === undefined ? null : { ...r };
  }
  async run() {
    const info = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: info.changes } };
  }
}

export class D1Falsa {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.cola = Promise.resolve(); // D1 atiende las escrituras de una en una
  }
  prepare(sql) { return new Sentencia(this.db, sql, []); }
  batch(stmts) {
    const turno = this.cola.then(() => {
      this.db.exec('BEGIN');
      try {
        const out = stmts.map((s) => {
          const info = this.db.prepare(s.sql).run(...s.args);
          return { success: true, meta: { changes: info.changes } };
        });
        this.db.exec('COMMIT');
        return out;
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw new Error('D1_ERROR: ' + e.message);
      }
    });
    this.cola = turno.catch(() => {});
    return turno;
  }
}
