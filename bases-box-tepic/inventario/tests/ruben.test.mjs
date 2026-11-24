// Perfil de Rubén (solo registra ventas) y avisos al celular (Web Push cifrado, RFC 8291 / VAPID RFC 8292).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { D1Falsa } from './d1-shim.mjs';
import { crearRepoD1 } from '../functions/_d1.js';
import { cifrar, llavesVapid, enviar, _pruebas } from '../functions/_push.js';

const Core = createRequire(import.meta.url)('../public/core.js');
const { b64u, deB64u, hkdf, unir } = _pruebas;

async function arrancar(fabrica, avisos) {
  const repo = await fabrica();
  const t0 = Date.now(); let tick = 0;
  const opts = () => ({ now: t0 + tick++, avisar: (a) => avisos.push(a), claveVapid: async () => 'CLAVE' });
  const call = (token, method, path, body, query) => Core.handle(repo, { method, path, body, query: Object.assign({ tz: '0' }, query), token }, opts());
  const s = await call('', 'POST', '/setup', { nombre: 'X', pinLocal: '482159', pinTienda: '730518', catalogo: { bases: true } });
  const mk = (tok) => { const c = { t: tok, call: (m, p, b, q) => call(c.t, m, p, b, q), async op(b) { const r = await call(c.t, 'POST', '/op', b); if (r.json.ok && r.json.token) c.t = r.json.token; return r; } }; return c; };
  const local = mk(s.json.token);
  const tienda = mk((await call('', 'POST', '/login', { rol: 'tienda', pin: '730518' })).json.token);
  return { repo, call, mk, local, tienda };
}

for (const [nombre, fabrica] of [['local', async () => Core.crearRepoLocal(Core.almacenMemoria(), 'ruben')], ['d1', async () => crearRepoD1(new D1Falsa())]]) {
  test('perfil de Rubén · ' + nombre + ': solo registra ventas, con su nombre, y avisa al almacén', async () => {
    const avisos = [];
    const { call, mk, local, tienda } = await arrancar(fabrica, avisos);
    // sin PIN no existe el perfil
    assert.equal((await call('', 'GET', '/ping')).json.ruben, false);
    assert.equal((await call('', 'POST', '/login', { rol: 'ruben', pin: '615243' })).json.error.code, 'pin_incorrecto');
    // el Almacén le pone su PIN (distinto a los demás)
    assert.equal((await tienda.op({ op: 'pin.ruben', pinActual: '730518', pinNuevo: '615243' })).json.error.code, 'pin_incorrecto', 'Zeus necesita el PIN del almacén');
    assert.equal((await local.op({ op: 'pin.ruben', pinActual: '482159', pinNuevo: '730518' })).json.error.code, 'pin_igual');
    assert.equal((await local.op({ op: 'pin.ruben', pinActual: '482159', pinNuevo: '615243' })).status, 200);
    assert.equal((await call('', 'GET', '/ping')).json.ruben, true);
    const lg = await call('', 'POST', '/login', { rol: 'ruben', pin: '615243' });
    assert.equal(lg.json.ok, true); assert.equal(lg.json.rol, 'ruben');
    const ruben = mk(lg.json.token);

    // mercancía en tienda
    const est = (await local.call('GET', '/estado')).json;
    const b = est.productos.find((p) => p.nombre === 'Base Individual · Rosa');
    await local.op({ op: 'mov.entrada', lineas: [{ id: b.id, cant: 4 }] });
    const env = await local.op({ op: 'traspaso.enviar', lineas: [{ id: b.id, cant: 4 }] });
    await tienda.op({ op: 'traspaso.recibir', id: env.json.resultado.id });
    avisos.length = 0;

    // venta de Rubén: queda con su nombre aunque escriba otro, y avisa
    const v = await ruben.op({ op: 'mov.venta', pago: 'efectivo', vendedor: 'Hugo', cliente: 'Ana', lineas: [{ id: b.id, cant: 1, precio: 1600 }] });
    assert.equal(v.status, 200, JSON.stringify(v.json));
    assert.equal(avisos.length, 1);
    assert.match(avisos[0].titulo, /Carlos registró una venta · \$1,600/);
    assert.match(avisos[0].texto, /1 × Base Individual · Rosa · efectivo · cliente Ana/);
    const mov = (await local.call('GET', '/movs', null, { limite: '10', tipos: 'venta' })).json.items.find((m) => m.grupo === v.json.resultado.grupo);
    assert.equal(mov.vendedor, 'Carlos'); assert.equal(mov.rol, 'ruben');
    assert.equal(v.json.estado.productos[0].costo, undefined, 'Rubén no ve costos');

    // lo demás no lo puede hacer
    for (const op of [
      { op: 'mov.entrada', lineas: [{ id: b.id, cant: 1 }] }, { op: 'mov.devolucion', lineas: [{ id: b.id, cant: 1, precio: 1 }] },
      { op: 'mov.anular', grupo: v.json.resultado.grupo, motivo: 'prueba' }, { op: 'venta.pago', grupo: v.json.resultado.grupo, pago: 'tarjeta' },
      { op: 'gasto.crear', monto: 10, cat: 'comida', concepto: 'x' }, { op: 'traspaso.recibir', id: env.json.resultado.id },
      { op: 'mov.conteo', loc: 'tienda', lineas: [{ id: b.id, cant: 1 }] }, { op: 'agenda.crear', cliente: 'x', dia: '2026-01-01', detalle: 'x' },
      { op: 'pin.ruben', pinActual: '615243', pinNuevo: '615244' }, { op: 'push.suscribir', endpoint: 'https://x', p256dh: 'x', auth: 'x' }
    ]) assert.equal((await ruben.op(op)).status, 403, op.op);
    for (const ruta of ['/resumen', '/reporte-semana', '/cuentas', '/gastos', '/push/clave']) assert.equal((await ruben.call('GET', ruta)).status, 403, ruta);
    assert.equal((await ruben.call('GET', '/agenda', null, { desde: '2026-01-01', hasta: '2026-01-31' })).status, 200, 'Rubén ve los pedidos de clientes (solo lectura)');
    assert.equal(avisos.length, 1, 'lo que falla no avisa');

    // solo ve sus propios movimientos y su reporte del día
    await tienda.op({ op: 'mov.venta', pago: 'tarjeta', lineas: [{ id: b.id, cant: 1, precio: 1600 }] });
    assert.equal(avisos.length, 1, 'las ventas de la tienda no avisan');
    const suyos = (await ruben.call('GET', '/movs', null, { limite: '50' })).json.items;
    assert.ok(suyos.length >= 1 && suyos.every((m) => m.rol === 'ruben'));
    assert.ok((await ruben.call('GET', '/estado')).json.recientes.every((m) => m.rol === 'ruben'));
    const rep = (await ruben.call('GET', '/reporte-dia')).json;
    assert.equal(rep.ventas.length, 1); assert.equal(rep.ventas[0].vendedor, 'Carlos');
    // el Almacén sí puede anular la venta de Rubén
    assert.equal((await local.op({ op: 'mov.anular', grupo: v.json.resultado.grupo, motivo: 'prueba' })).status, 200);

    // cambiar su propio PIN sí puede
    const cp = await ruben.op({ op: 'pin.cambiar', pinActual: '615243', pinNuevo: '615249' });
    assert.equal(cp.status, 200, JSON.stringify(cp.json));
  });

  test('avisos al celular · ' + nombre + ': suscribir, probar y quitar (solo almacén/dueño)', async () => {
    const avisos = [];
    const { local, tienda, mk } = await arrancar(fabrica, avisos);
    assert.equal((await local.call('GET', '/push/clave')).json.publica, 'CLAVE');
    assert.equal((await tienda.call('GET', '/push/clave')).json.publica, 'CLAVE', 'Zeus (tienda) también puede activar avisos');
    assert.equal((await local.op({ op: 'push.probar' })).json.error.code, 'sin_avisos');
    const p256dh = 'B' + 'A'.repeat(86), auth = 'Q'.repeat(22);
    assert.equal((await local.op({ op: 'push.suscribir', endpoint: 'http://no-https', p256dh, auth })).json.error.code, 'push_invalido');
    const s1 = await local.op({ op: 'push.suscribir', endpoint: 'https://push.ejemplo.com/abc123', p256dh, auth, equipo: 'iPhone' });
    assert.equal(s1.json.resultado.avisos, 1); assert.equal(s1.json.estado.avisos, 1);
    // la misma suscripción no se duplica
    assert.equal((await local.op({ op: 'push.suscribir', endpoint: 'https://push.ejemplo.com/abc123', p256dh, auth })).json.resultado.avisos, 1);
    assert.equal((await mk('x').op({ op: 'push.suscribir', endpoint: 'https://push.ejemplo.com/zzz', p256dh, auth })).status, 401);
    avisos.length = 0;
    assert.equal((await local.op({ op: 'push.probar' })).status, 200);
    assert.equal(avisos.length, 1); assert.match(avisos[0].titulo, /Avisos activados/);
    assert.equal((await local.op({ op: 'push.quitar', endpoint: 'https://push.ejemplo.com/abc123' })).json.resultado.avisos, 0);
  });
}

// descifra como lo haría el celular (RFC 8291) para comprobar el formato
async function descifrar(body, uaPriv, uaPubRaw, authRaw) {
  const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPriv, 256));
  const ikm = await hkdf(authRaw, compartido, unir(new TextEncoder().encode('WebPush: info\0'), uaPubRaw, asPub), 32);
  const cek = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plano = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, ct));
  assert.equal(plano[plano.length - 1], 2, 'termina con el delimitador del último registro');
  return new TextDecoder().decode(plano.slice(0, -1));
}

test('push: el mensaje cifrado se puede descifrar con la llave del celular', async () => {
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const body = await cifrar('{"titulo":"Rubén registró una venta"}', b64u(uaPub), b64u(auth));
  assert.equal(new DataView(body.buffer).getUint32(16), 4096);
  assert.equal(await descifrar(body, ua.privateKey, uaPub, auth), '{"titulo":"Rubén registró una venta"}');
});

test('push: firma VAPID válida, cabeceras correctas y suscripciones vencidas detectadas', async () => {
  const v = await llavesVapid({});
  assert.equal(v.nuevas, true); assert.equal(deB64u(v.publica).length, 65);
  assert.equal((await llavesVapid({ vapid: { publica: v.publica, privada: v.privada } })).nuevas, false);
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPub = b64u(await crypto.subtle.exportKey('raw', ua.publicKey)), auth = b64u(crypto.getRandomValues(new Uint8Array(16)));
  const raw = { vapid: { publica: v.publica, privada: v.privada }, push: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: uaPub, auth }, { endpoint: 'https://web.push.apple.com/vencida', p256dh: uaPub, auth }] };
  const llamadas = [];
  const r = await enviar(raw, { titulo: 'T', texto: 'X' }, { fetch: async (url, init) => { llamadas.push({ url, init }); return { ok: !url.includes('vencida'), status: url.includes('vencida') ? 410 : 201 }; } });
  assert.deepEqual(r, { enviados: 1, muertas: ['https://web.push.apple.com/vencida'] });
  const h = llamadas.find((l) => l.url.includes('fcm')).init.headers; // se mandan en paralelo: el orden no está garantizado
  assert.equal(h['Content-Encoding'], 'aes128gcm'); assert.equal(h.TTL, '86400');
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(h.Authorization);
  assert.ok(m); assert.equal(m[2], v.publica);
  const [c, p, f] = m[1].split('.');
  const claims = JSON.parse(new TextDecoder().decode(deB64u(p)));
  assert.equal(claims.aud, 'https://fcm.googleapis.com'); assert.match(claims.sub, /^mailto:/);
  const pub = await crypto.subtle.importKey('raw', deB64u(v.publica), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, deB64u(f), new TextEncoder().encode(c + '.' + p)), 'firma ES256 válida');
  // sin suscripciones o sin llaves no manda nada
  assert.deepEqual(await enviar({}, { titulo: 'x' }), { enviados: 0, muertas: [] });
});
