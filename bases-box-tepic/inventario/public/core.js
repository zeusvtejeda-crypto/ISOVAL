/* Núcleo del inventario de Bases Box Tepic.
   Lo comparten el servidor (Cloudflare Pages Function + D1) y el modo local del navegador:
   mismas reglas, mismos permisos y mismo formato de respuesta.

   handle(repo, req) recibe la petición ya traducida ({ method, path, query, body, token })
   y devuelve { status, json }. El repo es quien guarda: crearRepoLocal() aquí mismo
   (localStorage) o crearRepoD1() en functions/_d1.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BBCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const DIA = 86400000;
  const ROLES = ['local', 'tienda', 'dueno']; // dueno: solo lectura (resumen del negocio)
  const CATS = ['base', 'material', 'accesorio'];
  const PAGOS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];
  const CATS_GASTO = ['materiales', 'sueldos', 'renta', 'servicios', 'transporte', 'comida', 'mantenimiento', 'publicidad', 'retiro', 'otro'];
  const MAX_LINEAS = 60;
  const SESION_DIAS = 14;
  const TZ_DEFECTO = -420; // Tepic, Nayarit: UTC−7 todo el año
  const NO_ANULABLES = ['envio', 'recibo', 'envio_cancelado', 'inicial', 'anulacion'];

  // Catálogo de arranque: las medidas y tonos que ya publica la web de Bases Box Tepic.
  const MEDIDAS_BASE = [
    { id: 'ind', nombre: 'Individual', dims: '1.00 × 1.90 m', precio: 0 },
    { id: 'mat', nombre: 'Matrimonial', dims: '1.35 × 1.90 m', precio: 0 },
    { id: 'qn', nombre: 'Queen', dims: '1.50 × 2.00 m', precio: 0 },
    { id: 'kg', nombre: 'King', dims: '2.00 × 2.00 m', precio: 0 }
  ];
  const TONOS_BASE = [
    { id: 'cocoa', nombre: 'Cocoa', hex: '#6F4E37' },
    { id: 'morado', nombre: 'Morado', hex: '#6B3FA0' },
    { id: 'rosa', nombre: 'Rosa', hex: '#E84E8A' },
    { id: 'gris', nombre: 'Gris', hex: '#8A8D8F' },
    { id: 'azul', nombre: 'Azul', hex: '#2E5AAC' },
    { id: 'marino', nombre: 'Marino', hex: '#1E2A52' },
    { id: 'verde', nombre: 'Verde', hex: '#39A85B' },
    { id: 'negro', nombre: 'Negro', hex: '#1A1A1A' }
  ];
  const EXTRAS_BASE = [
    { nombre: 'Triplay', cat: 'material', unidad: 'hoja' },
    { nombre: 'Tela o vinil', cat: 'material', unidad: 'm' },
    { nombre: 'Espuma', cat: 'material', unidad: 'hoja' },
    { nombre: 'Madera', cat: 'material', unidad: 'pza' },
    { nombre: 'Grapas', cat: 'material', unidad: 'caja' },
    { nombre: 'Patas cromadas', cat: 'accesorio', unidad: 'juego' },
    { nombre: 'Empaque', cat: 'accesorio', unidad: 'pza' }
  ];

  class ApiError extends Error {
    constructor(status, code, mensaje, extra) {
      super(mensaje);
      this.status = status;
      this.code = code;
      this.extra = extra || null;
    }
  }
  const bad = (code, mensaje, extra) => new ApiError(400, code, mensaje, extra);
  const conflicto = () => new ApiError(409, 'conflicto', 'El inventario cambió mientras guardabas. Ya se actualizó la pantalla; revisa e intenta de nuevo.');
  const ok = (data) => ({ status: 200, json: Object.assign({ ok: true }, data) });
  const fail = (status, code, mensaje, extra) => ({ status, json: { ok: false, error: Object.assign({ code, mensaje }, extra) } });

  // ───────── utilidades

  const clean = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const p2 = (n) => (n < 10 ? '0' : '') + n;

  function numero(v, min, max, def) {
    if (v === '' || v == null) return def;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw bad('numero_invalido', 'Revisa los números: deben estar entre ' + min + ' y ' + max + '.');
    return Math.round(n * 100) / 100;
  }
  function entero(v, min, max, def) {
    if (v === '' || v == null) return def;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw bad('numero_invalido', 'Revisa las cantidades: deben ser enteros entre ' + min + ' y ' + max + '.');
    return n;
  }
  function diaKey(ts, tz) {
    const d = new Date(ts + tz * 60000);
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  }
  const tzDe = (q) => {
    const n = Number(q && q.tz);
    return Number.isFinite(n) && n >= -840 && n <= 840 ? Math.round(n) : TZ_DEFECTO;
  };
  function fmtEspera(s) {
    if (s < 90) return s + ' segundos';
    if (s < 5400) return Math.ceil(s / 60) + ' minutos';
    return Math.ceil(s / 3600) + ' horas';
  }
  const clonar = (o) => JSON.parse(JSON.stringify(o));

  // ───────── hash y firma (SHA-256 / HMAC en JS puro: funciona igual en Workers, navegador y Node,
  // incluso en páginas sin HTTPS donde crypto.subtle no existe)

  const K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be,
    0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
    0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85,
    0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
    0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function sha256(bytes) {
    const l = bytes.length;
    const m = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    m.set(bytes);
    m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(m.length - 8, Math.floor(l / 0x20000000), false);
    dv.setUint32(m.length - 4, (l << 3) >>> 0, false);
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Array(64);
    for (let off = 0; off < m.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    h.forEach((v, i) => odv.setUint32(i * 4, v, false));
    return out;
  }
  const utf8 = (s) => new TextEncoder().encode(s);
  const hex = (bytes) => Array.from(bytes, (b) => (b < 16 ? '0' : '') + b.toString(16)).join('');
  const sha256hex = (s) => hex(sha256(utf8(s)));
  function hmacHex(clave, msg) {
    let k = utf8(clave);
    if (k.length > 64) k = sha256(k);
    const m = utf8(msg);
    const ipad = new Uint8Array(64 + m.length);
    const opad = new Uint8Array(96);
    for (let i = 0; i < 64; i++) {
      const b = k[i] || 0;
      ipad[i] = b ^ 0x36;
      opad[i] = b ^ 0x5c;
    }
    ipad.set(m, 64);
    opad.set(sha256(ipad), 64);
    return hex(sha256(opad));
  }
  const b64u = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64uDec = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  function igual(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }
  function aleatorioHex(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return hex(a);
  }
  const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function codigoRecuperacion() {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    let s = '';
    a.forEach((b, i) => {
      s += ALFA[b % 32];
      if (i === 3) s += '-';
    });
    return s;
  }
  const normCodigo = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const uid = (p) => p + Date.now().toString(36) + aleatorioHex(3);

  const hashPin = (salt, pin) => sha256hex(salt + ':' + pin);
  function nuevoAcceso(secreto, v) {
    const salt = aleatorioHex(8);
    return { salt, hash: hashPin(salt, secreto), v: v || 1 };
  }
  const PINS_COMUNES = ['123456', '654321', '121212', '112233', '123123', '159753', '147258', '102030', '123321', '010203', '696969', '202020', '2580', '12345678', '87654321', '11223344', '12341234', '123654', '1234567'];
  // ¿ese PIN ya lo usa otro usuario?
  const pinEnUso = (cfg, rol, pin) => ROLES.some((r) => r !== rol && cfg.acceso[r] && igual(hashPin(cfg.acceso[r].salt, pin), cfg.acceso[r].hash));
  function validarPin(pin) {
    if (!/^\d{6,8}$/.test(pin)) throw bad('pin_formato', 'El PIN debe tener de 6 a 8 números.');
    const debil = /^(\d)\1+$/.test(pin) || /^(\d{1,4})\1+$/.test(pin) || '01234567890123456789'.includes(pin) || '98765432109876543210'.includes(pin) || PINS_COMUNES.includes(pin);
    if (debil) throw bad('pin_debil', 'Ese PIN es muy fácil de adivinar. Elige otro.');
  }

  // ───────── configuración y sesión

  function normalizarCfg(raw) {
    raw = raw || {};
    return {
      configurado: !!raw.configurado,
      negocio: Object.assign({ nombre: 'Bases Box Tepic', telLocal: '', telTienda: '', envioTepic: 200, envioFuera: 250, descRecoge: 200 }, raw.negocio),
      medidas: Array.isArray(raw.medidas) ? raw.medidas : [],
      tonos: Array.isArray(raw.tonos) ? raw.tonos : [],
      acceso: raw.acceso || {},
      intentos: raw.intentos || {},
      secret: raw.secret || '',
      rev: raw.rev | 0
    };
  }
  async function cargarCfg(ctx) {
    if (!ctx.cfg) ctx.cfg = normalizarCfg(await ctx.repo.config());
    return ctx.cfg;
  }
  function firmar(cfg, rol, ahora) {
    const p = b64u(JSON.stringify({ r: rol, exp: ahora + SESION_DIAS * DIA, pv: cfg.acceso[rol].v }));
    return p + '.' + hmacHex(cfg.secret, p);
  }
  function verificar(cfg, token, ahora) {
    const sinSesion = () => new ApiError(401, 'sin_sesion', 'Tu sesión terminó. Entra de nuevo con tu PIN.');
    if (!token || !cfg.secret) throw sinSesion();
    const i = String(token).indexOf('.');
    if (i < 1) throw sinSesion();
    const p = token.slice(0, i);
    if (!igual(token.slice(i + 1), hmacHex(cfg.secret, p))) throw sinSesion();
    let d;
    try { d = JSON.parse(b64uDec(p)); } catch (e) { throw sinSesion(); }
    const acc = d && cfg.acceso[d.r];
    if (!acc || !ROLES.includes(d.r) || !(d.exp > ahora) || acc.v !== d.pv) throw sinSesion();
    return { rol: d.r, exp: d.exp };
  }

  // Bloqueo por intentos fallidos: se CUENTA el intento antes de comprobar el PIN y de forma atómica en el repo
  // (así ni una ráfaga de peticiones en paralelo se salta el límite). 5 intentos = bloqueo de 5 min; cada bloqueo
  // siguiente dura el triple (tope 24 h). Un acierto borra el contador.
  async function reservar(ctx, clave) {
    const r = await ctx.repo.intento(clave, ctx.ahora);
    const espera = Math.max(0, Math.ceil((r.hasta - ctx.ahora) / 1000));
    if (!r.adm) throw new ApiError(423, 'bloqueado', 'Demasiados intentos. Espera ' + fmtEspera(espera) + ' para volver a intentar.', { espera });
    return { restantes: r.hasta > ctx.ahora ? 0 : 5 - r.n, espera };
  }
  function fallar(res, code, msg) {
    if (res.restantes === 0) throw new ApiError(423, 'bloqueado', 'Demasiados intentos. Espera ' + fmtEspera(res.espera) + ' para volver a intentar.', { espera: res.espera });
    throw new ApiError(401, code, msg + ' Te quedan ' + res.restantes + (res.restantes === 1 ? ' intento.' : ' intentos.'), { restantes: res.restantes });
  }
  const limpiarIntentos = (ctx, ...claves) => ctx.repo.limpiarIntentos(claves);

  const nuevaTx = () => ({
    config: {}, configInsert: null, guardas: [], productosInsert: [], productosUpdate: [], stock: [], movs: [],
    movsAnulados: [], traspasos: [], pedidos: [], gastosInsert: [], gastosAnular: [], sinRev: false, reiniciar: false
  });

  // ───────── rutas públicas: ping, setup, login, recuperar

  async function ping(ctx) {
    const cfg = await cargarCfg(ctx);
    return ok({
      servidor: ctx.servidor !== false, version: VERSION, configurado: cfg.configurado, negocio: cfg.negocio.nombre,
      requiereClave: !cfg.configurado && !!ctx.claveInstalacion, dueno: !!(cfg.acceso && cfg.acceso.dueno)
    });
  }

  function nombreBase(m, t) { return 'Base ' + m.nombre + ' · ' + t.nombre; }
  function filaProducto(ahora, d) {
    return Object.assign({
      id: uid('p'), nombre: '', cat: 'base', medida: '', tono: '', unidad: 'pza', precio: 0, costo: 0, min_local: 0, min_tienda: 0,
      activo: 1, stock_local: 0, stock_tienda: 0, hubo_local: 0, hubo_tienda: 0, creado: ahora, actualizado: ahora
    }, d);
  }

  async function setup(ctx) {
    const cfg = await cargarCfg(ctx);
    if (cfg.configurado) throw new ApiError(409, 'ya_configurado', 'Este inventario ya está configurado. Entra con tu PIN.');
    const b = ctx.req.body || {};
    // Con SETUP_KEY definida en el servidor, nadie puede adueñarse del inventario sin conocerla.
    if (ctx.claveInstalacion && !ctx.demo) {
      const it = await reservar(ctx, 'setup');
      if (!normCodigo(b.clave) || !igual(normCodigo(b.clave), normCodigo(ctx.claveInstalacion))) fallar(it, 'clave_instalacion', 'La clave de instalación no es correcta.');
    }
    const pinL = String(b.pinLocal || ''), pinT = String(b.pinTienda || '');
    if (!ctx.demo) { validarPin(pinL); validarPin(pinT); }
    if (pinL === pinT) throw bad('pin_igual', 'Cada usuario necesita un PIN distinto.');
    const nombre = clean(b.nombre, 60) || 'Bases Box Tepic';
    const codigo = codigoRecuperacion();
    const acceso = { local: nuevoAcceso(pinL), tienda: nuevoAcceso(pinT), recup: nuevoAcceso(normCodigo(codigo)) };
    const medidas = clonar(MEDIDAS_BASE), tonos = clonar(TONOS_BASE);
    const cat = b.catalogo || {};
    const tx = nuevaTx();
    if (cat.bases) {
      medidas.forEach((m) => tonos.forEach((t) => {
        tx.productosInsert.push(filaProducto(ctx.ahora, { nombre: nombreBase(m, t), cat: 'base', medida: m.id, tono: t.id, min_local: 2, min_tienda: 1 }));
      }));
    }
    if (cat.extras) {
      EXTRAS_BASE.forEach((e) => tx.productosInsert.push(filaProducto(ctx.ahora, { nombre: e.nombre, cat: e.cat, unidad: e.unidad, min_local: e.cat === 'material' ? 5 : 2 })));
    }
    tx.configInsert = { configurado: true };
    tx.config = { negocio: { nombre, telLocal: '', telTienda: '' }, medidas, tonos, acceso, secret: aleatorioHex(32), intentos: {} };
    await ctx.repo.commit(tx);
    const nueva = normalizarCfg(await ctx.repo.config());
    return ok({ token: firmar(nueva, 'local', ctx.ahora), rol: 'local', codigo });
  }

  async function login(ctx) {
    const cfg = await cargarCfg(ctx);
    if (!cfg.configurado) throw new ApiError(409, 'no_configurado', 'Este inventario todavía no está configurado.');
    const b = ctx.req.body || {};
    const rol = b.rol;
    if (!ROLES.includes(rol)) throw bad('rol_invalido', 'Elige quién eres.');
    const it = await reservar(ctx, rol);
    const acc = cfg.acceso[rol];
    if (!acc || !igual(hashPin(acc.salt, String(b.pin || '')), acc.hash)) fallar(it, 'pin_incorrecto', 'PIN incorrecto.');
    await limpiarIntentos(ctx, rol);
    return ok({ token: firmar(cfg, rol, ctx.ahora), rol });
  }

  async function recuperar(ctx) {
    const cfg = await cargarCfg(ctx);
    if (!cfg.configurado) throw new ApiError(409, 'no_configurado', 'Este inventario todavía no está configurado.');
    const b = ctx.req.body || {};
    const rol = b.rol, pin = String(b.pin || '');
    if (!ROLES.includes(rol)) throw bad('rol_invalido', 'Elige de quién es el PIN.');
    validarPin(pin);
    const it = await reservar(ctx, 'recup');
    const rec = cfg.acceso.recup;
    if (!rec || !igual(hashPin(rec.salt, normCodigo(b.codigo)), rec.hash)) fallar(it, 'codigo_incorrecto', 'Código de recuperación incorrecto.');
    if (pinEnUso(cfg, rol, pin)) throw bad('pin_igual', 'Cada usuario necesita un PIN distinto.');
    const codigo = codigoRecuperacion();
    const acceso = Object.assign({}, cfg.acceso, {
      [rol]: nuevoAcceso(pin, ((cfg.acceso[rol] && cfg.acceso[rol].v) || 0) + 1),
      recup: nuevoAcceso(normCodigo(codigo))
    });
    const tx = nuevaTx();
    tx.config = { acceso };
    await ctx.repo.commit(tx);
    await limpiarIntentos(ctx, 'recup', rol);
    return ok({ token: firmar(Object.assign({}, cfg, { acceso }), rol, ctx.ahora), rol, codigo });
  }

  // ───────── estado para el cliente

  // lunes de la semana de una fecha 'YYYY-MM-DD' (semana lunes–domingo)
  function lunesDe(k) {
    const [y, m, d] = k.split('-').map(Number);
    const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    return new Date(Date.UTC(y, m - 1, d - dow)).toISOString().slice(0, 10);
  }

  const redondear2 = (o) => { o.total = Math.round(o.total * 100) / 100; return o; };

  // ventas netas (ventas − devoluciones) de hoy, de la semana y del mes, con desglose por producto y por día
  function detalleVentas(filas, ahora, tz) {
    const hoyK = diaKey(ahora, tz), mesK = hoyK.slice(0, 7), semK = lunesDe(hoyK);
    const per = {
      hoy: { desde: hoyK, test: (k) => k === hoyK },
      semana: { desde: semK, test: (k) => k >= semK && k <= hoyK },
      mes: { desde: mesK + '-01', test: (k) => k.slice(0, 7) === mesK }
    };
    const out = {};
    Object.keys(per).forEach((n) => { out[n] = { desde: per[n].desde, total: 0, envios: 0, pzas: 0, n: 0, g: new Set(), prods: {}, dias: {} }; });
    filas.forEach((r) => {
      const pzas = -r.delta, monto = pzas * (r.precio || 0), env = r.envio || 0, k = diaKey(r.ts, tz);
      Object.keys(per).forEach((n) => {
        if (!per[n].test(k)) return;
        const o = out[n];
        o.total += monto + env; o.envios += env; o.pzas += pzas;
        const pr = o.prods[r.prod] || (o.prods[r.prod] = { id: r.prod, pzas: 0, total: 0 });
        pr.pzas += pzas; pr.total += monto;
        const d = o.dias[k] || (o.dias[k] = { k, pzas: 0, total: 0, envios: 0, g: new Set() });
        d.pzas += pzas; d.total += monto + env; d.envios += env;
        if (r.tipo === 'venta') { o.g.add(r.grupo); d.g.add(r.grupo); }
      });
    });
    Object.keys(out).forEach((n) => {
      const o = out[n];
      o.n = o.g.size; delete o.g;
      o.productos = Object.values(o.prods).filter((t) => t.pzas !== 0).sort((a, b) => b.total - a.total || b.pzas - a.pzas).map(redondear2);
      o.dias = Object.values(o.dias).sort((a, b) => (a.k < b.k ? 1 : -1)).map((d) => { d.n = d.g.size; delete d.g; return redondear2(d); });
      delete o.prods;
      o.dias.forEach((d) => { d.envios = Math.round(d.envios * 100) / 100; });
      o.envios = Math.round(o.envios * 100) / 100;
      redondear2(o);
    });
    return out;
  }

  function resumenVentas(filas, ahora, tz) {
    const det = detalleVentas(filas, ahora, tz);
    const dias = [], idxDia = {};
    for (let i = 6; i >= 0; i--) {
      const k = diaKey(ahora - i * DIA, tz);
      idxDia[k] = dias.length;
      dias.push({ k, total: 0, pzas: 0 });
    }
    const top = {};
    filas.forEach((r) => {
      const pzas = -r.delta, monto = pzas * (r.precio || 0), k = diaKey(r.ts, tz);
      if (k in idxDia) { dias[idxDia[k]].total += monto + (r.envio || 0); dias[idxDia[k]].pzas += pzas; }
      if (r.ts >= ahora - 30 * DIA) {
        const t = top[r.prod] || (top[r.prod] = { id: r.prod, pzas: 0, total: 0 });
        t.pzas += pzas;
        t.total += monto;
      }
    });
    const res = (o) => ({ total: o.total, pzas: o.pzas, n: o.n, envios: o.envios });
    return {
      hoy: res(det.hoy), semana: res(det.semana), mes: res(det.mes), dias: dias.map(redondear2),
      top: Object.values(top).filter((t) => t.pzas > 0).sort((a, b) => b.pzas - a.pzas).slice(0, 5).map(redondear2)
    };
  }

  // gastos: el vendedor solo ve los que registró la tienda; el Almacén ve todos
  const gastosVisibles = (filas) => filas; // los gastos son de todo el negocio: todos los usuarios ven lo mismo
  function resumenGastos(filas, ahora, tz) {
    const hoyK = diaKey(ahora, tz), mesK = hoyK.slice(0, 7), semK = lunesDe(hoyK);
    const per = { hoy: (k) => k === hoyK, semana: (k) => k >= semK && k <= hoyK, mes: (k) => k.slice(0, 7) === mesK };
    const out = {};
    Object.keys(per).forEach((n) => { out[n] = { total: 0, n: 0, porCat: {}, porPago: {} }; });
    filas.filter((g) => !g.anulado).forEach((g) => {
      const k = diaKey(g.ts, tz);
      Object.keys(per).forEach((n) => {
        if (!per[n](k)) return;
        const o = out[n];
        o.total += g.monto; o.n += 1;
        o.porCat[g.cat] = (o.porCat[g.cat] || 0) + g.monto;
        o.porPago[g.pago] = (o.porPago[g.pago] || 0) + g.monto;
      });
    });
    const r2 = (n) => Math.round(n * 100) / 100;
    Object.keys(out).forEach((n) => {
      out[n].total = r2(out[n].total);
      Object.keys(out[n].porCat).forEach((c) => { out[n].porCat[c] = r2(out[n].porCat[c]); });
      Object.keys(out[n].porPago).forEach((c) => { out[n].porPago[c] = r2(out[n].porPago[c]); });
    });
    return out;
  }
  async function listarGastos(ctx) {
    const filas = gastosVisibles(await ctx.repo.gastos(ctx.ahora - 36 * DIA));
    const items = filas.slice().sort((a, b) => b.ts - a.ts || (a.id < b.id ? 1 : -1)).slice(0, 400);
    return { items, resumen: resumenGastos(filas, ctx.ahora, ctx.tz) };
  }

  async function opGastoCrear(ctx, b, tx) {
    const monto = Number(b.monto);
    if (!Number.isFinite(monto) || monto <= 0) throw bad('falta_monto', 'Escribe cuánto se gastó.');
    if (monto > 10000000) throw bad('numero_invalido', 'Ese monto es demasiado grande.');
    const cat = CATS_GASTO.includes(b.cat) ? b.cat : 'otro';
    const concepto = clean(b.concepto, 80);
    if (cat === 'otro' && !concepto) throw bad('falta_concepto', 'Escribe en qué se gastó.');
    let ts = ctx.ahora;
    if (b.dia !== undefined && b.dia !== null && b.dia !== '') {
      const hoyK = diaKey(ctx.ahora, ctx.tz), dia = String(b.dia);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || dia > hoyK || diaKey(ctx.ahora - 34 * DIA, ctx.tz) > dia) throw bad('dia_invalido', 'Elige un día de los últimos 30 días.');
      if (dia !== hoyK) { const [y, m, d] = dia.split('-').map(Number); ts = Date.UTC(y, m - 1, d, 12, 0, 0) - ctx.tz * 60000; }
    }
    const id = grupoDe(b, 'X');
    tx.gastosInsert.push({
      id, ts, rol: ctx.rol, monto: Math.round(monto * 100) / 100, cat, concepto, pago: PAGOS.includes(b.pago) ? b.pago : 'efectivo',
      anulado: 0, anulado_ts: 0, anulado_por: '', anulado_nota: ''
    });
    return { id, monto: Math.round(monto * 100) / 100 };
  }
  async function opGastoAnular(ctx, b, tx) {
    const motivo = clean(b.motivo, 140);
    if (motivo.length < 3) throw bad('falta_motivo', 'Escribe el motivo.');
    const g = await ctx.repo.gasto(clean(b.id, 60));
    if (!g) throw new ApiError(404, 'no_existe', 'No encontré ese gasto.');
    if (g.anulado) throw new ApiError(409, 'ya_anulado', 'Ese gasto ya estaba anulado.');
    if (ctx.rol !== 'local' && g.rol !== ctx.rol) throw new ApiError(403, 'sin_permiso', 'Solo puedes anular gastos de tu tienda.');
    tx.gastosAnular.push({ id: g.id, ts: ctx.ahora, por: ctx.rol, nota: motivo });
    tx.guardas.push({ tipo: 'gasto_sin_anular', id: g.id });
    return { id: g.id };
  }

  // Resumen del negocio (Dueño y Almacén): producción, ventas, gastos, egresos, resultado e inventario.
  async function resumenDueno(ctx) {
    const { repo, ahora, tz } = ctx;
    const hoyK = diaKey(ahora, tz), mesK = hoyK.slice(0, 7), semK = lunesDe(hoyK);
    const per = { hoy: (k) => k === hoyK, semana: (k) => k >= semK && k <= hoyK, mes: (k) => k.slice(0, 7) === mesK };
    const [filasV, gastosF, prods, prodRows, trasp, peds] = await Promise.all([
      repo.ventas(ahora - 36 * DIA), repo.gastos(ahora - 36 * DIA), repo.productos(), repo.producciones(ahora - 36 * DIA),
      repo.traspasos({ desde: ahora - 60 * DIA }), repo.pedidos({ desde: ahora - 60 * DIA })
    ]);
    const r2 = (n) => Math.round(n * 100) / 100;
    const costoDe = {};
    prods.forEach((p) => { costoDe[p.id] = p.costo || 0; });
    const periodos = {};
    Object.keys(per).forEach((n) => {
      periodos[n] = { ventas: { bruto: 0, devuelto: 0, neto: 0, pzas: 0, n: 0, envios: 0, porPago: {} }, gastos: null, produccion: { pzas: 0, costo: 0, compras: 0, comprasCosto: 0, porProducto: {} } };
    });
    const grupos = {};
    Object.keys(per).forEach((n) => { grupos[n] = new Set(); });
    filasV.forEach((r) => {
      const k = diaKey(r.ts, tz), pz = Math.abs(r.delta), monto = pz * (r.precio || 0), env = r.envio || 0;
      Object.keys(per).forEach((n) => {
        if (!per[n](k)) return;
        const v = periodos[n].ventas;
        if (r.tipo === 'venta') {
          v.bruto += monto + env; v.envios += env; v.pzas += pz; grupos[n].add(r.grupo);
          const pg = r.pago || 'efectivo';
          v.porPago[pg] = (v.porPago[pg] || 0) + monto + env;
        } else { v.devuelto += monto; v.pzas -= pz; }
      });
    });
    prodRows.forEach((r) => {
      const k = diaKey(r.ts, tz);
      Object.keys(per).forEach((n) => {
        if (!per[n](k)) return;
        const o = periodos[n].produccion, costo = r.delta * (costoDe[r.prod] || 0);
        if (r.motivo === 'produccion') {
          o.pzas += r.delta; o.costo += costo;
          o.porProducto[r.prod] = (o.porProducto[r.prod] || 0) + r.delta;
        } else if (r.motivo === 'compra') { o.compras += r.delta; o.comprasCosto += costo; }
      });
    });
    const gres = resumenGastos(gastosF, ahora, tz);
    Object.keys(per).forEach((n) => {
      const p = periodos[n], v = p.ventas;
      v.n = grupos[n].size;
      v.bruto = r2(v.bruto); v.devuelto = r2(v.devuelto); v.envios = r2(v.envios); v.neto = r2(v.bruto - v.devuelto);
      Object.keys(v.porPago).forEach((c) => { v.porPago[c] = r2(v.porPago[c]); });
      p.gastos = gres[n];
      p.egresos = r2(gres[n].total + v.devuelto);
      p.resultado = r2(v.bruto - p.egresos);
      p.produccion.costo = r2(p.produccion.costo); p.produccion.comprasCosto = r2(p.produccion.comprasCosto);
      p.produccion.porProducto = Object.keys(p.produccion.porProducto).map((id) => ({ id, pzas: p.produccion.porProducto[id] })).sort((a, b) => b.pzas - a.pzas).slice(0, 8);
    });
    // últimos 7 días: lo que entró vs. lo que salió
    const dias = [];
    for (let i = 6; i >= 0; i--) dias.push({ k: diaKey(ahora - i * DIA, tz), ventas: 0, gastos: 0 });
    const idx = {};
    dias.forEach((d, i) => { idx[d.k] = i; });
    filasV.forEach((r) => { const i = idx[diaKey(r.ts, tz)]; if (i === undefined) return; const m = Math.abs(r.delta) * (r.precio || 0) + (r.envio || 0); dias[i].ventas += r.tipo === 'venta' ? m : -Math.abs(r.delta) * (r.precio || 0); });
    gastosF.filter((g) => !g.anulado).forEach((g) => { const i = idx[diaKey(g.ts, tz)]; if (i !== undefined) dias[i].gastos += g.monto; });
    dias.forEach((d) => { d.ventas = r2(d.ventas); d.gastos = r2(d.gastos); });
    // inventario
    const act = prods.filter((p) => p.activo);
    const enCamino = trasp.filter((t) => t.estado === 'en_transito').reduce((a, t) => a + t.lineas.reduce((b, l) => b + l.cant, 0), 0);
    const inv = {
      pzasAlmacen: act.reduce((a, p) => a + p.stock_local, 0), pzasTienda: act.reduce((a, p) => a + p.stock_tienda, 0), pzasCamino: enCamino,
      valorCosto: r2(act.reduce((a, p) => a + (p.stock_local + p.stock_tienda) * (p.costo || 0), 0)),
      valorVenta: r2(act.reduce((a, p) => a + (p.stock_local + p.stock_tienda) * (p.precio || 0), 0)),
      bajos: act.filter((p) => (p.min_local > 0 && p.hubo_local && p.stock_local <= p.min_local) || (p.min_tienda > 0 && p.hubo_tienda && p.stock_tienda <= p.min_tienda)).length,
      enviosEnCamino: trasp.filter((t) => t.estado === 'en_transito').length,
      pedidosPendientes: peds.filter((p) => p.estado === 'pendiente').length
    };
    const top = {};
    filasV.filter((r) => per.mes(diaKey(r.ts, tz))).forEach((r) => { const t = top[r.prod] || (top[r.prod] = { id: r.prod, pzas: 0, total: 0 }); const pz = -r.delta; t.pzas += pz; t.total += pz * (r.precio || 0); });
    return {
      ahora, periodos, dias, inventario: inv,
      top: Object.values(top).filter((t) => t.pzas > 0).sort((a, b) => b.pzas - a.pzas).slice(0, 5).map((t) => ({ id: t.id, pzas: t.pzas, total: r2(t.total) }))
    };
  }

  // reporte del día de la tienda: cada venta con sus piezas, cobro por forma de pago, envíos y devoluciones
  async function reporteDia(ctx) {
    const q = ctx.req.query || {};
    const hoyK = diaKey(ctx.ahora, ctx.tz);
    let dia = hoyK;
    if (q.dia !== undefined && q.dia !== '') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(q.dia)) || String(q.dia) > hoyK || diaKey(ctx.ahora - 34 * DIA, ctx.tz) > String(q.dia)) throw bad('dia_invalido', 'Elige un día de los últimos 30 días.');
      dia = String(q.dia);
    }
    const filas = (await ctx.repo.ventas(ctx.ahora - 36 * DIA)).filter((r) => diaKey(r.ts, ctx.tz) === dia).sort((a, b) => a.ts - b.ts);
    const grupos = Object.create(null), orden = [];
    filas.forEach((r) => {
      const g = grupos[r.grupo] || (grupos[r.grupo] = { grupo: r.grupo, ts: r.ts, tipo: r.tipo, cliente: r.cliente || '', pago: r.pago || '', entrega: r.tipo === 'venta' ? r.motivo || '' : '', envio: 0, lineas: [], total: 0 });
      if (!orden.includes(g)) orden.push(g);
      const pzas = Math.abs(r.delta);
      g.lineas.push({ id: r.prod, pzas, precio: r.precio || 0 });
      g.envio += r.envio || 0;
      g.total += pzas * (r.precio || 0) + (r.envio || 0);
    });
    const redo = (n) => Math.round(n * 100) / 100;
    const ventas = orden.filter((g) => g.tipo === 'venta').map((g) => Object.assign(g, { total: redo(g.total), envio: redo(g.envio) }));
    const devs = orden.filter((g) => g.tipo === 'devolucion').map((g) => ({ grupo: g.grupo, ts: g.ts, lineas: g.lineas, total: redo(g.total) }));
    const t = { ventas: ventas.length, pzas: 0, envios: 0, vendido: 0, devuelto: 0, neto: 0, porPago: {} };
    ventas.forEach((g) => {
      t.vendido += g.total; t.envios += g.envio;
      g.lineas.forEach((l) => { t.pzas += l.pzas; });
      t.porPago[g.pago || 'efectivo'] = redo((t.porPago[g.pago || 'efectivo'] || 0) + g.total);
    });
    devs.forEach((g) => { t.devuelto += g.total; g.lineas.forEach((l) => { t.pzas -= l.pzas; }); });
    t.vendido = redo(t.vendido); t.envios = redo(t.envios); t.devuelto = redo(t.devuelto); t.neto = redo(t.vendido - t.devuelto);
    const prods = await ctx.repo.productos();
    const gastos = (await ctx.repo.gastos(ctx.ahora - 36 * DIA)).filter((g) => g.rol === 'tienda' && !g.anulado && diaKey(g.ts, ctx.tz) === dia).sort((a, b) => a.ts - b.ts);
    t.gastos = redo(gastos.reduce((a, g) => a + g.monto, 0));
    t.gastosEfectivo = redo(gastos.filter((g) => g.pago === 'efectivo').reduce((a, g) => a + g.monto, 0));
    t.efectivoNeto = redo((t.porPago.efectivo || 0) - t.gastosEfectivo);
    return { dia, hoy: dia === hoyK, ventas, devoluciones: devs, gastos, totales: t, tienda: { pzas: prods.filter((p) => p.activo).reduce((a, p) => a + p.stock_tienda, 0) } };
  }

  async function armarEstado(ctx) {
    const { repo, ahora, rol } = ctx;
    const [raw, prods, trasp, peds, ventas, rec, gastosFilas] = await Promise.all([
      repo.config(), repo.productos(), repo.traspasos({ desde: ahora - 30 * DIA }), repo.pedidos({ desde: ahora - 30 * DIA }),
      repo.ventas(ahora - 35 * DIA), repo.movs({ limite: 40 }), repo.gastos(ahora - 36 * DIA)
    ]);
    const cfg = normalizarCfg(raw);
    const productos = prods.map((p) => {
      const o = Object.assign({}, p);
      if (rol === 'tienda') delete o.costo;
      return o;
    });
    const est = {
      rev: cfg.rev, ahora, rol, version: VERSION, dueno: !!cfg.acceso.dueno, negocio: cfg.negocio, medidas: cfg.medidas, tonos: cfg.tonos,
      productos, traspasos: trasp, pedidos: peds, resumen: Object.assign(resumenVentas(ventas, ahora, ctx.tz), { gastos: (({ hoy, semana, mes }) => ({ hoy: hoy.total, semana: semana.total, mes: mes.total }))(resumenGastos(gastosVisibles(gastosFilas), ahora, ctx.tz)) }), recientes: rec.items
    };
    if (ctx.exp && ctx.exp - ahora < (SESION_DIAS / 2) * DIA) est.token = firmar(cfg, rol, ahora);
    return est;
  }

  async function listarMovs(ctx) {
    const q = ctx.req.query || {};
    return ctx.repo.movs({
      limite: Math.min(Math.max(parseInt(q.limite, 10) || 60, 1), 500),
      antes: q.antes ? String(q.antes) : null,
      desde: Number(q.desde) || 0,
      hasta: Number(q.hasta) || 0,
      prods: q.prods ? String(q.prods).split(',').slice(0, 40) : null,
      tipos: q.tipos ? String(q.tipos).split(',').slice(0, 12) : null,
      rol: ROLES.includes(q.rol) ? q.rol : null,
      anulaciones: q.anulaciones === '1'
    });
  }

  // ───────── operaciones

  // sin prototipo: un id como "__proto__" o "constructor" mandado por un cliente no encuentra nada
  const own = (o, k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
  const indexar = (arr) => arr.reduce((o, x) => { o[x.id] = x; return o; }, Object.create(null));
  const stockDe = (p, loc) => (loc === 'local' ? p.stock_local : p.stock_tienda);
  const nombreLoc = (loc) => (loc === 'local' ? 'el almacén' : 'la tienda');
  const deltaStock = (id, loc, delta) => ({ id, dl: loc === 'local' ? delta : 0, dt: loc === 'tienda' ? delta : 0 });
  function revisarStock(p, loc, delta) {
    if (stockDe(p, loc) + delta < 0) {
      throw new ApiError(409, 'stock_insuficiente', 'No alcanza ' + p.nombre + ': en ' + nombreLoc(loc) + ' hay ' + stockDe(p, loc) + '.');
    }
  }
  function lineas(raw, campo, min) {
    campo = campo || 'cant';
    if (!Array.isArray(raw) || !raw.length) throw bad('sin_lineas', 'Agrega al menos un producto.');
    if (raw.length > MAX_LINEAS) throw bad('muchas_lineas', 'Máximo ' + MAX_LINEAS + ' productos por operación. Haz otra operación con el resto.');
    const vistos = new Set();
    return raw.map((r) => {
      if (!r || typeof r !== 'object') throw bad('linea_invalida', 'Hay una línea vacía.');
      const id = clean(r.id, 40);
      if (!id || vistos.has(id)) throw bad('linea_invalida', 'Hay un producto repetido o vacío.');
      vistos.add(id);
      const cant = Number(r[campo]);
      if (!Number.isInteger(cant) || cant < (min == null ? 1 : min) || cant > 99999) throw bad('cantidad_invalida', 'Las cantidades deben ser números enteros' + (min === 0 ? '.' : ' de 1 en adelante.'));
      return { id, cant, precio: r.precio };
    });
  }
  function grupoDe(b, prefijo) {
    return typeof b.cid === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(b.cid) && !(b.cid in Object.prototype) ? b.cid : uid(prefijo || 'G');
  }
  function nuevoMov(ctx, grupo, i, p, loc, delta, tipo, extra) {
    return Object.assign({
      id: grupo + '-' + i, ts: ctx.ahora, prod: p.id, loc, delta, tipo, motivo: '', nota: '', rol: ctx.rol, precio: null,
      cliente: '', pago: '', envio: 0, grupo, ref: '', anulado: 0, anulado_ts: 0, anulado_por: '', anulado_nota: ''
    }, extra);
  }
  async function productoPorId(ctx, id) {
    const p = (await ctx.repo.productos()).find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'producto_no_existe', 'Ese producto ya no existe. Actualiza la pantalla.');
    return p;
  }
  function activoOError(p) {
    if (!p) throw new ApiError(404, 'producto_no_existe', 'Un producto ya no existe. Actualiza la pantalla.');
    if (!p.activo) throw new ApiError(409, 'producto_archivado', p.nombre + ' está archivado.');
    return p;
  }

  // entrega de una venta → tarifa de envío en la configuración del negocio (null = sin cargo)
  const ENTREGAS = { recoge: null, tepic: 'envioTepic', xalisco: 'envioFuera', cantera: 'envioFuera' };

  const MOV_DEF = {
    entrada: { loc: 'local', signo: 1, motivos: ['produccion', 'compra', 'otro'] },
    salida: { loc: 'local', signo: -1, motivos: ['uso', 'merma', 'otro'] },
    venta: { loc: 'tienda', signo: -1, precio: true },
    devolucion: { loc: 'tienda', signo: 1, precio: true },
    merma: { loc: 'tienda', signo: -1 }
  };

  async function opMovLineas(ctx, b, tx, tipo) {
    const def = MOV_DEF[tipo];
    const ls = lineas(b.lineas);
    const prods = indexar(await ctx.repo.productos());
    const grupo = grupoDe(b, tipo[0].toUpperCase());
    const extra = {
      motivo: def.motivos ? (def.motivos.includes(b.motivo) ? b.motivo : 'otro') : '',
      nota: clean(b.nota, 200),
      cliente: tipo === 'venta' ? clean(b.cliente, 60) : '',
      pago: tipo === 'venta' ? (PAGOS.includes(b.pago) ? b.pago : 'efectivo') : ''
    };
    // entrega de una venta: recoge en tienda, o envío con tarifa por zona (el vendedor puede ajustar el monto)
    let envio = 0;
    if (tipo === 'venta' && Object.prototype.hasOwnProperty.call(ENTREGAS, b.entrega)) {
      extra.motivo = b.entrega;
      const neg = (await cargarCfg(ctx)).negocio;
      if (ENTREGAS[b.entrega]) envio = numero(b.envio == null || b.envio === '' ? neg[ENTREGAS[b.entrega]] : b.envio, 0, 100000, neg[ENTREGAS[b.entrega]]);
    }
    let total = 0, piezas = 0;
    ls.forEach((l, i) => {
      const p = activoOError(prods[l.id]);
      const delta = def.signo * l.cant;
      revisarStock(p, def.loc, delta);
      const precio = def.precio ? numero(l.precio == null || l.precio === '' ? p.precio : l.precio, 0, 1e6, 0) : null;
      total += (precio || 0) * l.cant;
      piezas += l.cant;
      tx.stock.push(deltaStock(p.id, def.loc, delta));
      tx.movs.push(nuevoMov(ctx, grupo, i, p, def.loc, delta, tipo, Object.assign({ precio, envio: i === 0 ? envio : 0 }, extra)));
    });
    return { grupo, total: Math.round((total + envio) * 100) / 100, piezas, envio };
  }

  // Regresa piezas de la tienda al almacén de inmediato (una sola operación: sale de la tienda y entra al almacén).
  async function opRegreso(ctx, b, tx) {
    const ls = lineas(b.lineas);
    const prods = indexar(await ctx.repo.productos());
    const grupo = grupoDe(b, 'R');
    const nota = clean(b.nota, 200);
    let piezas = 0;
    ls.forEach((l, i) => {
      const p = activoOError(prods[l.id]);
      revisarStock(p, 'tienda', -l.cant);
      piezas += l.cant;
      tx.stock.push(deltaStock(p.id, 'tienda', -l.cant), deltaStock(p.id, 'local', l.cant));
      tx.movs.push(nuevoMov(ctx, grupo, i * 2, p, 'tienda', -l.cant, 'regreso', { nota }));
      tx.movs.push(nuevoMov(ctx, grupo, i * 2 + 1, p, 'local', l.cant, 'regreso', { nota }));
    });
    return { grupo, piezas };
  }

  async function opConteo(ctx, b, tx) {
    const loc = ctx.rol;
    const ls = lineas(b.lineas, 'contado', 0);
    const prods = indexar(await ctx.repo.productos());
    const grupo = grupoDe(b, 'C');
    const nota = clean(b.nota, 200);
    let i = 0;
    ls.forEach((l) => {
      const p = activoOError(prods[l.id]);
      const actual = stockDe(p, loc), delta = l.cant - actual;
      if (!delta) return;
      tx.stock.push(deltaStock(p.id, loc, delta));
      tx.movs.push(nuevoMov(ctx, grupo, i++, p, loc, delta, 'ajuste', { nota: ('Conteo: sistema ' + actual + ', contado ' + l.cant + (nota ? '. ' + nota : '')).slice(0, 200) }));
    });
    if (!tx.movs.length) throw bad('sin_cambios', 'El conteo coincide con el sistema. No hay nada que ajustar.');
    return { grupo, ajustes: tx.movs.length };
  }

  async function opAnular(ctx, b, tx) {
    const grupo = clean(b.grupo, 60), motivo = clean(b.motivo, 140);
    if (motivo.length < 3) throw bad('falta_motivo', 'Escribe el motivo de la anulación.');
    const orig = (await ctx.repo.movsGrupo(grupo)).filter((m) => m.tipo !== 'anulacion');
    if (!orig.length) throw new ApiError(404, 'no_existe', 'No encontré esa operación.');
    if (orig.some((m) => m.anulado)) throw new ApiError(409, 'ya_anulado', 'Esa operación ya estaba anulada.');
    if (orig.some((m) => NO_ANULABLES.includes(m.tipo))) throw new ApiError(409, 'no_anulable', 'Los traspasos se cancelan desde su tarjeta y el inventario inicial se corrige con un conteo.');
    if (ctx.rol !== 'local' && orig.some((m) => m.rol !== ctx.rol)) throw new ApiError(403, 'sin_permiso', 'Solo puedes anular operaciones de tu tienda.');
    const prods = indexar(await ctx.repo.productos());
    const acum = {};
    orig.forEach((m) => { const k = m.prod + '|' + m.loc; acum[k] = (acum[k] || 0) - m.delta; });
    Object.keys(acum).forEach((k) => {
      const [id, loc] = k.split('|');
      const p = prods[id];
      if (p && stockDe(p, loc) + acum[k] < 0) {
        throw new ApiError(409, 'no_se_puede_anular', 'No se puede anular: ya no hay suficiente ' + p.nombre + ' en ' + nombreLoc(loc) + ' para deshacerlo.');
      }
    });
    const nuevo = uid('A');
    orig.forEach((m, i) => {
      tx.stock.push(deltaStock(m.prod, m.loc, -m.delta));
      tx.movs.push({
        id: nuevo + '-' + i, ts: ctx.ahora, prod: m.prod, loc: m.loc, delta: -m.delta, tipo: 'anulacion', motivo: '', nota: motivo,
        rol: ctx.rol, precio: m.precio, cliente: '', pago: '', envio: 0, grupo: nuevo, ref: m.id, anulado: 0, anulado_ts: 0, anulado_por: '', anulado_nota: ''
      });
      tx.movsAnulados.push({ id: m.id, ts: ctx.ahora, por: ctx.rol, nota: motivo });
    });
    tx.guardas.push({ tipo: 'grupo_sin_anular', grupo });
    return { grupo: nuevo, anulada: grupo };
  }

  async function opEnviar(ctx, b, tx) {
    const ls = lineas(b.lineas);
    const prods = indexar(await ctx.repo.productos());
    const id = grupoDe(b, 'T');
    const nota = clean(b.nota, 200);
    let pedido = '';
    if (b.pedido) {
      const ped = await ctx.repo.pedido(clean(b.pedido, 60));
      if (!ped || ped.estado !== 'pendiente') throw new ApiError(409, 'pedido_no_disponible', 'Ese pedido ya no está pendiente.');
      pedido = ped.id;
      tx.pedidos.push({ p: Object.assign({}, ped, { estado: 'surtido', traspaso: id }), lineas: ped.lineas });
      tx.guardas.push({ tipo: 'pedido_estado', id: ped.id, estado: 'pendiente' });
    }
    let piezas = 0;
    ls.forEach((l, i) => {
      const p = activoOError(prods[l.id]);
      revisarStock(p, 'local', -l.cant);
      piezas += l.cant;
      tx.stock.push(deltaStock(p.id, 'local', -l.cant));
      tx.movs.push(nuevoMov(ctx, id, i, p, 'local', -l.cant, 'envio', { nota, ref: id }));
    });
    tx.traspasos.push({
      t: { id, ts: ctx.ahora, estado: 'en_transito', nota, pedido, recibido_ts: 0, nota_recibo: '', dif: 0 },
      lineas: ls.map((l) => ({ id: l.id, cant: l.cant, recibida: 0 }))
    });
    return { id, piezas };
  }

  async function opRecibir(ctx, b, tx) {
    const t = await ctx.repo.traspaso(clean(b.id, 60));
    if (!t) throw new ApiError(404, 'no_existe', 'No encontré ese envío.');
    if (t.estado !== 'en_transito') throw new ApiError(409, 'ya_resuelto', 'Ese envío ya fue ' + (t.estado === 'recibido' ? 'recibido.' : 'cancelado.'));
    const dadas = {};
    (Array.isArray(b.lineas) ? b.lineas : []).forEach((l) => { dadas[clean(l && l.id, 40)] = l.recibida; });
    const prods = indexar(await ctx.repo.productos());
    const grupo = t.id + 'r';
    const nota = clean(b.nota, 200);
    let dif = false, piezas = 0, i = 0;
    const lin = t.lineas.map((l) => {
      const r = dadas[l.id] === undefined ? l.cant : Number(dadas[l.id]);
      if (!Number.isInteger(r) || r < 0 || r > l.cant) throw bad('cantidad_invalida', 'Lo recibido debe estar entre 0 y lo enviado.');
      if (r !== l.cant) dif = true;
      return Object.assign({}, l, { recibida: r });
    });
    if (dif && nota.length < 3) throw bad('falta_nota', 'Anota qué pasó con la diferencia (faltante o daño).');
    lin.forEach((l) => {
      if (l.recibida < 1) return;
      const p = prods[l.id];
      if (!p) throw new ApiError(404, 'producto_no_existe', 'Un producto ya no existe.');
      piezas += l.recibida;
      tx.stock.push(deltaStock(p.id, 'tienda', l.recibida));
      tx.movs.push(nuevoMov(ctx, grupo, i++, p, 'tienda', l.recibida, 'recibo', { nota, ref: t.id }));
    });
    tx.traspasos.push({ t: Object.assign({}, t, { estado: 'recibido', recibido_ts: ctx.ahora, nota_recibo: nota, dif: dif ? 1 : 0 }), lineas: lin });
    tx.guardas.push({ tipo: 'traspaso_estado', id: t.id, estado: 'en_transito' });
    return { id: t.id, piezas, dif };
  }

  async function opCancelar(ctx, b, tx) {
    const t = await ctx.repo.traspaso(clean(b.id, 60));
    if (!t) throw new ApiError(404, 'no_existe', 'No encontré ese envío.');
    if (t.estado !== 'en_transito') throw new ApiError(409, 'ya_resuelto', 'Ese envío ya fue ' + (t.estado === 'recibido' ? 'recibido.' : 'cancelado.'));
    const motivo = clean(b.motivo, 140);
    if (motivo.length < 3) throw bad('falta_motivo', 'Escribe por qué cancelas el envío.');
    const prods = indexar(await ctx.repo.productos());
    const grupo = t.id + 'c';
    t.lineas.forEach((l, i) => {
      const p = prods[l.id];
      if (!p) return;
      tx.stock.push(deltaStock(p.id, 'local', l.cant));
      tx.movs.push(nuevoMov(ctx, grupo, i, p, 'local', l.cant, 'envio_cancelado', { nota: motivo, ref: t.id }));
    });
    tx.traspasos.push({ t: Object.assign({}, t, { estado: 'cancelado', nota_recibo: motivo }), lineas: t.lineas });
    tx.guardas.push({ tipo: 'traspaso_estado', id: t.id, estado: 'en_transito' });
    if (t.pedido) {
      const ped = await ctx.repo.pedido(t.pedido);
      if (ped && ped.estado === 'surtido') tx.pedidos.push({ p: Object.assign({}, ped, { estado: 'pendiente', traspaso: '' }), lineas: ped.lineas });
    }
    return { id: t.id };
  }

  async function opPedidoCrear(ctx, b, tx) {
    const ls = lineas(b.lineas);
    const prods = indexar(await ctx.repo.productos());
    ls.forEach((l) => activoOError(prods[l.id]));
    const id = grupoDe(b, 'P');
    if (await ctx.repo.pedido(id)) throw new ApiError(409, 'duplicado', 'Este pedido ya se había guardado.');
    tx.pedidos.push({
      p: { id, ts: ctx.ahora, estado: 'pendiente', nota: clean(b.nota, 200), traspaso: '' },
      lineas: ls.map((l) => ({ id: l.id, cant: l.cant, recibida: 0 }))
    });
    return { id, piezas: ls.reduce((s, l) => s + l.cant, 0) };
  }

  async function opPedidoCancelar(ctx, b, tx) {
    const ped = await ctx.repo.pedido(clean(b.id, 60));
    if (!ped) throw new ApiError(404, 'no_existe', 'No encontré ese pedido.');
    if (ped.estado !== 'pendiente') throw new ApiError(409, 'ya_resuelto', 'Ese pedido ya no está pendiente.');
    tx.pedidos.push({ p: Object.assign({}, ped, { estado: 'cancelado' }), lineas: ped.lineas });
    tx.guardas.push({ tipo: 'pedido_estado', id: ped.id, estado: 'pendiente' });
    return { id: ped.id };
  }

  // ── catálogo

  function existeId(lista, id, que) {
    if (!id) return '';
    if (!lista.some((x) => x.id === id)) throw bad('catalogo', 'La opción de ' + que + ' elegida ya no existe en el catálogo.');
    return id;
  }

  async function opProductoCrear(ctx, b, tx) {
    const cfg = ctx.cfg;
    if (!CATS.includes(b.cat)) throw bad('categoria', 'Elige una categoría.');
    const nombre = clean(b.nombre, 80);
    if (nombre.length < 2) throw bad('nombre', 'Escribe el nombre del producto.');
    const prods = await ctx.repo.productos();
    if (prods.some((p) => norm(p.nombre) === norm(nombre))) throw new ApiError(409, 'duplicado', 'Ya existe un producto llamado "' + nombre + '".');
    const sl = entero(b.stock_local, 0, 99999, 0), st = entero(b.stock_tienda, 0, 99999, 0);
    const p = filaProducto(ctx.ahora, {
      nombre, cat: b.cat,
      medida: b.cat === 'base' ? existeId(cfg.medidas, b.medida, 'medida') : '',
      tono: b.cat === 'base' ? existeId(cfg.tonos, b.tono, 'tono') : '',
      unidad: clean(b.unidad, 12) || 'pza',
      precio: numero(b.precio, 0, 1e6, 0), costo: numero(b.costo, 0, 1e6, 0),
      min_local: entero(b.min_local, 0, 9999, 0), min_tienda: entero(b.min_tienda, 0, 9999, 0),
      stock_local: sl, stock_tienda: st, hubo_local: sl > 0 ? 1 : 0, hubo_tienda: st > 0 ? 1 : 0
    });
    tx.productosInsert.push(p);
    const grupo = grupoDe(b, 'I');
    let i = 0;
    if (sl > 0) tx.movs.push(nuevoMov(ctx, grupo, i++, p, 'local', sl, 'inicial', { nota: 'Inventario inicial' }));
    if (st > 0) tx.movs.push(nuevoMov(ctx, grupo, i++, p, 'tienda', st, 'inicial', { nota: 'Inventario inicial' }));
    return { id: p.id };
  }

  async function opVariantes(ctx, b, tx) {
    const cfg = ctx.cfg;
    const pick = (lista, ids) => (Array.isArray(ids) ? ids : []).map((id) => lista.find((x) => x.id === id)).filter(Boolean);
    const medidas = pick(cfg.medidas, b.medidas), tonos = pick(cfg.tonos, b.tonos);
    if (!medidas.length || !tonos.length) throw bad('sin_seleccion', 'Elige al menos una medida y un tono.');
    if (medidas.length * tonos.length > 60) throw bad('demasiadas', 'Máximo 60 productos a la vez.');
    const existentes = new Set((await ctx.repo.productos()).map((p) => norm(p.nombre)));
    const minL = entero(b.min_local, 0, 9999, 2), minT = entero(b.min_tienda, 0, 9999, 1);
    let creados = 0, omitidos = 0;
    medidas.forEach((m) => tonos.forEach((t) => {
      const nombre = nombreBase(m, t);
      if (existentes.has(norm(nombre))) { omitidos++; return; }
      tx.productosInsert.push(filaProducto(ctx.ahora, { nombre, cat: 'base', medida: m.id, tono: t.id, precio: m.precio, min_local: minL, min_tienda: minT }));
      creados++;
    }));
    if (!creados) throw new ApiError(409, 'duplicado', 'Todas esas bases ya existen.');
    return { creados, omitidos };
  }

  async function opProductoEditar(ctx, b, tx) {
    const prods = await ctx.repo.productos();
    const p = prods.find((x) => x.id === b.id);
    if (!p) throw new ApiError(404, 'producto_no_existe', 'Ese producto ya no existe. Actualiza la pantalla.');
    const set = {};
    if (b.nombre !== undefined) {
      const n = clean(b.nombre, 80);
      if (n.length < 2) throw bad('nombre', 'Escribe el nombre del producto.');
      if (prods.some((x) => x.id !== p.id && norm(x.nombre) === norm(n))) throw new ApiError(409, 'duplicado', 'Ya existe un producto llamado "' + n + '".');
      set.nombre = n;
    }
    if (b.unidad !== undefined) set.unidad = clean(b.unidad, 12) || 'pza';
    if (b.precio !== undefined) set.precio = numero(b.precio, 0, 1e6, 0);
    if (b.costo !== undefined) set.costo = numero(b.costo, 0, 1e6, 0);
    if (b.min_local !== undefined) set.min_local = entero(b.min_local, 0, 9999, 0);
    if (b.min_tienda !== undefined) set.min_tienda = entero(b.min_tienda, 0, 9999, 0);
    if (p.cat === 'base' && b.medida !== undefined) set.medida = existeId(ctx.cfg.medidas, b.medida, 'medida');
    if (p.cat === 'base' && b.tono !== undefined) set.tono = existeId(ctx.cfg.tonos, b.tono, 'tono');
    if (!Object.keys(set).length) throw bad('sin_cambios', 'No hay cambios que guardar.');
    set.actualizado = ctx.ahora;
    tx.productosUpdate.push({ id: p.id, set });
    return { id: p.id };
  }

  async function opProductoArchivar(ctx, b, tx) {
    const p = await productoPorId(ctx, b.id);
    const activo = b.activo ? 1 : 0;
    if (!activo) {
      if (p.stock_local || p.stock_tienda) {
        throw new ApiError(409, 'tiene_stock', 'Primero deja en cero el stock de ' + p.nombre + ' (almacén ' + p.stock_local + ', tienda ' + p.stock_tienda + ').');
      }
      const enUso = (await ctx.repo.traspasos({ abiertos: true })).some((t) => t.lineas.some((l) => l.id === p.id)) ||
        (await ctx.repo.pedidos({ abiertos: true })).some((x) => x.lineas.some((l) => l.id === p.id));
      if (enUso) throw new ApiError(409, 'en_uso', p.nombre + ' está en un envío o pedido pendiente. Resuélvelo primero.');
    }
    tx.productosUpdate.push({ id: p.id, set: { activo, actualizado: ctx.ahora } });
    return { id: p.id, activo };
  }

  function limpiarMedidas(arr) {
    if (!Array.isArray(arr) || !arr.length || arr.length > 20) throw bad('medidas', 'Deja de 1 a 20 medidas.');
    const ids = new Set();
    return arr.map((m) => {
      const id = m && /^[a-z0-9_-]{1,20}$/.test(m.id) ? m.id : '';
      const nombre = clean(m && m.nombre, 30);
      if (!id || ids.has(id) || !nombre) throw bad('medidas', 'Cada medida necesita un nombre.');
      ids.add(id);
      return { id, nombre, dims: clean(m.dims, 24), precio: numero(m.precio, 0, 1e6, 0) };
    });
  }
  function limpiarTonos(arr) {
    if (!Array.isArray(arr) || !arr.length || arr.length > 40) throw bad('tonos', 'Deja de 1 a 40 tonos.');
    const ids = new Set();
    return arr.map((t) => {
      const id = t && /^[a-z0-9_-]{1,20}$/.test(t.id) ? t.id : '';
      const nombre = clean(t && t.nombre, 24);
      if (!id || ids.has(id) || !nombre || !/^#[0-9a-fA-F]{6}$/.test(t.hex)) throw bad('tonos', 'Cada tono necesita nombre y color.');
      ids.add(id);
      return { id, nombre, hex: t.hex.toUpperCase() };
    });
  }

  const tarifa = (v, actual) => (v === undefined || v === null || v === '' ? actual : numero(v, 0, 100000, actual));

  async function opConfigGuardar(ctx, b, tx) {
    const cfg = ctx.cfg, patch = {};
    const prods = await ctx.repo.productos();
    if (b.negocio) {
      patch.negocio = {
        nombre: clean(b.negocio.nombre, 60) || cfg.negocio.nombre,
        telLocal: String(b.negocio.telLocal || '').replace(/\D/g, '').slice(0, 15),
        telTienda: String(b.negocio.telTienda || '').replace(/\D/g, '').slice(0, 15),
        envioTepic: tarifa(b.negocio.envioTepic, cfg.negocio.envioTepic),
        envioFuera: tarifa(b.negocio.envioFuera, cfg.negocio.envioFuera),
        descRecoge: tarifa(b.negocio.descRecoge, cfg.negocio.descRecoge)
      };
    }
    if (b.medidas) {
      patch.medidas = limpiarMedidas(b.medidas);
      cfg.medidas.filter((m) => !patch.medidas.some((n) => n.id === m.id)).forEach((m) => {
        if (prods.some((p) => p.cat === 'base' && p.medida === m.id)) throw new ApiError(409, 'en_uso', 'No puedes quitar la medida "' + m.nombre + '": hay productos que la usan.');
      });
    }
    if (b.tonos) {
      patch.tonos = limpiarTonos(b.tonos);
      cfg.tonos.filter((t) => !patch.tonos.some((n) => n.id === t.id)).forEach((t) => {
        if (prods.some((p) => p.cat === 'base' && p.tono === t.id)) throw new ApiError(409, 'en_uso', 'No puedes quitar el tono "' + t.nombre + '": hay productos que lo usan.');
      });
    }
    if (Array.isArray(b.aplicarPrecios) && patch.medidas) {
      b.aplicarPrecios.forEach((mid) => {
        const m = patch.medidas.find((x) => x.id === mid);
        if (!m) return;
        prods.filter((p) => p.cat === 'base' && p.medida === mid && p.precio !== m.precio)
          .forEach((p) => tx.productosUpdate.push({ id: p.id, set: { precio: m.precio, actualizado: ctx.ahora } }));
      });
    }
    if (!Object.keys(patch).length) throw bad('sin_cambios', 'No hay cambios que guardar.');
    tx.config = patch;
    return { actualizados: tx.productosUpdate.length };
  }

  async function opPinCambiar(ctx, b, tx) {
    const cfg = ctx.cfg, rol = ctx.rol;
    const it = await reservar(ctx, rol);
    const acc = cfg.acceso[rol];
    if (!igual(hashPin(acc.salt, String(b.pinActual || '')), acc.hash)) fallar(it, 'pin_incorrecto', 'Tu PIN actual no coincide.');
    const nuevo = String(b.pinNuevo || '');
    validarPin(nuevo);
    // “ese PIN ya lo usa el otro usuario” revelaría el PIN ajeno a quien pruebe uno por uno: cada intento cuenta y no se borra con el acierto
    await reservar(ctx, 'cambio:' + rol);
    if (pinEnUso(cfg, rol, nuevo)) throw bad('pin_igual', 'Ese PIN no está disponible. Elige otro.');
    await limpiarIntentos(ctx, rol);
    const acceso = Object.assign({}, cfg.acceso, { [rol]: nuevoAcceso(nuevo, acc.v + 1) });
    tx.config = { acceso };
    return { token: firmar(Object.assign({}, cfg, { acceso }), rol, ctx.ahora) };
  }

  async function opPinReiniciar(ctx, b, tx) {
    const cfg = ctx.cfg;
    const it = await reservar(ctx, 'local');
    const acc = cfg.acceso.local;
    if (!igual(hashPin(acc.salt, String(b.pinActual || '')), acc.hash)) fallar(it, 'pin_incorrecto', 'Tu PIN no coincide.');
    await limpiarIntentos(ctx, 'local', 'tienda');
    const nuevo = String(b.pinNuevo || '');
    validarPin(nuevo);
    if (pinEnUso(cfg, 'tienda', nuevo)) throw bad('pin_igual', 'Cada usuario necesita un PIN distinto.');
    const t = cfg.acceso.tienda;
    const acceso = Object.assign({}, cfg.acceso, { tienda: nuevoAcceso(nuevo, ((t && t.v) || 0) + 1) });
    tx.config = { acceso };
    return {};
  }

  async function opRecupNueva(ctx, b, tx) {
    const cfg = ctx.cfg;
    const it = await reservar(ctx, 'local');
    const acc = cfg.acceso.local;
    if (!igual(hashPin(acc.salt, String(b.pinActual || '')), acc.hash)) fallar(it, 'pin_incorrecto', 'Tu PIN no coincide.');
    await limpiarIntentos(ctx, 'local');
    const codigo = codigoRecuperacion();
    tx.config = { acceso: Object.assign({}, cfg.acceso, { recup: nuevoAcceso(normCodigo(codigo)) }) };
    return { codigo };
  }

  // El Almacén crea o cambia el PIN del Dueño (usuario de solo lectura con el resumen del negocio).
  async function opPinDueno(ctx, b, tx) {
    const cfg = ctx.cfg;
    const it = await reservar(ctx, 'local');
    const acc = cfg.acceso.local;
    if (!igual(hashPin(acc.salt, String(b.pinActual || '')), acc.hash)) fallar(it, 'pin_incorrecto', 'Tu PIN no coincide.');
    await limpiarIntentos(ctx, 'local', 'dueno');
    const nuevo = String(b.pinNuevo || '');
    validarPin(nuevo);
    if (pinEnUso(cfg, 'dueno', nuevo)) throw bad('pin_igual', 'Cada usuario necesita un PIN distinto.');
    const d = cfg.acceso.dueno;
    tx.config = { acceso: Object.assign({}, cfg.acceso, { dueno: nuevoAcceso(nuevo, ((d && d.v) || 0) + 1) }) };
    return {};
  }

  // Deja el inventario en cero (borra movimientos, envíos y pedidos; conserva productos, precios, PIN y ajustes).
  async function opReiniciar(ctx, b, tx) {
    const cfg = ctx.cfg;
    const it = await reservar(ctx, 'local');
    const acc = cfg.acceso.local;
    if (!igual(hashPin(acc.salt, String(b.pinActual || '')), acc.hash)) fallar(it, 'pin_incorrecto', 'Tu PIN no coincide.');
    await limpiarIntentos(ctx, 'local');
    if (String(b.confirmacion || '').trim().toUpperCase() !== 'BORRAR TODO') throw bad('falta_confirmacion', 'Escribe BORRAR TODO para confirmar.');
    tx.reiniciar = true;
    tx.config = { reinicio: { ts: ctx.ahora, rol: ctx.rol } };
    return {};
  }

  const OPS = {
    'producto.crear': [['local'], opProductoCrear],
    'producto.variantes': [['local'], opVariantes],
    'producto.editar': [['local'], opProductoEditar],
    'producto.archivar': [['local'], opProductoArchivar],
    'mov.entrada': [['local'], (c, b, t) => opMovLineas(c, b, t, 'entrada')],
    'mov.salida': [['local'], (c, b, t) => opMovLineas(c, b, t, 'salida')],
    'mov.venta': [['tienda'], (c, b, t) => opMovLineas(c, b, t, 'venta')],
    'mov.devolucion': [['tienda'], (c, b, t) => opMovLineas(c, b, t, 'devolucion')],
    'mov.merma': [['tienda'], (c, b, t) => opMovLineas(c, b, t, 'merma')],
    'mov.regreso': [['local', 'tienda'], opRegreso],
    'gasto.crear': [['local', 'tienda'], opGastoCrear],
    'gasto.anular': [['local', 'tienda'], opGastoAnular],
    'mov.conteo': [['local', 'tienda'], opConteo],
    'mov.anular': [['local', 'tienda'], opAnular],
    'traspaso.enviar': [['local'], opEnviar],
    'traspaso.recibir': [['tienda'], opRecibir],
    'traspaso.cancelar': [['local'], opCancelar],
    'pedido.crear': [['tienda'], opPedidoCrear],
    'pedido.cancelar': [['local', 'tienda'], opPedidoCancelar],
    'config.guardar': [['local'], opConfigGuardar],
    'pin.cambiar': [['local', 'tienda', 'dueno'], opPinCambiar],
    'pin.dueno': [['local'], opPinDueno],
    'pin.reiniciar': [['local'], opPinReiniciar],
    'recup.nueva': [['local'], opRecupNueva],
    'sistema.reiniciar': [['local'], opReiniciar]
  };

  // Ejecuta una operación ya autenticada y la guarda de forma atómica.
  async function correrOp(ctx, body) {
    const def = body && typeof body.op === 'string' && Object.prototype.hasOwnProperty.call(OPS, body.op) ? OPS[body.op] : null;
    if (!def) throw bad('op_invalida', 'Operación desconocida.');
    if (!def[0].includes(ctx.rol)) throw new ApiError(403, 'sin_permiso', def[0][0] === 'local' ? 'Esta acción es del almacén.' : 'Esta acción es del vendedor de la tienda.');
    const tx = nuevaTx();
    const resultado = (await def[1](ctx, body, tx)) || {};
    await ctx.repo.commit(tx);
    return resultado;
  }

  // ───────── entrada única

  async function handle(repo, req, opts) {
    opts = opts || {};
    const ahora = opts.now || Date.now();
    const ctx = { repo, ahora, req: req || {}, tz: tzDe(req && req.query), servidor: opts.servidor, demo: !!opts.demo, claveInstalacion: opts.claveInstalacion || '' };
    try {
      const path = String(ctx.req.path || '/').replace(/\/+$/, '') || '/';
      const m = String(ctx.req.method || 'GET').toUpperCase();
      if (path === '/ping' && m === 'GET') return await ping(ctx);
      if (path === '/setup' && m === 'POST') return await setup(ctx);
      if (path === '/login' && m === 'POST') return await login(ctx);
      if (path === '/recuperar' && m === 'POST') return await recuperar(ctx);
      const cfg = await cargarCfg(ctx);
      if (!cfg.configurado) throw new ApiError(409, 'no_configurado', 'Este inventario todavía no está configurado.');
      const au = verificar(cfg, ctx.req.token, ahora);
      ctx.rol = au.rol;
      ctx.exp = au.exp;
      if (path === '/rev' && m === 'GET') return ok({ rev: cfg.rev });
      if (path === '/estado' && m === 'GET') return ok(await armarEstado(ctx));
      if (path === '/movs' && m === 'GET') return ok(await listarMovs(ctx));
      if (path === '/reporte-dia' && m === 'GET') return ok(await reporteDia(ctx));
      if (path === '/resumen' && m === 'GET') {
        if (ctx.rol === 'tienda') throw new ApiError(403, 'sin_permiso', 'El resumen del negocio es del dueño y del almacén.');
        return ok(await resumenDueno(ctx));
      }
      if (path === '/gastos' && m === 'GET') return ok(await listarGastos(ctx));
      if (path === '/ventas' && m === 'GET') return ok({ ahora: ctx.ahora, ventas: detalleVentas(await ctx.repo.ventas(ctx.ahora - 35 * DIA), ctx.ahora, ctx.tz) });
      if (path === '/op' && m === 'POST') {
        const resultado = await correrOp(ctx, ctx.req.body);
        const extra = {};
        if (resultado.token) { extra.token = resultado.token; delete resultado.token; }
        const est = await armarEstado(ctx);
        return ok(Object.assign({ resultado, estado: est }, extra));
      }
      throw new ApiError(404, 'no_existe', 'Ruta no encontrada.');
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.code, e.message, e.extra);
      if (typeof console !== 'undefined') console.error(e);
      return fail(500, 'interno', 'Algo falló en el servidor. Intenta de nuevo.');
    }
  }

  // ───────── repo local (localStorage o memoria): mismo contrato que el repo D1

  function crearRepoLocal(almacen, clave) {
    const vacio = () => ({ v: 1, config: {}, productos: {}, movs: [], traspasos: {}, pedidos: {}, intentos: {}, gastos: [] });
    let S = leer();
    let ids = new Set(S.movs.map((m) => m.id));
    let diferido = false;

    function leer() {
      try {
        const raw = almacen.getItem(clave);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && d.productos && d.movs) return d;
        }
      } catch (e) { /* almacén vacío o ilegible: se empieza de cero */ }
      return vacio();
    }
    function guardar() {
      if (diferido) return;
      try {
        almacen.setItem(clave, JSON.stringify(S));
      } catch (e) {
        S = leer();
        ids = new Set(S.movs.map((m) => m.id));
        throw new ApiError(507, 'sin_espacio', 'No hay espacio para guardar en este equipo. Exporta un respaldo y libera memoria.');
      }
    }
    const conLineas = (t) => (t ? Object.assign({}, t, { lineas: t.lineas.map((l) => Object.assign({}, l)) }) : null);
    const porFecha = (a, b) => b.ts - a.ts || (a.id < b.id ? 1 : -1);

    return {
      async config() { return clonar(S.config); },
      async producciones(desde) { return S.movs.filter((m) => m.tipo === 'entrada' && !m.anulado && m.ts >= desde).map((m) => ({ ts: m.ts, prod: m.prod, delta: m.delta, motivo: m.motivo })); },
      async gastos(desde) { return (S.gastos || []).filter((g) => g.ts >= desde).map((g) => Object.assign({}, g)); },
      async gasto(id) { const g = (S.gastos || []).find((x) => x.id === id); return g ? Object.assign({}, g) : null; },
      // cuenta un intento de PIN de forma atómica (ver reservar en el núcleo)
      async intento(clave, ahora) {
        const m = S.intentos || (S.intentos = {});
        const it = Object.prototype.hasOwnProperty.call(m, clave) ? m[clave] : (m[clave] = { n: 0, b: 0, hasta: 0 });
        let adm = 1;
        if (it.hasta > ahora) adm = 0;
        else if (it.n + 1 >= 5) { it.hasta = ahora + Math.min(DIA, 5 * 60000 * Math.pow(3, it.b)); it.b += 1; it.n = 0; } else it.n += 1;
        guardar();
        return { n: it.n, b: it.b, hasta: it.hasta, adm };
      },
      async limpiarIntentos(claves) { const m = S.intentos || {}; claves.forEach((c) => { delete m[c]; }); S.intentos = m; guardar(); },
      async productos() { return Object.values(S.productos).map((p) => Object.assign({}, p)); },
      async traspasos(f) {
        f = f || {};
        return Object.values(S.traspasos)
          .filter((t) => (f.abiertos ? t.estado === 'en_transito' : t.estado === 'en_transito' || t.ts >= (f.desde || 0)))
          .sort(porFecha).slice(0, 80).map(conLineas);
      },
      async traspaso(id) { return conLineas(own(S.traspasos, id)); },
      async pedidos(f) {
        f = f || {};
        return Object.values(S.pedidos)
          .filter((t) => (f.abiertos ? t.estado === 'pendiente' : t.estado === 'pendiente' || t.ts >= (f.desde || 0)))
          .sort(porFecha).slice(0, 80).map(conLineas);
      },
      async pedido(id) { return conLineas(own(S.pedidos, id)); },
      async movsGrupo(grupo) { return S.movs.filter((m) => m.grupo === grupo).map((m) => Object.assign({}, m)); },
      async movs(f) {
        let arr = S.movs.filter((m) => {
          if (!f.anulaciones && m.tipo === 'anulacion') return false;
          if (f.desde && m.ts < f.desde) return false;
          if (f.hasta && m.ts > f.hasta) return false;
          if (f.prods && !f.prods.includes(m.prod)) return false;
          if (f.tipos && !f.tipos.includes(m.tipo)) return false;
          if (f.rol && m.rol !== f.rol) return false;
          return true;
        }).sort(porFecha);
        if (f.antes) {
          const i = f.antes.indexOf('_'), ts = Number(f.antes.slice(0, i)), id = f.antes.slice(i + 1);
          arr = arr.filter((m) => m.ts < ts || (m.ts === ts && m.id < id));
        }
        const items = arr.slice(0, f.limite).map((m) => Object.assign({}, m));
        const last = items[items.length - 1];
        return { items, siguiente: arr.length > f.limite && last ? last.ts + '_' + last.id : null };
      },
      async ventas(desde) {
        return S.movs.filter((m) => (m.tipo === 'venta' || m.tipo === 'devolucion') && !m.anulado && m.ts >= desde)
          .map((m) => ({ ts: m.ts, prod: m.prod, delta: m.delta, precio: m.precio, grupo: m.grupo, tipo: m.tipo, cliente: m.cliente, pago: m.pago, motivo: m.motivo, envio: m.envio || 0, rol: m.rol }));
      },
      async commit(tx) {
        // 1) verificar todo antes de tocar nada
        (tx.guardas || []).forEach((g) => {
          if (g.tipo === 'traspaso_estado' && (!own(S.traspasos, g.id) || S.traspasos[g.id].estado !== g.estado)) throw conflicto();
          if (g.tipo === 'pedido_estado' && (!own(S.pedidos, g.id) || S.pedidos[g.id].estado !== g.estado)) throw conflicto();
          if (g.tipo === 'grupo_sin_anular' && S.movs.some((m) => m.grupo === g.grupo && m.anulado)) throw conflicto();
          if (g.tipo === 'gasto_sin_anular' && (S.gastos || []).some((x) => x.id === g.id && x.anulado)) throw conflicto();
        });
        if (tx.configInsert) Object.keys(tx.configInsert).forEach((k) => { if (k in S.config) throw new ApiError(409, 'ya_configurado', 'Este inventario ya está configurado.'); });
        tx.movs.forEach((m) => { if (ids.has(m.id)) throw new ApiError(409, 'duplicado', 'Esta operación ya se había guardado.'); });
        tx.gastosInsert.forEach((g) => { if ((S.gastos || []).some((x) => x.id === g.id)) throw new ApiError(409, 'duplicado', 'Esta operación ya se había guardado.'); });
        const acum = {};
        tx.stock.forEach((s) => { const a = acum[s.id] || (acum[s.id] = [0, 0]); a[0] += s.dl; a[1] += s.dt; });
        Object.keys(acum).forEach((id) => {
          const p = own(S.productos, id);
          if (!p || p.stock_local + acum[id][0] < 0 || p.stock_tienda + acum[id][1] < 0) throw conflicto();
        });
        // 2) aplicar
        const antes = diferido ? null : JSON.stringify(S);
        try {
          if (tx.reiniciar) {
            S.movs = []; ids = new Set(); S.traspasos = {}; S.pedidos = {}; S.gastos = [];
            Object.keys(S.productos).forEach((k) => Object.assign(S.productos[k], { stock_local: 0, stock_tienda: 0, hubo_local: 0, hubo_tienda: 0 }));
          }
          if (tx.configInsert) Object.assign(S.config, tx.configInsert);
          Object.assign(S.config, tx.config);
          tx.productosInsert.forEach((p) => { S.productos[p.id] = Object.assign({}, p); });
          tx.productosUpdate.forEach((u) => { if (S.productos[u.id]) Object.assign(S.productos[u.id], u.set); });
          Object.keys(acum).forEach((id) => {
            const p = S.productos[id];
            p.stock_local += acum[id][0];
            p.stock_tienda += acum[id][1];
            if (p.stock_local > 0) p.hubo_local = 1; // “hubo”: alguna vez tuvo existencias; sin eso un producto nuevo en cero no es alerta
            if (p.stock_tienda > 0) p.hubo_tienda = 1;
          });
          tx.movsAnulados.forEach((a) => {
            const m = S.movs.find((x) => x.id === a.id);
            if (m) Object.assign(m, { anulado: 1, anulado_ts: a.ts, anulado_por: a.por, anulado_nota: a.nota });
          });
          tx.movs.forEach((m) => { S.movs.push(Object.assign({}, m)); ids.add(m.id); });
          S.gastos = S.gastos || [];
          tx.gastosAnular.forEach((a) => { const g = S.gastos.find((x) => x.id === a.id); if (g) Object.assign(g, { anulado: 1, anulado_ts: a.ts, anulado_por: a.por, anulado_nota: a.nota }); });
          tx.gastosInsert.forEach((g) => { S.gastos.push(Object.assign({}, g)); });
          tx.traspasos.forEach((x) => { S.traspasos[x.t.id] = Object.assign({}, x.t, { lineas: x.lineas.map((l) => Object.assign({}, l)) }); });
          tx.pedidos.forEach((x) => { S.pedidos[x.p.id] = Object.assign({}, x.p, { lineas: x.lineas.map((l) => Object.assign({}, l)) }); });
          if (!tx.sinRev) S.config.rev = (S.config.rev | 0) + 1;
          guardar();
        } catch (e) {
          if (antes) {
            S = JSON.parse(antes);
            ids = new Set(S.movs.map((m) => m.id));
          }
          throw e;
        }
      },
      recargar() { S = leer(); ids = new Set(S.movs.map((m) => m.id)); },
      async diferir(fn) {
        diferido = true;
        try { return await fn(); } finally { diferido = false; guardar(); }
      },
      borrar() { S = vacio(); ids = new Set(); try { almacen.removeItem(clave); } catch (e) { /* sin almacén */ } }
    };
  }

  function almacenMemoria() {
    const m = {};
    return {
      getItem: (k) => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: (k) => { delete m[k]; }
    };
  }

  // ───────── datos de demostración (solo modo local; el servidor nunca los siembra)

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function sembrarDemo(repo, opts) {
    opts = opts || {};
    const fin = opts.now || Date.now();
    const rnd = mulberry32(20261023);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    // día 0 = hace 27 días; las horas son de Tepic (UTC−7) y nada queda en el futuro
    const medianoche = Math.floor((fin + TZ_DEFECTO * 60000) / DIA) * DIA - TZ_DEFECTO * 60000;
    const dia0 = medianoche - 27 * DIA;
    const hora = (d, h) => Math.min(dia0 + d * DIA + (h * 60 + entre(0, 40)) * 60000, fin - 20 * 60000);
    const inicio = dia0 - 3600000;
    let seq = 0;
    const cid = () => 'demo' + (++seq).toString(36) + 'x' + Math.floor(rnd() * 1e6).toString(36);
    const run = async (rol, body, ahora) => {
      const ctx = { repo, ahora, rol, cfg: normalizarCfg(await repo.config()), req: { body }, servidor: false, tz: TZ_DEFECTO };
      return correrOp(ctx, Object.assign({ cid: cid() }, body));
    };

    await repo.diferir(async () => {
      await handle(repo, {
        method: 'POST', path: '/setup',
        body: { nombre: 'Bases Box Tepic', pinLocal: '1111', pinTienda: '2222', catalogo: { bases: true, extras: true } }
      }, { now: inicio, demo: true, servidor: false });

      { // el Dueño de la demostración entra con 3333
        const cfgD = normalizarCfg(await repo.config());
        const txD = nuevaTx();
        txD.config = { acceso: Object.assign({}, cfgD.acceso, { dueno: nuevoAcceso('3333', 1) }) };
        txD.sinRev = true;
        await repo.commit(txD);
      }
      const precios = { ind: 2350, mat: 3100, qn: 3790, kg: 4650 };
      const cfg0 = normalizarCfg(await repo.config());
      await run('local', {
        op: 'config.guardar',
        medidas: cfg0.medidas.map((m) => Object.assign({}, m, { precio: precios[m.id] || 0 })),
        aplicarPrecios: cfg0.medidas.map((m) => m.id)
      }, inicio);
      for (const p of await repo.productos()) {
        if (p.cat === 'base') await run('local', { op: 'producto.editar', id: p.id, costo: Math.round(precios[p.medida] * 0.62) }, inicio);
        else await run('local', { op: 'producto.editar', id: p.id, precio: 0, costo: entre(60, 480) }, inicio);
      }

      const bases = (await repo.productos()).filter((p) => p.cat === 'base');
      const extras = (await repo.productos()).filter((p) => p.cat !== 'base');
      // Producción y compras iniciales
      await run('local', { op: 'mov.entrada', motivo: 'produccion', lineas: bases.filter(() => rnd() < 0.7).slice(0, 15).map((p) => ({ id: p.id, cant: entre(3, 9) })) }, hora(0, 9));
      await run('local', { op: 'mov.entrada', motivo: 'compra', lineas: extras.map((p) => ({ id: p.id, cant: entre(8, 40) })) }, hora(0, 11));

      let pendiente = null;
      for (let d = 0; d < 28; d++) {
        const hoyEsFin = d === 27;
        const prods = await repo.productos();
        const basesNow = prods.filter((p) => p.cat === 'base');
        // fábrica: producción cada par de días
        if (d % 2 === 1) {
          const cand = basesNow.filter(() => rnd() < 0.25).slice(0, 5);
          if (cand.length) await run('local', { op: 'mov.entrada', motivo: 'produccion', lineas: cand.map((p) => ({ id: p.id, cant: entre(2, 6) })) }, hora(d, 11));
        }
        if (d % 9 === 4) {
          const mat = prods.filter((p) => p.cat === 'material');
          await run('local', { op: 'mov.entrada', motivo: 'compra', lineas: mat.slice(0, 4).map((p) => ({ id: p.id, cant: entre(10, 30) })) }, hora(d, 12));
        }
        // la tienda recibe lo que se mandó el día anterior (el último envío queda en camino)
        if (pendiente && d > pendiente.d && d < 26) {
          await run('tienda', { op: 'traspaso.recibir', id: pendiente.id, lineas: [] }, hora(d, 9));
          pendiente = null;
        }
        if (d % 3 === 0 && d > 0) {
          const cand = basesNow.filter((p) => p.stock_local >= 3 && p.stock_tienda <= 3).slice(0, entre(3, 6));
          if (cand.length) {
            const r = await run('local', { op: 'traspaso.enviar', nota: d % 6 === 0 ? 'En la camioneta de la tarde' : '', lineas: cand.map((p) => ({ id: p.id, cant: Math.min(entre(2, 4), p.stock_local) })) }, hora(d, 15));
            pendiente = { id: r.id, d };
          }
        }
        // tienda: ventas del día
        const nv = d % 7 === 6 ? entre(3, 5) : entre(0, 3);
        for (let v = 0; v < nv; v++) {
          const disp = (await repo.productos()).filter((p) => p.cat === 'base' && p.activo && p.stock_tienda > 0);
          if (!disp.length) break;
          const l1 = pick(disp);
          const lineas2 = [{ id: l1.id, cant: 1 }];
          if (rnd() < 0.2) { const l2 = pick(disp.filter((x) => x.id !== l1.id)); if (l2) lineas2.push({ id: l2.id, cant: 1 }); }
          await run('tienda', { op: 'mov.venta', pago: pick(['efectivo', 'efectivo', 'transferencia', 'tarjeta']), cliente: rnd() < 0.3 ? pick(['Mostrador', 'Familia Ríos', 'Sra. Lupita', 'Hotel Cielo']) : '', lineas: lineas2 }, hora(d, 10 + v * 2));
        }
        if (d === 12) {
          const cand = (await repo.productos()).find((p) => p.cat === 'base' && p.stock_tienda > 0);
          if (cand) await run('tienda', { op: 'mov.merma', nota: 'Se manchó en exhibición', lineas: [{ id: cand.id, cant: 1 }] }, hora(d, 17));
        }
        void hoyEsFin;
      }

      // Estado final para que el tablero muestre alertas y trabajo pendiente
      const fin2 = await repo.productos();
      const bajos = fin2.filter((p) => p.cat === 'base' && p.stock_tienda > 0).slice(0, 3);
      for (const p of bajos) await run('tienda', { op: 'mov.conteo', nota: 'Conteo de cierre', lineas: [{ id: p.id, contado: 0 }] }, fin - 100 * 60000);
      const pedirP = fin2.filter((p) => p.cat === 'base').slice(0, 2);
      await run('tienda', { op: 'pedido.crear', nota: 'Se están acabando en tienda', lineas: pedirP.map((p) => ({ id: p.id, cant: 3 })) }, fin - 60 * 60000);
    });
    return { local: '1111', tienda: '2222', dueno: '3333' };
  }

  return {
    VERSION, MAX_LINEAS, MEDIDAS_BASE, TONOS_BASE, EXTRAS_BASE,
    handle, crearRepoLocal, almacenMemoria, sembrarDemo, ApiError,
    // expuestos para pruebas
    sha256hex, hmacHex, resumenVentas, diaKey
  };
});
