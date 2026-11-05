// Revisión de cuentas: cuadre de efectivo y cobros digitales, y detección de contradicciones en los registros.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { D1Falsa } from './d1-shim.mjs';
import { crearRepoD1 } from '../functions/_d1.js';

const Core = createRequire(import.meta.url)('../public/core.js');
const DIA = 86400000;

async function arrancar(fabrica) {
  const repo = await fabrica();
  const t0 = Date.now(); let tick = 0, off = 0;
  const now = () => t0 + off + tick++;
  const call = (token, method, path, body, query) => Core.handle(repo, { method, path, body, query, token }, { now: now() });
  const s = await call('', 'POST', '/setup', { nombre: 'X', pinLocal: '482159', pinTienda: '730518', catalogo: { bases: true } });
  const cli = (token) => ({ token, call: (m, p, b, q) => call(cli.t, m, p, b, q) });
  const mk = (tok) => { const c = { t: tok, async call(m, p, b, q) { return call(c.t, m, p, b, q); }, async op(b) { const r = await call(c.t, 'POST', '/op', b, { tz: '0' }); if (r.json.ok && r.json.token) c.t = r.json.token; return r; } }; return c; };
  const local = mk(s.json.token);
  const tienda = mk((await call('', 'POST', '/login', { rol: 'tienda', pin: '730518' })).json.token);
  const est = (await local.call('GET', '/estado', null, { tz: '0' })).json;
  const prod = (n) => est.productos.find((p) => p.nombre === n);
  return { repo, local, tienda, prod, avanzar: (ms) => { off += ms; }, hoy: est.hoy };
}

for (const [nombre, fabrica] of [['local', async () => Core.crearRepoLocal(Core.almacenMemoria(), 'cuentas')], ['d1', async () => crearRepoD1(new D1Falsa())]]) {
  test('revisión de cuentas · ' + nombre + ': claras, efectivo y digital contra lo contado, ventas raras, y solo Almacén/Dueño', async () => {
    const { local, tienda, prod } = await arrancar(fabrica);
    const a = prod('Base Queen · Gris'), b = prod('Base Individual · Rosa');
    await local.op({ op: 'producto.editar', id: a.id, costo: 1249, precio: 2000 });
    await local.op({ op: 'producto.editar', id: b.id, costo: 1112, precio: 1600 });
    await local.op({ op: 'mov.entrada', motivo: 'produccion', lineas: [{ id: a.id, cant: 10 }, { id: b.id, cant: 10 }] });
    const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id: a.id, cant: 8 }, { id: b.id, cant: 8 }] });
    await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });
    const C = (q) => local.call('GET', '/cuentas', null, Object.assign({ tz: '0' }, q)).then((r) => r.json);
    // sin ventas ni gastos: todo claro
    let r = await C();
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.estado, 'claras');
    assert.deepEqual(r.hallazgos, []);
    // ventas y gastos
    await tienda.op({ op: 'mov.venta', pago: 'efectivo', lineas: [{ id: a.id, cant: 2, precio: 2000 }] });            // 4000 efectivo
    await tienda.op({ op: 'mov.venta', pago: 'tarjeta', lineas: [{ id: b.id, cant: 1, precio: 1600 }] });              // 1600 tarjeta
    await tienda.op({ op: 'mov.venta', pago: 'transferencia', lineas: [{ id: b.id, cant: 1, precio: 1700 }] });        // 1700 transferencia
    await tienda.op({ op: 'gasto.crear', monto: 1500, cat: 'comida', concepto: 'Comida', pago: 'efectivo' });
    r = await C();
    assert.equal(r.efectivo.vendido, 4000); assert.equal(r.efectivo.gastos, 1500); assert.equal(r.efectivo.esperado, 2500);
    assert.equal(r.digital.sistema, 3300);
    assert.equal(r.estado, 'claras', 'sin conteo no hay diferencia que marcar');
    // lo contado coincide → claras
    r = await C({ contado: '2500', digital: '3300' });
    assert.equal(r.estado, 'claras'); assert.equal(r.efectivo.diferencia, 0); assert.equal(r.digital.diferencia, 0);
    // falta efectivo y falta dinero digital → error
    r = await C({ contado: '2300', digital: '3300' });
    assert.equal(r.estado, 'error');
    const h = r.hallazgos.find((x) => x.codigo === 'efectivo_no_cuadra');
    assert.equal(h.nivel, 'error'); assert.equal(h.monto, -200); assert.match(h.detalle, /faltan \$200/);
    r = await C({ contado: '2500', digital: '3000' });
    assert.equal(r.hallazgos.find((x) => x.codigo === 'digital_no_cuadra').monto, -300);
    assert.equal((await C({ contado: '2600' })).hallazgos[0].monto, 100, 'sobrante');
    assert.equal((await local.call('GET', '/cuentas', null, { tz: '0', contado: 'abc' })).status, 400);
    assert.equal((await local.call('GET', '/cuentas', null, { tz: '0', desde: '2020-01-01' })).status, 400);
    assert.equal((await local.call('GET', '/cuentas', null, { tz: '0', desde: '2999-01-01' })).status, 400);
    // venta sin precio y venta repetida
    const cero = await tienda.op({ op: 'mov.venta', pago: 'efectivo', lineas: [{ id: a.id, cant: 1, precio: 0 }] });
    assert.equal(cero.status, 200, JSON.stringify(cero.json));
    r = await C();
    assert.equal(r.estado, 'error');
    assert.ok(r.hallazgos.some((x) => x.codigo === 'venta_sin_precio'));
    await tienda.op({ op: 'mov.anular', grupo: cero.json.resultado.grupo, motivo: 'Error de captura' });
    assert.equal((await C()).estado, 'claras', 'al anular la venta mala vuelve a estar claro');
    await tienda.op({ op: 'mov.venta', pago: 'efectivo', lineas: [{ id: a.id, cant: 1, precio: 100 }] });
    r = await C();
    assert.equal(r.estado, 'revisar');
    assert.ok(r.hallazgos.some((x) => x.codigo === 'venta_bajo_costo' && x.nivel === 'aviso'));
    await tienda.op({ op: 'mov.venta', pago: 'efectivo', lineas: [{ id: a.id, cant: 1, precio: 100 }] });
    assert.ok((await C()).hallazgos.some((x) => x.codigo === 'venta_duplicada'));
    // devolución sin venta, y más gastos en efectivo que ventas en efectivo
    await tienda.op({ op: 'mov.devolucion', lineas: [{ id: b.id, cant: 5, precio: 1600 }] });
    r = await C();
    assert.ok(r.hallazgos.some((x) => x.codigo === 'devoluciones'));
    assert.ok(r.hallazgos.some((x) => x.codigo === 'devolucion_sin_venta'));
    await local.op({ op: 'gasto.crear', monto: 9000, cat: 'sueldos', concepto: 'Sueldos', pago: 'efectivo' });
    assert.ok((await C()).hallazgos.some((x) => x.codigo === 'efectivo_negativo'));
    // pedidos de clientes atrasados
    const ayer = new Date(Date.now() - DIA).toISOString().slice(0, 10);
    await local.op({ op: 'agenda.crear', cliente: 'Carla', dia: ayer, detalle: '3 bases' });
    assert.ok((await C()).hallazgos.some((x) => x.codigo === 'pedidos_atrasados'));
    // permisos: el vendedor no ve las cuentas
    assert.equal((await tienda.call('GET', '/cuentas', null, { tz: '0' })).status, 403);
  });
}

test('revisión de cuentas · una existencia manipulada fuera del sistema se detecta como error (D1)', async () => {
  let db;
  const { local, prod } = await arrancar(async () => { db = new D1Falsa(); return crearRepoD1(db); });
  const a = prod('Base Queen · Gris');
  await local.op({ op: 'mov.entrada', motivo: 'produccion', lineas: [{ id: a.id, cant: 5 }] });
  const C = () => local.call('GET', '/cuentas', null, { tz: '0' }).then((r) => r.json);
  assert.equal((await C()).estado, 'claras');
  db.db.exec(`UPDATE productos SET stock_local = stock_local + 3 WHERE id = '${a.id}'`); // alguien tocó la base de datos directamente
  const r = await C();
  assert.equal(r.estado, 'error');
  const h = r.hallazgos.find((x) => x.codigo === 'existencias_descuadradas');
  assert.equal(h.nivel, 'error');
  assert.equal(h.productos[0].existencia, 8); assert.equal(h.productos[0].segunMovimientos, 5);
  assert.match(h.detalle, /avisa a soporte/i);
  // un conteo físico ajusta la existencia pero la alerta se queda: el problema es que algo cambió sin dejar movimiento
  await local.op({ op: 'mov.conteo', lineas: [{ id: a.id, contado: 5 }] });
  assert.equal((await C()).estado, 'error');
});
