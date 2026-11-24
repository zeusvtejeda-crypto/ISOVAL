// Pago dividido (anticipo + saldo), anticipos de pedidos que cuentan el día que entran, quién pagó cada gasto,
// datos extra del pedido, repartos y nómina de la semana.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { D1Falsa } from './d1-shim.mjs';
import { crearRepoD1 } from '../functions/_d1.js';

const Core = createRequire(import.meta.url)('../public/core.js');
const DIA = 86400000;

async function arrancar(fabrica) {
  const repo = await fabrica();
  const t0 = Date.now(); let tick = 0;
  const call = (token, method, path, body, query) => Core.handle(repo, { method, path, body, query: Object.assign({ tz: '0' }, query), token }, { now: t0 + tick++ });
  const s = await call('', 'POST', '/setup', { nombre: 'X', pinLocal: '482159', pinTienda: '730518', catalogo: { bases: true } });
  const mk = (tok) => { const c = { t: tok, call: (m, p, b, q) => call(c.t, m, p, b, q), async op(b) { const r = await call(c.t, 'POST', '/op', b); if (r.json.ok && r.json.token) c.t = r.json.token; return r; } }; return c; };
  const local = mk(s.json.token);
  const tienda = mk((await call('', 'POST', '/login', { rol: 'tienda', pin: '730518' })).json.token);
  const est = (await local.call('GET', '/estado')).json;
  const b = est.productos.find((p) => p.nombre === 'Base Matrimonial · Gris');
  await local.op({ op: 'mov.entrada', lineas: [{ id: b.id, cant: 6 }] });
  const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id: b.id, cant: 6 }] });
  await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });
  return { local, tienda, b, hoy: new Date(t0).toISOString().slice(0, 10), ayer: new Date(t0 - DIA).toISOString().slice(0, 10) };
}

for (const [nombre, fabrica] of [['local', async () => Core.crearRepoLocal(Core.almacenMemoria(), 'cobros')], ['d1', async () => crearRepoD1(new D1Falsa())]]) {
  test('pago dividido, anticipos, gastos por pagador, repartos y nómina · ' + nombre, async () => {
    const { local, tienda, b, hoy, ayer } = await arrancar(fabrica);

    // ── pago dividido: $1,950 = $1,500 con tarjeta ayer + $450 en efectivo hoy
    const v = await tienda.op({ op: 'mov.venta', pago: 'efectivo', cliente: 'Almadelia', entrega: 'tepic', envio: 150, reparto: 'Zeus, Alan', lineas: [{ id: b.id, cant: 1, precio: 1800 }], otroPago: { monto: 1500, pago: 'tarjeta', dia: ayer } });
    assert.equal(v.status, 200, JSON.stringify(v.json));
    assert.equal(v.json.resultado.total, 1950);
    const rh = (await tienda.call('GET', '/reporte-dia')).json;
    const g = rh.ventas.find((x) => x.grupo === v.json.resultado.grupo);
    assert.equal(g.total, 450, 'hoy solo entró el saldo');
    assert.equal(rh.totales.porPago.efectivo, 450);
    const ra = (await tienda.call('GET', '/reporte-dia', null, { dia: ayer })).json;
    assert.equal(ra.totales.porPago.tarjeta, 1500, 'el anticipo cuenta el día que entró, con su forma de pago');
    const c = (await local.call('GET', '/cuentas', null, { desde: ayer, hasta: hoy })).json;
    assert.equal(c.efectivo.vendido, 450);
    assert.equal(c.digital.tarjeta, 1500);
    // inventario: solo una base vendida
    assert.equal((await local.call('GET', '/estado')).json.productos.find((p) => p.id === b.id).stock_tienda, 5);
    // no se puede pagar aparte más del total
    assert.equal((await tienda.op({ op: 'mov.venta', pago: 'efectivo', lineas: [{ id: b.id, cant: 1, precio: 1800 }], otroPago: { monto: 5000, pago: 'tarjeta' } })).json.error.code, 'pago_dividido');
    // cambiar la forma de pago de la venta no toca la parte pagada aparte
    const cp = await tienda.op({ op: 'venta.pago', grupo: v.json.resultado.grupo, pago: 'transferencia' });
    assert.equal(cp.status, 200, JSON.stringify(cp.json));
    const ra2 = (await tienda.call('GET', '/reporte-dia', null, { dia: ayer })).json;
    assert.equal(ra2.totales.porPago.tarjeta, 1500);
    assert.equal((await tienda.call('GET', '/reporte-dia')).json.totales.porPago.transferencia, 450);

    // ── pedido con datos extra y anticipo por transferencia: cuenta hoy como cobro
    const p = await tienda.op({ op: 'agenda.crear', cliente: 'Zamira', dia: hoy, lineas: [{ id: b.id, cant: 1, precio: 2000 }], entrega: 'tepic', anticipo: 1150, extra: { patas: 'Café altas', envio: 150, pago: 'efectivo', referencia: 'Casa de 2 pisos', antPago: 'transferencia' } });
    assert.equal(p.status, 200, JSON.stringify(p.json));
    const ped = p.json.estado.agenda.find((a) => a.id === p.json.resultado.id);
    assert.equal(ped.extra.patas, 'Café altas'); assert.equal(ped.extra.referencia, 'Casa de 2 pisos'); assert.equal(ped.extra.antReg, 1150);
    assert.equal((await tienda.call('GET', '/reporte-dia')).json.totales.porPago.transferencia, 1600, '450 de la venta + 1,150 del anticipo');
    // editar sin cambiar el anticipo no lo vuelve a contar; subirlo cuenta solo la diferencia; bajarlo no se puede
    await tienda.op({ op: 'agenda.editar', id: ped.id, cliente: 'Zamira', dia: hoy, lineas: ped.lineas, entrega: 'tepic', anticipo: 1150 });
    assert.equal((await tienda.call('GET', '/reporte-dia')).json.totales.porPago.transferencia, 1600);
    await tienda.op({ op: 'agenda.editar', id: ped.id, cliente: 'Zamira', dia: hoy, lineas: ped.lineas, entrega: 'tepic', anticipo: 1300, extra: Object.assign({}, ped.extra) });
    assert.equal((await tienda.call('GET', '/reporte-dia')).json.totales.porPago.transferencia, 1750);
    assert.equal((await tienda.op({ op: 'agenda.editar', id: ped.id, cliente: 'Zamira', dia: hoy, lineas: ped.lineas, entrega: 'tepic', anticipo: 100 })).json.error.code, 'anticipo_cobrado');
    // al entregar se cobra solo el saldo (el anticipo ya se contó)
    const ent = await tienda.op({ op: 'mov.venta', pago: 'efectivo', cliente: 'Zamira', entrega: 'tepic', envio: 150, abono: 1300, reparto: 'Rubén', lineas: [{ id: b.id, cant: 1, precio: 2000 }] });
    assert.equal(ent.status, 200, JSON.stringify(ent.json));
    assert.equal(ent.json.resultado.total, 850);
    const rf = (await tienda.call('GET', '/reporte-dia')).json;
    assert.equal(rf.totales.porPago.efectivo, 850, 'la venta de Almadelia se cambió a transferencia');
    assert.equal(rf.totales.porPago.transferencia, 450 + 1300);
    assert.equal(rf.totales.vendido, 450 + 1300 + 850, 'saldo Almadelia + anticipo Zamira + saldo Zamira');

    // ── gastos: quién lo pagó; solo los de la caja sacan efectivo
    await tienda.op({ op: 'gasto.crear', monto: 1000, cat: 'servicios', concepto: 'Pipa de agua', pago: 'efectivo', pagador: 'zeus' });
    await tienda.op({ op: 'gasto.crear', monto: 170, cat: 'comida', concepto: 'Oxxo', pago: 'efectivo', pagador: 'rene' });
    await tienda.op({ op: 'gasto.crear', monto: 50, cat: 'comida', concepto: 'Torta', pago: 'efectivo', pagador: 'caja' });
    await tienda.op({ op: 'gasto.crear', monto: 400, cat: 'reembolso', concepto: 'Se le regresa a Zeus', pago: 'efectivo', pagador: 'caja', persona: 'Zeus' });
    const rg = (await tienda.call('GET', '/reporte-dia')).json;
    assert.equal(rg.totales.gastosEfectivo, 450, 'solo la torta y el reembolso salen de la caja');

    // ── nómina: sueldo + comisión por base + repartos − adelantos
    await tienda.op({ op: 'gasto.crear', monto: 300, cat: 'sueldos', concepto: 'Adelanto', pago: 'efectivo', persona: 'Rubén' });
    assert.equal((await tienda.op({ op: 'nomina.config', lista: [{ n: 'Zeus', sueldo: 4000, com: 100, rep: 25 }, { n: 'Alan', sueldo: 0, com: 0, rep: 25 }, { n: 'Rubén', sueldo: 2700, com: 0, rep: 25 }] })).status, 200);
    const nom = (await tienda.call('GET', '/nomina')).json;
    const zeus = nom.personas.find((x) => x.n === 'Zeus'), ruben = nom.personas.find((x) => x.n === 'Rubén'), alan = nom.personas.find((x) => x.n === 'Alan');
    assert.equal(zeus.bases, 2); assert.equal(zeus.comision, 200); assert.equal(zeus.viajes, 1); assert.equal(zeus.total, 4225);
    assert.equal(alan.viajes, 1); assert.equal(alan.total, 25);
    assert.equal(ruben.viajes, 1); assert.equal(ruben.pagado, 300); assert.equal(ruben.falta, 2700 + 25 - 300);
    const dz = nom.deudas.find((d) => d.k === 'zeus'), dr = nom.deudas.find((d) => d.k === 'rene');
    assert.equal(dz.puso, 1000); assert.equal(dz.regresado, 400); assert.equal(dz.debe, 600);
    assert.equal(dr.debe, 170);
  });

  test('botón de emergencia: cerrar y reabrir el negocio · ' + nombre, async () => {
    const { local, tienda, b } = await arrancar(fabrica);

    // cerrar pide el PIN del almacén: uno incorrecto no cierra nada
    assert.equal((await local.op({ op: 'negocio.cerrar', pinActual: '000000', motivo: 'x' })).json.error.code, 'pin_incorrecto');
    assert.equal((await tienda.call('GET', '/estado')).status, 200, 'sigue abierto');

    // ping anuncia que está abierto
    assert.equal((await tienda.call('GET', '/ping')).json.cerrado, null);

    // cerrar con el PIN correcto
    assert.equal((await local.op({ op: 'negocio.cerrar', pinActual: '482159', motivo: 'En pausa' })).status, 200);

    // con el negocio cerrado nadie entra ni registra nada
    const bloq = await tienda.call('GET', '/estado');
    assert.equal(bloq.status, 503); assert.equal(bloq.json.error.code, 'negocio_cerrado');
    assert.equal((await tienda.op({ op: 'mov.venta', pago: 'efectivo', lineas: [{ id: b.id, cant: 1, precio: 1000 }] })).json.error.code, 'negocio_cerrado');
    assert.equal((await local.op({ op: 'gasto.crear', monto: 50, cat: 'comida', concepto: 'x', pago: 'efectivo' })).json.error.code, 'negocio_cerrado');

    // ping avisa el cierre y su motivo (para la pantalla de bloqueo)
    const png = (await tienda.call('GET', '/ping')).json;
    assert.equal(png.cerrado.motivo, 'En pausa');

    // reabrir pide el PIN del almacén; con el correcto vuelve a funcionar
    assert.equal((await local.op({ op: 'negocio.abrir', pinActual: '999999' })).json.error.code, 'pin_incorrecto');
    assert.equal((await local.op({ op: 'negocio.abrir', pinActual: '482159' })).status, 200);
    assert.equal((await tienda.call('GET', '/estado')).status, 200, 'reabierto');
    assert.equal((await tienda.op({ op: 'mov.venta', pago: 'efectivo', lineas: [{ id: b.id, cant: 1, precio: 1000 }] })).status, 200);
  });
}
