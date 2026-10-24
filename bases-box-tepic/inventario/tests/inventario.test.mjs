// Pruebas del núcleo: la misma batería corre contra el repo local (memoria) y contra el repo D1
// (SQLite en memoria). Uso:  node --test inventario/tests      (Node 22.13 o más reciente)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { D1Falsa } from './d1-shim.mjs';
import { crearRepoD1 } from '../functions/_d1.js';

const require = createRequire(import.meta.url);
const Core = require('../public/core.js');

const DIA = 86400000;

const fabricas = {
  local: async () => Core.crearRepoLocal(Core.almacenMemoria(), 'prueba'),
  d1: async () => crearRepoD1(new D1Falsa())
};

// Cliente mínimo: llama a handle() igual que lo haría la Function o el modo local
function cliente(repo, reloj) {
  const api = {
    token: '',
    now: reloj || (() => Date.now()),
    async call(method, path, body, query) {
      return Core.handle(repo, { method, path, body, query, token: api.token }, { now: api.now() });
    },
    async login(rol, pin) {
      const r = await api.call('POST', '/login', { rol, pin });
      if (r.json.ok) api.token = r.json.token;
      return r;
    },
    async op(body) {
      const r = await api.call('POST', '/op', body);
      if (r.json.ok && r.json.token) api.token = r.json.token;
      return r;
    },
    async estado() { return (await api.call('GET', '/estado')).json; }
  };
  return api;
}

async function iniciar(fabrica, opciones) {
  const repo = await fabrica();
  const t0 = Date.now();
  let offset = 0, tick = 0;
  const reloj = () => t0 + offset + tick++; // cada llamada avanza 1 ms: los movimientos nunca empatan
  const api = cliente(repo, reloj);
  api.avanzar = (ms) => { offset += ms; };
  const r = await api.call('POST', '/setup', {
    nombre: 'Bases Box Tepic', pinLocal: '4821', pinTienda: '7305',
    catalogo: Object.assign({ bases: true, extras: true }, opciones)
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  api.token = r.json.token;
  api.codigo = r.json.codigo;
  const tienda = cliente(repo, reloj);
  await tienda.login('tienda', '7305');
  return { repo, local: api, tienda };
}

const prod = (est, nombre) => est.productos.find((p) => p.nombre === nombre);

for (const [nombre, fabrica] of Object.entries(fabricas)) {
  describe('inventario · repo ' + nombre, () => {
    test('hash y firma coinciden con node:crypto', () => {
      for (const s of ['', 'abc', '4821', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'ñandú ' + 'x'.repeat(200)]) {
        assert.equal(Core.sha256hex(s), createHash('sha256').update(s).digest('hex'));
        assert.equal(Core.hmacHex('clave', s), createHmac('sha256', 'clave').update(s).digest('hex'));
      }
      const larga = 'k'.repeat(100);
      assert.equal(Core.hmacHex(larga, 'm'), createHmac('sha256', larga).update('m').digest('hex'));
    });

    test('configuración inicial: catálogo, un solo setup y código de recuperación', async () => {
      const { local, repo } = await iniciar(fabrica);
      const est = await local.estado();
      assert.equal(est.productos.filter((p) => p.cat === 'base').length, 32);
      assert.equal(est.productos.filter((p) => p.cat !== 'base').length, 7);
      assert.equal(est.medidas.length, 4);
      assert.equal(est.tonos.length, 8);
      assert.match(local.codigo, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      const otra = await Core.handle(repo, { method: 'POST', path: '/setup', body: { pinLocal: '5937', pinTienda: '6482' } });
      assert.equal(otra.status, 409);
      assert.equal(otra.json.error.code, 'ya_configurado');
    });

    test('PIN: formato, débiles y distintos', async () => {
      const repo = await fabrica();
      const set = (b) => Core.handle(repo, { method: 'POST', path: '/setup', body: b });
      assert.equal((await set({ pinLocal: '12', pinTienda: '7305' })).json.error.code, 'pin_formato');
      assert.equal((await set({ pinLocal: '1234', pinTienda: '7305' })).json.error.code, 'pin_debil');
      assert.equal((await set({ pinLocal: '0000', pinTienda: '7305' })).json.error.code, 'pin_debil');
      assert.equal((await set({ pinLocal: '4821', pinTienda: '4821' })).json.error.code, 'pin_igual');
      assert.equal((await set({ pinLocal: '4821', pinTienda: '7305' })).status, 200);
    });

    test('clave de instalación: sin ella nadie puede adueñarse del inventario', async () => {
      const repo = await fabrica();
      const opts = { claveInstalacion: 'ABCD-EFGH-JKLM' };
      const set = (extra) => Core.handle(repo, { method: 'POST', path: '/setup', body: Object.assign({ pinLocal: '4821', pinTienda: '7305' }, extra) }, opts);
      let r = await Core.handle(repo, { method: 'GET', path: '/ping' }, opts);
      assert.equal(r.json.requiereClave, true);
      assert.equal((await set({})).json.error.code, 'clave_instalacion');
      r = await set({ clave: 'otra-cosa' });
      assert.equal(r.status, 401);
      assert.match(r.json.error.mensaje, /3 intentos/); // el intento sin clave también cuenta
      assert.equal((await set({ clave: 'abcd efgh jklm' })).status, 200); // sin importar mayúsculas ni separadores
      r = await Core.handle(repo, { method: 'GET', path: '/ping' }, opts);
      assert.equal(r.json.requiereClave, false); // ya configurado: la clave deja de pedirse
      assert.equal((await set({ clave: 'ABCD-EFGH-JKLM' })).json.error.code, 'ya_configurado');
    });

    test('clave de instalación: se bloquea tras 5 intentos', async () => {
      const repo = await fabrica();
      const opts = { claveInstalacion: 'ABCD-EFGH-JKLM' };
      let r;
      for (let i = 0; i < 5; i++) r = await Core.handle(repo, { method: 'POST', path: '/setup', body: { clave: 'x' + i, pinLocal: '4821', pinTienda: '7305' } }, opts);
      assert.equal(r.status, 423);
      r = await Core.handle(repo, { method: 'POST', path: '/setup', body: { clave: 'ABCD-EFGH-JKLM', pinLocal: '4821', pinTienda: '7305' } }, opts);
      assert.equal(r.status, 423);
    });

    test('sesión: sin token, token alterado y roles', async () => {
      const { local, tienda, repo } = await iniciar(fabrica);
      assert.equal((await Core.handle(repo, { method: 'GET', path: '/estado' })).status, 401);
      assert.equal((await Core.handle(repo, { method: 'GET', path: '/estado', token: local.token + 'x' })).status, 401);
      const [cuerpo, firma] = local.token.split('.');
      const falso = Buffer.from(JSON.stringify({ r: 'local', exp: Date.now() + DIA, pv: 1 })).toString('base64url') + '.' + firma;
      assert.equal((await Core.handle(repo, { method: 'GET', path: '/estado', token: falso })).status, 401);
      assert.equal((await local.estado()).rol, 'local');
      assert.equal((await tienda.estado()).rol, 'tienda');
      assert.ok(cuerpo);
    });

    test('login: bloqueo tras 5 intentos y espera creciente', async () => {
      const { repo, local } = await iniciar(fabrica);
      const c = cliente(repo, local.now);
      let r;
      for (let i = 0; i < 4; i++) {
        r = await c.login('local', '0001');
        assert.equal(r.status, 401);
      }
      assert.match(r.json.error.mensaje, /1 intento/);
      r = await c.login('local', '0001');
      assert.equal(r.status, 423);
      r = await c.login('local', '4821'); // aun con el PIN bueno, bloqueado
      assert.equal(r.status, 423);
      local.avanzar(5 * 60000 + 1000);
      r = await c.login('local', '4821');
      assert.equal(r.status, 200);
      // el otro rol nunca se bloqueó
      assert.equal((await c.login('tienda', '7305')).status, 200);
    });

    test('permisos por rol', async () => {
      const { local, tienda } = await iniciar(fabrica, { bases: false, extras: false });
      const crear = { op: 'producto.crear', nombre: 'Tela', cat: 'material', unidad: 'm' };
      assert.equal((await tienda.op(crear)).status, 403);
      assert.equal((await local.op(crear)).status, 200);
      const est = await local.estado();
      const id = prod(est, 'Tela').id;
      assert.equal((await tienda.op({ op: 'mov.entrada', lineas: [{ id, cant: 1 }] })).status, 403);
      assert.equal((await local.op({ op: 'mov.venta', lineas: [{ id, cant: 1 }] })).status, 403);
      assert.equal((await tienda.op({ op: 'traspaso.enviar', lineas: [{ id, cant: 1 }] })).status, 403);
      assert.equal((await local.op({ op: 'traspaso.recibir', id: 'x' })).status, 403);
      assert.equal((await tienda.op({ op: 'config.guardar', negocio: { nombre: 'X' } })).status, 403);
      assert.equal((await local.op({ op: 'no.existe' })).status, 400);
    });

    test('costos solo para el dueño del local', async () => {
      const { local, tienda } = await iniciar(fabrica, { bases: false, extras: false });
      await local.op({ op: 'producto.crear', nombre: 'Base de prueba', cat: 'base', precio: 3000, costo: 1800, stock_local: 2 });
      assert.equal((await local.estado()).productos[0].costo, 1800);
      assert.equal('costo' in (await tienda.estado()).productos[0], false);
    });

    test('entradas y salidas del local respetan el stock', async () => {
      const { local } = await iniciar(fabrica);
      const id = prod(await local.estado(), 'Triplay').id;
      let r = await local.op({ op: 'mov.entrada', motivo: 'compra', lineas: [{ id, cant: 20 }] });
      assert.equal(r.status, 200);
      assert.equal(prod(r.json.estado, 'Triplay').stock_local, 20);
      r = await local.op({ op: 'mov.salida', motivo: 'uso', lineas: [{ id, cant: 5 }] });
      assert.equal(prod(r.json.estado, 'Triplay').stock_local, 15);
      r = await local.op({ op: 'mov.salida', lineas: [{ id, cant: 16 }] });
      assert.equal(r.status, 409);
      assert.equal(r.json.error.code, 'stock_insuficiente');
      assert.equal(prod(await local.estado(), 'Triplay').stock_local, 15);
      for (const malo of [0, -2, 1.5, '3x', null]) {
        assert.equal((await local.op({ op: 'mov.entrada', lineas: [{ id, cant: malo }] })).status, 400, String(malo));
      }
      assert.equal((await local.op({ op: 'mov.entrada', lineas: [{ id, cant: 1 }, { id, cant: 1 }] })).status, 400);
      assert.equal((await local.op({ op: 'mov.entrada', lineas: [] })).status, 400);
      assert.equal((await local.op({ op: 'mov.entrada', lineas: [null] })).status, 400);
    });

    test('traspaso: enviar, recibir con diferencia y doble recepción', async () => {
      const { local, tienda } = await iniciar(fabrica);
      const est0 = await local.estado();
      const a = prod(est0, 'Base Queen · Gris').id, b = prod(est0, 'Base King · Negro').id;
      await local.op({ op: 'mov.entrada', motivo: 'produccion', lineas: [{ id: a, cant: 6 }, { id: b, cant: 4 }] });
      assert.equal((await local.op({ op: 'traspaso.enviar', lineas: [{ id: a, cant: 7 }] })).status, 409);
      const env = await local.op({ op: 'traspaso.enviar', nota: 'camioneta', lineas: [{ id: a, cant: 4 }, { id: b, cant: 2 }] });
      assert.equal(env.status, 200);
      const tid = env.json.resultado.id;
      let est = env.json.estado;
      assert.equal(prod(est, 'Base Queen · Gris').stock_local, 2);
      assert.equal(prod(est, 'Base Queen · Gris').stock_tienda, 0);
      assert.equal(est.traspasos[0].estado, 'en_transito');
      // la tienda ve el envío pero el local no lo puede recibir
      assert.equal((await local.op({ op: 'traspaso.recibir', id: tid })).status, 403);
      // llegó menos: exige explicación
      let r = await tienda.op({ op: 'traspaso.recibir', id: tid, lineas: [{ id: a, recibida: 3 }, { id: b, recibida: 2 }] });
      assert.equal(r.json.error.code, 'falta_nota');
      r = await tienda.op({ op: 'traspaso.recibir', id: tid, lineas: [{ id: a, recibida: 5 }] });
      assert.equal(r.status, 400); // más de lo enviado
      r = await tienda.op({ op: 'traspaso.recibir', id: tid, nota: 'Una base llegó rota', lineas: [{ id: a, recibida: 3 }, { id: b, recibida: 2 }] });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      est = r.json.estado;
      assert.equal(prod(est, 'Base Queen · Gris').stock_tienda, 3);
      assert.equal(prod(est, 'Base King · Negro').stock_tienda, 2);
      assert.equal(est.traspasos[0].estado, 'recibido');
      assert.equal(est.traspasos[0].dif, 1);
      // segunda recepción: nada cambia
      r = await tienda.op({ op: 'traspaso.recibir', id: tid, nota: 'otra vez', lineas: [] });
      assert.equal(r.status, 409);
      assert.equal(prod(await tienda.estado(), 'Base Queen · Gris').stock_tienda, 3);
      // ya recibido: no se puede cancelar
      assert.equal((await local.op({ op: 'traspaso.cancelar', id: tid, motivo: 'error' })).status, 409);
    });

    test('cancelar un envío devuelve el stock al local', async () => {
      const { local } = await iniciar(fabrica);
      const id = prod(await local.estado(), 'Base Queen · Gris').id;
      await local.op({ op: 'mov.entrada', lineas: [{ id, cant: 5 }] });
      const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id, cant: 5 }] });
      assert.equal(prod(env.json.estado, 'Base Queen · Gris').stock_local, 0);
      assert.equal((await local.op({ op: 'traspaso.cancelar', id: env.json.resultado.id })).json.error.code, 'falta_motivo');
      const r = await local.op({ op: 'traspaso.cancelar', id: env.json.resultado.id, motivo: 'Se cambió el pedido' });
      assert.equal(prod(r.json.estado, 'Base Queen · Gris').stock_local, 5);
      assert.equal(r.json.estado.traspasos[0].estado, 'cancelado');
    });

    test('ventas, devoluciones y resumen del día; anular restaura todo', async () => {
      const { local, tienda } = await iniciar(fabrica);
      const est0 = await local.estado();
      const a = prod(est0, 'Base Queen · Gris'), b = prod(est0, 'Base Individual · Rosa');
      await local.op({ op: 'config.guardar', medidas: est0.medidas.map((m) => (m.id === 'qn' ? { ...m, precio: 3800 } : m)), aplicarPrecios: ['qn'] });
      await local.op({ op: 'mov.entrada', lineas: [{ id: a.id, cant: 5 }, { id: b.id, cant: 5 }] });
      const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id: a.id, cant: 5 }, { id: b.id, cant: 5 }] });
      await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });

      assert.equal((await tienda.op({ op: 'mov.venta', lineas: [{ id: a.id, cant: 6 }] })).status, 409);
      const v = await tienda.op({ op: 'mov.venta', pago: 'tarjeta', cliente: 'Hotel Cielo', lineas: [{ id: a.id, cant: 2 }, { id: b.id, cant: 1, precio: 2000 }] });
      assert.equal(v.status, 200, JSON.stringify(v.json));
      assert.equal(v.json.resultado.total, 2 * 3800 + 2000);
      let est = v.json.estado;
      assert.equal(prod(est, 'Base Queen · Gris').stock_tienda, 3);
      assert.equal(est.resumen.hoy.total, 9600);
      assert.equal(est.resumen.hoy.pzas, 3);
      assert.equal(est.resumen.hoy.n, 1);
      assert.equal(est.resumen.dias.length, 7);
      assert.equal(est.resumen.dias[6].total, 9600);
      assert.equal(est.resumen.top[0].id, a.id);

      const dev = await tienda.op({ op: 'mov.devolucion', nota: 'Cliente se arrepintió', lineas: [{ id: b.id, cant: 1, precio: 2000 }] });
      assert.equal(dev.json.estado.resumen.hoy.total, 7600);
      assert.equal(prod(dev.json.estado, 'Base Individual · Rosa').stock_tienda, 5);

      // anular exige motivo y respeta el rol
      const g = v.json.resultado.grupo;
      assert.equal((await tienda.op({ op: 'mov.anular', grupo: g, motivo: '' })).json.error.code, 'falta_motivo');
      const r = await tienda.op({ op: 'mov.anular', grupo: g, motivo: 'Se cobró mal' });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      est = r.json.estado;
      assert.equal(prod(est, 'Base Queen · Gris').stock_tienda, 5);
      assert.equal(est.resumen.hoy.total, -2000); // solo queda la devolución
      assert.equal((await tienda.op({ op: 'mov.anular', grupo: g, motivo: 'otra vez' })).json.error.code, 'ya_anulado');
      // lo anulado aparece marcado en el historial y las anulaciones no estorban en la lista
      const hist = (await local.call('GET', '/movs', null, { limite: '50' })).json.items;
      assert.ok(hist.some((m) => m.grupo === g && m.anulado === 1 && m.anulado_nota === 'Se cobró mal'));
      assert.equal(hist.some((m) => m.tipo === 'anulacion'), false);
      // el local no puede anular un traspaso; la tienda no puede anular algo del local
      assert.equal((await local.op({ op: 'mov.anular', grupo: env.json.resultado.id, motivo: 'prueba' })).json.error.code, 'no_anulable');
      const ent = await local.op({ op: 'mov.entrada', lineas: [{ id: a.id, cant: 1 }] });
      assert.equal((await tienda.op({ op: 'mov.anular', grupo: ent.json.resultado.grupo, motivo: 'no es mío' })).status, 403);
    });

    test('no se puede anular una entrada si ya salieron las piezas', async () => {
      const { local } = await iniciar(fabrica);
      const id = prod(await local.estado(), 'Triplay').id;
      const ent = await local.op({ op: 'mov.entrada', lineas: [{ id, cant: 4 }] });
      await local.op({ op: 'mov.salida', lineas: [{ id, cant: 3 }] });
      const r = await local.op({ op: 'mov.anular', grupo: ent.json.resultado.grupo, motivo: 'me equivoqué' });
      assert.equal(r.json.error.code, 'no_se_puede_anular');
      assert.equal(prod(await local.estado(), 'Triplay').stock_local, 1);
    });

    test('“hubo existencias”: un producto nuevo en cero no es alerta, uno que se acabó sí', async () => {
      const { local, tienda } = await iniciar(fabrica);
      let p = prod(await local.estado(), 'Triplay');
      assert.equal(p.hubo_local, 0);
      assert.equal(p.hubo_tienda, 0);
      await local.op({ op: 'mov.entrada', lineas: [{ id: p.id, cant: 2 }] });
      await local.op({ op: 'mov.salida', lineas: [{ id: p.id, cant: 2 }] });
      p = prod(await local.estado(), 'Triplay');
      assert.equal(p.stock_local, 0);
      assert.equal(p.hubo_local, 1);
      assert.equal(p.hubo_tienda, 0);
      const nuevo = await local.op({ op: 'producto.crear', nombre: 'Tela gris', cat: 'material', stock_tienda: 3 });
      p = prod(nuevo.json.estado, 'Tela gris');
      assert.deepEqual([p.hubo_local, p.hubo_tienda], [0, 1]);
      assert.equal(tienda.token.length > 10, true);
    });

    test('conteo físico ajusta al número contado', async () => {
      const { local, tienda } = await iniciar(fabrica);
      const id = prod(await local.estado(), 'Grapas').id;
      await local.op({ op: 'mov.entrada', lineas: [{ id, cant: 10 }] });
      assert.equal((await local.op({ op: 'mov.conteo', lineas: [{ id, contado: 10 }] })).json.error.code, 'sin_cambios');
      let r = await local.op({ op: 'mov.conteo', nota: 'Se contó en bodega', lineas: [{ id, contado: 7 }] });
      assert.equal(prod(r.json.estado, 'Grapas').stock_local, 7);
      r = await tienda.op({ op: 'mov.conteo', lineas: [{ id, contado: 2 }] });
      assert.equal(prod(r.json.estado, 'Grapas').stock_tienda, 2);
      assert.equal(prod(r.json.estado, 'Grapas').stock_local, 7);
      assert.equal(r.json.estado.recientes[0].tipo, 'ajuste');
      assert.match(r.json.estado.recientes[0].nota, /sistema 0, contado 2/);
    });

    test('pedidos de la tienda se surten con un envío y se reabren si se cancela', async () => {
      const { local, tienda } = await iniciar(fabrica);
      const id = prod(await local.estado(), 'Base Queen · Gris').id;
      await local.op({ op: 'mov.entrada', lineas: [{ id, cant: 8 }] });
      const ped = await tienda.op({ op: 'pedido.crear', nota: 'Urge', lineas: [{ id, cant: 3 }] });
      assert.equal(ped.status, 200);
      const pid = ped.json.resultado.id;
      assert.equal(ped.json.estado.pedidos[0].estado, 'pendiente');
      const env = await local.op({ op: 'traspaso.enviar', pedido: pid, lineas: [{ id, cant: 3 }] });
      assert.equal(env.json.estado.pedidos[0].estado, 'surtido');
      assert.equal((await tienda.op({ op: 'pedido.cancelar', id: pid })).status, 409);
      const can = await local.op({ op: 'traspaso.cancelar', id: env.json.resultado.id, motivo: 'Falló la camioneta' });
      assert.equal(can.json.estado.pedidos[0].estado, 'pendiente');
      const x = await tienda.op({ op: 'pedido.cancelar', id: pid });
      assert.equal(x.json.estado.pedidos[0].estado, 'cancelado');
      assert.equal((await local.op({ op: 'traspaso.enviar', pedido: pid, lineas: [{ id, cant: 1 }] })).status, 409);
    });

    test('repetir la misma operación (mismo cid) no duplica nada', async () => {
      const { local } = await iniciar(fabrica);
      const id = prod(await local.estado(), 'Triplay').id;
      const cuerpo = { op: 'mov.entrada', cid: 'cid-prueba-0001', lineas: [{ id, cant: 3 }] };
      assert.equal((await local.op(cuerpo)).status, 200);
      const r = await local.op(cuerpo);
      assert.equal(r.status, 409);
      assert.equal(r.json.error.code, 'duplicado');
      assert.equal(prod(await local.estado(), 'Triplay').stock_local, 3);
    });

    test('dos ventas a la vez de la última pieza: solo una se guarda', async () => {
      const { local, tienda, repo } = await iniciar(fabrica);
      const id = prod(await local.estado(), 'Base Queen · Gris').id;
      await local.op({ op: 'mov.entrada', lineas: [{ id, cant: 1 }] });
      const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id, cant: 1 }] });
      await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });
      const otra = cliente(repo, tienda.now);
      await otra.login('tienda', '7305');
      const [r1, r2] = await Promise.all([
        tienda.op({ op: 'mov.venta', lineas: [{ id, cant: 1, precio: 100 }] }),
        otra.op({ op: 'mov.venta', lineas: [{ id, cant: 1, precio: 100 }] })
      ]);
      const codigos = [r1.status, r2.status].sort();
      assert.deepEqual(codigos, [200, 409]);
      assert.equal(prod(await local.estado(), 'Base Queen · Gris').stock_tienda, 0);
    });

    test('catálogo: crear, duplicados, variantes, editar y archivar', async () => {
      const { local } = await iniciar(fabrica, { bases: false, extras: false });
      let r = await local.op({ op: 'producto.crear', nombre: 'Base Queen · Gris', cat: 'base', medida: 'qn', tono: 'gris', precio: 3790, stock_local: 3, stock_tienda: 1 });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      const id = r.json.resultado.id;
      assert.equal(prod(r.json.estado, 'Base Queen · Gris').stock_local, 3);
      assert.equal((await local.op({ op: 'producto.crear', nombre: ' base queen · GRIS ', cat: 'base' })).json.error.code, 'duplicado');
      assert.equal((await local.op({ op: 'producto.crear', nombre: 'X', cat: 'base' })).json.error.code, 'nombre');
      assert.equal((await local.op({ op: 'producto.crear', nombre: 'Algo', cat: 'base', medida: 'zzz' })).json.error.code, 'catalogo');
      r = await local.op({ op: 'producto.variantes', medidas: ['ind', 'qn'], tonos: ['gris', 'rosa', 'negro'], min_local: 2, min_tienda: 1 });
      assert.equal(r.json.resultado.creados, 5);
      assert.equal(r.json.resultado.omitidos, 1);
      assert.equal(r.json.estado.productos.length, 6);
      assert.equal((await local.op({ op: 'producto.variantes', medidas: ['ind'], tonos: ['gris'] })).json.error.code, 'duplicado');
      r = await local.op({ op: 'producto.editar', id, precio: 3999, min_local: 4 });
      assert.equal(prod(r.json.estado, 'Base Queen · Gris').precio, 3999);
      assert.equal(prod(r.json.estado, 'Base Queen · Gris').min_local, 4);
      assert.equal((await local.op({ op: 'producto.editar', id, nombre: 'Base Individual · Gris' })).json.error.code, 'duplicado');
      // archivar exige stock en cero
      assert.equal((await local.op({ op: 'producto.archivar', id, activo: false })).json.error.code, 'tiene_stock');
      await local.op({ op: 'mov.conteo', lineas: [{ id, contado: 0 }] });
      const t = await local.estado();
      assert.equal(prod(t, 'Base Queen · Gris').stock_local, 0);
      assert.equal((await local.op({ op: 'producto.archivar', id, activo: true })).status, 200);
    });

    test('un producto en un envío pendiente no se archiva y uno archivado no se mueve', async () => {
      const { local } = await iniciar(fabrica);
      const id = prod(await local.estado(), 'Grapas').id;
      await local.op({ op: 'mov.entrada', lineas: [{ id, cant: 2 }] });
      const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id, cant: 2 }] });
      assert.equal((await local.op({ op: 'producto.archivar', id, activo: false })).json.error.code, 'en_uso');
      await local.op({ op: 'traspaso.cancelar', id: env.json.resultado.id, motivo: 'prueba' });
      await local.op({ op: 'mov.salida', lineas: [{ id, cant: 2 }] });
      assert.equal((await local.op({ op: 'producto.archivar', id, activo: false })).status, 200);
      assert.equal((await local.op({ op: 'mov.entrada', lineas: [{ id, cant: 1 }] })).json.error.code, 'producto_archivado');
    });

    test('ajustes del negocio: medidas, tonos, precios y teléfonos', async () => {
      const { local, tienda } = await iniciar(fabrica);
      const est = await local.estado();
      const medidas = est.medidas.map((m) => (m.id === 'kg' ? { ...m, precio: 4650 } : m));
      let r = await local.op({ op: 'config.guardar', medidas, aplicarPrecios: ['kg'], negocio: { nombre: 'Bases Box', telLocal: '+52 311 121 6033', telTienda: '' } });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.resultado.actualizados, 8);
      assert.equal(prod(r.json.estado, 'Base King · Negro').precio, 4650);
      assert.equal(r.json.estado.negocio.telLocal, '523111216033');
      assert.equal((await tienda.estado()).negocio.nombre, 'Bases Box');
      // no se puede quitar una medida en uso
      r = await local.op({ op: 'config.guardar', medidas: medidas.filter((m) => m.id !== 'kg') });
      assert.equal(r.json.error.code, 'en_uso');
      r = await local.op({ op: 'config.guardar', tonos: [...est.tonos, { id: 'amarillo', nombre: 'Amarillo', hex: '#f2a900' }] });
      assert.equal(r.json.estado.tonos.length, 9);
      assert.equal(r.json.estado.tonos[8].hex, '#F2A900');
      assert.equal((await local.op({ op: 'config.guardar', tonos: [{ id: 'x', nombre: 'Mal', hex: 'rojo' }] })).json.error.code, 'tonos');
    });

    test('cambiar PIN cierra las demás sesiones; la tienda no cambia el del local', async () => {
      const { local, tienda, repo } = await iniciar(fabrica);
      const vieja = tienda.token;
      assert.equal((await tienda.op({ op: 'pin.cambiar', pinActual: '0000', pinNuevo: '8264' })).json.error.code, 'pin_incorrecto');
      assert.equal((await tienda.op({ op: 'pin.cambiar', pinActual: '7305', pinNuevo: '4821' })).json.error.code, 'pin_igual');
      assert.equal((await tienda.op({ op: 'pin.cambiar', pinActual: '7305', pinNuevo: '1111' })).json.error.code, 'pin_debil');
      const r = await tienda.op({ op: 'pin.cambiar', pinActual: '7305', pinNuevo: '8264' });
      assert.equal(r.status, 200);
      assert.notEqual(tienda.token, vieja);
      assert.equal((await tienda.estado()).rol, 'tienda');
      assert.equal((await Core.handle(repo, { method: 'GET', path: '/estado', token: vieja })).status, 401);
      assert.equal((await cliente(repo, local.now).login('tienda', '7305')).status, 401);
      assert.equal((await cliente(repo, local.now).login('tienda', '8264')).status, 200);
      // el local reinicia el PIN de la tienda con su propio PIN
      assert.equal((await local.op({ op: 'pin.reiniciar', pinActual: '9999', pinNuevo: '3917' })).json.error.code, 'pin_incorrecto');
      assert.equal((await local.op({ op: 'pin.reiniciar', pinActual: '4821', pinNuevo: '3917' })).status, 200);
      assert.equal((await cliente(repo, local.now).login('tienda', '3917')).status, 200);
      const t2 = cliente(repo, local.now);
      await t2.login('tienda', '3917');
      assert.equal((await t2.op({ op: 'pin.reiniciar', pinActual: '3917', pinNuevo: '2846' })).status, 403);
    });

    test('recuperar PIN con el código y rotarlo', async () => {
      const { local, repo } = await iniciar(fabrica);
      const c = cliente(repo, local.now);
      assert.equal((await c.call('POST', '/recuperar', { codigo: 'AAAA-BBBB', rol: 'local', pin: '5927' })).status, 401);
      const r = await c.call('POST', '/recuperar', { codigo: local.codigo.toLowerCase().replace('-', ' '), rol: 'local', pin: '5927' });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.notEqual(r.json.codigo, local.codigo);
      assert.equal((await cliente(repo, local.now).login('local', '4821')).status, 401);
      assert.equal((await cliente(repo, local.now).login('local', '5927')).status, 200);
      // el código anterior ya no sirve
      assert.equal((await c.call('POST', '/recuperar', { codigo: local.codigo, rol: 'local', pin: '6039' })).status, 401);
      assert.equal((await c.call('POST', '/recuperar', { codigo: r.json.codigo, rol: 'tienda', pin: '5927' })).json.error.code, 'pin_igual');
    });

    test('código de recuperación nuevo: pide PIN y el anterior deja de servir', async () => {
      const { local, tienda, repo } = await iniciar(fabrica);
      assert.equal((await tienda.op({ op: 'recup.nueva', pinActual: '7305' })).status, 403);
      assert.equal((await local.op({ op: 'recup.nueva', pinActual: '0000' })).json.error.code, 'pin_incorrecto');
      const r = await local.op({ op: 'recup.nueva', pinActual: '4821' });
      assert.equal(r.status, 200);
      assert.match(r.json.resultado.codigo, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      const c = cliente(repo, local.now);
      assert.equal((await c.call('POST', '/recuperar', { codigo: local.codigo, rol: 'local', pin: '5927' })).status, 401);
      assert.equal((await c.call('POST', '/recuperar', { codigo: r.json.resultado.codigo, rol: 'local', pin: '5927' })).status, 200);
    });

    test('historial: filtros, paginación y orden', async () => {
      const { local, tienda } = await iniciar(fabrica);
      const id = prod(await local.estado(), 'Triplay').id;
      for (let i = 0; i < 7; i++) { local.avanzar(60000); await local.op({ op: 'mov.entrada', lineas: [{ id, cant: 1 }] }); }
      const pag1 = (await local.call('GET', '/movs', null, { limite: '3' })).json;
      assert.equal(pag1.items.length, 3);
      assert.ok(pag1.siguiente);
      assert.ok(pag1.items[0].ts >= pag1.items[1].ts);
      const pag2 = (await local.call('GET', '/movs', null, { limite: '10', antes: pag1.siguiente })).json;
      assert.equal(pag2.items.length, 4);
      assert.equal(pag2.siguiente, null);
      const ids = new Set([...pag1.items, ...pag2.items].map((m) => m.id));
      assert.equal(ids.size, 7);
      assert.equal((await local.call('GET', '/movs', null, { tipos: 'venta' })).json.items.length, 0);
      assert.equal((await local.call('GET', '/movs', null, { prods: id, tipos: 'entrada,salida' })).json.items.length, 7);
      assert.equal((await local.call('GET', '/movs', null, { rol: 'tienda' })).json.items.length, 0);
    });

    test('datos de demostración: se generan, cuadran y el tablero tiene vida', async () => {
      const repo = await fabrica();
      const pins = await Core.sembrarDemo(repo, { now: Date.now() });
      assert.deepEqual(pins, { local: '1111', tienda: '2222' });
      const c = cliente(repo);
      assert.equal((await c.login('local', '1111')).status, 200);
      const est = await c.estado();
      assert.equal(est.productos.length, 39);
      assert.ok(est.resumen.mes.total > 0, 'hay ventas este mes');
      assert.ok(est.resumen.dias.some((d) => d.total > 0));
      assert.ok(est.traspasos.some((t) => t.estado === 'en_transito'), 'queda un envío por recibir');
      assert.ok(est.pedidos.some((p) => p.estado === 'pendiente'), 'queda un pedido pendiente');
      assert.ok(est.productos.some((p) => p.cat === 'base' && p.precio > 0));
      assert.ok(est.productos.some((p) => p.cat === 'base' && p.stock_local < p.min_local));
      // invariante: la suma de movimientos por producto y lugar es exactamente el stock
      const todos = [];
      let antes = null;
      do {
        const r = (await c.call('GET', '/movs', null, { limite: '500', anulaciones: '1', ...(antes ? { antes } : {}) })).json;
        todos.push(...r.items);
        antes = r.siguiente;
      } while (antes);
      assert.ok(todos.length > 100);
      const suma = {};
      todos.forEach((m) => { suma[m.prod + '|' + m.loc] = (suma[m.prod + '|' + m.loc] || 0) + m.delta; });
      est.productos.forEach((p) => {
        assert.equal(suma[p.id + '|local'] || 0, p.stock_local, p.nombre + ' local');
        assert.equal(suma[p.id + '|tienda'] || 0, p.stock_tienda, p.nombre + ' tienda');
      });
      assert.ok(est.productos.every((p) => p.stock_local >= 0 && p.stock_tienda >= 0));
    });
  });
}
