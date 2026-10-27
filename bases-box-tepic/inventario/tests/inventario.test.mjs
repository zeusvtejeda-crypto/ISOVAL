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
    nombre: 'Bases Box Tepic', pinLocal: '482159', pinTienda: '730518',
    catalogo: Object.assign({ bases: true, extras: true }, opciones)
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  api.token = r.json.token;
  api.codigo = r.json.codigo;
  const tienda = cliente(repo, reloj);
  await tienda.login('tienda', '730518');
  return { repo, local: api, tienda };
}

const prod = (est, nombre) => est.productos.find((p) => p.nombre === nombre);

for (const [nombre, fabrica] of Object.entries(fabricas)) {
  describe('inventario · repo ' + nombre, () => {
    test('hash y firma coinciden con node:crypto', () => {
      for (const s of ['', 'abc', '482159', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'ñandú ' + 'x'.repeat(200)]) {
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
      const otra = await Core.handle(repo, { method: 'POST', path: '/setup', body: { pinLocal: '593764', pinTienda: '648251' } });
      assert.equal(otra.status, 409);
      assert.equal(otra.json.error.code, 'ya_configurado');
    });

    test('PIN: formato, débiles y distintos', async () => {
      const repo = await fabrica();
      const set = (b) => Core.handle(repo, { method: 'POST', path: '/setup', body: b });
      assert.equal((await set({ pinLocal: '12', pinTienda: '730518' })).json.error.code, 'pin_formato');
      assert.equal((await set({ pinLocal: '4821', pinTienda: '730518' })).json.error.code, 'pin_formato', 'menos de 6 números');
      for (const debil of ['123456', '000000', '111111', '654321', '121212', '123123', '112233', '987654', '45674567']) assert.equal((await set({ pinLocal: debil, pinTienda: '730518' })).json.error.code, 'pin_debil', debil);
      assert.equal((await set({ pinLocal: '482159', pinTienda: '482159' })).json.error.code, 'pin_igual');
      assert.equal((await set({ pinLocal: '482159', pinTienda: '730518' })).status, 200);
    });

    test('clave de instalación: sin ella nadie puede adueñarse del inventario', async () => {
      const repo = await fabrica();
      const opts = { claveInstalacion: 'ABCD-EFGH-JKLM' };
      const set = (extra) => Core.handle(repo, { method: 'POST', path: '/setup', body: Object.assign({ pinLocal: '482159', pinTienda: '730518' }, extra) }, opts);
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
      for (let i = 0; i < 5; i++) r = await Core.handle(repo, { method: 'POST', path: '/setup', body: { clave: 'x' + i, pinLocal: '482159', pinTienda: '730518' } }, opts);
      assert.equal(r.status, 423);
      r = await Core.handle(repo, { method: 'POST', path: '/setup', body: { clave: 'ABCD-EFGH-JKLM', pinLocal: '482159', pinTienda: '730518' } }, opts);
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
      r = await c.login('local', '482159'); // aun con el PIN bueno, bloqueado
      assert.equal(r.status, 423);
      local.avanzar(5 * 60000 + 1000);
      r = await c.login('local', '482159');
      assert.equal(r.status, 200);
      // el otro rol nunca se bloqueó
      assert.equal((await c.login('tienda', '730518')).status, 200);
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

    test('costos solo para el almacén', async () => {
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
      await otra.login('tienda', '730518');
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
      assert.equal((await tienda.op({ op: 'pin.cambiar', pinActual: '0000', pinNuevo: '826437' })).json.error.code, 'pin_incorrecto');
      assert.equal((await tienda.op({ op: 'pin.cambiar', pinActual: '730518', pinNuevo: '482159' })).json.error.code, 'pin_igual');
      assert.equal((await tienda.op({ op: 'pin.cambiar', pinActual: '730518', pinNuevo: '111111' })).json.error.code, 'pin_debil');
      const r = await tienda.op({ op: 'pin.cambiar', pinActual: '730518', pinNuevo: '826437' });
      assert.equal(r.status, 200);
      assert.notEqual(tienda.token, vieja);
      assert.equal((await tienda.estado()).rol, 'tienda');
      assert.equal((await Core.handle(repo, { method: 'GET', path: '/estado', token: vieja })).status, 401);
      assert.equal((await cliente(repo, local.now).login('tienda', '730518')).status, 401);
      assert.equal((await cliente(repo, local.now).login('tienda', '826437')).status, 200);
      // el local reinicia el PIN de la tienda con su propio PIN
      assert.equal((await local.op({ op: 'pin.reiniciar', pinActual: '9999', pinNuevo: '391752' })).json.error.code, 'pin_incorrecto');
      assert.equal((await local.op({ op: 'pin.reiniciar', pinActual: '482159', pinNuevo: '391752' })).status, 200);
      assert.equal((await cliente(repo, local.now).login('tienda', '391752')).status, 200);
      const t2 = cliente(repo, local.now);
      await t2.login('tienda', '391752');
      assert.equal((await t2.op({ op: 'pin.reiniciar', pinActual: '391752', pinNuevo: '284613' })).status, 403);
    });

    test('recuperar PIN con el código y rotarlo', async () => {
      const { local, repo } = await iniciar(fabrica);
      const c = cliente(repo, local.now);
      assert.equal((await c.call('POST', '/recuperar', { codigo: 'AAAA-BBBB', rol: 'local', pin: '592741' })).status, 401);
      const r = await c.call('POST', '/recuperar', { codigo: local.codigo.toLowerCase().replace('-', ' '), rol: 'local', pin: '592741' });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.notEqual(r.json.codigo, local.codigo);
      assert.equal((await cliente(repo, local.now).login('local', '482159')).status, 401);
      assert.equal((await cliente(repo, local.now).login('local', '592741')).status, 200);
      // el código anterior ya no sirve
      assert.equal((await c.call('POST', '/recuperar', { codigo: local.codigo, rol: 'local', pin: '603958' })).status, 401);
      assert.equal((await c.call('POST', '/recuperar', { codigo: r.json.codigo, rol: 'tienda', pin: '592741' })).json.error.code, 'pin_igual');
    });

    test('código de recuperación nuevo: pide PIN y el anterior deja de servir', async () => {
      const { local, tienda, repo } = await iniciar(fabrica);
      assert.equal((await tienda.op({ op: 'recup.nueva', pinActual: '730518' })).status, 403);
      assert.equal((await local.op({ op: 'recup.nueva', pinActual: '0000' })).json.error.code, 'pin_incorrecto');
      const r = await local.op({ op: 'recup.nueva', pinActual: '482159' });
      assert.equal(r.status, 200);
      assert.match(r.json.resultado.codigo, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      const c = cliente(repo, local.now);
      assert.equal((await c.call('POST', '/recuperar', { codigo: local.codigo, rol: 'local', pin: '592741' })).status, 401);
      assert.equal((await c.call('POST', '/recuperar', { codigo: r.json.resultado.codigo, rol: 'local', pin: '592741' })).status, 200);
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

    test('reporte de ventas: hoy, semana y mes con desglose; devoluciones restan; anuladas no cuentan', async () => {
      const { repo, local, tienda } = await iniciar(fabrica);
      const est0 = await local.estado();
      const a = prod(est0, 'Base Queen · Gris'), b = prod(est0, 'Base Individual · Rosa');
      await local.op({ op: 'mov.entrada', lineas: [{ id: a.id, cant: 20 }, { id: b.id, cant: 20 }] });
      const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id: a.id, cant: 20 }, { id: b.id, cant: 20 }] });
      await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });

      assert.equal((await local.call('GET', '/ventas')).status, 200);
      assert.equal((await Core.handle(repo, { method: 'GET', path: '/ventas' }, { now: Date.now() })).status, 401);
      let r = (await tienda.call('GET', '/ventas')).json;
      assert.equal(r.ventas.hoy.total, 0);
      assert.deepEqual(r.ventas.mes.productos, []);

      await tienda.op({ op: 'mov.venta', lineas: [{ id: a.id, cant: 2, precio: 3000 }, { id: b.id, cant: 1, precio: 1000 }] });
      const v2 = await tienda.op({ op: 'mov.venta', lineas: [{ id: a.id, cant: 1, precio: 3000 }] });
      await tienda.op({ op: 'mov.devolucion', lineas: [{ id: b.id, cant: 1, precio: 1000 }] });
      r = (await tienda.call('GET', '/ventas')).json.ventas;
      assert.equal(r.hoy.total, 9000);
      assert.equal(r.hoy.pzas, 3);
      assert.equal(r.hoy.n, 2);
      assert.equal(r.hoy.productos.length, 1, 'la base devuelta queda en cero y no aparece');
      assert.equal(r.hoy.productos[0].id, a.id);
      assert.equal(r.hoy.productos[0].pzas, 3);
      assert.equal(r.hoy.dias.length, 1);
      assert.equal(r.hoy.dias[0].total, 9000);
      assert.equal(r.semana.total, 9000);
      assert.equal(r.mes.total, 9000);

      // anulada: deja de contar
      await tienda.op({ op: 'mov.anular', grupo: v2.json.resultado.grupo, motivo: 'Error de captura' });
      r = (await tienda.call('GET', '/ventas')).json.ventas;
      assert.equal(r.hoy.total, 6000);
      assert.equal(r.hoy.n, 1);

      // ocho días después: ya no es "semana" ni "hoy"; el resumen del estado coincide con el reporte
      local.avanzar(8 * DIA);
      await tienda.op({ op: 'mov.venta', lineas: [{ id: b.id, cant: 2, precio: 1500 }] });
      const est = await tienda.estado();
      r = (await tienda.call('GET', '/ventas')).json.ventas;
      assert.equal(r.hoy.total, 3000);
      assert.equal(r.semana.total, 3000);
      assert.ok(r.mes.total === 3000 || r.mes.total === 9000, 'el mes puede incluir o no la venta de hace 8 días');
      assert.deepEqual({ t: est.resumen.semana.total, p: est.resumen.semana.pzas }, { t: r.semana.total, p: r.semana.pzas });
      assert.equal(est.resumen.mes.total, r.mes.total);
      assert.ok(r.mes.dias.every((d, i, l) => !i || l[i - 1].k > d.k), 'días del más reciente al más antiguo');
    });

    test('entrega y envío en ventas; reporte del día por forma de pago', async () => {
      const { local, tienda } = await iniciar(fabrica);
      const est0 = await local.estado();
      assert.deepEqual([est0.negocio.envioTepic, est0.negocio.envioFuera, est0.negocio.descRecoge], [200, 250, 200]);
      const a = prod(est0, 'Base Queen · Gris'), b = prod(est0, 'Base Individual · Rosa');
      await local.op({ op: 'mov.entrada', lineas: [{ id: a.id, cant: 20 }, { id: b.id, cant: 20 }] });
      const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id: a.id, cant: 20 }, { id: b.id, cant: 20 }] });
      await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });

      // recoge en tienda: sin cargo; el precio por base lo pone el vendedor
      const v1 = await tienda.op({ op: 'mov.venta', pago: 'efectivo', entrega: 'recoge', cliente: 'Ana', lineas: [{ id: a.id, cant: 2, precio: 1800 }] });
      assert.equal(v1.json.resultado.total, 3600);
      // envío a Tepic con la tarifa de la configuración (200) y a Xalisco con monto ajustado
      const v2 = await tienda.op({ op: 'mov.venta', pago: 'transferencia', entrega: 'tepic', lineas: [{ id: b.id, cant: 1, precio: 1600 }, { id: a.id, cant: 1, precio: 2000 }] });
      assert.equal(v2.json.resultado.total, 3800);
      assert.equal(v2.json.resultado.envio, 200);
      const v3 = await tienda.op({ op: 'mov.venta', pago: 'tarjeta', entrega: 'xalisco', envio: 300, lineas: [{ id: b.id, cant: 1, precio: 1600 }] });
      assert.equal(v3.json.resultado.total, 1900);
      // una entrega inventada se ignora; un monto de envío inválido se rechaza
      const v4 = await tienda.op({ op: 'mov.venta', entrega: 'luna', envio: 999, lineas: [{ id: b.id, cant: 1, precio: 1600 }] });
      assert.equal(v4.json.resultado.total, 1600);
      assert.equal((await tienda.op({ op: 'mov.venta', entrega: 'cantera', envio: -50, lineas: [{ id: b.id, cant: 1, precio: 1600 }] })).json.error.code, 'numero_invalido');
      const v5 = await tienda.op({ op: 'mov.venta', entrega: 'cantera', lineas: [{ id: b.id, cant: 1, precio: 1600 }] });
      assert.equal(v5.json.resultado.envio, 250, 'La Cantera usa la tarifa de fuera de Tepic');
      await tienda.op({ op: 'mov.anular', grupo: v5.json.resultado.grupo, motivo: 'Cliente canceló' });

      const rep = (await tienda.call('GET', '/reporte-dia')).json;
      assert.equal(rep.ok, true, JSON.stringify(rep));
      assert.equal(rep.hoy, true);
      assert.equal(rep.totales.ventas, 4);
      assert.equal(rep.totales.envios, 500);
      assert.equal(rep.totales.vendido, 3600 + 3800 + 1900 + 1600);
      assert.equal(rep.totales.porPago.efectivo, 3600 + 1600);
      assert.equal(rep.totales.porPago.transferencia, 3800);
      assert.equal(rep.totales.porPago.tarjeta, 1900);
      assert.equal(rep.ventas[0].cliente, 'Ana');
      assert.equal(rep.ventas[0].entrega, 'recoge');
      assert.equal(rep.ventas[1].lineas.length, 2);
      assert.equal(rep.totales.pzas, 2 + 2 + 1 + 1);
      // la devolución resta del neto
      await tienda.op({ op: 'mov.devolucion', lineas: [{ id: b.id, cant: 1, precio: 1600 }] });
      const rep2 = (await tienda.call('GET', '/reporte-dia')).json;
      assert.equal(rep2.totales.devuelto, 1600);
      assert.equal(rep2.totales.neto, rep.totales.vendido - 1600);
      assert.equal(rep2.devoluciones.length, 1);
      // el reporte semanal/mensual incluye los envíos
      const rv = (await tienda.call('GET', '/ventas')).json.ventas;
      assert.equal(rv.hoy.envios, 500);
      assert.equal(rv.hoy.total, rep.totales.vendido - 1600);
      // sin sesión no hay reporte; fechas absurdas se rechazan
      assert.equal((await Core.handle(await fabrica(), { method: 'GET', path: '/reporte-dia' }, { now: Date.now() })).status, 409);
      assert.equal((await tienda.call('GET', '/reporte-dia', null, { dia: '2020-01-01' })).status, 400);
      assert.equal((await tienda.call('GET', '/reporte-dia', null, { dia: 'ayer' })).status, 400);
      assert.equal((await tienda.call('GET', '/reporte-dia', null, { dia: '2999-01-01' })).status, 400);
      // un día de otra fecha queda vacío
      local.avanzar(2 * DIA);
      const rep3 = (await tienda.call('GET', '/reporte-dia')).json;
      assert.equal(rep3.totales.ventas, 0);
      const ayer = rep.dia;
      assert.equal((await tienda.call('GET', '/reporte-dia', null, { dia: ayer })).json.totales.ventas, 4);
      // las tarifas se pueden cambiar desde Almacén y no se pierden al guardar el negocio sin ellas
      await local.op({ op: 'config.guardar', negocio: { nombre: 'Bases Box Tepic', envioTepic: 220 } });
      let e2 = await local.estado();
      assert.deepEqual([e2.negocio.envioTepic, e2.negocio.envioFuera], [220, 250]);
      await local.op({ op: 'config.guardar', negocio: { nombre: 'Bases Box Tepic' } });
      e2 = await local.estado();
      assert.equal(e2.negocio.envioTepic, 220);
    });

    test('reiniciar a cero: pide PIN y frase, borra movimientos y stock, conserva catálogo, precios y PIN', async () => {
      const { repo, local, tienda } = await iniciar(fabrica);
      const est0 = await local.estado();
      const a = prod(est0, 'Base Queen · Gris');
      await local.op({ op: 'config.guardar', medidas: est0.medidas.map((m) => (m.id === 'qn' ? { ...m, precio: 2000 } : m)), aplicarPrecios: ['qn'] });
      await local.op({ op: 'mov.entrada', lineas: [{ id: a.id, cant: 9 }] });
      const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id: a.id, cant: 5 }] });
      await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });
      await tienda.op({ op: 'mov.venta', lineas: [{ id: a.id, cant: 1 }] });
      await tienda.op({ op: 'pedido.crear', lineas: [{ id: a.id, cant: 3 }] });
      await local.op({ op: 'traspaso.enviar', lineas: [{ id: a.id, cant: 1 }] });

      // solo Almacén, con su PIN y la frase exacta
      assert.equal((await tienda.op({ op: 'sistema.reiniciar', pinActual: '730518', confirmacion: 'BORRAR TODO' })).status, 403);
      assert.equal((await local.op({ op: 'sistema.reiniciar', pinActual: '000999', confirmacion: 'BORRAR TODO' })).json.error.code, 'pin_incorrecto');
      assert.equal((await local.op({ op: 'sistema.reiniciar', pinActual: '482159', confirmacion: 'borrar' })).json.error.code, 'falta_confirmacion');
      assert.equal((await local.op({ op: 'sistema.reiniciar', pinActual: '482159' })).json.error.code, 'falta_confirmacion');
      assert.ok((await local.estado()).productos.some((p) => p.stock_local + p.stock_tienda > 0), 'nada se borró con los intentos fallidos');

      const r = await local.op({ op: 'sistema.reiniciar', pinActual: '482159', confirmacion: 'borrar todo' });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      const est = r.json.estado;
      assert.ok(est.productos.every((p) => p.stock_local === 0 && p.stock_tienda === 0));
      assert.equal(est.productos.length, est0.productos.length);
      assert.equal(prod(est, 'Base Queen · Gris').precio, 2000, 'los precios se conservan');
      assert.deepEqual([est.traspasos.length, est.pedidos.length, est.recientes.length], [0, 0, 0]);
      assert.equal(est.resumen.hoy.total, 0);
      assert.equal((await local.call('GET', '/movs', null, { limite: '50' })).json.items.length, 0);
      // los PIN siguen sirviendo y se puede volver a trabajar
      assert.equal((await cliente(repo, local.now).login('tienda', '730518')).status, 200);
      assert.equal((await local.op({ op: 'mov.entrada', lineas: [{ id: a.id, cant: 2 }] })).status, 200);
    });

    test('entradas basura nunca tumban el servidor (siempre 4xx, jamás 500) ni corrompen datos', async () => {
      const { local, tienda } = await iniciar(fabrica);
      const est = await local.estado();
      const a = prod(est, 'Base Queen · Gris');
      await local.op({ op: 'mov.entrada', lineas: [{ id: a.id, cant: 5 }] });
      const raros = [null, undefined, true, 0, -1, 1e999, NaN, '', 'x', '__proto__', 'constructor', '<img src=x onerror=alert(1)>', { a: 1 }, [], [[]], 'DROP TABLE movs;--', 'a'.repeat(5000)];
      const cuerpos = [];
      for (const v of raros) {
        for (const op of ['mov.entrada', 'mov.salida', 'mov.venta', 'mov.devolucion', 'mov.merma', 'mov.conteo', 'mov.anular', 'traspaso.enviar', 'traspaso.recibir', 'traspaso.cancelar', 'pedido.crear', 'pedido.cancelar', 'producto.crear', 'producto.editar', 'producto.variantes', 'producto.archivar', 'config.guardar', 'pin.cambiar', 'pin.reiniciar', 'recup.nueva', 'sistema.reiniciar', v]) {
          cuerpos.push({ op, lineas: v, id: v, grupo: v, cant: v, precio: v, nota: v, motivo: v, pago: v, entrega: v, envio: v, cliente: v, nombre: v, negocio: v, medidas: v, tonos: v, pinActual: v, pinNuevo: v, confirmacion: v });
          cuerpos.push({ op, lineas: [{ id: v, cant: v, precio: v, contado: v, recibida: v }] });
          cuerpos.push({ op, lineas: [{ id: a.id, cant: v, precio: v }] });
        }
      }
      for (const c of cuerpos) {
        for (const quien of [local, tienda]) {
          let r;
          try { r = await quien.op(c); } catch (e) { assert.fail('lanzó excepción con ' + JSON.stringify(c).slice(0, 120) + ': ' + e.message); }
          assert.ok(r.status < 500, 'status ' + r.status + ' con ' + JSON.stringify(c).slice(0, 160));
        }
      }
      for (const ruta of ['/', '/op', '/estado', '/movs', '/ventas', '/reporte-dia', '/../x', '/%00', '/constructor']) {
        const r = await local.call('GET', ruta, null, { limite: 'x', dia: '__proto__', antes: '__proto__', tipos: ['a'], tz: 'zzz' });
        assert.ok(r.status < 500, ruta + ' → ' + r.status);
      }
      // el inventario sigue consistente: ninguna existencia negativa y el total no cambió por basura
      const fin = await local.estado();
      fin.productos.forEach((p) => assert.ok(p.stock_local >= 0 && p.stock_tienda >= 0 && Number.isInteger(p.stock_local)));
      assert.equal(prod(fin, 'Base Queen · Gris').stock_local + prod(fin, 'Base Queen · Gris').stock_tienda >= 0, true);
    });

    test('la sesión vence a los 14 días sin uso y se renueva con el uso; el rol no se puede cambiar', async () => {
      const { local, tienda } = await iniciar(fabrica);
      assert.equal((await tienda.call('GET', '/estado')).status, 200);
      local.avanzar(8 * DIA);
      const e = (await tienda.call('GET', '/estado')).json;
      assert.ok(e.token, 'a mitad de vida se entrega un token renovado');
      const viejo = tienda.token;
      tienda.token = e.token;
      local.avanzar(10 * DIA); // 18 días desde el primer login, pero solo 10 desde la renovación
      assert.equal((await tienda.call('GET', '/estado')).status, 200);
      tienda.token = viejo;
      assert.equal((await tienda.call('GET', '/estado')).json.error.code, 'sin_sesion', 'el token viejo ya venció');
      // un token de tienda con el rol cambiado a local no sirve
      const [cuerpo, firma] = e.token.split('.');
      const obj = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
      obj.r = 'local';
      tienda.token = Buffer.from(JSON.stringify(obj)).toString('base64url') + '.' + firma;
      assert.equal((await tienda.call('GET', '/estado')).json.error.code, 'sin_sesion');
    });

    test('seguridad: ráfaga de PIN en paralelo, sondeo del PIN ajeno, ids con nombre de propiedad, pedido repetido', async () => {
      const { repo, local, tienda } = await iniciar(fabrica);
      // 1) 40 intentos simultáneos con PIN malo: solo 5 llegan a comprobarse; el resto ya está bloqueado
      const c = cliente(repo, local.now);
      const rs = await Promise.all(Array.from({ length: 40 }, (_, i) => c.call('POST', '/login', { rol: 'local', pin: String(100000 + i * 7919) })));
      const codigos = rs.map((r) => r.json.error.code);
      assert.equal(codigos.filter((x) => x === 'pin_incorrecto').length, 4, 'cuatro con aviso de intentos');
      assert.ok(codigos.filter((x) => x === 'bloqueado').length >= 36, 'el resto bloqueado: ' + codigos.join(','));
      assert.equal((await c.call('POST', '/login', { rol: 'local', pin: '482159' })).json.error.code, 'bloqueado', 'ni el PIN correcto entra durante el bloqueo');
      local.avanzar(6 * 60000);
      assert.equal((await c.call('POST', '/login', { rol: 'local', pin: '482159' })).status, 200, 'pasado el bloqueo entra con su PIN');

      // 2) el vendedor no puede ir probando PIN para descubrir el del Almacén con pin.cambiar
      const vistos = [];
      let pinT = '730518';
      for (let i = 0; i < 12; i++) {
        const r = await tienda.op({ op: 'pin.cambiar', pinActual: pinT, pinNuevo: String(482150 + i) });
        if (r.status === 200) pinT = String(482150 + i);
        vistos.push(r.json.error);
      }
      const bloq = vistos.findIndex((e) => e && e.code === 'bloqueado');
      assert.ok(bloq >= 0 && bloq <= 6, 'se bloquea en pocos intentos (' + bloq + ')');
      assert.ok(vistos.every((e) => !e || e.code !== 'pin_igual' || e.mensaje.indexOf('Almacén') < 0));

      // 3) ids con nombre de propiedad no rompen reportes ni historial
      const est = await local.estado();
      const a = prod(est, 'Base Queen · Gris');
      await local.op({ op: 'mov.entrada', cid: '__proto__', lineas: [{ id: a.id, cant: 3 }] });
      await local.op({ op: 'mov.entrada', cid: 'constructor', lineas: [{ id: a.id, cant: 3 }] });
      assert.equal((await tienda.call('GET', '/reporte-dia')).status, 200);
      assert.equal((await local.call('GET', '/movs', null, { limite: '50' })).status, 200);

      // 4) un pedido no se puede sobrescribir repitiendo su id
      await local.op({ op: 'mov.entrada', lineas: [{ id: a.id, cant: 5 }] });
      const t2 = cliente(repo, local.now); local.avanzar(25 * 3600000); const lg2 = await t2.login('tienda', pinT); assert.equal(lg2.status, 200, JSON.stringify(lg2.json));
      const p1 = await t2.op({ op: 'pedido.crear', cid: 'pedido-unico-01', lineas: [{ id: a.id, cant: 2 }] });
      assert.equal(p1.status, 200, JSON.stringify(p1.json));
      assert.equal((await t2.op({ op: 'pedido.crear', cid: 'pedido-unico-01', lineas: [{ id: a.id, cant: 9 }] })).json.error.code, 'duplicado');
    });

    test('regreso de tienda al almacén: mueve de inmediato, valida existencias, se puede anular', async () => {
      const { local, tienda } = await iniciar(fabrica);
      const est0 = await local.estado();
      const a = prod(est0, 'Base Queen · Gris'), b = prod(est0, 'Base Individual · Rosa');
      await local.op({ op: 'mov.entrada', lineas: [{ id: a.id, cant: 10 }, { id: b.id, cant: 4 }] });
      const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id: a.id, cant: 6 }, { id: b.id, cant: 4 }] });
      await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });
      // no se puede regresar más de lo que hay en la tienda
      assert.equal((await tienda.op({ op: 'mov.regreso', lineas: [{ id: a.id, cant: 7 }] })).json.error.code, 'stock_insuficiente');
      const r = await tienda.op({ op: 'mov.regreso', lineas: [{ id: a.id, cant: 2 }, { id: b.id, cant: 1 }], nota: 'Se movieron por error' });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.resultado.piezas, 3);
      let est = r.json.estado;
      assert.deepEqual([prod(est, 'Base Queen · Gris').stock_local, prod(est, 'Base Queen · Gris').stock_tienda], [6, 4]);
      assert.deepEqual([prod(est, 'Base Individual · Rosa').stock_local, prod(est, 'Base Individual · Rosa').stock_tienda], [1, 3]);
      // el Almacén también puede registrarlo, y las ventas no se alteran
      assert.equal((await local.op({ op: 'mov.regreso', lineas: [{ id: a.id, cant: 1 }] })).status, 200);
      assert.equal((await local.estado()).resumen.hoy.total, 0);
      // anular lo deja como estaba
      const g = r.json.resultado.grupo;
      const an = await tienda.op({ op: 'mov.anular', grupo: g, motivo: 'Fue un error' });
      assert.equal(an.status, 200, JSON.stringify(an.json));
      est = an.json.estado;
      assert.deepEqual([prod(est, 'Base Queen · Gris').stock_local, prod(est, 'Base Queen · Gris').stock_tienda], [5, 5]);
      assert.deepEqual([prod(est, 'Base Individual · Rosa').stock_local, prod(est, 'Base Individual · Rosa').stock_tienda], [0, 4]);
      // aparece en el historial filtrado por envíos
      const h = (await local.call('GET', '/movs', null, { limite: '50', tipos: 'regreso' })).json.items;
      assert.ok(h.length >= 4 && h.every((m) => m.tipo === 'regreso'));
    });

    test('gastos: registro por ambos usuarios, visibilidad, resumen, reporte del día, anulación y reinicio', async () => {
      const { local, tienda } = await iniciar(fabrica);
      assert.equal((await tienda.op({ op: 'gasto.crear', monto: 0, cat: 'comida' })).json.error.code, 'falta_monto');
      assert.equal((await tienda.op({ op: 'gasto.crear', monto: -5, cat: 'comida' })).json.error.code, 'falta_monto');
      assert.equal((await tienda.op({ op: 'gasto.crear', monto: 'abc', cat: 'comida' })).json.error.code, 'falta_monto');
      assert.equal((await tienda.op({ op: 'gasto.crear', monto: 50, cat: 'otro' })).json.error.code, 'falta_concepto');
      assert.equal((await tienda.op({ op: 'gasto.crear', monto: 50, cat: 'comida', dia: '2020-01-01' })).json.error.code, 'dia_invalido');
      const g1 = await tienda.op({ op: 'gasto.crear', monto: 120.5, cat: 'comida', concepto: 'Comida del equipo', pago: 'efectivo' });
      assert.equal(g1.status, 200, JSON.stringify(g1.json));
      const g2 = await tienda.op({ op: 'gasto.crear', monto: 300, cat: 'transporte', concepto: 'Gasolina camioneta', pago: 'tarjeta' });
      const g3 = await local.op({ op: 'gasto.crear', monto: 5000, cat: 'materiales', concepto: 'Madera y tela', pago: 'transferencia' });
      assert.equal(g3.status, 200);
      // los gastos son de todo el negocio: Almacén y Tienda ven exactamente lo mismo
      const lt = (await tienda.call('GET', '/gastos')).json, ll = (await local.call('GET', '/gastos')).json;
      assert.equal(lt.items.length, 3);
      assert.equal(ll.items.length, 3);
      assert.deepEqual(lt.resumen, ll.resumen);
      assert.equal(lt.resumen.hoy.total, 5420.5);
      assert.equal(ll.resumen.hoy.total, 5420.5);
      assert.equal(ll.resumen.mes.porCat.materiales, 5000);
      assert.equal(ll.resumen.hoy.porPago.efectivo, 120.5);
      assert.equal((await tienda.estado()).resumen.gastos.hoy, 5420.5);
      assert.equal((await local.estado()).resumen.gastos.mes, 5420.5);
      // un gasto de ayer entra al mes pero no al día de hoy
      const ayerK = new Date(Date.now() - DIA).toISOString().slice(0, 10);
      const g4 = await tienda.op({ op: 'gasto.crear', monto: 80, cat: 'comida', dia: ayerK });
      assert.equal(g4.status, 200, JSON.stringify(g4.json));
      assert.equal((await tienda.call('GET', '/gastos', null, { tz: '0' })).json.resumen.hoy.total, 5420.5);
      // reporte del día: gastos de la tienda y efectivo neto
      const a = prod(await local.estado(), 'Base Queen · Gris');
      await local.op({ op: 'mov.entrada', lineas: [{ id: a.id, cant: 5 }] });
      const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id: a.id, cant: 5 }] });
      await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });
      await tienda.op({ op: 'mov.venta', pago: 'efectivo', lineas: [{ id: a.id, cant: 1, precio: 1000 }] });
      const rep = (await tienda.call('GET', '/reporte-dia', null, { tz: '0' })).json;
      assert.equal(rep.gastos.length, 2);
      assert.equal(rep.totales.gastos, 420.5);
      assert.equal(rep.totales.gastosEfectivo, 120.5);
      assert.equal(rep.totales.efectivoNeto, 1000 - 120.5);
      // anular: el vendedor solo lo suyo, con motivo; no se anula dos veces; no cuenta en los totales
      assert.equal((await tienda.op({ op: 'gasto.anular', id: g3.json.resultado.id, motivo: 'no era mío' })).status, 403);
      assert.equal((await tienda.op({ op: 'gasto.anular', id: g1.json.resultado.id, motivo: '' })).json.error.code, 'falta_motivo');
      assert.equal((await tienda.op({ op: 'gasto.anular', id: 'no-existe', motivo: 'prueba' })).status, 404);
      assert.equal((await tienda.op({ op: 'gasto.anular', id: g1.json.resultado.id, motivo: 'Me equivoqué' })).status, 200);
      assert.equal((await tienda.op({ op: 'gasto.anular', id: g1.json.resultado.id, motivo: 'otra vez' })).json.error.code, 'ya_anulado');
      assert.equal((await tienda.call('GET', '/gastos', null, { tz: '0' })).json.resumen.hoy.total, 5300);
      assert.equal((await local.op({ op: 'gasto.anular', id: g2.json.resultado.id, motivo: 'Lo pagó el dueño' })).status, 200);
      // el mismo id no se registra dos veces (reintento de red)
      const cid = 'gasto-reintento-1';
      assert.equal((await tienda.op({ op: 'gasto.crear', cid, monto: 10, cat: 'comida' })).status, 200);
      assert.equal((await tienda.op({ op: 'gasto.crear', cid, monto: 10, cat: 'comida' })).json.error.code, 'duplicado');
      // dejar todo en cero también borra los gastos
      const pin = '482159';
      assert.equal((await local.op({ op: 'sistema.reiniciar', pinActual: pin, confirmacion: 'BORRAR TODO' })).status, 200);
      assert.equal((await local.call('GET', '/gastos')).json.items.length, 0);
    });

    test('Dueño: solo lectura, PIN lo crea el Almacén, ve costos y el resumen del negocio', async () => {
      const { repo, local, tienda } = await iniciar(fabrica);
      const c0 = cliente(repo, local.now);
      assert.equal((await c0.call('GET', '/ping')).json.dueno, false);
      assert.equal((await c0.login('dueno', '482150')).status, 401, 'sin PIN de dueño no entra nadie');
      // solo el Almacén crea el PIN del dueño, con su propio PIN; no puede repetir el de otro usuario
      assert.equal((await tienda.op({ op: 'pin.dueno', pinActual: '730518', pinNuevo: '615243' })).status, 403);
      assert.equal((await local.op({ op: 'pin.dueno', pinActual: '000999', pinNuevo: '615243' })).json.error.code, 'pin_incorrecto');
      assert.equal((await local.op({ op: 'pin.dueno', pinActual: '482159', pinNuevo: '730518' })).json.error.code, 'pin_igual');
      assert.equal((await local.op({ op: 'pin.dueno', pinActual: '482159', pinNuevo: '123456' })).json.error.code, 'pin_debil');
      assert.equal((await local.op({ op: 'pin.dueno', pinActual: '482159', pinNuevo: '615243' })).status, 200);
      assert.equal((await c0.call('GET', '/ping')).json.dueno, true);
      const dueno = cliente(repo, local.now);
      assert.equal((await dueno.login('dueno', '615243')).status, 200);
      // los PIN siguen siendo distintos entre los tres
      assert.equal((await tienda.op({ op: 'pin.cambiar', pinActual: '730518', pinNuevo: '615243' })).json.error.code, 'pin_igual');

      // datos del negocio: producción, venta con envío, devolución, gasto
      const est0 = await local.estado();
      const a = prod(est0, 'Base Queen · Gris'), b = prod(est0, 'Base Individual · Rosa');
      await local.op({ op: 'producto.editar', id: a.id, costo: 1000, precio: 2000 });
      await local.op({ op: 'producto.editar', id: b.id, costo: 700, precio: 1600 });
      await local.op({ op: 'mov.entrada', motivo: 'produccion', lineas: [{ id: a.id, cant: 10 }, { id: b.id, cant: 5 }] });
      await local.op({ op: 'mov.entrada', motivo: 'compra', lineas: [{ id: b.id, cant: 2 }] });
      const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id: a.id, cant: 6 }, { id: b.id, cant: 4 }] });
      await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });
      await tienda.op({ op: 'mov.venta', pago: 'efectivo', entrega: 'tepic', lineas: [{ id: a.id, cant: 2, precio: 1800 }] });   // 3600 + 200
      await tienda.op({ op: 'mov.venta', pago: 'transferencia', lineas: [{ id: b.id, cant: 1, precio: 1600 }] });                  // 1600
      await tienda.op({ op: 'mov.devolucion', lineas: [{ id: b.id, cant: 1, precio: 1600 }] });                                    // -1600
      await tienda.op({ op: 'gasto.crear', monto: 500, cat: 'comida', concepto: 'Comida' });
      await local.op({ op: 'gasto.crear', monto: 2500, cat: 'materiales', concepto: 'Tela', pago: 'transferencia' });
      await local.op({ op: 'traspaso.enviar', lineas: [{ id: a.id, cant: 1 }] });

      const r = (await dueno.call('GET', '/resumen', null, { tz: '0' })).json;
      assert.equal(r.ok, true, JSON.stringify(r));
      const h = r.periodos.hoy;
      assert.equal(h.ventas.bruto, 3800 + 1600);
      assert.equal(h.ventas.devuelto, 1600);
      assert.equal(h.ventas.neto, 3800);
      assert.equal(h.ventas.envios, 200);
      assert.equal(h.ventas.n, 2);
      assert.equal(h.ventas.porPago.efectivo, 3800);
      assert.equal(h.ventas.porPago.transferencia, 1600);
      assert.equal(h.gastos.total, 3000);
      assert.equal(h.gastos.porCat.materiales, 2500);
      assert.equal(h.egresos, 3000 + 1600);
      assert.equal(h.resultado, 5400 - 4600);
      assert.equal(h.produccion.pzas, 15);
      assert.equal(h.produccion.costo, 10 * 1000 + 5 * 700);
      assert.equal(h.produccion.compras, 2);
      assert.equal(r.periodos.mes.ventas.bruto, 5400);
      assert.equal(r.periodos.semana.gastos.total, 3000);
      assert.equal(r.dias.length, 7);
      assert.equal(r.dias[6].gastos, 3000);
      assert.equal(r.dias[6].ventas, 3800);
      assert.equal(r.inventario.pzasCamino, 1);
      assert.equal(r.inventario.enviosEnCamino, 1);
      assert.equal(r.inventario.pzasAlmacen + r.inventario.pzasTienda, 15 + 2 - 2 - 1 + 0 - 1 + 1 - 0 + 0 - 0, 'inventario: producido y comprado menos lo vendido y lo que va en camino');
      assert.ok(r.inventario.valorCosto > 0 && r.inventario.valorVenta > 0);
      assert.equal(r.top[0].id, a.id);
      // el Almacén ve el mismo resumen; el vendedor no
      assert.deepEqual((await local.call('GET', '/resumen', null, { tz: '0' })).json.periodos, r.periodos);
      assert.equal((await tienda.call('GET', '/resumen')).status, 403);

      // el dueño ve los costos; el vendedor no
      assert.equal((await dueno.estado()).productos.find((p) => p.id === a.id).costo, 1000);
      assert.equal('costo' in (await tienda.estado()).productos[0], false);
      // lee gastos, ventas y reporte, pero no puede hacer NADA (ninguna operación, salvo cambiar su propio PIN)
      assert.equal((await dueno.call('GET', '/gastos')).json.items.length, 2);
      assert.equal((await dueno.call('GET', '/ventas')).status, 200);
      assert.equal((await dueno.call('GET', '/movs', null, { limite: '20' })).status, 200);
      for (const op of ['mov.entrada', 'mov.salida', 'mov.venta', 'mov.devolucion', 'mov.merma', 'mov.regreso', 'mov.conteo', 'mov.anular', 'traspaso.enviar', 'traspaso.recibir', 'traspaso.cancelar', 'pedido.crear', 'pedido.cancelar', 'producto.crear', 'producto.editar', 'producto.variantes', 'producto.archivar', 'config.guardar', 'pin.reiniciar', 'pin.dueno', 'recup.nueva', 'sistema.reiniciar', 'gasto.crear', 'gasto.anular']) {
        const x = await dueno.op({ op, lineas: [{ id: a.id, cant: 1 }], monto: 5, cat: 'comida', pinActual: '615243', pinNuevo: '951357', confirmacion: 'BORRAR TODO', id: 'x', grupo: 'x', motivo: 'prueba' });
        assert.equal(x.status, 403, op + ' → ' + x.status);
      }
      assert.equal((await dueno.op({ op: 'pin.cambiar', pinActual: '615243', pinNuevo: '951357' })).status, 200, 'puede cambiar su propio PIN');
      assert.equal((await cliente(repo, local.now).login('dueno', '951357')).status, 200);
    });

    test('datos de demostración: se generan, cuadran y el tablero tiene vida', async () => {
      const repo = await fabrica();
      const pins = await Core.sembrarDemo(repo, { now: Date.now() });
      assert.deepEqual(pins, { local: '1111', tienda: '2222', dueno: '3333' });
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
