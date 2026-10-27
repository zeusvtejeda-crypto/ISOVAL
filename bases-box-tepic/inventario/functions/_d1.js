// Repo de Cloudflare D1 para el núcleo del inventario (public/core.js).
// Cada operación se guarda con un solo db.batch(): D1 lo ejecuta como transacción, así que
// el stock, las anulaciones y los traspasos cambian todos o ninguno. Las columnas stock_*
// tienen CHECK (>= 0): si dos personas gastan la última pieza a la vez, una de las dos falla.
// Las listas van como un único parámetro JSON (json_each) para no toparse con el límite de
// 100 parámetros ni de 50 consultas por petición del plan gratis.
import BBCore from '../public/core.js';

const { ApiError } = BBCore;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL, cat TEXT NOT NULL, medida TEXT NOT NULL DEFAULT '', tono TEXT NOT NULL DEFAULT '',
    unidad TEXT NOT NULL DEFAULT 'pza', precio REAL NOT NULL DEFAULT 0, costo REAL NOT NULL DEFAULT 0,
    min_local INTEGER NOT NULL DEFAULT 0, min_tienda INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1,
    stock_local INTEGER NOT NULL DEFAULT 0 CHECK (stock_local >= 0), stock_tienda INTEGER NOT NULL DEFAULT 0 CHECK (stock_tienda >= 0),
    hubo_local INTEGER NOT NULL DEFAULT 0, hubo_tienda INTEGER NOT NULL DEFAULT 0,
    creado INTEGER NOT NULL, actualizado INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS movs (
    id TEXT PRIMARY KEY, ts INTEGER NOT NULL, prod TEXT NOT NULL, loc TEXT NOT NULL, delta INTEGER NOT NULL, tipo TEXT NOT NULL,
    motivo TEXT NOT NULL DEFAULT '', nota TEXT NOT NULL DEFAULT '', rol TEXT NOT NULL, precio REAL, cliente TEXT NOT NULL DEFAULT '',
    pago TEXT NOT NULL DEFAULT '', envio REAL NOT NULL DEFAULT 0, grupo TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', anulado INTEGER NOT NULL DEFAULT 0,
    anulado_ts INTEGER NOT NULL DEFAULT 0, anulado_por TEXT NOT NULL DEFAULT '', anulado_nota TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS movs_ts ON movs (ts DESC, id DESC)`,
  `CREATE INDEX IF NOT EXISTS movs_grupo ON movs (grupo)`,
  `CREATE INDEX IF NOT EXISTS movs_prod ON movs (prod, ts DESC)`,
  `CREATE TABLE IF NOT EXISTS traspasos (
    id TEXT PRIMARY KEY, ts INTEGER NOT NULL, estado TEXT NOT NULL, nota TEXT NOT NULL DEFAULT '', pedido TEXT NOT NULL DEFAULT '',
    recibido_ts INTEGER NOT NULL DEFAULT 0, nota_recibo TEXT NOT NULL DEFAULT '', dif INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS traspaso_lineas (
    traspaso_id TEXT NOT NULL, prod TEXT NOT NULL, cant INTEGER NOT NULL, recibida INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (traspaso_id, prod))`,
  `CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY, ts INTEGER NOT NULL, estado TEXT NOT NULL, nota TEXT NOT NULL DEFAULT '', traspaso TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS pedido_lineas (pedido_id TEXT NOT NULL, prod TEXT NOT NULL, cant INTEGER NOT NULL, PRIMARY KEY (pedido_id, prod))`,
  `CREATE TABLE IF NOT EXISTS gastos (
    id TEXT PRIMARY KEY, ts INTEGER NOT NULL, rol TEXT NOT NULL, monto REAL NOT NULL CHECK (monto > 0), cat TEXT NOT NULL, concepto TEXT NOT NULL DEFAULT '',
    pago TEXT NOT NULL DEFAULT 'efectivo', anulado INTEGER NOT NULL DEFAULT 0, anulado_ts INTEGER NOT NULL DEFAULT 0, anulado_por TEXT NOT NULL DEFAULT '', anulado_nota TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS gastos_ts ON gastos (ts DESC)`,
  `CREATE TABLE IF NOT EXISTS intentos (k TEXT PRIMARY KEY, n INTEGER NOT NULL, b INTEGER NOT NULL, hasta INTEGER NOT NULL, adm INTEGER NOT NULL)`,
  // tabla trampa: insertar aquí rompe el CHECK y deshace todo el batch (ver guardas)
  `CREATE TABLE IF NOT EXISTS guardas (g INTEGER NOT NULL CHECK (g = 0))`
];

const COLS_PRODUCTO = ['id', 'nombre', 'cat', 'medida', 'tono', 'unidad', 'precio', 'costo', 'min_local', 'min_tienda', 'activo', 'stock_local', 'stock_tienda', 'hubo_local', 'hubo_tienda', 'creado', 'actualizado'];
const COLS_MOV = ['id', 'ts', 'prod', 'loc', 'delta', 'tipo', 'motivo', 'nota', 'rol', 'precio', 'cliente', 'pago', 'envio', 'grupo', 'ref', 'anulado', 'anulado_ts', 'anulado_por', 'anulado_nota'];
const COLS_GASTO = ['id', 'ts', 'rol', 'monto', 'cat', 'concepto', 'pago', 'anulado', 'anulado_ts', 'anulado_por', 'anulado_nota'];
const COLS_EDITABLES = ['nombre', 'unidad', 'precio', 'costo', 'min_local', 'min_tienda', 'medida', 'tono', 'activo', 'actualizado'];

const insertarJson = (tabla, cols) =>
  `INSERT INTO ${tabla} (${cols.join(', ')}) SELECT ${cols.map((c) => `json_extract(value, '$.${c}')`).join(', ')} FROM json_each(?1)`;

const migradas = new WeakSet();

export async function crearRepoD1(db) {
  if (!migradas.has(db)) {
    const existe = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'productos'`).first();
    if (!existe) await db.batch(SCHEMA.map((s) => db.prepare(s)));
    else {
      // bases creadas antes de existir el cobro de envío: se agrega la columna una sola vez
      try { await db.prepare(`SELECT envio FROM movs LIMIT 0`).all(); } catch (e) {
        try { await db.prepare(`ALTER TABLE movs ADD COLUMN envio REAL NOT NULL DEFAULT 0`).run(); } catch (e2) { /* otra instancia ya la agregó */ }
      }
    }
    for (const sql of SCHEMA.filter((x) => /TABLE IF NOT EXISTS (intentos|gastos)|INDEX IF NOT EXISTS gastos_ts/.test(x))) await db.prepare(sql).run();
    migradas.add(db);
  }
  const q = (sql, ...args) => db.prepare(sql).bind(...args);
  const todas = async (sql, ...args) => (await q(sql, ...args).all()).results || [];

  async function conLineas(headers, tabla, col, recibida) {
    if (!headers.length) return [];
    const ls = await todas(`SELECT ${col} AS padre, prod, cant, ${recibida} AS recibida FROM ${tabla} WHERE ${col} IN (SELECT value FROM json_each(?1))`, JSON.stringify(headers.map((h) => h.id)));
    return headers.map((h) => Object.assign({}, h, {
      lineas: ls.filter((l) => l.padre === h.id).map((l) => ({ id: l.prod, cant: l.cant, recibida: l.recibida }))
    }));
  }

  function construir(tx) {
    const st = [];
    tx.guardas.forEach((g) => {
      if (g.tipo === 'traspaso_estado') st.push(q(`INSERT INTO guardas (g) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM traspasos WHERE id = ?1 AND estado = ?2)`, g.id, g.estado));
      else if (g.tipo === 'pedido_estado') st.push(q(`INSERT INTO guardas (g) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pedidos WHERE id = ?1 AND estado = ?2)`, g.id, g.estado));
      else if (g.tipo === 'gasto_sin_anular') st.push(q(`INSERT INTO guardas (g) SELECT 1 WHERE EXISTS (SELECT 1 FROM gastos WHERE id = ?1 AND anulado = 1)`, g.id));
      else if (g.tipo === 'grupo_sin_anular') st.push(q(`INSERT INTO guardas (g) SELECT 1 WHERE EXISTS (SELECT 1 FROM movs WHERE grupo = ?1 AND anulado = 1)`, g.grupo));
    });
    if (tx.reiniciar) {
      ['gastos', 'movs', 'traspaso_lineas', 'traspasos', 'pedido_lineas', 'pedidos'].forEach((t) => st.push(q(`DELETE FROM ${t}`)));
      st.push(q(`UPDATE productos SET stock_local = 0, stock_tienda = 0, hubo_local = 0, hubo_tienda = 0`));
    }
    if (tx.configInsert) Object.keys(tx.configInsert).forEach((k) => st.push(q(`INSERT INTO config (k, v) VALUES (?1, ?2)`, k, JSON.stringify(tx.configInsert[k]))));
    Object.keys(tx.config).forEach((k) => st.push(q(`INSERT INTO config (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, JSON.stringify(tx.config[k]))));
    if (tx.productosInsert.length) st.push(q(insertarJson('productos', COLS_PRODUCTO), JSON.stringify(tx.productosInsert)));
    // ediciones: se agrupan por las columnas que cambian y van en una sola sentencia cada grupo
    const grupos = {};
    tx.productosUpdate.forEach((u) => {
      const cols = Object.keys(u.set).filter((c) => COLS_EDITABLES.includes(c)).sort();
      const clave = cols.join(',');
      (grupos[clave] || (grupos[clave] = { cols, filas: [] })).filas.push(Object.assign({ id: u.id }, u.set));
    });
    Object.keys(grupos).forEach((clave) => {
      const g = grupos[clave];
      const sets = g.cols.map((c) => `${c} = (SELECT json_extract(j.value, '$.${c}') FROM json_each(?1) j WHERE json_extract(j.value, '$.id') = productos.id)`);
      st.push(q(`UPDATE productos SET ${sets.join(', ')} WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?1))`, JSON.stringify(g.filas)));
    });
    if (tx.stock.length) {
      const suma = (campo) => `COALESCE((SELECT SUM(json_extract(j.value, '$.${campo}')) FROM json_each(?1) j WHERE json_extract(j.value, '$.id') = productos.id), 0)`;
      st.push(q(
        `UPDATE productos SET
           stock_local = stock_local + ${suma('dl')},
           stock_tienda = stock_tienda + ${suma('dt')},
           hubo_local = MAX(hubo_local, (stock_local + ${suma('dl')}) > 0),
           hubo_tienda = MAX(hubo_tienda, (stock_tienda + ${suma('dt')}) > 0)
         WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?1))`,
        JSON.stringify(tx.stock)
      ));
    }
    if (tx.movsAnulados.length) {
      const a = tx.movsAnulados[0];
      st.push(q(`UPDATE movs SET anulado = 1, anulado_ts = ?2, anulado_por = ?3, anulado_nota = ?4 WHERE id IN (SELECT value FROM json_each(?1))`,
        JSON.stringify(tx.movsAnulados.map((m) => m.id)), a.ts, a.por, a.nota));
    }
    if (tx.movs.length) st.push(q(insertarJson('movs', COLS_MOV), JSON.stringify(tx.movs)));
    if (tx.gastosAnular.length) {
      const a = tx.gastosAnular[0];
      st.push(q(`UPDATE gastos SET anulado = 1, anulado_ts = ?2, anulado_por = ?3, anulado_nota = ?4 WHERE id IN (SELECT value FROM json_each(?1))`, JSON.stringify(tx.gastosAnular.map((x) => x.id)), a.ts, a.por, a.nota));
    }
    if (tx.gastosInsert.length) st.push(q(insertarJson('gastos', COLS_GASTO), JSON.stringify(tx.gastosInsert)));
    tx.traspasos.forEach(({ t, lineas }) => {
      st.push(q(
        `INSERT INTO traspasos (id, ts, estado, nota, pedido, recibido_ts, nota_recibo, dif) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, nota = excluded.nota, pedido = excluded.pedido,
           recibido_ts = excluded.recibido_ts, nota_recibo = excluded.nota_recibo, dif = excluded.dif`,
        t.id, t.ts, t.estado, t.nota || '', t.pedido || '', t.recibido_ts || 0, t.nota_recibo || '', t.dif || 0
      ));
      st.push(q(`DELETE FROM traspaso_lineas WHERE traspaso_id = ?1`, t.id));
      st.push(q(`INSERT INTO traspaso_lineas (traspaso_id, prod, cant, recibida) SELECT ?1, json_extract(value, '$.id'), json_extract(value, '$.cant'), json_extract(value, '$.recibida') FROM json_each(?2)`,
        t.id, JSON.stringify(lineas)));
    });
    tx.pedidos.forEach(({ p, lineas }) => {
      st.push(q(
        `INSERT INTO pedidos (id, ts, estado, nota, traspaso) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, nota = excluded.nota, traspaso = excluded.traspaso`,
        p.id, p.ts, p.estado, p.nota || '', p.traspaso || ''
      ));
      st.push(q(`DELETE FROM pedido_lineas WHERE pedido_id = ?1`, p.id));
      st.push(q(`INSERT INTO pedido_lineas (pedido_id, prod, cant) SELECT ?1, json_extract(value, '$.id'), json_extract(value, '$.cant') FROM json_each(?2)`,
        p.id, JSON.stringify(lineas)));
    });
    if (!tx.sinRev) st.push(q(`INSERT INTO config (k, v) VALUES ('rev', '1') ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS INTEGER) + 1 AS TEXT)`));
    return st;
  }

  return {
    async config() {
      const o = {};
      (await todas(`SELECT k, v FROM config`)).forEach((r) => {
        try { o[r.k] = JSON.parse(r.v); } catch (e) { /* valor ilegible: se ignora */ }
      });
      return o;
    },
    productos() { return todas(`SELECT * FROM productos ORDER BY nombre COLLATE NOCASE`); },
    async traspasos(f) {
      f = f || {};
      const filas = f.abiertos
        ? await todas(`SELECT * FROM traspasos WHERE estado = 'en_transito' ORDER BY ts DESC, id DESC LIMIT 80`)
        : await todas(`SELECT * FROM traspasos WHERE estado = 'en_transito' OR ts >= ?1 ORDER BY ts DESC, id DESC LIMIT 80`, f.desde || 0);
      return conLineas(filas, 'traspaso_lineas', 'traspaso_id', 'recibida');
    },
    async traspaso(id) {
      const h = await q(`SELECT * FROM traspasos WHERE id = ?1`, id).first();
      return h ? (await conLineas([h], 'traspaso_lineas', 'traspaso_id', 'recibida'))[0] : null;
    },
    async pedidos(f) {
      f = f || {};
      const filas = f.abiertos
        ? await todas(`SELECT * FROM pedidos WHERE estado = 'pendiente' ORDER BY ts DESC, id DESC LIMIT 80`)
        : await todas(`SELECT * FROM pedidos WHERE estado = 'pendiente' OR ts >= ?1 ORDER BY ts DESC, id DESC LIMIT 80`, f.desde || 0);
      return conLineas(filas, 'pedido_lineas', 'pedido_id', '0');
    },
    async pedido(id) {
      const h = await q(`SELECT * FROM pedidos WHERE id = ?1`, id).first();
      return h ? (await conLineas([h], 'pedido_lineas', 'pedido_id', '0'))[0] : null;
    },
    diferir(fn) { return fn(); }, // sin efecto: cada commit ya es una transacción (lo usa sembrarDemo en las pruebas)
    movsGrupo(grupo) { return todas(`SELECT * FROM movs WHERE grupo = ?1 ORDER BY id`, grupo); },
    async movs(f) {
      const w = [], a = [];
      if (!f.anulaciones) w.push(`tipo != 'anulacion'`);
      if (f.desde) { w.push('ts >= ?'); a.push(f.desde); }
      if (f.hasta) { w.push('ts <= ?'); a.push(f.hasta); }
      if (f.prods) { w.push('prod IN (SELECT value FROM json_each(?))'); a.push(JSON.stringify(f.prods)); }
      if (f.tipos) { w.push('tipo IN (SELECT value FROM json_each(?))'); a.push(JSON.stringify(f.tipos)); }
      if (f.rol) { w.push('rol = ?'); a.push(f.rol); }
      if (f.antes) {
        const i = f.antes.indexOf('_');
        w.push('(ts < ? OR (ts = ? AND id < ?))');
        a.push(Number(f.antes.slice(0, i)), Number(f.antes.slice(0, i)), f.antes.slice(i + 1));
      }
      a.push(f.limite + 1);
      const filas = await todas(`SELECT * FROM movs ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY ts DESC, id DESC LIMIT ?`, ...a);
      const items = filas.slice(0, f.limite);
      const last = items[items.length - 1];
      return { items, siguiente: filas.length > f.limite && last ? last.ts + '_' + last.id : null };
    },
    producciones(desde) { return todas(`SELECT ts, prod, delta, motivo FROM movs WHERE tipo = 'entrada' AND anulado = 0 AND ts >= ?1`, desde); },
    gastos(desde) { return todas(`SELECT * FROM gastos WHERE ts >= ?1 ORDER BY ts DESC`, desde); },
    async gasto(id) { return (await q(`SELECT * FROM gastos WHERE id = ?1`, id).first()) || null; },
    ventas(desde) {
      return todas(`SELECT ts, prod, delta, precio, grupo, tipo, cliente, pago, motivo, envio, rol FROM movs WHERE tipo IN ('venta', 'devolucion') AND anulado = 0 AND ts >= ?1`, desde);
    },
    // Cuenta un intento de PIN en una sola sentencia atómica (el contador no se pierde aunque lleguen muchas peticiones a la vez).
    async intento(clave, ahora) {
      const fila = await q(
        `INSERT INTO intentos (k, n, b, hasta, adm) VALUES (?1, 1, 0, 0, 1)
         ON CONFLICT(k) DO UPDATE SET
           adm = CASE WHEN hasta > ?2 THEN 0 ELSE 1 END,
           n = CASE WHEN hasta > ?2 THEN n WHEN n + 1 >= 5 THEN 0 ELSE n + 1 END,
           hasta = CASE WHEN hasta > ?2 THEN hasta WHEN n + 1 >= 5 THEN ?2 + (CASE b WHEN 0 THEN 300000 WHEN 1 THEN 900000 WHEN 2 THEN 2700000 WHEN 3 THEN 8100000 WHEN 4 THEN 24300000 WHEN 5 THEN 72900000 ELSE 86400000 END) ELSE hasta END,
           b = CASE WHEN hasta > ?2 THEN b WHEN n + 1 >= 5 THEN b + 1 ELSE b END
         RETURNING n, b, hasta, adm`, clave, ahora).first();
      return fila;
    },
    async limpiarIntentos(claves) {
      if (!claves.length) return;
      await q(`DELETE FROM intentos WHERE k IN (SELECT value FROM json_each(?1))`, JSON.stringify(claves)).run();
    },
    async commit(tx) {
      try {
        await db.batch(construir(tx));
      } catch (e) {
        const m = String((e && (e.message || (e.cause && e.cause.message))) || e);
        if (/UNIQUE constraint failed: config\.k/i.test(m)) throw new ApiError(409, 'ya_configurado', 'Este inventario ya está configurado.');
        if (/UNIQUE constraint failed/i.test(m)) throw new ApiError(409, 'duplicado', 'Esta operación ya se había guardado.');
        if (/CHECK constraint failed/i.test(m)) throw new ApiError(409, 'conflicto', 'El inventario cambió mientras guardabas. Ya se actualizó la pantalla; revisa e intenta de nuevo.');
        throw e;
      }
    }
  };
}
