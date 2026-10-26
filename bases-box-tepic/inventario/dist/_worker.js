/* huella:b2f07e9fc2e7327f */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// public/core.js
var require_core = __commonJS({
  "public/core.js"(exports, module) {
    (function(root, factory) {
      if (typeof module === "object" && module.exports) module.exports = factory();
      else root.BBCore = factory();
    })(typeof self !== "undefined" ? self : exports, function() {
      "use strict";
      const VERSION = "1.0.0";
      const DIA = 864e5;
      const ROLES = ["local", "tienda"];
      const CATS = ["base", "material", "accesorio"];
      const PAGOS = ["efectivo", "transferencia", "tarjeta", "otro"];
      const MAX_LINEAS = 60;
      const SESION_DIAS = 30;
      const TZ_DEFECTO = -420;
      const NO_ANULABLES = ["envio", "recibo", "envio_cancelado", "inicial", "anulacion"];
      const MEDIDAS_BASE = [
        { id: "ind", nombre: "Individual", dims: "1.00 \xD7 1.90 m", precio: 0 },
        { id: "mat", nombre: "Matrimonial", dims: "1.35 \xD7 1.90 m", precio: 0 },
        { id: "qn", nombre: "Queen", dims: "1.50 \xD7 2.00 m", precio: 0 },
        { id: "kg", nombre: "King", dims: "2.00 \xD7 2.00 m", precio: 0 }
      ];
      const TONOS_BASE = [
        { id: "cocoa", nombre: "Cocoa", hex: "#6F4E37" },
        { id: "morado", nombre: "Morado", hex: "#6B3FA0" },
        { id: "rosa", nombre: "Rosa", hex: "#E84E8A" },
        { id: "gris", nombre: "Gris", hex: "#8A8D8F" },
        { id: "azul", nombre: "Azul", hex: "#2E5AAC" },
        { id: "marino", nombre: "Marino", hex: "#1E2A52" },
        { id: "verde", nombre: "Verde", hex: "#39A85B" },
        { id: "negro", nombre: "Negro", hex: "#1A1A1A" }
      ];
      const EXTRAS_BASE = [
        { nombre: "Triplay", cat: "material", unidad: "hoja" },
        { nombre: "Tela o vinil", cat: "material", unidad: "m" },
        { nombre: "Espuma", cat: "material", unidad: "hoja" },
        { nombre: "Madera", cat: "material", unidad: "pza" },
        { nombre: "Grapas", cat: "material", unidad: "caja" },
        { nombre: "Patas cromadas", cat: "accesorio", unidad: "juego" },
        { nombre: "Empaque", cat: "accesorio", unidad: "pza" }
      ];
      class ApiError2 extends Error {
        constructor(status, code, mensaje, extra) {
          super(mensaje);
          this.status = status;
          this.code = code;
          this.extra = extra || null;
        }
      }
      const bad = (code, mensaje, extra) => new ApiError2(400, code, mensaje, extra);
      const conflicto = () => new ApiError2(409, "conflicto", "El inventario cambi\xF3 mientras guardabas. Ya se actualiz\xF3 la pantalla; revisa e intenta de nuevo.");
      const ok = (data) => ({ status: 200, json: Object.assign({ ok: true }, data) });
      const fail = (status, code, mensaje, extra) => ({ status, json: { ok: false, error: Object.assign({ code, mensaje }, extra) } });
      const clean = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
      const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
      const p2 = (n) => (n < 10 ? "0" : "") + n;
      function numero(v, min, max, def) {
        if (v === "" || v == null) return def;
        const n = Number(v);
        if (!Number.isFinite(n) || n < min || n > max) throw bad("numero_invalido", "Revisa los n\xFAmeros: deben estar entre " + min + " y " + max + ".");
        return Math.round(n * 100) / 100;
      }
      function entero(v, min, max, def) {
        if (v === "" || v == null) return def;
        const n = Number(v);
        if (!Number.isInteger(n) || n < min || n > max) throw bad("numero_invalido", "Revisa las cantidades: deben ser enteros entre " + min + " y " + max + ".");
        return n;
      }
      function diaKey(ts, tz) {
        const d = new Date(ts + tz * 6e4);
        return d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate());
      }
      const tzDe = (q) => {
        const n = Number(q && q.tz);
        return Number.isFinite(n) && n >= -840 && n <= 840 ? Math.round(n) : TZ_DEFECTO;
      };
      function fmtEspera(s) {
        if (s < 90) return s + " segundos";
        if (s < 5400) return Math.ceil(s / 60) + " minutos";
        return Math.ceil(s / 3600) + " horas";
      }
      const clonar = (o) => JSON.parse(JSON.stringify(o));
      const K256 = [
        1116352408,
        1899447441,
        3049323471,
        3921009573,
        961987163,
        1508970993,
        2453635748,
        2870763221,
        3624381080,
        310598401,
        607225278,
        1426881987,
        1925078388,
        2162078206,
        2614888103,
        3248222580,
        3835390401,
        4022224774,
        264347078,
        604807628,
        770255983,
        1249150122,
        1555081692,
        1996064986,
        2554220882,
        2821834349,
        2952996808,
        3210313671,
        3336571891,
        3584528711,
        113926993,
        338241895,
        666307205,
        773529912,
        1294757372,
        1396182291,
        1695183700,
        1986661051,
        2177026350,
        2456956037,
        2730485921,
        2820302411,
        3259730800,
        3345764771,
        3516065817,
        3600352804,
        4094571909,
        275423344,
        430227734,
        506948616,
        659060556,
        883997877,
        958139571,
        1322822218,
        1537002063,
        1747873779,
        1955562222,
        2024104815,
        2227730452,
        2361852424,
        2428436474,
        2756734187,
        3204031479,
        3329325298
      ];
      function sha256(bytes) {
        const l = bytes.length;
        const m = new Uint8Array(l + 9 + 63 >> 6 << 6);
        m.set(bytes);
        m[l] = 128;
        const dv = new DataView(m.buffer);
        dv.setUint32(m.length - 8, Math.floor(l / 536870912), false);
        dv.setUint32(m.length - 4, l << 3 >>> 0, false);
        const h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
        const w = new Array(64);
        for (let off = 0; off < m.length; off += 64) {
          for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
          for (let i = 16; i < 64; i++) {
            const a2 = w[i - 15], b2 = w[i - 2];
            const s0 = (a2 >>> 7 | a2 << 25) ^ (a2 >>> 18 | a2 << 14) ^ a2 >>> 3;
            const s1 = (b2 >>> 17 | b2 << 15) ^ (b2 >>> 19 | b2 << 13) ^ b2 >>> 10;
            w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
          }
          let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
          for (let i = 0; i < 64; i++) {
            const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
            const ch = e & f ^ ~e & g;
            const t1 = hh + S1 + ch + K256[i] + w[i] >>> 0;
            const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
            const maj = a & b ^ a & c ^ b & c;
            const t2 = S0 + maj >>> 0;
            hh = g;
            g = f;
            f = e;
            e = d + t1 >>> 0;
            d = c;
            c = b;
            b = a;
            a = t1 + t2 >>> 0;
          }
          h[0] = h[0] + a >>> 0;
          h[1] = h[1] + b >>> 0;
          h[2] = h[2] + c >>> 0;
          h[3] = h[3] + d >>> 0;
          h[4] = h[4] + e >>> 0;
          h[5] = h[5] + f >>> 0;
          h[6] = h[6] + g >>> 0;
          h[7] = h[7] + hh >>> 0;
        }
        const out = new Uint8Array(32);
        const odv = new DataView(out.buffer);
        h.forEach((v, i) => odv.setUint32(i * 4, v, false));
        return out;
      }
      const utf8 = (s) => new TextEncoder().encode(s);
      const hex = (bytes) => Array.from(bytes, (b) => (b < 16 ? "0" : "") + b.toString(16)).join("");
      const sha256hex = (s) => hex(sha256(utf8(s)));
      function hmacHex(clave, msg) {
        let k = utf8(clave);
        if (k.length > 64) k = sha256(k);
        const m = utf8(msg);
        const ipad = new Uint8Array(64 + m.length);
        const opad = new Uint8Array(96);
        for (let i = 0; i < 64; i++) {
          const b = k[i] || 0;
          ipad[i] = b ^ 54;
          opad[i] = b ^ 92;
        }
        ipad.set(m, 64);
        opad.set(sha256(ipad), 64);
        return hex(sha256(opad));
      }
      const b64u = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const b64uDec = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
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
      const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      function codigoRecuperacion() {
        const a = new Uint8Array(8);
        crypto.getRandomValues(a);
        let s = "";
        a.forEach((b, i) => {
          s += ALFA[b % 32];
          if (i === 3) s += "-";
        });
        return s;
      }
      const normCodigo = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const uid = (p) => p + Date.now().toString(36) + aleatorioHex(3);
      const hashPin = (salt, pin) => sha256hex(salt + ":" + pin);
      function nuevoAcceso(secreto, v) {
        const salt = aleatorioHex(8);
        return { salt, hash: hashPin(salt, secreto), v: v || 1 };
      }
      function validarPin(pin) {
        if (!/^\d{4,8}$/.test(pin)) throw bad("pin_formato", "El PIN debe tener de 4 a 8 n\xFAmeros.");
        if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) throw bad("pin_debil", "Ese PIN es muy f\xE1cil de adivinar. Elige otro.");
      }
      function normalizarCfg(raw) {
        raw = raw || {};
        return {
          configurado: !!raw.configurado,
          negocio: Object.assign({ nombre: "Bases Box Tepic", telLocal: "", telTienda: "" }, raw.negocio),
          medidas: Array.isArray(raw.medidas) ? raw.medidas : [],
          tonos: Array.isArray(raw.tonos) ? raw.tonos : [],
          acceso: raw.acceso || {},
          intentos: raw.intentos || {},
          secret: raw.secret || "",
          rev: raw.rev | 0
        };
      }
      async function cargarCfg(ctx) {
        if (!ctx.cfg) ctx.cfg = normalizarCfg(await ctx.repo.config());
        return ctx.cfg;
      }
      function firmar(cfg, rol, ahora) {
        const p = b64u(JSON.stringify({ r: rol, exp: ahora + SESION_DIAS * DIA, pv: cfg.acceso[rol].v }));
        return p + "." + hmacHex(cfg.secret, p);
      }
      function verificar(cfg, token, ahora) {
        const sinSesion = () => new ApiError2(401, "sin_sesion", "Tu sesi\xF3n termin\xF3. Entra de nuevo con tu PIN.");
        if (!token || !cfg.secret) throw sinSesion();
        const i = String(token).indexOf(".");
        if (i < 1) throw sinSesion();
        const p = token.slice(0, i);
        if (!igual(token.slice(i + 1), hmacHex(cfg.secret, p))) throw sinSesion();
        let d;
        try {
          d = JSON.parse(b64uDec(p));
        } catch (e) {
          throw sinSesion();
        }
        const acc = d && cfg.acceso[d.r];
        if (!acc || !ROLES.includes(d.r) || !(d.exp > ahora) || acc.v !== d.pv) throw sinSesion();
        return { rol: d.r, exp: d.exp };
      }
      function chequearBloqueo(cfg, clave, ahora) {
        const it = cfg.intentos[clave];
        if (it && it.hasta > ahora) {
          const espera = Math.ceil((it.hasta - ahora) / 1e3);
          throw new ApiError2(423, "bloqueado", "Demasiados intentos. Espera " + fmtEspera(espera) + " para volver a intentar.", { espera });
        }
      }
      function registrarFallo(cfg, clave, ahora) {
        const it = Object.assign({ n: 0, b: 0, hasta: 0 }, cfg.intentos[clave]);
        it.n += 1;
        let restantes = 5 - it.n;
        if (it.n >= 5) {
          it.b += 1;
          it.n = 0;
          it.hasta = ahora + Math.min(DIA, 5 * 6e4 * Math.pow(3, it.b - 1));
          restantes = 0;
        }
        return { intentos: Object.assign({}, cfg.intentos, { [clave]: it }), restantes, espera: restantes === 0 ? Math.ceil((it.hasta - ahora) / 1e3) : 0 };
      }
      function sinIntentos(cfg, ...claves) {
        const o = Object.assign({}, cfg.intentos);
        claves.forEach((c) => delete o[c]);
        return o;
      }
      async function fallar(ctx, cfg, clave, code, msg) {
        const f = registrarFallo(cfg, clave, ctx.ahora);
        const tx = nuevaTx();
        tx.config = { intentos: f.intentos };
        tx.sinRev = true;
        await ctx.repo.commit(tx);
        if (f.restantes === 0) throw new ApiError2(423, "bloqueado", "Demasiados intentos. Espera " + fmtEspera(f.espera) + " para volver a intentar.", { espera: f.espera });
        throw new ApiError2(401, code, msg + " Te quedan " + f.restantes + (f.restantes === 1 ? " intento." : " intentos."), { restantes: f.restantes });
      }
      const nuevaTx = () => ({
        config: {},
        configInsert: null,
        guardas: [],
        productosInsert: [],
        productosUpdate: [],
        stock: [],
        movs: [],
        movsAnulados: [],
        traspasos: [],
        pedidos: [],
        sinRev: false
      });
      async function ping(ctx) {
        const cfg = await cargarCfg(ctx);
        return ok({
          servidor: ctx.servidor !== false,
          version: VERSION,
          configurado: cfg.configurado,
          negocio: cfg.negocio.nombre,
          requiereClave: !cfg.configurado && !!ctx.claveInstalacion
        });
      }
      function nombreBase(m, t) {
        return "Base " + m.nombre + " \xB7 " + t.nombre;
      }
      function filaProducto(ahora, d) {
        return Object.assign({
          id: uid("p"),
          nombre: "",
          cat: "base",
          medida: "",
          tono: "",
          unidad: "pza",
          precio: 0,
          costo: 0,
          min_local: 0,
          min_tienda: 0,
          activo: 1,
          stock_local: 0,
          stock_tienda: 0,
          hubo_local: 0,
          hubo_tienda: 0,
          creado: ahora,
          actualizado: ahora
        }, d);
      }
      async function setup(ctx) {
        const cfg = await cargarCfg(ctx);
        if (cfg.configurado) throw new ApiError2(409, "ya_configurado", "Este inventario ya est\xE1 configurado. Entra con tu PIN.");
        const b = ctx.req.body || {};
        if (ctx.claveInstalacion && !ctx.demo) {
          chequearBloqueo(cfg, "setup", ctx.ahora);
          if (!normCodigo(b.clave) || !igual(normCodigo(b.clave), normCodigo(ctx.claveInstalacion))) await fallar(ctx, cfg, "setup", "clave_instalacion", "La clave de instalaci\xF3n no es correcta.");
        }
        const pinL = String(b.pinLocal || ""), pinT = String(b.pinTienda || "");
        if (!ctx.demo) {
          validarPin(pinL);
          validarPin(pinT);
        }
        if (pinL === pinT) throw bad("pin_igual", "Cada usuario necesita un PIN distinto.");
        const nombre = clean(b.nombre, 60) || "Bases Box Tepic";
        const codigo = codigoRecuperacion();
        const acceso = { local: nuevoAcceso(pinL), tienda: nuevoAcceso(pinT), recup: nuevoAcceso(normCodigo(codigo)) };
        const medidas = clonar(MEDIDAS_BASE), tonos = clonar(TONOS_BASE);
        const cat = b.catalogo || {};
        const tx = nuevaTx();
        if (cat.bases) {
          medidas.forEach((m) => tonos.forEach((t) => {
            tx.productosInsert.push(filaProducto(ctx.ahora, { nombre: nombreBase(m, t), cat: "base", medida: m.id, tono: t.id, min_local: 2, min_tienda: 1 }));
          }));
        }
        if (cat.extras) {
          EXTRAS_BASE.forEach((e) => tx.productosInsert.push(filaProducto(ctx.ahora, { nombre: e.nombre, cat: e.cat, unidad: e.unidad, min_local: e.cat === "material" ? 5 : 2 })));
        }
        tx.configInsert = { configurado: true };
        tx.config = { negocio: { nombre, telLocal: "", telTienda: "" }, medidas, tonos, acceso, secret: aleatorioHex(32), intentos: {} };
        await ctx.repo.commit(tx);
        const nueva = normalizarCfg(await ctx.repo.config());
        return ok({ token: firmar(nueva, "local", ctx.ahora), rol: "local", codigo });
      }
      async function login(ctx) {
        const cfg = await cargarCfg(ctx);
        if (!cfg.configurado) throw new ApiError2(409, "no_configurado", "Este inventario todav\xEDa no est\xE1 configurado.");
        const b = ctx.req.body || {};
        const rol = b.rol;
        if (!ROLES.includes(rol)) throw bad("rol_invalido", "Elige qui\xE9n eres.");
        chequearBloqueo(cfg, rol, ctx.ahora);
        const acc = cfg.acceso[rol];
        if (!acc || !igual(hashPin(acc.salt, String(b.pin || "")), acc.hash)) await fallar(ctx, cfg, rol, "pin_incorrecto", "PIN incorrecto.");
        if (cfg.intentos[rol]) {
          const tx = nuevaTx();
          tx.config = { intentos: sinIntentos(cfg, rol) };
          tx.sinRev = true;
          await ctx.repo.commit(tx);
        }
        return ok({ token: firmar(cfg, rol, ctx.ahora), rol });
      }
      async function recuperar(ctx) {
        const cfg = await cargarCfg(ctx);
        if (!cfg.configurado) throw new ApiError2(409, "no_configurado", "Este inventario todav\xEDa no est\xE1 configurado.");
        const b = ctx.req.body || {};
        const rol = b.rol, pin = String(b.pin || "");
        if (!ROLES.includes(rol)) throw bad("rol_invalido", "Elige de qui\xE9n es el PIN.");
        validarPin(pin);
        chequearBloqueo(cfg, "recup", ctx.ahora);
        const rec = cfg.acceso.recup;
        if (!rec || !igual(hashPin(rec.salt, normCodigo(b.codigo)), rec.hash)) await fallar(ctx, cfg, "recup", "codigo_incorrecto", "C\xF3digo de recuperaci\xF3n incorrecto.");
        const otro = cfg.acceso[rol === "local" ? "tienda" : "local"];
        if (otro && igual(hashPin(otro.salt, pin), otro.hash)) throw bad("pin_igual", "Cada usuario necesita un PIN distinto.");
        const codigo = codigoRecuperacion();
        const acceso = Object.assign({}, cfg.acceso, {
          [rol]: nuevoAcceso(pin, (cfg.acceso[rol] && cfg.acceso[rol].v || 0) + 1),
          recup: nuevoAcceso(normCodigo(codigo))
        });
        const tx = nuevaTx();
        tx.config = { acceso, intentos: sinIntentos(cfg, "recup", rol) };
        await ctx.repo.commit(tx);
        return ok({ token: firmar(Object.assign({}, cfg, { acceso }), rol, ctx.ahora), rol, codigo });
      }
      function resumenVentas(filas, ahora, tz) {
        const hoyK = diaKey(ahora, tz), mesK = hoyK.slice(0, 7);
        const hoy = { total: 0, pzas: 0, n: 0 }, mes = { total: 0, pzas: 0, n: 0 };
        const hoyG = /* @__PURE__ */ new Set(), mesG = /* @__PURE__ */ new Set();
        const dias = [], idxDia = {};
        for (let i = 6; i >= 0; i--) {
          const k = diaKey(ahora - i * DIA, tz);
          idxDia[k] = dias.length;
          dias.push({ k, total: 0, pzas: 0 });
        }
        const top = {};
        filas.forEach((r) => {
          const pzas = -r.delta, monto = pzas * (r.precio || 0);
          const k = diaKey(r.ts, tz);
          if (k === hoyK) {
            hoy.total += monto;
            hoy.pzas += pzas;
            if (r.tipo === "venta") hoyG.add(r.grupo);
          }
          if (k.slice(0, 7) === mesK) {
            mes.total += monto;
            mes.pzas += pzas;
            if (r.tipo === "venta") mesG.add(r.grupo);
          }
          if (k in idxDia) {
            dias[idxDia[k]].total += monto;
            dias[idxDia[k]].pzas += pzas;
          }
          if (r.ts >= ahora - 30 * DIA) {
            const t = top[r.prod] || (top[r.prod] = { id: r.prod, pzas: 0, total: 0 });
            t.pzas += pzas;
            t.total += monto;
          }
        });
        hoy.n = hoyG.size;
        mes.n = mesG.size;
        const redondear = (o) => {
          o.total = Math.round(o.total * 100) / 100;
          return o;
        };
        return {
          hoy: redondear(hoy),
          mes: redondear(mes),
          dias: dias.map(redondear),
          top: Object.values(top).filter((t) => t.pzas > 0).sort((a, b) => b.pzas - a.pzas).slice(0, 5).map(redondear)
        };
      }
      async function armarEstado(ctx) {
        const { repo, ahora, rol } = ctx;
        const [raw, prods, trasp, peds, ventas, rec] = await Promise.all([
          repo.config(),
          repo.productos(),
          repo.traspasos({ desde: ahora - 30 * DIA }),
          repo.pedidos({ desde: ahora - 30 * DIA }),
          repo.ventas(ahora - 35 * DIA),
          repo.movs({ limite: 40 })
        ]);
        const cfg = normalizarCfg(raw);
        const productos = prods.map((p) => {
          const o = Object.assign({}, p);
          if (rol !== "local") delete o.costo;
          return o;
        });
        const est = {
          rev: cfg.rev,
          ahora,
          rol,
          version: VERSION,
          negocio: cfg.negocio,
          medidas: cfg.medidas,
          tonos: cfg.tonos,
          productos,
          traspasos: trasp,
          pedidos: peds,
          resumen: resumenVentas(ventas, ahora, ctx.tz),
          recientes: rec.items
        };
        if (ctx.exp && ctx.exp - ahora < SESION_DIAS / 2 * DIA) est.token = firmar(cfg, rol, ahora);
        return est;
      }
      async function listarMovs(ctx) {
        const q = ctx.req.query || {};
        return ctx.repo.movs({
          limite: Math.min(Math.max(parseInt(q.limite, 10) || 60, 1), 500),
          antes: q.antes ? String(q.antes) : null,
          desde: Number(q.desde) || 0,
          hasta: Number(q.hasta) || 0,
          prods: q.prods ? String(q.prods).split(",").slice(0, 40) : null,
          tipos: q.tipos ? String(q.tipos).split(",").slice(0, 12) : null,
          rol: ROLES.includes(q.rol) ? q.rol : null,
          anulaciones: q.anulaciones === "1"
        });
      }
      const indexar = (arr) => arr.reduce((o, x) => {
        o[x.id] = x;
        return o;
      }, {});
      const stockDe = (p, loc) => loc === "local" ? p.stock_local : p.stock_tienda;
      const nombreLoc = (loc) => loc === "local" ? "el almac\xE9n" : "la tienda";
      const deltaStock = (id, loc, delta) => ({ id, dl: loc === "local" ? delta : 0, dt: loc === "tienda" ? delta : 0 });
      function revisarStock(p, loc, delta) {
        if (stockDe(p, loc) + delta < 0) {
          throw new ApiError2(409, "stock_insuficiente", "No alcanza " + p.nombre + ": en " + nombreLoc(loc) + " hay " + stockDe(p, loc) + ".");
        }
      }
      function lineas(raw, campo, min) {
        campo = campo || "cant";
        if (!Array.isArray(raw) || !raw.length) throw bad("sin_lineas", "Agrega al menos un producto.");
        if (raw.length > MAX_LINEAS) throw bad("muchas_lineas", "M\xE1ximo " + MAX_LINEAS + " productos por operaci\xF3n. Haz otra operaci\xF3n con el resto.");
        const vistos = /* @__PURE__ */ new Set();
        return raw.map((r) => {
          if (!r || typeof r !== "object") throw bad("linea_invalida", "Hay una l\xEDnea vac\xEDa.");
          const id = clean(r.id, 40);
          if (!id || vistos.has(id)) throw bad("linea_invalida", "Hay un producto repetido o vac\xEDo.");
          vistos.add(id);
          const cant = Number(r[campo]);
          if (!Number.isInteger(cant) || cant < (min == null ? 1 : min) || cant > 99999) throw bad("cantidad_invalida", "Las cantidades deben ser n\xFAmeros enteros" + (min === 0 ? "." : " de 1 en adelante."));
          return { id, cant, precio: r.precio };
        });
      }
      function grupoDe(b, prefijo) {
        return typeof b.cid === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(b.cid) ? b.cid : uid(prefijo || "G");
      }
      function nuevoMov(ctx, grupo, i, p, loc, delta, tipo, extra) {
        return Object.assign({
          id: grupo + "-" + i,
          ts: ctx.ahora,
          prod: p.id,
          loc,
          delta,
          tipo,
          motivo: "",
          nota: "",
          rol: ctx.rol,
          precio: null,
          cliente: "",
          pago: "",
          grupo,
          ref: "",
          anulado: 0,
          anulado_ts: 0,
          anulado_por: "",
          anulado_nota: ""
        }, extra);
      }
      async function productoPorId(ctx, id) {
        const p = (await ctx.repo.productos()).find((x) => x.id === id);
        if (!p) throw new ApiError2(404, "producto_no_existe", "Ese producto ya no existe. Actualiza la pantalla.");
        return p;
      }
      function activoOError(p) {
        if (!p) throw new ApiError2(404, "producto_no_existe", "Un producto ya no existe. Actualiza la pantalla.");
        if (!p.activo) throw new ApiError2(409, "producto_archivado", p.nombre + " est\xE1 archivado.");
        return p;
      }
      const MOV_DEF = {
        entrada: { loc: "local", signo: 1, motivos: ["produccion", "compra", "otro"] },
        salida: { loc: "local", signo: -1, motivos: ["uso", "merma", "otro"] },
        venta: { loc: "tienda", signo: -1, precio: true },
        devolucion: { loc: "tienda", signo: 1, precio: true },
        merma: { loc: "tienda", signo: -1 }
      };
      async function opMovLineas(ctx, b, tx, tipo) {
        const def = MOV_DEF[tipo];
        const ls = lineas(b.lineas);
        const prods = indexar(await ctx.repo.productos());
        const grupo = grupoDe(b, tipo[0].toUpperCase());
        const extra = {
          motivo: def.motivos ? def.motivos.includes(b.motivo) ? b.motivo : "otro" : "",
          nota: clean(b.nota, 200),
          cliente: tipo === "venta" ? clean(b.cliente, 60) : "",
          pago: tipo === "venta" ? PAGOS.includes(b.pago) ? b.pago : "efectivo" : ""
        };
        let total = 0, piezas = 0;
        ls.forEach((l, i) => {
          const p = activoOError(prods[l.id]);
          const delta = def.signo * l.cant;
          revisarStock(p, def.loc, delta);
          const precio = def.precio ? numero(l.precio == null || l.precio === "" ? p.precio : l.precio, 0, 1e6, 0) : null;
          total += (precio || 0) * l.cant;
          piezas += l.cant;
          tx.stock.push(deltaStock(p.id, def.loc, delta));
          tx.movs.push(nuevoMov(ctx, grupo, i, p, def.loc, delta, tipo, Object.assign({ precio }, extra)));
        });
        return { grupo, total: Math.round(total * 100) / 100, piezas };
      }
      async function opConteo(ctx, b, tx) {
        const loc = ctx.rol;
        const ls = lineas(b.lineas, "contado", 0);
        const prods = indexar(await ctx.repo.productos());
        const grupo = grupoDe(b, "C");
        const nota = clean(b.nota, 200);
        let i = 0;
        ls.forEach((l) => {
          const p = activoOError(prods[l.id]);
          const actual = stockDe(p, loc), delta = l.cant - actual;
          if (!delta) return;
          tx.stock.push(deltaStock(p.id, loc, delta));
          tx.movs.push(nuevoMov(ctx, grupo, i++, p, loc, delta, "ajuste", { nota: ("Conteo: sistema " + actual + ", contado " + l.cant + (nota ? ". " + nota : "")).slice(0, 200) }));
        });
        if (!tx.movs.length) throw bad("sin_cambios", "El conteo coincide con el sistema. No hay nada que ajustar.");
        return { grupo, ajustes: tx.movs.length };
      }
      async function opAnular(ctx, b, tx) {
        const grupo = clean(b.grupo, 60), motivo = clean(b.motivo, 140);
        if (motivo.length < 3) throw bad("falta_motivo", "Escribe el motivo de la anulaci\xF3n.");
        const orig = (await ctx.repo.movsGrupo(grupo)).filter((m) => m.tipo !== "anulacion");
        if (!orig.length) throw new ApiError2(404, "no_existe", "No encontr\xE9 esa operaci\xF3n.");
        if (orig.some((m) => m.anulado)) throw new ApiError2(409, "ya_anulado", "Esa operaci\xF3n ya estaba anulada.");
        if (orig.some((m) => NO_ANULABLES.includes(m.tipo))) throw new ApiError2(409, "no_anulable", "Los traspasos se cancelan desde su tarjeta y el inventario inicial se corrige con un conteo.");
        if (ctx.rol !== "local" && orig.some((m) => m.rol !== ctx.rol)) throw new ApiError2(403, "sin_permiso", "Solo puedes anular operaciones de tu tienda.");
        const prods = indexar(await ctx.repo.productos());
        const acum = {};
        orig.forEach((m) => {
          const k = m.prod + "|" + m.loc;
          acum[k] = (acum[k] || 0) - m.delta;
        });
        Object.keys(acum).forEach((k) => {
          const [id, loc] = k.split("|");
          const p = prods[id];
          if (p && stockDe(p, loc) + acum[k] < 0) {
            throw new ApiError2(409, "no_se_puede_anular", "No se puede anular: ya no hay suficiente " + p.nombre + " en " + nombreLoc(loc) + " para deshacerlo.");
          }
        });
        const nuevo = uid("A");
        orig.forEach((m, i) => {
          tx.stock.push(deltaStock(m.prod, m.loc, -m.delta));
          tx.movs.push({
            id: nuevo + "-" + i,
            ts: ctx.ahora,
            prod: m.prod,
            loc: m.loc,
            delta: -m.delta,
            tipo: "anulacion",
            motivo: "",
            nota: motivo,
            rol: ctx.rol,
            precio: m.precio,
            cliente: "",
            pago: "",
            grupo: nuevo,
            ref: m.id,
            anulado: 0,
            anulado_ts: 0,
            anulado_por: "",
            anulado_nota: ""
          });
          tx.movsAnulados.push({ id: m.id, ts: ctx.ahora, por: ctx.rol, nota: motivo });
        });
        tx.guardas.push({ tipo: "grupo_sin_anular", grupo });
        return { grupo: nuevo, anulada: grupo };
      }
      async function opEnviar(ctx, b, tx) {
        const ls = lineas(b.lineas);
        const prods = indexar(await ctx.repo.productos());
        const id = grupoDe(b, "T");
        const nota = clean(b.nota, 200);
        let pedido = "";
        if (b.pedido) {
          const ped = await ctx.repo.pedido(clean(b.pedido, 60));
          if (!ped || ped.estado !== "pendiente") throw new ApiError2(409, "pedido_no_disponible", "Ese pedido ya no est\xE1 pendiente.");
          pedido = ped.id;
          tx.pedidos.push({ p: Object.assign({}, ped, { estado: "surtido", traspaso: id }), lineas: ped.lineas });
          tx.guardas.push({ tipo: "pedido_estado", id: ped.id, estado: "pendiente" });
        }
        let piezas = 0;
        ls.forEach((l, i) => {
          const p = activoOError(prods[l.id]);
          revisarStock(p, "local", -l.cant);
          piezas += l.cant;
          tx.stock.push(deltaStock(p.id, "local", -l.cant));
          tx.movs.push(nuevoMov(ctx, id, i, p, "local", -l.cant, "envio", { nota, ref: id }));
        });
        tx.traspasos.push({
          t: { id, ts: ctx.ahora, estado: "en_transito", nota, pedido, recibido_ts: 0, nota_recibo: "", dif: 0 },
          lineas: ls.map((l) => ({ id: l.id, cant: l.cant, recibida: 0 }))
        });
        return { id, piezas };
      }
      async function opRecibir(ctx, b, tx) {
        const t = await ctx.repo.traspaso(clean(b.id, 60));
        if (!t) throw new ApiError2(404, "no_existe", "No encontr\xE9 ese env\xEDo.");
        if (t.estado !== "en_transito") throw new ApiError2(409, "ya_resuelto", "Ese env\xEDo ya fue " + (t.estado === "recibido" ? "recibido." : "cancelado."));
        const dadas = {};
        (Array.isArray(b.lineas) ? b.lineas : []).forEach((l) => {
          dadas[clean(l && l.id, 40)] = l.recibida;
        });
        const prods = indexar(await ctx.repo.productos());
        const grupo = t.id + "r";
        const nota = clean(b.nota, 200);
        let dif = false, piezas = 0, i = 0;
        const lin = t.lineas.map((l) => {
          const r = dadas[l.id] === void 0 ? l.cant : Number(dadas[l.id]);
          if (!Number.isInteger(r) || r < 0 || r > l.cant) throw bad("cantidad_invalida", "Lo recibido debe estar entre 0 y lo enviado.");
          if (r !== l.cant) dif = true;
          return Object.assign({}, l, { recibida: r });
        });
        if (dif && nota.length < 3) throw bad("falta_nota", "Anota qu\xE9 pas\xF3 con la diferencia (faltante o da\xF1o).");
        lin.forEach((l) => {
          if (l.recibida < 1) return;
          const p = prods[l.id];
          if (!p) throw new ApiError2(404, "producto_no_existe", "Un producto ya no existe.");
          piezas += l.recibida;
          tx.stock.push(deltaStock(p.id, "tienda", l.recibida));
          tx.movs.push(nuevoMov(ctx, grupo, i++, p, "tienda", l.recibida, "recibo", { nota, ref: t.id }));
        });
        tx.traspasos.push({ t: Object.assign({}, t, { estado: "recibido", recibido_ts: ctx.ahora, nota_recibo: nota, dif: dif ? 1 : 0 }), lineas: lin });
        tx.guardas.push({ tipo: "traspaso_estado", id: t.id, estado: "en_transito" });
        return { id: t.id, piezas, dif };
      }
      async function opCancelar(ctx, b, tx) {
        const t = await ctx.repo.traspaso(clean(b.id, 60));
        if (!t) throw new ApiError2(404, "no_existe", "No encontr\xE9 ese env\xEDo.");
        if (t.estado !== "en_transito") throw new ApiError2(409, "ya_resuelto", "Ese env\xEDo ya fue " + (t.estado === "recibido" ? "recibido." : "cancelado."));
        const motivo = clean(b.motivo, 140);
        if (motivo.length < 3) throw bad("falta_motivo", "Escribe por qu\xE9 cancelas el env\xEDo.");
        const prods = indexar(await ctx.repo.productos());
        const grupo = t.id + "c";
        t.lineas.forEach((l, i) => {
          const p = prods[l.id];
          if (!p) return;
          tx.stock.push(deltaStock(p.id, "local", l.cant));
          tx.movs.push(nuevoMov(ctx, grupo, i, p, "local", l.cant, "envio_cancelado", { nota: motivo, ref: t.id }));
        });
        tx.traspasos.push({ t: Object.assign({}, t, { estado: "cancelado", nota_recibo: motivo }), lineas: t.lineas });
        tx.guardas.push({ tipo: "traspaso_estado", id: t.id, estado: "en_transito" });
        if (t.pedido) {
          const ped = await ctx.repo.pedido(t.pedido);
          if (ped && ped.estado === "surtido") tx.pedidos.push({ p: Object.assign({}, ped, { estado: "pendiente", traspaso: "" }), lineas: ped.lineas });
        }
        return { id: t.id };
      }
      async function opPedidoCrear(ctx, b, tx) {
        const ls = lineas(b.lineas);
        const prods = indexar(await ctx.repo.productos());
        ls.forEach((l) => activoOError(prods[l.id]));
        const id = grupoDe(b, "P");
        tx.pedidos.push({
          p: { id, ts: ctx.ahora, estado: "pendiente", nota: clean(b.nota, 200), traspaso: "" },
          lineas: ls.map((l) => ({ id: l.id, cant: l.cant, recibida: 0 }))
        });
        return { id, piezas: ls.reduce((s, l) => s + l.cant, 0) };
      }
      async function opPedidoCancelar(ctx, b, tx) {
        const ped = await ctx.repo.pedido(clean(b.id, 60));
        if (!ped) throw new ApiError2(404, "no_existe", "No encontr\xE9 ese pedido.");
        if (ped.estado !== "pendiente") throw new ApiError2(409, "ya_resuelto", "Ese pedido ya no est\xE1 pendiente.");
        tx.pedidos.push({ p: Object.assign({}, ped, { estado: "cancelado" }), lineas: ped.lineas });
        tx.guardas.push({ tipo: "pedido_estado", id: ped.id, estado: "pendiente" });
        return { id: ped.id };
      }
      function existeId(lista, id, que) {
        if (!id) return "";
        if (!lista.some((x) => x.id === id)) throw bad("catalogo", "La opci\xF3n de " + que + " elegida ya no existe en el cat\xE1logo.");
        return id;
      }
      async function opProductoCrear(ctx, b, tx) {
        const cfg = ctx.cfg;
        if (!CATS.includes(b.cat)) throw bad("categoria", "Elige una categor\xEDa.");
        const nombre = clean(b.nombre, 80);
        if (nombre.length < 2) throw bad("nombre", "Escribe el nombre del producto.");
        const prods = await ctx.repo.productos();
        if (prods.some((p3) => norm(p3.nombre) === norm(nombre))) throw new ApiError2(409, "duplicado", 'Ya existe un producto llamado "' + nombre + '".');
        const sl = entero(b.stock_local, 0, 99999, 0), st = entero(b.stock_tienda, 0, 99999, 0);
        const p = filaProducto(ctx.ahora, {
          nombre,
          cat: b.cat,
          medida: b.cat === "base" ? existeId(cfg.medidas, b.medida, "medida") : "",
          tono: b.cat === "base" ? existeId(cfg.tonos, b.tono, "tono") : "",
          unidad: clean(b.unidad, 12) || "pza",
          precio: numero(b.precio, 0, 1e6, 0),
          costo: numero(b.costo, 0, 1e6, 0),
          min_local: entero(b.min_local, 0, 9999, 0),
          min_tienda: entero(b.min_tienda, 0, 9999, 0),
          stock_local: sl,
          stock_tienda: st,
          hubo_local: sl > 0 ? 1 : 0,
          hubo_tienda: st > 0 ? 1 : 0
        });
        tx.productosInsert.push(p);
        const grupo = grupoDe(b, "I");
        let i = 0;
        if (sl > 0) tx.movs.push(nuevoMov(ctx, grupo, i++, p, "local", sl, "inicial", { nota: "Inventario inicial" }));
        if (st > 0) tx.movs.push(nuevoMov(ctx, grupo, i++, p, "tienda", st, "inicial", { nota: "Inventario inicial" }));
        return { id: p.id };
      }
      async function opVariantes(ctx, b, tx) {
        const cfg = ctx.cfg;
        const pick = (lista, ids) => (Array.isArray(ids) ? ids : []).map((id) => lista.find((x) => x.id === id)).filter(Boolean);
        const medidas = pick(cfg.medidas, b.medidas), tonos = pick(cfg.tonos, b.tonos);
        if (!medidas.length || !tonos.length) throw bad("sin_seleccion", "Elige al menos una medida y un tono.");
        if (medidas.length * tonos.length > 60) throw bad("demasiadas", "M\xE1ximo 60 productos a la vez.");
        const existentes = new Set((await ctx.repo.productos()).map((p) => norm(p.nombre)));
        const minL = entero(b.min_local, 0, 9999, 2), minT = entero(b.min_tienda, 0, 9999, 1);
        let creados = 0, omitidos = 0;
        medidas.forEach((m) => tonos.forEach((t) => {
          const nombre = nombreBase(m, t);
          if (existentes.has(norm(nombre))) {
            omitidos++;
            return;
          }
          tx.productosInsert.push(filaProducto(ctx.ahora, { nombre, cat: "base", medida: m.id, tono: t.id, precio: m.precio, min_local: minL, min_tienda: minT }));
          creados++;
        }));
        if (!creados) throw new ApiError2(409, "duplicado", "Todas esas bases ya existen.");
        return { creados, omitidos };
      }
      async function opProductoEditar(ctx, b, tx) {
        const prods = await ctx.repo.productos();
        const p = prods.find((x) => x.id === b.id);
        if (!p) throw new ApiError2(404, "producto_no_existe", "Ese producto ya no existe. Actualiza la pantalla.");
        const set = {};
        if (b.nombre !== void 0) {
          const n = clean(b.nombre, 80);
          if (n.length < 2) throw bad("nombre", "Escribe el nombre del producto.");
          if (prods.some((x) => x.id !== p.id && norm(x.nombre) === norm(n))) throw new ApiError2(409, "duplicado", 'Ya existe un producto llamado "' + n + '".');
          set.nombre = n;
        }
        if (b.unidad !== void 0) set.unidad = clean(b.unidad, 12) || "pza";
        if (b.precio !== void 0) set.precio = numero(b.precio, 0, 1e6, 0);
        if (b.costo !== void 0) set.costo = numero(b.costo, 0, 1e6, 0);
        if (b.min_local !== void 0) set.min_local = entero(b.min_local, 0, 9999, 0);
        if (b.min_tienda !== void 0) set.min_tienda = entero(b.min_tienda, 0, 9999, 0);
        if (p.cat === "base" && b.medida !== void 0) set.medida = existeId(ctx.cfg.medidas, b.medida, "medida");
        if (p.cat === "base" && b.tono !== void 0) set.tono = existeId(ctx.cfg.tonos, b.tono, "tono");
        if (!Object.keys(set).length) throw bad("sin_cambios", "No hay cambios que guardar.");
        set.actualizado = ctx.ahora;
        tx.productosUpdate.push({ id: p.id, set });
        return { id: p.id };
      }
      async function opProductoArchivar(ctx, b, tx) {
        const p = await productoPorId(ctx, b.id);
        const activo = b.activo ? 1 : 0;
        if (!activo) {
          if (p.stock_local || p.stock_tienda) {
            throw new ApiError2(409, "tiene_stock", "Primero deja en cero el stock de " + p.nombre + " (almac\xE9n " + p.stock_local + ", tienda " + p.stock_tienda + ").");
          }
          const enUso = (await ctx.repo.traspasos({ abiertos: true })).some((t) => t.lineas.some((l) => l.id === p.id)) || (await ctx.repo.pedidos({ abiertos: true })).some((x) => x.lineas.some((l) => l.id === p.id));
          if (enUso) throw new ApiError2(409, "en_uso", p.nombre + " est\xE1 en un env\xEDo o pedido pendiente. Resu\xE9lvelo primero.");
        }
        tx.productosUpdate.push({ id: p.id, set: { activo, actualizado: ctx.ahora } });
        return { id: p.id, activo };
      }
      function limpiarMedidas(arr) {
        if (!Array.isArray(arr) || !arr.length || arr.length > 20) throw bad("medidas", "Deja de 1 a 20 medidas.");
        const ids = /* @__PURE__ */ new Set();
        return arr.map((m) => {
          const id = m && /^[a-z0-9_-]{1,20}$/.test(m.id) ? m.id : "";
          const nombre = clean(m && m.nombre, 30);
          if (!id || ids.has(id) || !nombre) throw bad("medidas", "Cada medida necesita un nombre.");
          ids.add(id);
          return { id, nombre, dims: clean(m.dims, 24), precio: numero(m.precio, 0, 1e6, 0) };
        });
      }
      function limpiarTonos(arr) {
        if (!Array.isArray(arr) || !arr.length || arr.length > 40) throw bad("tonos", "Deja de 1 a 40 tonos.");
        const ids = /* @__PURE__ */ new Set();
        return arr.map((t) => {
          const id = t && /^[a-z0-9_-]{1,20}$/.test(t.id) ? t.id : "";
          const nombre = clean(t && t.nombre, 24);
          if (!id || ids.has(id) || !nombre || !/^#[0-9a-fA-F]{6}$/.test(t.hex)) throw bad("tonos", "Cada tono necesita nombre y color.");
          ids.add(id);
          return { id, nombre, hex: t.hex.toUpperCase() };
        });
      }
      async function opConfigGuardar(ctx, b, tx) {
        const cfg = ctx.cfg, patch = {};
        const prods = await ctx.repo.productos();
        if (b.negocio) {
          patch.negocio = {
            nombre: clean(b.negocio.nombre, 60) || cfg.negocio.nombre,
            telLocal: String(b.negocio.telLocal || "").replace(/\D/g, "").slice(0, 15),
            telTienda: String(b.negocio.telTienda || "").replace(/\D/g, "").slice(0, 15)
          };
        }
        if (b.medidas) {
          patch.medidas = limpiarMedidas(b.medidas);
          cfg.medidas.filter((m) => !patch.medidas.some((n) => n.id === m.id)).forEach((m) => {
            if (prods.some((p) => p.cat === "base" && p.medida === m.id)) throw new ApiError2(409, "en_uso", 'No puedes quitar la medida "' + m.nombre + '": hay productos que la usan.');
          });
        }
        if (b.tonos) {
          patch.tonos = limpiarTonos(b.tonos);
          cfg.tonos.filter((t) => !patch.tonos.some((n) => n.id === t.id)).forEach((t) => {
            if (prods.some((p) => p.cat === "base" && p.tono === t.id)) throw new ApiError2(409, "en_uso", 'No puedes quitar el tono "' + t.nombre + '": hay productos que lo usan.');
          });
        }
        if (Array.isArray(b.aplicarPrecios) && patch.medidas) {
          b.aplicarPrecios.forEach((mid) => {
            const m = patch.medidas.find((x) => x.id === mid);
            if (!m) return;
            prods.filter((p) => p.cat === "base" && p.medida === mid && p.precio !== m.precio).forEach((p) => tx.productosUpdate.push({ id: p.id, set: { precio: m.precio, actualizado: ctx.ahora } }));
          });
        }
        if (!Object.keys(patch).length) throw bad("sin_cambios", "No hay cambios que guardar.");
        tx.config = patch;
        return { actualizados: tx.productosUpdate.length };
      }
      async function opPinCambiar(ctx, b, tx) {
        const cfg = ctx.cfg, rol = ctx.rol;
        chequearBloqueo(cfg, rol, ctx.ahora);
        const acc = cfg.acceso[rol];
        if (!igual(hashPin(acc.salt, String(b.pinActual || "")), acc.hash)) await fallar(ctx, cfg, rol, "pin_incorrecto", "Tu PIN actual no coincide.");
        const nuevo = String(b.pinNuevo || "");
        validarPin(nuevo);
        const otro = cfg.acceso[rol === "local" ? "tienda" : "local"];
        if (otro && igual(hashPin(otro.salt, nuevo), otro.hash)) throw bad("pin_igual", "Cada usuario necesita un PIN distinto.");
        const acceso = Object.assign({}, cfg.acceso, { [rol]: nuevoAcceso(nuevo, acc.v + 1) });
        tx.config = { acceso, intentos: sinIntentos(cfg, rol) };
        return { token: firmar(Object.assign({}, cfg, { acceso }), rol, ctx.ahora) };
      }
      async function opPinReiniciar(ctx, b, tx) {
        const cfg = ctx.cfg;
        chequearBloqueo(cfg, "local", ctx.ahora);
        const acc = cfg.acceso.local;
        if (!igual(hashPin(acc.salt, String(b.pinActual || "")), acc.hash)) await fallar(ctx, cfg, "local", "pin_incorrecto", "Tu PIN no coincide.");
        const nuevo = String(b.pinNuevo || "");
        validarPin(nuevo);
        if (igual(hashPin(acc.salt, nuevo), acc.hash)) throw bad("pin_igual", "Cada usuario necesita un PIN distinto.");
        const t = cfg.acceso.tienda;
        const acceso = Object.assign({}, cfg.acceso, { tienda: nuevoAcceso(nuevo, (t && t.v || 0) + 1) });
        tx.config = { acceso, intentos: sinIntentos(cfg, "local", "tienda") };
        return {};
      }
      async function opRecupNueva(ctx, b, tx) {
        const cfg = ctx.cfg;
        chequearBloqueo(cfg, "local", ctx.ahora);
        const acc = cfg.acceso.local;
        if (!igual(hashPin(acc.salt, String(b.pinActual || "")), acc.hash)) await fallar(ctx, cfg, "local", "pin_incorrecto", "Tu PIN no coincide.");
        const codigo = codigoRecuperacion();
        tx.config = { acceso: Object.assign({}, cfg.acceso, { recup: nuevoAcceso(normCodigo(codigo)) }), intentos: sinIntentos(cfg, "local") };
        return { codigo };
      }
      const OPS = {
        "producto.crear": [["local"], opProductoCrear],
        "producto.variantes": [["local"], opVariantes],
        "producto.editar": [["local"], opProductoEditar],
        "producto.archivar": [["local"], opProductoArchivar],
        "mov.entrada": [["local"], (c, b, t) => opMovLineas(c, b, t, "entrada")],
        "mov.salida": [["local"], (c, b, t) => opMovLineas(c, b, t, "salida")],
        "mov.venta": [["tienda"], (c, b, t) => opMovLineas(c, b, t, "venta")],
        "mov.devolucion": [["tienda"], (c, b, t) => opMovLineas(c, b, t, "devolucion")],
        "mov.merma": [["tienda"], (c, b, t) => opMovLineas(c, b, t, "merma")],
        "mov.conteo": [["local", "tienda"], opConteo],
        "mov.anular": [["local", "tienda"], opAnular],
        "traspaso.enviar": [["local"], opEnviar],
        "traspaso.recibir": [["tienda"], opRecibir],
        "traspaso.cancelar": [["local"], opCancelar],
        "pedido.crear": [["tienda"], opPedidoCrear],
        "pedido.cancelar": [["local", "tienda"], opPedidoCancelar],
        "config.guardar": [["local"], opConfigGuardar],
        "pin.cambiar": [["local", "tienda"], opPinCambiar],
        "pin.reiniciar": [["local"], opPinReiniciar],
        "recup.nueva": [["local"], opRecupNueva]
      };
      async function correrOp(ctx, body) {
        const def = OPS[body && body.op];
        if (!def) throw bad("op_invalida", "Operaci\xF3n desconocida.");
        if (!def[0].includes(ctx.rol)) throw new ApiError2(403, "sin_permiso", def[0][0] === "local" ? "Esta acci\xF3n es del almac\xE9n." : "Esta acci\xF3n es del vendedor de la tienda.");
        const tx = nuevaTx();
        const resultado = await def[1](ctx, body, tx) || {};
        await ctx.repo.commit(tx);
        return resultado;
      }
      async function handle(repo, req, opts) {
        opts = opts || {};
        const ahora = opts.now || Date.now();
        const ctx = { repo, ahora, req: req || {}, tz: tzDe(req && req.query), servidor: opts.servidor, demo: !!opts.demo, claveInstalacion: opts.claveInstalacion || "" };
        try {
          const path = String(ctx.req.path || "/").replace(/\/+$/, "") || "/";
          const m = String(ctx.req.method || "GET").toUpperCase();
          if (path === "/ping" && m === "GET") return await ping(ctx);
          if (path === "/setup" && m === "POST") return await setup(ctx);
          if (path === "/login" && m === "POST") return await login(ctx);
          if (path === "/recuperar" && m === "POST") return await recuperar(ctx);
          const cfg = await cargarCfg(ctx);
          if (!cfg.configurado) throw new ApiError2(409, "no_configurado", "Este inventario todav\xEDa no est\xE1 configurado.");
          const au = verificar(cfg, ctx.req.token, ahora);
          ctx.rol = au.rol;
          ctx.exp = au.exp;
          if (path === "/rev" && m === "GET") return ok({ rev: cfg.rev });
          if (path === "/estado" && m === "GET") return ok(await armarEstado(ctx));
          if (path === "/movs" && m === "GET") return ok(await listarMovs(ctx));
          if (path === "/op" && m === "POST") {
            const resultado = await correrOp(ctx, ctx.req.body);
            const extra = {};
            if (resultado.token) {
              extra.token = resultado.token;
              delete resultado.token;
            }
            const est = await armarEstado(ctx);
            return ok(Object.assign({ resultado, estado: est }, extra));
          }
          throw new ApiError2(404, "no_existe", "Ruta no encontrada.");
        } catch (e) {
          if (e instanceof ApiError2) return fail(e.status, e.code, e.message, e.extra);
          if (typeof console !== "undefined") console.error(e);
          return fail(500, "interno", "Algo fall\xF3 en el servidor. Intenta de nuevo.");
        }
      }
      function crearRepoLocal(almacen, clave) {
        const vacio = () => ({ v: 1, config: {}, productos: {}, movs: [], traspasos: {}, pedidos: {} });
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
          } catch (e) {
          }
          return vacio();
        }
        function guardar() {
          if (diferido) return;
          try {
            almacen.setItem(clave, JSON.stringify(S));
          } catch (e) {
            S = leer();
            ids = new Set(S.movs.map((m) => m.id));
            throw new ApiError2(507, "sin_espacio", "No hay espacio para guardar en este equipo. Exporta un respaldo y libera memoria.");
          }
        }
        const conLineas = (t) => t ? Object.assign({}, t, { lineas: t.lineas.map((l) => Object.assign({}, l)) }) : null;
        const porFecha = (a, b) => b.ts - a.ts || (a.id < b.id ? 1 : -1);
        return {
          async config() {
            return clonar(S.config);
          },
          async productos() {
            return Object.values(S.productos).map((p) => Object.assign({}, p));
          },
          async traspasos(f) {
            f = f || {};
            return Object.values(S.traspasos).filter((t) => f.abiertos ? t.estado === "en_transito" : t.estado === "en_transito" || t.ts >= (f.desde || 0)).sort(porFecha).slice(0, 80).map(conLineas);
          },
          async traspaso(id) {
            return conLineas(S.traspasos[id]);
          },
          async pedidos(f) {
            f = f || {};
            return Object.values(S.pedidos).filter((t) => f.abiertos ? t.estado === "pendiente" : t.estado === "pendiente" || t.ts >= (f.desde || 0)).sort(porFecha).slice(0, 80).map(conLineas);
          },
          async pedido(id) {
            return conLineas(S.pedidos[id]);
          },
          async movsGrupo(grupo) {
            return S.movs.filter((m) => m.grupo === grupo).map((m) => Object.assign({}, m));
          },
          async movs(f) {
            let arr = S.movs.filter((m) => {
              if (!f.anulaciones && m.tipo === "anulacion") return false;
              if (f.desde && m.ts < f.desde) return false;
              if (f.hasta && m.ts > f.hasta) return false;
              if (f.prods && !f.prods.includes(m.prod)) return false;
              if (f.tipos && !f.tipos.includes(m.tipo)) return false;
              if (f.rol && m.rol !== f.rol) return false;
              return true;
            }).sort(porFecha);
            if (f.antes) {
              const i = f.antes.indexOf("_"), ts = Number(f.antes.slice(0, i)), id = f.antes.slice(i + 1);
              arr = arr.filter((m) => m.ts < ts || m.ts === ts && m.id < id);
            }
            const items = arr.slice(0, f.limite).map((m) => Object.assign({}, m));
            const last = items[items.length - 1];
            return { items, siguiente: arr.length > f.limite && last ? last.ts + "_" + last.id : null };
          },
          async ventas(desde) {
            return S.movs.filter((m) => (m.tipo === "venta" || m.tipo === "devolucion") && !m.anulado && m.ts >= desde).map((m) => ({ ts: m.ts, prod: m.prod, delta: m.delta, precio: m.precio, grupo: m.grupo, tipo: m.tipo }));
          },
          async commit(tx) {
            (tx.guardas || []).forEach((g) => {
              if (g.tipo === "traspaso_estado" && (!S.traspasos[g.id] || S.traspasos[g.id].estado !== g.estado)) throw conflicto();
              if (g.tipo === "pedido_estado" && (!S.pedidos[g.id] || S.pedidos[g.id].estado !== g.estado)) throw conflicto();
              if (g.tipo === "grupo_sin_anular" && S.movs.some((m) => m.grupo === g.grupo && m.anulado)) throw conflicto();
            });
            if (tx.configInsert) Object.keys(tx.configInsert).forEach((k) => {
              if (k in S.config) throw new ApiError2(409, "ya_configurado", "Este inventario ya est\xE1 configurado.");
            });
            tx.movs.forEach((m) => {
              if (ids.has(m.id)) throw new ApiError2(409, "duplicado", "Esta operaci\xF3n ya se hab\xEDa guardado.");
            });
            const acum = {};
            tx.stock.forEach((s) => {
              const a = acum[s.id] || (acum[s.id] = [0, 0]);
              a[0] += s.dl;
              a[1] += s.dt;
            });
            Object.keys(acum).forEach((id) => {
              const p = S.productos[id];
              if (!p || p.stock_local + acum[id][0] < 0 || p.stock_tienda + acum[id][1] < 0) throw conflicto();
            });
            const antes = diferido ? null : JSON.stringify(S);
            try {
              if (tx.configInsert) Object.assign(S.config, tx.configInsert);
              Object.assign(S.config, tx.config);
              tx.productosInsert.forEach((p) => {
                S.productos[p.id] = Object.assign({}, p);
              });
              tx.productosUpdate.forEach((u) => {
                if (S.productos[u.id]) Object.assign(S.productos[u.id], u.set);
              });
              Object.keys(acum).forEach((id) => {
                const p = S.productos[id];
                p.stock_local += acum[id][0];
                p.stock_tienda += acum[id][1];
                if (p.stock_local > 0) p.hubo_local = 1;
                if (p.stock_tienda > 0) p.hubo_tienda = 1;
              });
              tx.movsAnulados.forEach((a) => {
                const m = S.movs.find((x) => x.id === a.id);
                if (m) Object.assign(m, { anulado: 1, anulado_ts: a.ts, anulado_por: a.por, anulado_nota: a.nota });
              });
              tx.movs.forEach((m) => {
                S.movs.push(Object.assign({}, m));
                ids.add(m.id);
              });
              tx.traspasos.forEach((x) => {
                S.traspasos[x.t.id] = Object.assign({}, x.t, { lineas: x.lineas.map((l) => Object.assign({}, l)) });
              });
              tx.pedidos.forEach((x) => {
                S.pedidos[x.p.id] = Object.assign({}, x.p, { lineas: x.lineas.map((l) => Object.assign({}, l)) });
              });
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
          recargar() {
            S = leer();
            ids = new Set(S.movs.map((m) => m.id));
          },
          async diferir(fn) {
            diferido = true;
            try {
              return await fn();
            } finally {
              diferido = false;
              guardar();
            }
          },
          borrar() {
            S = vacio();
            ids = /* @__PURE__ */ new Set();
            try {
              almacen.removeItem(clave);
            } catch (e) {
            }
          }
        };
      }
      function almacenMemoria() {
        const m = {};
        return {
          getItem: (k) => k in m ? m[k] : null,
          setItem: (k, v) => {
            m[k] = String(v);
          },
          removeItem: (k) => {
            delete m[k];
          }
        };
      }
      function mulberry32(a) {
        return function() {
          a |= 0;
          a = a + 1831565813 | 0;
          let t = Math.imul(a ^ a >>> 15, 1 | a);
          t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      }
      async function sembrarDemo(repo, opts) {
        opts = opts || {};
        const fin = opts.now || Date.now();
        const rnd = mulberry32(20261023);
        const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
        const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
        const medianoche = Math.floor((fin + TZ_DEFECTO * 6e4) / DIA) * DIA - TZ_DEFECTO * 6e4;
        const dia0 = medianoche - 27 * DIA;
        const hora = (d, h) => Math.min(dia0 + d * DIA + (h * 60 + entre(0, 40)) * 6e4, fin - 20 * 6e4);
        const inicio = dia0 - 36e5;
        let seq = 0;
        const cid = () => "demo" + (++seq).toString(36) + "x" + Math.floor(rnd() * 1e6).toString(36);
        const run = async (rol, body, ahora) => {
          const ctx = { repo, ahora, rol, cfg: normalizarCfg(await repo.config()), req: { body }, servidor: false, tz: TZ_DEFECTO };
          return correrOp(ctx, Object.assign({ cid: cid() }, body));
        };
        await repo.diferir(async () => {
          await handle(repo, {
            method: "POST",
            path: "/setup",
            body: { nombre: "Bases Box Tepic", pinLocal: "1111", pinTienda: "2222", catalogo: { bases: true, extras: true } }
          }, { now: inicio, demo: true, servidor: false });
          const precios = { ind: 2350, mat: 3100, qn: 3790, kg: 4650 };
          const cfg0 = normalizarCfg(await repo.config());
          await run("local", {
            op: "config.guardar",
            medidas: cfg0.medidas.map((m) => Object.assign({}, m, { precio: precios[m.id] || 0 })),
            aplicarPrecios: cfg0.medidas.map((m) => m.id)
          }, inicio);
          for (const p of await repo.productos()) {
            if (p.cat === "base") await run("local", { op: "producto.editar", id: p.id, costo: Math.round(precios[p.medida] * 0.62) }, inicio);
            else await run("local", { op: "producto.editar", id: p.id, precio: 0, costo: entre(60, 480) }, inicio);
          }
          const bases = (await repo.productos()).filter((p) => p.cat === "base");
          const extras = (await repo.productos()).filter((p) => p.cat !== "base");
          await run("local", { op: "mov.entrada", motivo: "produccion", lineas: bases.filter(() => rnd() < 0.7).slice(0, 15).map((p) => ({ id: p.id, cant: entre(3, 9) })) }, hora(0, 9));
          await run("local", { op: "mov.entrada", motivo: "compra", lineas: extras.map((p) => ({ id: p.id, cant: entre(8, 40) })) }, hora(0, 11));
          let pendiente = null;
          for (let d = 0; d < 28; d++) {
            const hoyEsFin = d === 27;
            const prods = await repo.productos();
            const basesNow = prods.filter((p) => p.cat === "base");
            if (d % 2 === 1) {
              const cand = basesNow.filter(() => rnd() < 0.25).slice(0, 5);
              if (cand.length) await run("local", { op: "mov.entrada", motivo: "produccion", lineas: cand.map((p) => ({ id: p.id, cant: entre(2, 6) })) }, hora(d, 11));
            }
            if (d % 9 === 4) {
              const mat = prods.filter((p) => p.cat === "material");
              await run("local", { op: "mov.entrada", motivo: "compra", lineas: mat.slice(0, 4).map((p) => ({ id: p.id, cant: entre(10, 30) })) }, hora(d, 12));
            }
            if (pendiente && d > pendiente.d && d < 26) {
              await run("tienda", { op: "traspaso.recibir", id: pendiente.id, lineas: [] }, hora(d, 9));
              pendiente = null;
            }
            if (d % 3 === 0 && d > 0) {
              const cand = basesNow.filter((p) => p.stock_local >= 3 && p.stock_tienda <= 3).slice(0, entre(3, 6));
              if (cand.length) {
                const r = await run("local", { op: "traspaso.enviar", nota: d % 6 === 0 ? "En la camioneta de la tarde" : "", lineas: cand.map((p) => ({ id: p.id, cant: Math.min(entre(2, 4), p.stock_local) })) }, hora(d, 15));
                pendiente = { id: r.id, d };
              }
            }
            const nv = d % 7 === 6 ? entre(3, 5) : entre(0, 3);
            for (let v = 0; v < nv; v++) {
              const disp = (await repo.productos()).filter((p) => p.cat === "base" && p.activo && p.stock_tienda > 0);
              if (!disp.length) break;
              const l1 = pick(disp);
              const lineas2 = [{ id: l1.id, cant: 1 }];
              if (rnd() < 0.2) {
                const l2 = pick(disp.filter((x) => x.id !== l1.id));
                if (l2) lineas2.push({ id: l2.id, cant: 1 });
              }
              await run("tienda", { op: "mov.venta", pago: pick(["efectivo", "efectivo", "transferencia", "tarjeta"]), cliente: rnd() < 0.3 ? pick(["Mostrador", "Familia R\xEDos", "Sra. Lupita", "Hotel Cielo"]) : "", lineas: lineas2 }, hora(d, 10 + v * 2));
            }
            if (d === 12) {
              const cand = (await repo.productos()).find((p) => p.cat === "base" && p.stock_tienda > 0);
              if (cand) await run("tienda", { op: "mov.merma", nota: "Se manch\xF3 en exhibici\xF3n", lineas: [{ id: cand.id, cant: 1 }] }, hora(d, 17));
            }
            void hoyEsFin;
          }
          const fin2 = await repo.productos();
          const bajos = fin2.filter((p) => p.cat === "base" && p.stock_tienda > 0).slice(0, 3);
          for (const p of bajos) await run("tienda", { op: "mov.conteo", nota: "Conteo de cierre", lineas: [{ id: p.id, contado: 0 }] }, fin - 100 * 6e4);
          const pedirP = fin2.filter((p) => p.cat === "base").slice(0, 2);
          await run("tienda", { op: "pedido.crear", nota: "Se est\xE1n acabando en tienda", lineas: pedirP.map((p) => ({ id: p.id, cant: 3 })) }, fin - 60 * 6e4);
        });
        return { local: "1111", tienda: "2222" };
      }
      return {
        VERSION,
        MAX_LINEAS,
        MEDIDAS_BASE,
        TONOS_BASE,
        EXTRAS_BASE,
        handle,
        crearRepoLocal,
        almacenMemoria,
        sembrarDemo,
        ApiError: ApiError2,
        // expuestos para pruebas
        sha256hex,
        hmacHex,
        resumenVentas,
        diaKey
      };
    });
  }
});

// ../../../../../tmp/bb-empaquetar-RZvLSz/archivos.js
var archivos_default = { "/apple-touch-icon.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"1acc6c85a28da7d51980"' }, "b64": "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" }, "/core.js": { "cabeceras": { "content-type": "text/javascript; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"cc2087a37fd758e25c4c"' }, "texto": `/* N\xFAcleo del inventario de Bases Box Tepic.
   Lo comparten el servidor (Cloudflare Pages Function + D1) y el modo local del navegador:
   mismas reglas, mismos permisos y mismo formato de respuesta.

   handle(repo, req) recibe la petici\xF3n ya traducida ({ method, path, query, body, token })
   y devuelve { status, json }. El repo es quien guarda: crearRepoLocal() aqu\xED mismo
   (localStorage) o crearRepoD1() en functions/_d1.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BBCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const DIA = 86400000;
  const ROLES = ['local', 'tienda'];
  const CATS = ['base', 'material', 'accesorio'];
  const PAGOS = ['efectivo', 'transferencia', 'tarjeta', 'otro'];
  const MAX_LINEAS = 60;
  const SESION_DIAS = 30;
  const TZ_DEFECTO = -420; // Tepic, Nayarit: UTC\u22127 todo el a\xF1o
  const NO_ANULABLES = ['envio', 'recibo', 'envio_cancelado', 'inicial', 'anulacion'];

  // Cat\xE1logo de arranque: las medidas y tonos que ya publica la web de Bases Box Tepic.
  const MEDIDAS_BASE = [
    { id: 'ind', nombre: 'Individual', dims: '1.00 \xD7 1.90 m', precio: 0 },
    { id: 'mat', nombre: 'Matrimonial', dims: '1.35 \xD7 1.90 m', precio: 0 },
    { id: 'qn', nombre: 'Queen', dims: '1.50 \xD7 2.00 m', precio: 0 },
    { id: 'kg', nombre: 'King', dims: '2.00 \xD7 2.00 m', precio: 0 }
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
  const conflicto = () => new ApiError(409, 'conflicto', 'El inventario cambi\xF3 mientras guardabas. Ya se actualiz\xF3 la pantalla; revisa e intenta de nuevo.');
  const ok = (data) => ({ status: 200, json: Object.assign({ ok: true }, data) });
  const fail = (status, code, mensaje, extra) => ({ status, json: { ok: false, error: Object.assign({ code, mensaje }, extra) } });

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 utilidades

  const clean = (s, max) => String(s == null ? '' : s).replace(/\\s+/g, ' ').trim().slice(0, max);
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().trim();
  const p2 = (n) => (n < 10 ? '0' : '') + n;

  function numero(v, min, max, def) {
    if (v === '' || v == null) return def;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw bad('numero_invalido', 'Revisa los n\xFAmeros: deben estar entre ' + min + ' y ' + max + '.');
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

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 hash y firma (SHA-256 / HMAC en JS puro: funciona igual en Workers, navegador y Node,
  // incluso en p\xE1ginas sin HTTPS donde crypto.subtle no existe)

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
  const b64u = (s) => btoa(s).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
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
  function validarPin(pin) {
    if (!/^\\d{4,8}$/.test(pin)) throw bad('pin_formato', 'El PIN debe tener de 4 a 8 n\xFAmeros.');
    if (/^(\\d)\\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) throw bad('pin_debil', 'Ese PIN es muy f\xE1cil de adivinar. Elige otro.');
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 configuraci\xF3n y sesi\xF3n

  function normalizarCfg(raw) {
    raw = raw || {};
    return {
      configurado: !!raw.configurado,
      negocio: Object.assign({ nombre: 'Bases Box Tepic', telLocal: '', telTienda: '' }, raw.negocio),
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
    const sinSesion = () => new ApiError(401, 'sin_sesion', 'Tu sesi\xF3n termin\xF3. Entra de nuevo con tu PIN.');
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

  // Bloqueo por intentos fallidos: 5 fallos = 5 min, y cada bloqueo siguiente dura el triple (tope 24 h).
  function chequearBloqueo(cfg, clave, ahora) {
    const it = cfg.intentos[clave];
    if (it && it.hasta > ahora) {
      const espera = Math.ceil((it.hasta - ahora) / 1000);
      throw new ApiError(423, 'bloqueado', 'Demasiados intentos. Espera ' + fmtEspera(espera) + ' para volver a intentar.', { espera });
    }
  }
  function registrarFallo(cfg, clave, ahora) {
    const it = Object.assign({ n: 0, b: 0, hasta: 0 }, cfg.intentos[clave]);
    it.n += 1;
    let restantes = 5 - it.n;
    if (it.n >= 5) {
      it.b += 1;
      it.n = 0;
      it.hasta = ahora + Math.min(DIA, 5 * 60000 * Math.pow(3, it.b - 1));
      restantes = 0;
    }
    return { intentos: Object.assign({}, cfg.intentos, { [clave]: it }), restantes, espera: restantes === 0 ? Math.ceil((it.hasta - ahora) / 1000) : 0 };
  }
  function sinIntentos(cfg, ...claves) {
    const o = Object.assign({}, cfg.intentos);
    claves.forEach((c) => delete o[c]);
    return o;
  }
  async function fallar(ctx, cfg, clave, code, msg) {
    const f = registrarFallo(cfg, clave, ctx.ahora);
    const tx = nuevaTx();
    tx.config = { intentos: f.intentos };
    tx.sinRev = true;
    await ctx.repo.commit(tx);
    if (f.restantes === 0) throw new ApiError(423, 'bloqueado', 'Demasiados intentos. Espera ' + fmtEspera(f.espera) + ' para volver a intentar.', { espera: f.espera });
    throw new ApiError(401, code, msg + ' Te quedan ' + f.restantes + (f.restantes === 1 ? ' intento.' : ' intentos.'), { restantes: f.restantes });
  }

  const nuevaTx = () => ({
    config: {}, configInsert: null, guardas: [], productosInsert: [], productosUpdate: [], stock: [], movs: [],
    movsAnulados: [], traspasos: [], pedidos: [], sinRev: false
  });

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 rutas p\xFAblicas: ping, setup, login, recuperar

  async function ping(ctx) {
    const cfg = await cargarCfg(ctx);
    return ok({
      servidor: ctx.servidor !== false, version: VERSION, configurado: cfg.configurado, negocio: cfg.negocio.nombre,
      requiereClave: !cfg.configurado && !!ctx.claveInstalacion
    });
  }

  function nombreBase(m, t) { return 'Base ' + m.nombre + ' \xB7 ' + t.nombre; }
  function filaProducto(ahora, d) {
    return Object.assign({
      id: uid('p'), nombre: '', cat: 'base', medida: '', tono: '', unidad: 'pza', precio: 0, costo: 0, min_local: 0, min_tienda: 0,
      activo: 1, stock_local: 0, stock_tienda: 0, hubo_local: 0, hubo_tienda: 0, creado: ahora, actualizado: ahora
    }, d);
  }

  async function setup(ctx) {
    const cfg = await cargarCfg(ctx);
    if (cfg.configurado) throw new ApiError(409, 'ya_configurado', 'Este inventario ya est\xE1 configurado. Entra con tu PIN.');
    const b = ctx.req.body || {};
    // Con SETUP_KEY definida en el servidor, nadie puede adue\xF1arse del inventario sin conocerla.
    if (ctx.claveInstalacion && !ctx.demo) {
      chequearBloqueo(cfg, 'setup', ctx.ahora);
      if (!normCodigo(b.clave) || !igual(normCodigo(b.clave), normCodigo(ctx.claveInstalacion))) await fallar(ctx, cfg, 'setup', 'clave_instalacion', 'La clave de instalaci\xF3n no es correcta.');
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
    if (!cfg.configurado) throw new ApiError(409, 'no_configurado', 'Este inventario todav\xEDa no est\xE1 configurado.');
    const b = ctx.req.body || {};
    const rol = b.rol;
    if (!ROLES.includes(rol)) throw bad('rol_invalido', 'Elige qui\xE9n eres.');
    chequearBloqueo(cfg, rol, ctx.ahora);
    const acc = cfg.acceso[rol];
    if (!acc || !igual(hashPin(acc.salt, String(b.pin || '')), acc.hash)) await fallar(ctx, cfg, rol, 'pin_incorrecto', 'PIN incorrecto.');
    if (cfg.intentos[rol]) {
      const tx = nuevaTx();
      tx.config = { intentos: sinIntentos(cfg, rol) };
      tx.sinRev = true;
      await ctx.repo.commit(tx);
    }
    return ok({ token: firmar(cfg, rol, ctx.ahora), rol });
  }

  async function recuperar(ctx) {
    const cfg = await cargarCfg(ctx);
    if (!cfg.configurado) throw new ApiError(409, 'no_configurado', 'Este inventario todav\xEDa no est\xE1 configurado.');
    const b = ctx.req.body || {};
    const rol = b.rol, pin = String(b.pin || '');
    if (!ROLES.includes(rol)) throw bad('rol_invalido', 'Elige de qui\xE9n es el PIN.');
    validarPin(pin);
    chequearBloqueo(cfg, 'recup', ctx.ahora);
    const rec = cfg.acceso.recup;
    if (!rec || !igual(hashPin(rec.salt, normCodigo(b.codigo)), rec.hash)) await fallar(ctx, cfg, 'recup', 'codigo_incorrecto', 'C\xF3digo de recuperaci\xF3n incorrecto.');
    const otro = cfg.acceso[rol === 'local' ? 'tienda' : 'local'];
    if (otro && igual(hashPin(otro.salt, pin), otro.hash)) throw bad('pin_igual', 'Cada usuario necesita un PIN distinto.');
    const codigo = codigoRecuperacion();
    const acceso = Object.assign({}, cfg.acceso, {
      [rol]: nuevoAcceso(pin, ((cfg.acceso[rol] && cfg.acceso[rol].v) || 0) + 1),
      recup: nuevoAcceso(normCodigo(codigo))
    });
    const tx = nuevaTx();
    tx.config = { acceso, intentos: sinIntentos(cfg, 'recup', rol) };
    await ctx.repo.commit(tx);
    return ok({ token: firmar(Object.assign({}, cfg, { acceso }), rol, ctx.ahora), rol, codigo });
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 estado para el cliente

  function resumenVentas(filas, ahora, tz) {
    const hoyK = diaKey(ahora, tz), mesK = hoyK.slice(0, 7);
    const hoy = { total: 0, pzas: 0, n: 0 }, mes = { total: 0, pzas: 0, n: 0 };
    const hoyG = new Set(), mesG = new Set();
    const dias = [], idxDia = {};
    for (let i = 6; i >= 0; i--) {
      const k = diaKey(ahora - i * DIA, tz);
      idxDia[k] = dias.length;
      dias.push({ k, total: 0, pzas: 0 });
    }
    const top = {};
    filas.forEach((r) => {
      const pzas = -r.delta, monto = pzas * (r.precio || 0);
      const k = diaKey(r.ts, tz);
      if (k === hoyK) { hoy.total += monto; hoy.pzas += pzas; if (r.tipo === 'venta') hoyG.add(r.grupo); }
      if (k.slice(0, 7) === mesK) { mes.total += monto; mes.pzas += pzas; if (r.tipo === 'venta') mesG.add(r.grupo); }
      if (k in idxDia) { dias[idxDia[k]].total += monto; dias[idxDia[k]].pzas += pzas; }
      if (r.ts >= ahora - 30 * DIA) {
        const t = top[r.prod] || (top[r.prod] = { id: r.prod, pzas: 0, total: 0 });
        t.pzas += pzas;
        t.total += monto;
      }
    });
    hoy.n = hoyG.size;
    mes.n = mesG.size;
    const redondear = (o) => { o.total = Math.round(o.total * 100) / 100; return o; };
    return {
      hoy: redondear(hoy), mes: redondear(mes), dias: dias.map(redondear),
      top: Object.values(top).filter((t) => t.pzas > 0).sort((a, b) => b.pzas - a.pzas).slice(0, 5).map(redondear)
    };
  }

  async function armarEstado(ctx) {
    const { repo, ahora, rol } = ctx;
    const [raw, prods, trasp, peds, ventas, rec] = await Promise.all([
      repo.config(), repo.productos(), repo.traspasos({ desde: ahora - 30 * DIA }), repo.pedidos({ desde: ahora - 30 * DIA }),
      repo.ventas(ahora - 35 * DIA), repo.movs({ limite: 40 })
    ]);
    const cfg = normalizarCfg(raw);
    const productos = prods.map((p) => {
      const o = Object.assign({}, p);
      if (rol !== 'local') delete o.costo;
      return o;
    });
    const est = {
      rev: cfg.rev, ahora, rol, version: VERSION, negocio: cfg.negocio, medidas: cfg.medidas, tonos: cfg.tonos,
      productos, traspasos: trasp, pedidos: peds, resumen: resumenVentas(ventas, ahora, ctx.tz), recientes: rec.items
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

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 operaciones

  const indexar = (arr) => arr.reduce((o, x) => { o[x.id] = x; return o; }, {});
  const stockDe = (p, loc) => (loc === 'local' ? p.stock_local : p.stock_tienda);
  const nombreLoc = (loc) => (loc === 'local' ? 'el almac\xE9n' : 'la tienda');
  const deltaStock = (id, loc, delta) => ({ id, dl: loc === 'local' ? delta : 0, dt: loc === 'tienda' ? delta : 0 });
  function revisarStock(p, loc, delta) {
    if (stockDe(p, loc) + delta < 0) {
      throw new ApiError(409, 'stock_insuficiente', 'No alcanza ' + p.nombre + ': en ' + nombreLoc(loc) + ' hay ' + stockDe(p, loc) + '.');
    }
  }
  function lineas(raw, campo, min) {
    campo = campo || 'cant';
    if (!Array.isArray(raw) || !raw.length) throw bad('sin_lineas', 'Agrega al menos un producto.');
    if (raw.length > MAX_LINEAS) throw bad('muchas_lineas', 'M\xE1ximo ' + MAX_LINEAS + ' productos por operaci\xF3n. Haz otra operaci\xF3n con el resto.');
    const vistos = new Set();
    return raw.map((r) => {
      if (!r || typeof r !== 'object') throw bad('linea_invalida', 'Hay una l\xEDnea vac\xEDa.');
      const id = clean(r.id, 40);
      if (!id || vistos.has(id)) throw bad('linea_invalida', 'Hay un producto repetido o vac\xEDo.');
      vistos.add(id);
      const cant = Number(r[campo]);
      if (!Number.isInteger(cant) || cant < (min == null ? 1 : min) || cant > 99999) throw bad('cantidad_invalida', 'Las cantidades deben ser n\xFAmeros enteros' + (min === 0 ? '.' : ' de 1 en adelante.'));
      return { id, cant, precio: r.precio };
    });
  }
  function grupoDe(b, prefijo) {
    return typeof b.cid === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(b.cid) ? b.cid : uid(prefijo || 'G');
  }
  function nuevoMov(ctx, grupo, i, p, loc, delta, tipo, extra) {
    return Object.assign({
      id: grupo + '-' + i, ts: ctx.ahora, prod: p.id, loc, delta, tipo, motivo: '', nota: '', rol: ctx.rol, precio: null,
      cliente: '', pago: '', grupo, ref: '', anulado: 0, anulado_ts: 0, anulado_por: '', anulado_nota: ''
    }, extra);
  }
  async function productoPorId(ctx, id) {
    const p = (await ctx.repo.productos()).find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'producto_no_existe', 'Ese producto ya no existe. Actualiza la pantalla.');
    return p;
  }
  function activoOError(p) {
    if (!p) throw new ApiError(404, 'producto_no_existe', 'Un producto ya no existe. Actualiza la pantalla.');
    if (!p.activo) throw new ApiError(409, 'producto_archivado', p.nombre + ' est\xE1 archivado.');
    return p;
  }

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
    let total = 0, piezas = 0;
    ls.forEach((l, i) => {
      const p = activoOError(prods[l.id]);
      const delta = def.signo * l.cant;
      revisarStock(p, def.loc, delta);
      const precio = def.precio ? numero(l.precio == null || l.precio === '' ? p.precio : l.precio, 0, 1e6, 0) : null;
      total += (precio || 0) * l.cant;
      piezas += l.cant;
      tx.stock.push(deltaStock(p.id, def.loc, delta));
      tx.movs.push(nuevoMov(ctx, grupo, i, p, def.loc, delta, tipo, Object.assign({ precio }, extra)));
    });
    return { grupo, total: Math.round(total * 100) / 100, piezas };
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
    if (motivo.length < 3) throw bad('falta_motivo', 'Escribe el motivo de la anulaci\xF3n.');
    const orig = (await ctx.repo.movsGrupo(grupo)).filter((m) => m.tipo !== 'anulacion');
    if (!orig.length) throw new ApiError(404, 'no_existe', 'No encontr\xE9 esa operaci\xF3n.');
    if (orig.some((m) => m.anulado)) throw new ApiError(409, 'ya_anulado', 'Esa operaci\xF3n ya estaba anulada.');
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
        rol: ctx.rol, precio: m.precio, cliente: '', pago: '', grupo: nuevo, ref: m.id, anulado: 0, anulado_ts: 0, anulado_por: '', anulado_nota: ''
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
      if (!ped || ped.estado !== 'pendiente') throw new ApiError(409, 'pedido_no_disponible', 'Ese pedido ya no est\xE1 pendiente.');
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
    if (!t) throw new ApiError(404, 'no_existe', 'No encontr\xE9 ese env\xEDo.');
    if (t.estado !== 'en_transito') throw new ApiError(409, 'ya_resuelto', 'Ese env\xEDo ya fue ' + (t.estado === 'recibido' ? 'recibido.' : 'cancelado.'));
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
    if (dif && nota.length < 3) throw bad('falta_nota', 'Anota qu\xE9 pas\xF3 con la diferencia (faltante o da\xF1o).');
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
    if (!t) throw new ApiError(404, 'no_existe', 'No encontr\xE9 ese env\xEDo.');
    if (t.estado !== 'en_transito') throw new ApiError(409, 'ya_resuelto', 'Ese env\xEDo ya fue ' + (t.estado === 'recibido' ? 'recibido.' : 'cancelado.'));
    const motivo = clean(b.motivo, 140);
    if (motivo.length < 3) throw bad('falta_motivo', 'Escribe por qu\xE9 cancelas el env\xEDo.');
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
    tx.pedidos.push({
      p: { id, ts: ctx.ahora, estado: 'pendiente', nota: clean(b.nota, 200), traspaso: '' },
      lineas: ls.map((l) => ({ id: l.id, cant: l.cant, recibida: 0 }))
    });
    return { id, piezas: ls.reduce((s, l) => s + l.cant, 0) };
  }

  async function opPedidoCancelar(ctx, b, tx) {
    const ped = await ctx.repo.pedido(clean(b.id, 60));
    if (!ped) throw new ApiError(404, 'no_existe', 'No encontr\xE9 ese pedido.');
    if (ped.estado !== 'pendiente') throw new ApiError(409, 'ya_resuelto', 'Ese pedido ya no est\xE1 pendiente.');
    tx.pedidos.push({ p: Object.assign({}, ped, { estado: 'cancelado' }), lineas: ped.lineas });
    tx.guardas.push({ tipo: 'pedido_estado', id: ped.id, estado: 'pendiente' });
    return { id: ped.id };
  }

  // \u2500\u2500 cat\xE1logo

  function existeId(lista, id, que) {
    if (!id) return '';
    if (!lista.some((x) => x.id === id)) throw bad('catalogo', 'La opci\xF3n de ' + que + ' elegida ya no existe en el cat\xE1logo.');
    return id;
  }

  async function opProductoCrear(ctx, b, tx) {
    const cfg = ctx.cfg;
    if (!CATS.includes(b.cat)) throw bad('categoria', 'Elige una categor\xEDa.');
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
    if (medidas.length * tonos.length > 60) throw bad('demasiadas', 'M\xE1ximo 60 productos a la vez.');
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
        throw new ApiError(409, 'tiene_stock', 'Primero deja en cero el stock de ' + p.nombre + ' (almac\xE9n ' + p.stock_local + ', tienda ' + p.stock_tienda + ').');
      }
      const enUso = (await ctx.repo.traspasos({ abiertos: true })).some((t) => t.lineas.some((l) => l.id === p.id)) ||
        (await ctx.repo.pedidos({ abiertos: true })).some((x) => x.lineas.some((l) => l.id === p.id));
      if (enUso) throw new ApiError(409, 'en_uso', p.nombre + ' est\xE1 en un env\xEDo o pedido pendiente. Resu\xE9lvelo primero.');
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

  async function opConfigGuardar(ctx, b, tx) {
    const cfg = ctx.cfg, patch = {};
    const prods = await ctx.repo.productos();
    if (b.negocio) {
      patch.negocio = {
        nombre: clean(b.negocio.nombre, 60) || cfg.negocio.nombre,
        telLocal: String(b.negocio.telLocal || '').replace(/\\D/g, '').slice(0, 15),
        telTienda: String(b.negocio.telTienda || '').replace(/\\D/g, '').slice(0, 15)
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
    chequearBloqueo(cfg, rol, ctx.ahora);
    const acc = cfg.acceso[rol];
    if (!igual(hashPin(acc.salt, String(b.pinActual || '')), acc.hash)) await fallar(ctx, cfg, rol, 'pin_incorrecto', 'Tu PIN actual no coincide.');
    const nuevo = String(b.pinNuevo || '');
    validarPin(nuevo);
    const otro = cfg.acceso[rol === 'local' ? 'tienda' : 'local'];
    if (otro && igual(hashPin(otro.salt, nuevo), otro.hash)) throw bad('pin_igual', 'Cada usuario necesita un PIN distinto.');
    const acceso = Object.assign({}, cfg.acceso, { [rol]: nuevoAcceso(nuevo, acc.v + 1) });
    tx.config = { acceso, intentos: sinIntentos(cfg, rol) };
    return { token: firmar(Object.assign({}, cfg, { acceso }), rol, ctx.ahora) };
  }

  async function opPinReiniciar(ctx, b, tx) {
    const cfg = ctx.cfg;
    chequearBloqueo(cfg, 'local', ctx.ahora);
    const acc = cfg.acceso.local;
    if (!igual(hashPin(acc.salt, String(b.pinActual || '')), acc.hash)) await fallar(ctx, cfg, 'local', 'pin_incorrecto', 'Tu PIN no coincide.');
    const nuevo = String(b.pinNuevo || '');
    validarPin(nuevo);
    if (igual(hashPin(acc.salt, nuevo), acc.hash)) throw bad('pin_igual', 'Cada usuario necesita un PIN distinto.');
    const t = cfg.acceso.tienda;
    const acceso = Object.assign({}, cfg.acceso, { tienda: nuevoAcceso(nuevo, ((t && t.v) || 0) + 1) });
    tx.config = { acceso, intentos: sinIntentos(cfg, 'local', 'tienda') };
    return {};
  }

  async function opRecupNueva(ctx, b, tx) {
    const cfg = ctx.cfg;
    chequearBloqueo(cfg, 'local', ctx.ahora);
    const acc = cfg.acceso.local;
    if (!igual(hashPin(acc.salt, String(b.pinActual || '')), acc.hash)) await fallar(ctx, cfg, 'local', 'pin_incorrecto', 'Tu PIN no coincide.');
    const codigo = codigoRecuperacion();
    tx.config = { acceso: Object.assign({}, cfg.acceso, { recup: nuevoAcceso(normCodigo(codigo)) }), intentos: sinIntentos(cfg, 'local') };
    return { codigo };
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
    'mov.conteo': [['local', 'tienda'], opConteo],
    'mov.anular': [['local', 'tienda'], opAnular],
    'traspaso.enviar': [['local'], opEnviar],
    'traspaso.recibir': [['tienda'], opRecibir],
    'traspaso.cancelar': [['local'], opCancelar],
    'pedido.crear': [['tienda'], opPedidoCrear],
    'pedido.cancelar': [['local', 'tienda'], opPedidoCancelar],
    'config.guardar': [['local'], opConfigGuardar],
    'pin.cambiar': [['local', 'tienda'], opPinCambiar],
    'pin.reiniciar': [['local'], opPinReiniciar],
    'recup.nueva': [['local'], opRecupNueva]
  };

  // Ejecuta una operaci\xF3n ya autenticada y la guarda de forma at\xF3mica.
  async function correrOp(ctx, body) {
    const def = OPS[body && body.op];
    if (!def) throw bad('op_invalida', 'Operaci\xF3n desconocida.');
    if (!def[0].includes(ctx.rol)) throw new ApiError(403, 'sin_permiso', def[0][0] === 'local' ? 'Esta acci\xF3n es del almac\xE9n.' : 'Esta acci\xF3n es del vendedor de la tienda.');
    const tx = nuevaTx();
    const resultado = (await def[1](ctx, body, tx)) || {};
    await ctx.repo.commit(tx);
    return resultado;
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 entrada \xFAnica

  async function handle(repo, req, opts) {
    opts = opts || {};
    const ahora = opts.now || Date.now();
    const ctx = { repo, ahora, req: req || {}, tz: tzDe(req && req.query), servidor: opts.servidor, demo: !!opts.demo, claveInstalacion: opts.claveInstalacion || '' };
    try {
      const path = String(ctx.req.path || '/').replace(/\\/+$/, '') || '/';
      const m = String(ctx.req.method || 'GET').toUpperCase();
      if (path === '/ping' && m === 'GET') return await ping(ctx);
      if (path === '/setup' && m === 'POST') return await setup(ctx);
      if (path === '/login' && m === 'POST') return await login(ctx);
      if (path === '/recuperar' && m === 'POST') return await recuperar(ctx);
      const cfg = await cargarCfg(ctx);
      if (!cfg.configurado) throw new ApiError(409, 'no_configurado', 'Este inventario todav\xEDa no est\xE1 configurado.');
      const au = verificar(cfg, ctx.req.token, ahora);
      ctx.rol = au.rol;
      ctx.exp = au.exp;
      if (path === '/rev' && m === 'GET') return ok({ rev: cfg.rev });
      if (path === '/estado' && m === 'GET') return ok(await armarEstado(ctx));
      if (path === '/movs' && m === 'GET') return ok(await listarMovs(ctx));
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
      return fail(500, 'interno', 'Algo fall\xF3 en el servidor. Intenta de nuevo.');
    }
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 repo local (localStorage o memoria): mismo contrato que el repo D1

  function crearRepoLocal(almacen, clave) {
    const vacio = () => ({ v: 1, config: {}, productos: {}, movs: [], traspasos: {}, pedidos: {} });
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
      } catch (e) { /* almac\xE9n vac\xEDo o ilegible: se empieza de cero */ }
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
      async productos() { return Object.values(S.productos).map((p) => Object.assign({}, p)); },
      async traspasos(f) {
        f = f || {};
        return Object.values(S.traspasos)
          .filter((t) => (f.abiertos ? t.estado === 'en_transito' : t.estado === 'en_transito' || t.ts >= (f.desde || 0)))
          .sort(porFecha).slice(0, 80).map(conLineas);
      },
      async traspaso(id) { return conLineas(S.traspasos[id]); },
      async pedidos(f) {
        f = f || {};
        return Object.values(S.pedidos)
          .filter((t) => (f.abiertos ? t.estado === 'pendiente' : t.estado === 'pendiente' || t.ts >= (f.desde || 0)))
          .sort(porFecha).slice(0, 80).map(conLineas);
      },
      async pedido(id) { return conLineas(S.pedidos[id]); },
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
          .map((m) => ({ ts: m.ts, prod: m.prod, delta: m.delta, precio: m.precio, grupo: m.grupo, tipo: m.tipo }));
      },
      async commit(tx) {
        // 1) verificar todo antes de tocar nada
        (tx.guardas || []).forEach((g) => {
          if (g.tipo === 'traspaso_estado' && (!S.traspasos[g.id] || S.traspasos[g.id].estado !== g.estado)) throw conflicto();
          if (g.tipo === 'pedido_estado' && (!S.pedidos[g.id] || S.pedidos[g.id].estado !== g.estado)) throw conflicto();
          if (g.tipo === 'grupo_sin_anular' && S.movs.some((m) => m.grupo === g.grupo && m.anulado)) throw conflicto();
        });
        if (tx.configInsert) Object.keys(tx.configInsert).forEach((k) => { if (k in S.config) throw new ApiError(409, 'ya_configurado', 'Este inventario ya est\xE1 configurado.'); });
        tx.movs.forEach((m) => { if (ids.has(m.id)) throw new ApiError(409, 'duplicado', 'Esta operaci\xF3n ya se hab\xEDa guardado.'); });
        const acum = {};
        tx.stock.forEach((s) => { const a = acum[s.id] || (acum[s.id] = [0, 0]); a[0] += s.dl; a[1] += s.dt; });
        Object.keys(acum).forEach((id) => {
          const p = S.productos[id];
          if (!p || p.stock_local + acum[id][0] < 0 || p.stock_tienda + acum[id][1] < 0) throw conflicto();
        });
        // 2) aplicar
        const antes = diferido ? null : JSON.stringify(S);
        try {
          if (tx.configInsert) Object.assign(S.config, tx.configInsert);
          Object.assign(S.config, tx.config);
          tx.productosInsert.forEach((p) => { S.productos[p.id] = Object.assign({}, p); });
          tx.productosUpdate.forEach((u) => { if (S.productos[u.id]) Object.assign(S.productos[u.id], u.set); });
          Object.keys(acum).forEach((id) => {
            const p = S.productos[id];
            p.stock_local += acum[id][0];
            p.stock_tienda += acum[id][1];
            if (p.stock_local > 0) p.hubo_local = 1; // \u201Chubo\u201D: alguna vez tuvo existencias; sin eso un producto nuevo en cero no es alerta
            if (p.stock_tienda > 0) p.hubo_tienda = 1;
          });
          tx.movsAnulados.forEach((a) => {
            const m = S.movs.find((x) => x.id === a.id);
            if (m) Object.assign(m, { anulado: 1, anulado_ts: a.ts, anulado_por: a.por, anulado_nota: a.nota });
          });
          tx.movs.forEach((m) => { S.movs.push(Object.assign({}, m)); ids.add(m.id); });
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
      borrar() { S = vacio(); ids = new Set(); try { almacen.removeItem(clave); } catch (e) { /* sin almac\xE9n */ } }
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

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 datos de demostraci\xF3n (solo modo local; el servidor nunca los siembra)

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
    // d\xEDa 0 = hace 27 d\xEDas; las horas son de Tepic (UTC\u22127) y nada queda en el futuro
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
      // Producci\xF3n y compras iniciales
      await run('local', { op: 'mov.entrada', motivo: 'produccion', lineas: bases.filter(() => rnd() < 0.7).slice(0, 15).map((p) => ({ id: p.id, cant: entre(3, 9) })) }, hora(0, 9));
      await run('local', { op: 'mov.entrada', motivo: 'compra', lineas: extras.map((p) => ({ id: p.id, cant: entre(8, 40) })) }, hora(0, 11));

      let pendiente = null;
      for (let d = 0; d < 28; d++) {
        const hoyEsFin = d === 27;
        const prods = await repo.productos();
        const basesNow = prods.filter((p) => p.cat === 'base');
        // f\xE1brica: producci\xF3n cada par de d\xEDas
        if (d % 2 === 1) {
          const cand = basesNow.filter(() => rnd() < 0.25).slice(0, 5);
          if (cand.length) await run('local', { op: 'mov.entrada', motivo: 'produccion', lineas: cand.map((p) => ({ id: p.id, cant: entre(2, 6) })) }, hora(d, 11));
        }
        if (d % 9 === 4) {
          const mat = prods.filter((p) => p.cat === 'material');
          await run('local', { op: 'mov.entrada', motivo: 'compra', lineas: mat.slice(0, 4).map((p) => ({ id: p.id, cant: entre(10, 30) })) }, hora(d, 12));
        }
        // la tienda recibe lo que se mand\xF3 el d\xEDa anterior (el \xFAltimo env\xEDo queda en camino)
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
        // tienda: ventas del d\xEDa
        const nv = d % 7 === 6 ? entre(3, 5) : entre(0, 3);
        for (let v = 0; v < nv; v++) {
          const disp = (await repo.productos()).filter((p) => p.cat === 'base' && p.activo && p.stock_tienda > 0);
          if (!disp.length) break;
          const l1 = pick(disp);
          const lineas2 = [{ id: l1.id, cant: 1 }];
          if (rnd() < 0.2) { const l2 = pick(disp.filter((x) => x.id !== l1.id)); if (l2) lineas2.push({ id: l2.id, cant: 1 }); }
          await run('tienda', { op: 'mov.venta', pago: pick(['efectivo', 'efectivo', 'transferencia', 'tarjeta']), cliente: rnd() < 0.3 ? pick(['Mostrador', 'Familia R\xEDos', 'Sra. Lupita', 'Hotel Cielo']) : '', lineas: lineas2 }, hora(d, 10 + v * 2));
        }
        if (d === 12) {
          const cand = (await repo.productos()).find((p) => p.cat === 'base' && p.stock_tienda > 0);
          if (cand) await run('tienda', { op: 'mov.merma', nota: 'Se manch\xF3 en exhibici\xF3n', lineas: [{ id: cand.id, cant: 1 }] }, hora(d, 17));
        }
        void hoyEsFin;
      }

      // Estado final para que el tablero muestre alertas y trabajo pendiente
      const fin2 = await repo.productos();
      const bajos = fin2.filter((p) => p.cat === 'base' && p.stock_tienda > 0).slice(0, 3);
      for (const p of bajos) await run('tienda', { op: 'mov.conteo', nota: 'Conteo de cierre', lineas: [{ id: p.id, contado: 0 }] }, fin - 100 * 60000);
      const pedirP = fin2.filter((p) => p.cat === 'base').slice(0, 2);
      await run('tienda', { op: 'pedido.crear', nota: 'Se est\xE1n acabando en tienda', lineas: pedirP.map((p) => ({ id: p.id, cant: 3 })) }, fin - 60 * 60000);
    });
    return { local: '1111', tienda: '2222' };
  }

  return {
    VERSION, MAX_LINEAS, MEDIDAS_BASE, TONOS_BASE, EXTRAS_BASE,
    handle, crearRepoLocal, almacenMemoria, sembrarDemo, ApiError,
    // expuestos para pruebas
    sha256hex, hmacHex, resumenVentas, diaKey
  };
});
` }, "/icon-192.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"320b41de409758534700"' }, "b64": "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" }, "/icon-512.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"db772ac6cdca77f069f9"' }, "b64": "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" }, "/icon-maskable-512.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"4a76c99c9b33a9f25c81"' }, "b64": "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" }, "/index.html": { "cabeceras": { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"309a803cd8d69e31e7ab"' }, "texto": `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>Inventario Bases Box</title>
<meta name="description" content="Inventario de Bases Box Tepic para el almac\xE9n y el vendedor de la tienda.">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#1A1A1A">
<meta name="color-scheme" content="light dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Inventario">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* Dise\xF1o: taller industrial. Grafito y naranja de la marca sobre papel c\xE1lido; Anton solo para el
   nombre y los t\xEDtulos de pantalla, Barlow Condensed para etiquetas y cifras grandes. En celular
   la navegaci\xF3n va abajo; desde 900 px pasa a una barra lateral. */
:root{
  --bg:#F4F2ED;--surface:#FFFFFF;--surface-2:#ECE9E2;--ink:#1A1A1A;--ink-2:#444C53;--muted:#66696C;
  --line:#DDD9D0;--line-2:#8E897D;
  --accent:#F2591F;--accent-ink:#1A1A1A;--accent-soft:#FCE6DB;--accent-text:#B63F0E;
  --rail:#1A1A1A;--rail-ink:#F4F2ED;--rail-muted:#A2A6A8;--rail-line:#333;
  --ok:#1B7339;--ok-soft:#DDF1E3;--warn:#8A5700;--warn-soft:#FBEAC4;--bad:#B3261E;--bad-soft:#F9DEDB;--info:#2A56A8;--info-soft:#E0E8F7;
  --bar:#4A5862;--bar-hi:#F2591F;--grid:#E4E1D9;--toast-link:#F2591F;
  --sombra:0 1px 2px rgba(26,26,26,.07),0 8px 24px -10px rgba(26,26,26,.2);
  --radio:8px;--radio-lg:12px;
  --f-cuerpo:'Barlow',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  --f-etiqueta:'Barlow Condensed','Arial Narrow',system-ui,sans-serif;
  --f-titulo:'Anton',Impact,'Arial Narrow Bold',sans-serif;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#131313;--surface:#1D1D1D;--surface-2:#282828;--ink:#F2F0EB;--ink-2:#C4C9CD;--muted:#9BA0A4;
    --line:#333;--line-2:#6A6A6A;
    --accent:#FF6A2E;--accent-ink:#141414;--accent-soft:#3B2217;--accent-text:#FF8A57;
    --rail:#0D0D0D;--rail-ink:#F2F0EB;--rail-muted:#8E9296;--rail-line:#262626;
    --ok:#62D18C;--ok-soft:#173222;--warn:#F2B84B;--warn-soft:#38290C;--bad:#FF8379;--bad-soft:#3E1B18;--info:#8DB2F2;--info-soft:#172439;
    --bar:#8F9DA7;--bar-hi:#FF6A2E;--grid:#2D2D2D;--toast-link:#B63F0E;
    --sombra:0 1px 2px rgba(0,0,0,.45),0 8px 24px -10px rgba(0,0,0,.7);
    color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --bg:#131313;--surface:#1D1D1D;--surface-2:#282828;--ink:#F2F0EB;--ink-2:#C4C9CD;--muted:#9BA0A4;
  --line:#333;--line-2:#6A6A6A;
  --accent:#FF6A2E;--accent-ink:#141414;--accent-soft:#3B2217;--accent-text:#FF8A57;
  --rail:#0D0D0D;--rail-ink:#F2F0EB;--rail-muted:#8E9296;--rail-line:#262626;
  --ok:#62D18C;--ok-soft:#173222;--warn:#F2B84B;--warn-soft:#38290C;--bad:#FF8379;--bad-soft:#3E1B18;--info:#8DB2F2;--info-soft:#172439;
  --bar:#8F9DA7;--bar-hi:#FF6A2E;--grid:#2D2D2D;--toast-link:#B63F0E;
  --sombra:0 1px 2px rgba(0,0,0,.45),0 8px 24px -10px rgba(0,0,0,.7);
  color-scheme:dark;
}

*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
html.modal-open{overflow:hidden}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font:400 16px/1.45 var(--f-cuerpo);-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);background:var(--rail);z-index:30}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
h1,h2,h3,h4,p,figure{margin:0}
ul,ol{margin:0;padding:0;list-style:none}
a{color:var(--accent-text)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.i{width:20px;height:20px;flex:none}
.i.g{width:28px;height:28px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
[hidden]{display:none!important}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 estructura */
.app{min-height:100vh}
.rail{display:none}
.top{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;background:var(--rail);color:var(--rail-ink)}
.top-in{display:flex;align-items:center;gap:10px;min-height:56px;padding-block:8px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.marca{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.logo{display:block;width:38px;height:38px;flex:none}
.logo img{display:block;width:100%;height:100%;border-radius:50%}
.marca-t{min-width:0;line-height:1}
.marca-n{font:400 20px/1 var(--f-titulo);letter-spacing:.03em;text-transform:uppercase;white-space:nowrap}
.marca-n b{color:var(--accent);font-weight:400}
.marca-s{display:block;margin-top:3px;font:600 12px/1 var(--f-etiqueta);letter-spacing:.18em;text-transform:uppercase;color:var(--rail-muted)}
.estado-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:99px;background:#2A2A2A;color:#E9E7E1;font:600 12px var(--f-etiqueta);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;border:0}
.estado-chip::before{content:"";width:8px;height:8px;border-radius:50%;background:#62D18C}
.estado-chip.off::before{background:#F2B84B}
.estado-chip.loc::before{background:#8DB2F2}
.estado-chip.act{cursor:pointer}
.main{padding-block:16px 104px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.main-in{max-width:1040px;margin:0 auto}
.main:focus{outline:none}
.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:20;display:grid;grid-template-columns:repeat(5,1fr);background:var(--surface);border-top:1px solid var(--line);padding:0 env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
.tab{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:62px;padding:8px 2px 6px;background:none;border:0;color:var(--muted);font:600 12.5px/1 var(--f-etiqueta);letter-spacing:.07em;text-transform:uppercase}
.tab[aria-current="page"]{color:var(--ink)}
.tab[aria-current="page"]::before{content:"";position:absolute;top:0;left:22%;right:22%;height:3px;border-radius:0 0 3px 3px;background:var(--accent)}
.badge{position:absolute;top:5px;left:calc(50% + 6px);min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--accent);color:var(--accent-ink);font:700 11px/18px var(--f-cuerpo);text-align:center}
@media (min-width:900px){
  .app{display:grid;grid-template-columns:244px minmax(0,1fr)}
  .rail{display:flex;flex-direction:column;gap:6px;position:sticky;top:0;height:100vh;padding:22px 14px 16px;background:var(--rail);color:var(--rail-ink)}
  .rail .marca{flex:none;padding:0 6px 18px;margin-bottom:6px;border-bottom:1px solid var(--rail-line)}
  .nav-it{position:relative;display:flex;align-items:center;gap:12px;min-height:46px;padding:0 12px;border:0;border-radius:var(--radio);background:none;color:var(--rail-muted);font:600 16px var(--f-etiqueta);letter-spacing:.07em;text-transform:uppercase;text-align:left}
  .nav-it:hover{background:rgba(255,255,255,.06);color:var(--rail-ink)}
  .nav-it[aria-current="page"]{background:rgba(255,255,255,.1);color:var(--rail-ink)}
  .nav-it[aria-current="page"]::before{content:"";position:absolute;left:-14px;top:9px;bottom:9px;width:4px;border-radius:0 4px 4px 0;background:var(--accent)}
  .nav-it .badge{position:static;margin-left:auto}
  .rail-pie{margin-top:auto;display:flex;flex-direction:column;gap:10px;padding:14px 6px 0;border-top:1px solid var(--rail-line)}
  .rail-rol{font:600 15px var(--f-etiqueta);letter-spacing:.06em;text-transform:uppercase}
  .rail-rol small{display:block;font:500 12px var(--f-cuerpo);letter-spacing:0;text-transform:none;color:var(--rail-muted)}
  .top,.tabbar{display:none}
  .main{padding-block:30px 56px}
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 texto y utilidades */
.t-pant{font:400 30px/1.05 var(--f-titulo);letter-spacing:.02em;text-transform:uppercase}
.t-sec{font:700 14px/1 var(--f-etiqueta);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2)}
.t-peq{font-size:14px;color:var(--muted)}
.muted{color:var(--muted)}
.cifras{font-variant-numeric:tabular-nums}
.num-g{font:700 36px/1 var(--f-etiqueta);letter-spacing:.01em}
.sep{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pila{display:flex;flex-direction:column;gap:14px}
.fila{display:flex;align-items:center;gap:10px}
.fila.w{flex-wrap:wrap}
.grow{flex:1;min-width:0}
.cabecera{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.cabecera p{margin-top:6px}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 botones y campos */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border-radius:var(--radio);border:1px solid transparent;background:var(--surface-2);color:var(--ink);font-weight:600;line-height:1.1;text-decoration:none;text-align:center}
.btn:hover{filter:brightness(.97)}
.btn:active{transform:translateY(1px)}
.btn[disabled]{opacity:.5;cursor:not-allowed;transform:none}
.btn[aria-busy="true"]{position:relative;color:transparent;pointer-events:none}
.btn[aria-busy="true"]::after{content:"";position:absolute;width:18px;height:18px;border-radius:50%;border:2px solid var(--ink);border-right-color:transparent;animation:gira .7s linear infinite}
@keyframes gira{to{transform:rotate(360deg)}}
.btn-p{background:var(--accent);color:var(--accent-ink)}
.btn-p[aria-busy="true"]::after{border-color:var(--accent-ink);border-right-color:transparent}
.btn-d{background:var(--ink);color:var(--bg)}
.btn-d[aria-busy="true"]::after{border-color:var(--bg);border-right-color:transparent}
.btn-g{background:transparent;border-color:var(--line-2)}
.btn-r{background:var(--bad);color:var(--bg)}
.btn-r[aria-busy="true"]::after{border-color:var(--bg);border-right-color:transparent}
.btn-s{min-height:36px;padding:0 12px;font-size:14px}
.btn-b{width:100%}
.icon-btn{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:var(--radio);border:0;background:transparent;color:inherit}
.icon-btn:hover{background:var(--surface-2)}
.lbl{display:block;margin-bottom:6px;font:600 13px/1.2 var(--f-etiqueta);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)}
.campo{display:block;margin-bottom:14px}
.inp{display:block;width:100%;min-height:44px;padding:9px 12px;border:1px solid var(--line-2);border-radius:var(--radio);background:var(--surface);color:var(--ink);appearance:none;-webkit-appearance:none}
.inp:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--ink)}
@supports (color:color-mix(in srgb,red,blue)){.inp:focus{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 35%,transparent)}}
textarea.inp{min-height:76px;resize:vertical}
select.inp{background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 18px) 19px,calc(100% - 13px) 19px;background-size:5px 5px;background-repeat:no-repeat;padding-right:34px}
.inp.pin{letter-spacing:.5em;font:600 24px var(--f-etiqueta);text-align:center}
.ayuda{margin-top:5px;font-size:13px;color:var(--muted)}
.err{margin-top:10px;padding:10px 12px;border-radius:var(--radio);background:var(--bad-soft);color:var(--bad);font-weight:600;font-size:14px}
.aviso{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:var(--radio);background:var(--info-soft);color:var(--ink);font-size:14px}
.aviso .i{color:var(--info);margin-top:1px}
.aviso.warn{background:var(--warn-soft)}
.aviso.warn .i{color:var(--warn)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:99px;border:1px solid var(--line-2);background:var(--surface);color:var(--ink-2);font-weight:600;font-size:14px}
.chip[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.pill{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:99px;background:var(--surface-2);color:var(--ink-2);font:700 12px/1 var(--f-etiqueta);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.pill.ok{background:var(--ok-soft);color:var(--ok)}
.pill.warn{background:var(--warn-soft);color:var(--warn)}
.pill.bad{background:var(--bad-soft);color:var(--bad)}
.pill.info{background:var(--info-soft);color:var(--info)}
.pill .i{width:13px;height:13px}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 tarjetas */
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radio-lg);padding:16px}
.card.flat{padding:0;overflow:hidden}
.card-t{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.grid-kpi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:640px){.grid-kpi{grid-template-columns:repeat(3,minmax(0,1fr))}}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radio-lg);padding:14px 14px 12px;min-width:0}
.kpi .t-sec{display:block;margin-bottom:10px;font-size:13px}
.kpi small{display:block;margin-top:6px;font-size:13px;color:var(--muted)}
.kpi.dest{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.kpi.dest .t-sec,.kpi.dest small{color:var(--bg);opacity:.75}
@supports (color:color-mix(in srgb,red,blue)){.kpi.dest .t-sec,.kpi.dest small{color:color-mix(in srgb,var(--bg) 70%,transparent);opacity:1}}
.dos-col{display:grid;gap:14px}
@media (min-width:900px){.dos-col{grid-template-columns:minmax(0,3fr) minmax(0,2fr);align-items:start}}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 listas */
.lista>li+li{border-top:1px solid var(--line)}
.item{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;background:none;border:0;text-align:left;min-height:56px}
button.item:hover{background:var(--surface-2)}
.item-t{font-weight:600;line-height:1.25}
.item-s{font-size:13.5px;color:var(--muted);line-height:1.3}
.ico-c{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:var(--surface-2);color:var(--ink-2);flex:none}
.ico-c.ok{background:var(--ok-soft);color:var(--ok)}
.ico-c.warn{background:var(--warn-soft);color:var(--warn)}
.ico-c.bad{background:var(--bad-soft);color:var(--bad)}
.ico-c.info{background:var(--info-soft);color:var(--info)}
.ico-c.acc{background:var(--accent-soft);color:var(--accent-text)}
.iso{display:block}
.vacio{display:flex;flex-direction:column;align-items:center;gap:10px;padding:34px 20px;text-align:center;color:var(--muted)}
.vacio .i{width:34px;height:34px;color:var(--line-2)}
.vacio b{color:var(--ink);font-size:17px}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 inventario */
.barra-filtros{position:sticky;top:calc(env(safe-area-inset-top,0px) + 56px);z-index:10;margin:0 calc(-1 * max(16px,env(safe-area-inset-left,0px)));padding:10px max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));background:var(--bg);background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
@media (min-width:900px){.barra-filtros{top:0}}
.buscar{position:relative}
.buscar .i{position:absolute;left:12px;top:12px;color:var(--muted);pointer-events:none}
.buscar .inp{padding-left:40px}
.prods{display:grid;gap:10px;margin-top:14px}
@media (min-width:760px){.prods{grid-template-columns:1fr 1fr}}
.prod{display:flex;align-items:center;gap:12px;width:100%;padding:12px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radio-lg);text-align:left}
.prod:hover{border-color:var(--line-2);box-shadow:var(--sombra)}
.prod.arch{opacity:.6}
.prod-ico{display:grid;place-items:center;width:44px;height:44px;border-radius:10px;background:var(--surface-2);flex:none}
.prod-main{min-width:0;flex:1}
.prod-n{display:block;font-weight:600;line-height:1.2}
.prod-s{display:block;margin-top:2px;font-size:13px;color:var(--muted);line-height:1.25}
.stocks{display:flex;gap:2px;flex:none}
.st{display:flex;flex-direction:column;align-items:center;min-width:46px;padding:2px 4px}
.st b{font:700 22px/1 var(--f-etiqueta);font-variant-numeric:tabular-nums}
.st i{font:600 11px/1 var(--f-etiqueta);font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:3px}
.st.agotado b{color:var(--bad)}
.st.bajo b{color:var(--warn)}
.st.cero b{color:var(--muted);font-weight:500}
.st.cam b{color:var(--info)}
.grupo-t{margin:20px 2px 2px}
@media (max-width:560px){
  .prod{flex-wrap:wrap}
  .stocks{flex:1 0 100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));margin-top:2px;padding-top:10px;border-top:1px solid var(--line);gap:0}
  .st{flex-direction:row;justify-content:center;align-items:baseline;gap:7px;min-width:0}
  .st i{margin-top:0}
}
.res-n{margin-top:12px;font-size:13px;color:var(--muted)}
.acciones-fab{display:flex;gap:8px;flex-wrap:wrap}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 mover */
.atajos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:760px){.atajos{grid-template-columns:repeat(4,minmax(0,1fr))}}
.atajo{display:flex;flex-direction:column;align-items:flex-start;gap:10px;min-height:112px;padding:14px;border-radius:var(--radio-lg);border:1px solid var(--line);background:var(--surface);text-align:left}
.atajo:hover{border-color:var(--line-2);box-shadow:var(--sombra)}
.atajo b{font:700 18px/1.1 var(--f-etiqueta);letter-spacing:.04em;text-transform:uppercase}
.atajo span{font-size:13px;color:var(--muted);line-height:1.3}
.atajo.pri{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.atajo.pri span{color:var(--accent-ink)}
@supports (color:color-mix(in srgb,red,blue)){.atajo.pri span{color:color-mix(in srgb,var(--accent-ink) 78%,transparent)}}
.atajo.pri .ico-c{background:rgba(26,26,26,.14);color:var(--accent-ink)}
.carta{display:block;width:100%;text-align:left;background:none;border:0;padding:14px}
button.carta:hover{background:var(--surface-2)}
.carta-lin{margin-top:8px;font-size:14px;color:var(--ink-2)}
.carta-lin span{display:block}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 gr\xE1fica y ranking */
.graf{position:relative}
.graf svg{display:block;width:100%;height:auto;overflow:visible}
.graf text{font-family:var(--f-cuerpo);fill:var(--muted);font-size:12px}
.graf .hoy-x{fill:var(--ink);font-weight:700}
.graf .val{fill:var(--ink);font-weight:700;font-size:12.5px}
.graf .gl{stroke:var(--grid);stroke-width:1}
.graf .barra{fill:var(--bar);transition:filter .12s}
.graf .barra.hi{fill:var(--bar-hi)}
.graf .col:hover .barra,.graf .col:focus .barra,.graf .col.act .barra{filter:brightness(1.18)}
.graf .col{outline:none}
.graf .col:focus-visible .hit{stroke:var(--accent);stroke-width:2}
.graf .hit{fill:transparent}
.tip{position:absolute;z-index:3;pointer-events:none;min-width:130px;padding:8px 10px;border-radius:var(--radio);background:var(--ink);color:var(--bg);box-shadow:var(--sombra);font-size:13px;line-height:1.3;transform:translate(-50%,-100%)}
.tip b{display:block;font:700 18px/1.1 var(--f-etiqueta);font-variant-numeric:tabular-nums}
.tip span{opacity:.78}
.tabla{width:100%;border-collapse:collapse;font-size:14px}
.tabla th{font:700 12px var(--f-etiqueta);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
.tabla td{padding:8px;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}
.tabla .r{text-align:right}
.rank{display:flex;flex-direction:column;gap:12px}
.rank-i{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:baseline}
.rank-i .n{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rank-i .v{font:700 16px var(--f-etiqueta);font-variant-numeric:tabular-nums}
.rank-i .b{grid-column:1/-1;height:6px;border-radius:3px;background:var(--surface-2);overflow:hidden}
.rank-i .b i{display:block;height:100%;border-radius:3px;background:var(--bar)}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 hojas (di\xE1logos) */
dialog.sheet{border:0;padding:0;background:var(--surface);color:var(--ink);width:100%;max-width:100%;max-height:92vh;max-height:min(92vh,92dvh);margin:auto 0 0;border-radius:18px 18px 0 0;box-shadow:0 -10px 50px rgba(0,0,0,.4);overflow:hidden}
dialog.sheet::backdrop{background:rgba(12,12,12,.62)}
dialog.sheet[open]{animation:sube .2s ease-out}
@keyframes sube{from{transform:translateY(28px);opacity:0}}
.sheet-in{display:flex;flex-direction:column;max-height:92vh;max-height:min(92vh,92dvh)}
.sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 12px 12px 20px;border-bottom:1px solid var(--line)}
.sheet-head h2{font:700 21px/1.15 var(--f-etiqueta);letter-spacing:.05em;text-transform:uppercase}
.sheet-body{flex:1;overflow:auto;padding:18px 20px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.sheet-foot{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;padding:12px 20px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:var(--surface)}
.sheet-foot .btn{flex:1 1 140px}
.sheet-foot .btn-p,.sheet-foot .btn-r{flex:2 1 190px}
@media (min-width:640px){
  dialog.sheet{margin:auto;max-width:560px;border-radius:18px}
  dialog.sheet.ancho{max-width:760px}
  .sheet-foot .btn,.sheet-foot .btn-p,.sheet-foot .btn-r{flex:0 1 auto;min-width:140px}
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 editor de l\xEDneas */
.lin-lista{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.lin{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 12px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:var(--radio);background:var(--surface)}
.lin.mal{border-color:var(--bad);background:var(--bad-soft);background:color-mix(in srgb,var(--bad-soft) 55%,var(--surface))}
.lin-n{font-weight:600;line-height:1.2;min-width:0}
.lin-s{font-size:13px;color:var(--muted)}
.lin-s.mal{color:var(--bad);font-weight:600}
.lin-ctl{grid-column:1/-1;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.paso{display:inline-flex;align-items:center;border:1px solid var(--line-2);border-radius:var(--radio);overflow:hidden;background:var(--surface)}
.paso button{width:42px;height:42px;border:0;background:var(--surface-2);display:grid;place-items:center}
.paso button:hover{filter:brightness(.95)}
.paso input{width:62px;height:42px;border:0;border-inline:1px solid var(--line-2);text-align:center;font:700 18px var(--f-etiqueta);background:var(--surface);color:var(--ink);font-variant-numeric:tabular-nums}
.paso input:focus{outline:2px solid var(--accent);outline-offset:-2px}
.precio{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line-2);border-radius:var(--radio);padding:0 8px;background:var(--surface);height:44px}
.precio input{width:84px;border:0;background:none;text-align:right;font:600 16px var(--f-cuerpo);font-variant-numeric:tabular-nums}
.precio input:focus{outline:none}
.precio:focus-within{outline:2px solid var(--accent)}
.lin-sub{margin-left:auto;font:700 17px var(--f-etiqueta);font-variant-numeric:tabular-nums}
.lin-add{position:sticky;top:0;z-index:3;margin:0 -20px 14px;padding:10px 20px;background:var(--surface);border-bottom:1px solid var(--line)}
.lin-res{margin-top:6px;border:1px solid var(--line-2);border-radius:var(--radio);background:var(--surface);max-height:min(260px,38vh);overflow:auto;-webkit-overflow-scrolling:touch}
.lin-res li+li{border-top:1px solid var(--line)}
.lin-res button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;background:none;border:0;text-align:left;min-height:48px}
.lin-res button:hover,.lin-res button:focus-visible{background:var(--surface-2)}
.lin-res .nada{padding:12px;font-size:14px;color:var(--muted)}
.total-b{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:var(--radio);background:var(--ink);color:var(--bg);margin-bottom:14px}
.total-b span{font:600 13px var(--f-etiqueta);letter-spacing:.1em;text-transform:uppercase;opacity:.8}
.total-b b{font:700 28px/1 var(--f-etiqueta);font-variant-numeric:tabular-nums}
.cnt-lista{border:1px solid var(--line);border-radius:var(--radio);overflow:hidden}
.cnt{display:flex;align-items:center;gap:12px;padding:8px 10px;background:var(--surface)}
.cnt+.cnt,.cnt-h+.cnt,.cnt+.cnt-h{border-top:1px solid var(--line)}
.cnt.cambio{background:var(--info-soft)}
.cnt-h{padding:8px 12px;background:var(--surface-2);font:700 12px var(--f-etiqueta);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2)}
.cnt-in{width:88px;height:46px;text-align:center;border:1px solid var(--line-2);border-radius:var(--radio);background:var(--surface);font:700 20px var(--f-etiqueta);font-variant-numeric:tabular-nums}
.cnt-in:focus{outline:2px solid var(--accent);outline-offset:-1px}
.sheet-foot .resumen{flex:1 0 100%;font-size:14px;color:var(--ink-2);text-align:left}
.opciones{display:flex;gap:8px;flex-wrap:wrap}
.opciones.g4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
@media (min-width:520px){.opciones.g4{grid-template-columns:repeat(4,minmax(0,1fr))}}
.opcion{flex:1 1 auto;min-height:44px;padding:0 14px;border-radius:var(--radio);border:1px solid var(--line-2);background:var(--surface);font-weight:600;color:var(--ink-2)}
.opcion[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--bg)}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 acceso (login e inicio) */
.acceso{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:max(24px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(24px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
.acceso-in{width:100%;max-width:440px;display:flex;flex-direction:column;gap:18px}
.acceso .marca-g{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
.acceso .logo{width:84px;height:84px}
.acceso h1{font:400 40px/1 var(--f-titulo);letter-spacing:.03em;text-transform:uppercase}
.acceso h1 b{color:var(--accent);font-weight:400}
.acceso .sub{font:600 14px var(--f-etiqueta);letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.tonos-fila{display:flex;justify-content:center;gap:6px}
.tonos-fila i{width:14px;height:14px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 0 0 1px rgba(0,0,0,.08)}
.rol-btn{display:flex;align-items:center;gap:14px;width:100%;padding:16px;border-radius:var(--radio-lg);border:1px solid var(--line);background:var(--surface);text-align:left}
.rol-btn:hover{border-color:var(--ink);box-shadow:var(--sombra)}
.rol-btn b{display:block;font:700 20px/1.1 var(--f-etiqueta);letter-spacing:.05em;text-transform:uppercase}
.rol-btn span{font-size:14px;color:var(--muted)}
.pasos{display:flex;gap:6px;justify-content:center}
.pasos i{width:28px;height:4px;border-radius:2px;background:var(--line-2)}
.pasos i.on{background:var(--accent)}
.codigo{display:block;padding:16px;border-radius:var(--radio);background:var(--ink);color:var(--bg);text-align:center;font:700 34px/1 var(--f-etiqueta);letter-spacing:.18em;user-select:all}
.check-fila{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:var(--radio);background:var(--surface);margin-bottom:10px}
.check-fila input{width:22px;height:22px;margin-top:1px;accent-color:var(--accent);flex:none}
.check-fila label{flex:1;line-height:1.3}
.check-fila small{display:block;color:var(--muted);font-size:13px;margin-top:2px}
.demo-b{display:flex;align-items:center;gap:12px;justify-content:center;flex-wrap:wrap;padding:6px 16px;min-height:44px;background:var(--warn-soft);color:var(--warn);font-weight:600;font-size:14px;text-align:center}
.demo-b .btn{min-height:30px;padding:0 10px;font-size:13px;color:inherit;border-color:currentColor;white-space:nowrap}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 avisos emergentes */
#toasts{position:fixed;left:0;right:0;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:100;display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 16px;pointer-events:none}
@media (min-width:900px){#toasts{bottom:24px}}
.toast{display:flex;align-items:center;gap:12px;max-width:min(520px,100%);padding:12px 14px;border-radius:var(--radio);background:var(--ink);color:var(--bg);box-shadow:var(--sombra);font-weight:500;pointer-events:auto;animation:sube .2s ease-out}
.toast.mal{background:var(--bad);color:var(--bg)}
.toast a,.toast button{flex:none;background:none;border:0;padding:4px 6px;margin:-4px -6px -4px 0;font-weight:700;color:var(--toast-link);text-decoration:underline;text-underline-offset:3px}
.toast.mal a,.toast.mal button{color:var(--bg)}
.toast .i{flex:none}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 varios */
.cargando{display:grid;place-items:center;min-height:50vh;color:var(--muted)}
.cargando i{width:28px;height:28px;border-radius:50%;border:3px solid var(--line-2);border-top-color:var(--accent);animation:gira .8s linear infinite}
.sec-mas{margin-bottom:18px}
.sec-mas .t-sec{display:block;margin:0 2px 8px}
.item .i.der{color:var(--line-2);margin-left:auto}
.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:14.5px}
.kv dt{color:var(--muted)}
.kv dd{margin:0;font-weight:600;text-align:right}
.hist-dia{margin:18px 2px 6px}
.linea-det{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)}
.linea-det:last-child{border-bottom:0}
.tachado{text-decoration:line-through;opacity:.65}
.pie-app{margin-top:26px;text-align:center;font-size:13px;color:var(--muted)}
.mini-sw{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:-1px;margin-right:6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}
.fila-edit{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) 92px auto;gap:8px;align-items:center;margin-bottom:8px}
.fila-edit.tono{grid-template-columns:44px minmax(0,1fr) auto}
.fila-edit input[type=color]{width:44px;height:44px;padding:2px;border:1px solid var(--line-2);border-radius:var(--radio);background:var(--surface)}
@media (max-width:520px){.fila-edit:not(.tono){grid-template-columns:1fr 1fr;} .fila-edit:not(.tono) .inp:first-child{grid-column:1/-1}}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></symbol>
    <symbol id="i-cubo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/></symbol>
    <symbol id="i-mover" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14"/><path d="m14 4 4 4-4 4"/><path d="M20 16H6"/><path d="m10 12-4 4 4 4"/></symbol>
    <symbol id="i-reloj" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
    <symbol id="i-mas" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="i-minus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></symbol>
    <symbol id="i-buscar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></symbol>
    <symbol id="i-camion" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></symbol>
    <symbol id="i-alerta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2.8 20h18.4L12 4z"/><path d="M12 10v4.5M12 17.5v.1"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></symbol>
    <symbol id="i-bajar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></symbol>
    <symbol id="i-candado" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></symbol>
    <symbol id="i-sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/></symbol>
    <symbol id="i-luna" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></symbol>
    <symbol id="i-recibo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/></symbol>
    <symbol id="i-devolver" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></symbol>
    <symbol id="i-basura" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></symbol>
    <symbol id="i-pedido" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/></symbol>
    <symbol id="i-conteo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 13 2.2 2.2L15.5 11"/></symbol>
    <symbol id="i-entrada" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/></symbol>
    <symbol id="i-salida" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5"/><path d="m7.5 9.5 4.5-4.5 4.5 4.5"/><path d="M5 20h14"/></symbol>
    <symbol id="i-editar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/></symbol>
    <symbol id="i-archivo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8"/><path d="M10 12h4"/></symbol>
    <symbol id="i-mensaje" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4V5z"/></symbol>
    <symbol id="i-refrescar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14-4.5L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4.5L20 15"/><path d="M20 20v-5h-5"/></symbol>
    <symbol id="i-sinred" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.8a15 15 0 0 1 20 0"/><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5v.1"/><path d="M3 3l18 18"/></symbol>
    <symbol id="i-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.1"/></symbol>
    <symbol id="i-der" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></symbol>
    <symbol id="i-usuario" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5"/></symbol>
    <symbol id="i-capas" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/></symbol>
    <symbol id="i-tuerca" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 7.8 4.5v9L12 21l-7.8-4.5v-9L12 3z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="i-tienda" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9z"/><path d="M5 14v6h14v-6"/></symbol>
    <symbol id="i-fabrica" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20V9l6 3V9l6 3V5h3v15H3z"/><path d="M7 16h2M12 16h2"/></symbol>
    <symbol id="i-copiar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></symbol>
    <symbol id="i-ojo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></symbol>
    <symbol id="i-tabla" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M9.5 10v9.5"/></symbol>
  </defs>
</svg>
<div id="raiz"><div class="cargando" role="status" aria-label="Cargando"><i></i></div></div>
<div id="toasts" role="status" aria-live="polite"></div>
<noscript><p style="padding:24px;font:16px system-ui">Esta app necesita JavaScript para funcionar.</p></noscript>
<script src="core.js"></script>
<script>
(function () {
'use strict';
const Core = window.BBCore;

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 claves y almacenamiento (si el navegador no deja guardar, se usa memoria) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const CLAVE_LOCAL = 'bb-inv:local:v1';
const CLAVE_SESION = 'bb-inv:sesion';
const CLAVE_TEMA = 'bb-inv:tema';
const CLAVE_ROL = 'bb-inv:ultimo-rol';
const CLAVE_CACHE = 'bb-inv:cache';
const CLAVE_MODO = 'bb-inv:modo';
const SYNC_MS = 9000;
const memoria = {};
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v === null ? (k in memoria ? memoria[k] : null) : v; } catch (e) { return k in memoria ? memoria[k] : null; } },
  set(k, v) { try { localStorage.setItem(k, v); delete memoria[k]; } catch (e) { memoria[k] = String(v); } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } delete memoria[k]; }
};
let avisoMemoria = false;
const almacenCore = {
  getItem: store.get,
  setItem(k, v) {
    store.set(k, v);
    if (!avisoMemoria && k in memoria) { avisoMemoria = true; setTimeout(() => toast('Este navegador no deja guardar datos: lo que captures se perder\xE1 al cerrar la pesta\xF1a.', { tipo: 'error', ms: 10000 }), 0); }
  },
  removeItem: store.del
};
const sesionTmp = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return memoria['s:' + k] || null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { memoria['s:' + k] = v; } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* nada */ } delete memoria['s:' + k]; }
};

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 plantillas con escape autom\xE1tico \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
class Raw { constructor(s) { this.s = s; } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : v == null || v === false ? '' : esc(v));
const html = (strs, ...vals) => new Raw(strs.reduce((a, s, i) => a + s + (i < vals.length ? val(vals[i]) : ''), ''));
const raw = (s) => new Raw(s);
const poner = (el, tpl) => { el.innerHTML = val(tpl); };
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const ico = (n, cls) => raw('<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>');

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 formatos \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const nf = new Intl.NumberFormat('es-MX');
const mf = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dinero = (n) => mf.format(n || 0);
const num = (n) => nf.format(n || 0);
const plural = (n, uno, varios) => num(n) + ' ' + (n === 1 ? uno : varios);
const DIA = 86400000;
const tzMin = () => -new Date().getTimezoneOffset();
const inicioDeDia = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fmtHora = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' });
const fmtDiaLargo = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDiaCorto = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function etiquetaDia(ts) {
  const hoy = inicioDeDia(Date.now()), d = inicioDeDia(ts);
  if (d === hoy) return 'Hoy';
  if (d === hoy - DIA) return 'Ayer';
  return mayus(fmtDiaLargo.format(ts));
}
function hace(ts) {
  const hoy = inicioDeDia(Date.now()), d = inicioDeDia(ts), h = fmtHora.format(ts);
  if (d === hoy) return 'hoy ' + h;
  if (d === hoy - DIA) return 'ayer ' + h;
  return fmtDiaCorto.format(ts).replace(/\\./g, '') + ', ' + h;
}
const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().trim();
// busca varias palabras sin importar el orden ni los signos: \u201Cqueen gris\u201D encuentra \u201CBase Queen \xB7 Gris\u201D
const coincide = (texto, q) => { const t = norm(q).split(/\\s+/).filter(Boolean); const h = norm(texto); return t.every((x) => h.includes(x)); };
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'x';
const entero = (v) => Math.max(0, Math.min(99999, parseInt(String(v).replace(/\\D/g, ''), 10) || 0));
const decimal = (v) => { const n = parseFloat(String(v).replace(/[^\\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
const nuevoCid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 estado \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
class ErrorRed extends Error { constructor() { super('Sin conexi\xF3n. Revisa tu internet e intenta de nuevo.'); } }
class ErrorApi extends Error { constructor(er) { super(er.mensaje || 'No se pudo completar.'); this.code = er.code; this.extra = er; } }

const S = {
  modo: null, token: '', rol: '', est: null, idx: {}, camino: {}, enLinea: true,
  tab: 'inicio', demo: false, recordar: true, instalar: null,
  filtro: { q: '', cat: 'todo', bajo: false, archivados: false },
  hist: { items: [], siguiente: null, cargando: false, tipo: 'todo', rango: '7', q: '', total: 0 },
  verTabla: false
};
let repoLocal = null;
let sincronizando = false;

const ROLES = {
  local: { nombre: 'Almac\xE9n', corto: 'Almac\xE9n', desc: 'Bodega y f\xE1brica: materiales, bases en producci\xF3n y env\xEDos a la tienda.', ic: 'fabrica' },
  tienda: { nombre: 'Vendedor tienda', corto: 'Tienda', desc: 'Venta al p\xFAblico: ventas, devoluciones, pedidos y recibo de mercanc\xEDa.', ic: 'tienda' }
};
const CATS = { base: 'Bases', material: 'Materiales', accesorio: 'Accesorios' };
const TIPOS = {
  entrada: { t: 'Entrada al almac\xE9n', ic: 'entrada', c: 'ok' },
  salida: { t: 'Salida del almac\xE9n', ic: 'salida', c: 'warn' },
  venta: { t: 'Venta', ic: 'recibo', c: 'acc' },
  devolucion: { t: 'Devoluci\xF3n de cliente', ic: 'devolver', c: 'info' },
  merma: { t: 'Merma en tienda', ic: 'basura', c: 'bad' },
  ajuste: { t: 'Ajuste por conteo', ic: 'conteo', c: 'info' },
  inicial: { t: 'Inventario inicial', ic: 'cubo', c: '' },
  envio: { t: 'Env\xEDo a la tienda', ic: 'camion', c: 'info' },
  recibo: { t: 'Recibido en tienda', ic: 'check', c: 'ok' },
  envio_cancelado: { t: 'Env\xEDo cancelado', ic: 'x', c: 'bad' }
};
const MOTIVOS = { produccion: 'Producci\xF3n', compra: 'Compra', uso: 'Uso en producci\xF3n', merma: 'Merma', otro: 'Otro' };
const PAGOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 tema \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function aplicarTema() {
  const t = store.get(CLAVE_TEMA) || 'auto';
  const r = document.documentElement;
  if (t === 'auto') r.removeAttribute('data-theme');
  else r.setAttribute('data-theme', t === 'oscuro' ? 'dark' : 'light');
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 ventanas, avisos y confirmaciones \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
let dlgN = 0;
function dialogo(o) {
  const d = document.createElement('dialog');
  d.className = 'sheet' + (o.clase ? ' ' + o.clase : '');
  const tid = 'dt' + (++dlgN);
  d.setAttribute('aria-labelledby', tid);
  poner(d, html\`<div class="sheet-in"><header class="sheet-head"><h2 id="\${tid}">\${o.titulo}</h2><button type="button" class="icon-btn" data-cerrar aria-label="Cerrar">\${ico('x')}</button></header><div class="sheet-body"></div>\${o.pie ? html\`<footer class="sheet-foot"></footer>\` : ''}</div>\`);
  const cuerpo = $('.sheet-body', d), pie = $('.sheet-foot', d);
  if (o.cuerpo) poner(cuerpo, o.cuerpo);
  if (o.pie && pie) poner(pie, o.pie);
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) d.close(); });
  d.addEventListener('close', () => {
    d.remove();
    if (!$('dialog.sheet')) document.documentElement.classList.remove('modal-open');
    if (o.alCerrar) o.alCerrar();
  });
  document.body.appendChild(d);
  document.documentElement.classList.add('modal-open');
  d.showModal();
  const f = $('[autofocus], input:not([type=hidden]):not([type=checkbox]), select, textarea', cuerpo);
  if (f && o.enfocar !== false && !matchMedia('(pointer:coarse)').matches) f.focus({ preventScroll: true });
  return { el: d, cuerpo, pie, cerrar: () => d.close() };
}

function toast(texto, o) {
  o = o || {};
  const cont = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (o.tipo === 'error' ? ' mal' : '');
  const nodo = html\`<span style="flex:1">\${texto}</span>\`;
  poner(t, nodo);
  if (o.accion) {
    const a = document.createElement(o.accion.href ? 'a' : 'button');
    a.textContent = o.accion.texto;
    if (o.accion.href) { a.href = o.accion.href; a.target = '_blank'; a.rel = 'noopener'; }
    else a.type = 'button';
    a.addEventListener('click', () => { if (o.accion.fn) o.accion.fn(); t.remove(); });
    t.appendChild(a);
  }
  cont.appendChild(t);
  while (cont.children.length > 3) cont.firstChild.remove();
  setTimeout(() => t.remove(), o.ms || (o.accion ? 9000 : 4500));
}

// confirmar({titulo, texto, ok, peligro, campo:{etiqueta, min, area}}) \u2192 true/false, o el texto escrito si hay campo
function confirmar(o) {
  return new Promise((resolver) => {
    let res = o.campo ? null : false;
    const d = dialogo({
      titulo: o.titulo,
      clase: '',
      cuerpo: html\`\${o.texto ? html\`<p style="margin-bottom:14px">\${o.texto}</p>\` : ''}\${o.campo ? html\`<label class="campo"><span class="lbl">\${o.campo.etiqueta}</span><textarea class="inp" id="cf-campo" rows="2" maxlength="140" placeholder="\${o.campo.ayuda || ''}"></textarea></label><p class="err" id="cf-err" hidden></p>\` : ''}\`,
      pie: html\`<button type="button" class="btn btn-g" data-cerrar>\${o.cancelar || 'Cancelar'}</button><button type="button" class="btn \${o.peligro ? 'btn-r' : 'btn-p'}" id="cf-ok">\${o.ok || 'Aceptar'}</button>\`,
      alCerrar: () => resolver(res)
    });
    const campo = $('#cf-campo', d.el);
    if (campo) campo.addEventListener('input', () => { $('#cf-err', d.el).hidden = true; });
    $('#cf-ok', d.el).addEventListener('click', () => {
      if (o.campo) {
        const v = $('#cf-campo', d.el).value.trim();
        if (v.length < (o.campo.min || 1)) { const e = $('#cf-err', d.el); e.hidden = false; e.textContent = o.campo.error || 'Escribe una explicaci\xF3n corta.'; return; }
        res = v;
      } else res = true;
      d.cerrar();
    });
  });
}

// Ejecuta una acci\xF3n de guardado dentro de una ventana: bloquea el bot\xF3n, muestra el error en su lugar y devuelve true si sali\xF3 bien
async function guardando(btn, errEl, fn) {
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  if (errEl) errEl.hidden = true;
  try { await fn(); return true; } catch (e) {
    let msg = e && e.message;
    if (!(e instanceof ErrorApi) && !(e instanceof ErrorRed)) { console.error(e); msg = 'Algo fall\xF3. Intenta de nuevo.'; }
    if (errEl) { errEl.hidden = false; errEl.textContent = msg; errEl.scrollIntoView({ block: 'nearest' }); }
    return false;
  } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 comunicaci\xF3n con el servidor (o con el modo local) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function setEnLinea(v) {
  if (S.enLinea === v) return;
  S.enLinea = v;
  pintarChips();
}
async function llamar(metodo, ruta, cuerpo, consulta) {
  consulta = Object.assign({ tz: tzMin() }, consulta);
  if (S.modo === 'local') {
    return Core.handle(repoLocal, { method: metodo, path: ruta, body: cuerpo, query: consulta, token: S.token }, { servidor: false });
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const headers = { 'content-type': 'application/json' };
    if (S.token) headers.authorization = 'Bearer ' + S.token;
    const res = await fetch('api' + ruta + '?' + new URLSearchParams(consulta), { method: metodo, headers, cache: 'no-store', signal: ctl.signal, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const json = await res.json().catch(() => null);
    if (!json) throw new Error('respuesta');
    setEnLinea(true);
    return { status: res.status, json };
  } catch (e) {
    setEnLinea(false);
    throw new ErrorRed();
  } finally { clearTimeout(t); }
}

function guardarSesion() {
  const dato = JSON.stringify({ token: S.token, rol: S.rol, modo: S.modo });
  if (S.recordar) { store.set(CLAVE_SESION, dato); sesionTmp.del(CLAVE_SESION); } else { sesionTmp.set(CLAVE_SESION, dato); store.del(CLAVE_SESION); }
}
function leerSesion() {
  const a = store.get(CLAVE_SESION), b = sesionTmp.get(CLAVE_SESION);
  try { const d = JSON.parse(a || b || 'null'); return d && d.token ? Object.assign(d, { recordar: !!a }) : null; } catch (e) { return null; }
}

function aplicarEstado(e) {
  if (e.token) { S.token = e.token; guardarSesion(); }
  S.est = e;
  S.rol = e.rol;
  S.idx = {};
  e.productos.forEach((p) => { S.idx[p.id] = p; });
  if (S.modo === 'servidor') store.set(CLAVE_CACHE, JSON.stringify({ ts: Date.now(), est: e }));
  S.camino = {};
  e.traspasos.filter((t) => t.estado === 'en_transito').forEach((t) => t.lineas.forEach((l) => { S.camino[l.id] = (S.camino[l.id] || 0) + l.cant; }));
  pintar();
}

async function cargarEstado() {
  const r = await llamar('GET', '/estado');
  if (r.json.ok) { aplicarEstado(r.json); return true; }
  if (r.status === 401) { salir(r.json.error.mensaje); return false; }
  throw new ErrorApi(r.json.error);
}

// Mutaciones. Devuelve el resultado de la operaci\xF3n; lanza ErrorApi / ErrorRed.
async function op(cuerpo) {
  const r = await llamar('POST', '/op', Object.assign({ cid: nuevoCid() }, cuerpo));
  if (r.json.ok) {
    if (r.json.token) { S.token = r.json.token; guardarSesion(); }
    aplicarEstado(r.json.estado);
    return r.json.resultado || {};
  }
  const er = r.json.error;
  if (r.status === 401) { salir(er.mensaje); throw new ErrorApi(er); }
  if (er.code === 'conflicto' || er.code === 'duplicado') await cargarEstado().catch(() => {});
  if (er.code === 'duplicado') return {};
  throw new ErrorApi(er);
}

async function sincronizar(forzar) {
  if (!S.token || !S.est || sincronizando || (document.hidden && !forzar)) return;
  if (S.modo === 'local' && !forzar) return; // sin servidor solo puede cambiar otra pesta\xF1a del mismo equipo (evento storage)
  sincronizando = true;
  try {
    if (S.modo === 'local') { repoLocal.recargar(); }
    const r = await llamar('GET', '/rev');
    if (r.json.ok) { if (r.json.rev !== S.est.rev) await cargarEstado(); }
    else if (r.status === 401) salir(r.json.error.mensaje);
  } catch (e) { /* sin red: el chip ya lo avisa */ } finally { sincronizando = false; }
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 piezas visuales del producto \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const hexOk = (h) => (/^#[0-9a-f]{6}$/i.test(h) ? h : '#8A8D8F');
function oscuro(hex, f) {
  const n = parseInt(hexOk(hex).slice(1), 16);
  const k = (v) => Math.max(0, Math.round(v * f)).toString(16).padStart(2, '0');
  return '#' + k((n >> 16) & 255) + k((n >> 8) & 255) + k(n & 255);
}
function isoBase(hex, tam) {
  const c = hexOk(hex);
  return raw('<svg class="iso" width="' + tam + '" height="' + tam + '" viewBox="0 0 40 40" aria-hidden="true"><polygon points="4,13 20,21 20,33 4,25" fill="' + oscuro(c, 0.74) + '"/><polygon points="36,13 20,21 20,33 36,25" fill="' + c + '"/><polygon points="20,5 36,13 20,21 4,13" fill="#ECEAE4" stroke="rgba(26,26,26,.5)" stroke-width="1.2" stroke-linejoin="round"/></svg>');
}
const medidaDe = (id) => (S.est.medidas || []).find((m) => m.id === id);
const tonoDe = (id) => (S.est.tonos || []).find((t) => t.id === id);
function iconoProd(p, tam) {
  tam = tam || 32;
  if (p.cat === 'base') { const t = tonoDe(p.tono); return isoBase(t ? t.hex : '#8A8D8F', tam); }
  return html\`<span style="color:var(--ink-2)">\${ico(p.cat === 'material' ? 'capas' : 'tuerca')}</span>\`;
}
function subProd(p, corto) {
  const m = p.cat === 'base' ? medidaDe(p.medida) : null;
  const partes = [];
  if (!corto) partes.push(m ? m.nombre + ' ' + m.dims : CATS[p.cat].replace(/s$/, ''));
  if (p.precio) partes.push(dinero(p.precio));
  else if (corto) partes.push('Sin precio');
  return partes.join(' \xB7 ');
}
// nivel de existencias de un lugar frente a su m\xEDnimo
function nivel(p, loc) {
  const st = loc === 'local' ? p.stock_local : p.stock_tienda, mn = loc === 'local' ? p.min_local : p.min_tienda;
  if (!(mn > 0) || !(loc === 'local' ? p.hubo_local : p.hubo_tienda)) return 'ok'; // sin m\xEDnimo, o nunca ha tenido existencias: no es alerta
  if (st === 0) return 'agotado';
  if (st < mn) return 'bajo';
  return 'ok';
}
const bajosDe = (loc) => S.est.productos.filter((p) => p.activo && nivel(p, loc) !== 'ok');
const sumar = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
function ordenProductos(a, b) {
  const orden = { base: 0, material: 1, accesorio: 2 };
  if (a.cat !== b.cat) return orden[a.cat] - orden[b.cat];
  if (a.cat === 'base') {
    const ma = S.est.medidas.findIndex((m) => m.id === a.medida), mb = S.est.medidas.findIndex((m) => m.id === b.medida);
    if (ma !== mb) return ma - mb;
    const ta = S.est.tonos.findIndex((t) => t.id === a.tono), tb = S.est.tonos.findIndex((t) => t.id === b.tono);
    if (ta !== tb) return ta - tb;
  }
  return a.nombre.localeCompare(b.nombre, 'es');
}

/* agrupa los movimientos de una misma operaci\xF3n (venta de varias bases, entrada de varios productos\u2026) */
function agrupar(movs) {
  const out = [], idx = {};
  movs.forEach((m) => {
    let g = idx[m.grupo];
    if (!g) {
      g = idx[m.grupo] = { grupo: m.grupo, ts: m.ts, tipo: m.tipo, rol: m.rol, nota: m.nota, motivo: m.motivo, cliente: m.cliente, pago: m.pago, ref: m.ref, anulado: !!m.anulado, anulado_ts: m.anulado_ts, anulado_por: m.anulado_por, anulado_nota: m.anulado_nota, lineas: [] };
      out.push(g);
    }
    g.lineas.push(m);
    if (m.ts < g.ts) g.ts = m.ts;
  });
  out.forEach((g) => {
    g.piezas = sumar(g.lineas, (m) => Math.abs(m.delta));
    g.total = (g.tipo === 'venta' || g.tipo === 'devolucion') ? sumar(g.lineas, (m) => Math.abs(m.delta) * (m.precio || 0)) : 0;
  });
  return out;
}
const nombreProd = (id) => (S.idx[id] ? S.idx[id].nombre : 'Producto eliminado');
function tituloOp(g) {
  const t = TIPOS[g.tipo] ? TIPOS[g.tipo].t : g.tipo;
  if (g.tipo === 'entrada' || g.tipo === 'salida') return t + (g.motivo && g.motivo !== 'otro' ? ' \xB7 ' + MOTIVOS[g.motivo] : '');
  return t;
}
const resumenOp = (g) => plural(g.lineas.length, 'producto', 'productos') + ' \xB7 ' + plural(g.piezas, 'pieza', 'piezas');
const puedeAnular = (g) => !g.anulado && !['envio', 'recibo', 'envio_cancelado', 'inicial', 'anulacion'].includes(g.tipo) && (S.rol === 'local' || g.rol === S.rol);

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 armaz\xF3n de la app \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const TABS = [
  { id: 'inicio', t: 'Inicio', ic: 'home' },
  { id: 'inventario', t: 'Inventario', ic: 'cubo' },
  { id: 'mover', t: 'Mover', ic: 'mover' },
  { id: 'historial', t: 'Historial', ic: 'reloj' },
  { id: 'mas', t: 'M\xE1s', ic: 'mas' }
];
const marca = () => html\`<div class="marca"><span class="logo"><img src="logo.png" alt="" width="38" height="38"></span><span class="marca-t"><span class="marca-n">Bases Bo<b>x</b></span><span class="marca-s">Tepic \xB7 Inventario</span></span></div>\`;

function montarApp() {
  poner($('#raiz'), html\`
    <div class="app">
      <aside class="rail" aria-label="Men\xFA principal">
        \${marca()}
        <nav style="display:flex;flex-direction:column;gap:4px" aria-label="Secciones">
          \${TABS.map((t) => html\`<button type="button" class="nav-it" data-tab="\${t.id}">\${ico(t.ic)}<span>\${t.t}</span><span class="badge" hidden></span></button>\`)}
        </nav>
        <div class="rail-pie">
          <div class="rail-rol"><span data-rol-nombre></span><small data-negocio></small></div>
          <button type="button" class="estado-chip act" data-act="sync" data-chip></button>
          <button type="button" class="btn btn-s btn-g" style="color:inherit;border-color:var(--rail-line)" data-act="salir">Cerrar sesi\xF3n</button>
        </div>
      </aside>
      <div>
        <header class="top"><div class="top-in">\${marca()}<button type="button" class="estado-chip act" data-act="sync" data-chip></button></div></header>
        <div class="demo-b" id="demo-b" hidden><span>Demostraci\xF3n \xB7 datos de ejemplo</span><button type="button" class="btn btn-s btn-g" data-act="salir-demo">Salir de la demo</button></div>
        <main class="main" id="vista" tabindex="-1"><div class="main-in" id="vista-in"></div></main>
      </div>
      <nav class="tabbar" aria-label="Secciones">
        \${TABS.map((t) => html\`<button type="button" class="tab" data-tab="\${t.id}">\${ico(t.ic)}<span>\${t.t}</span><span class="badge" hidden></span></button>\`)}
      </nav>
    </div>\`);
}

function pintarChips() {
  const loc = S.modo === 'local';
  const txt = loc ? 'Solo este equipo' : S.enLinea ? 'En l\xEDnea' : 'Sin conexi\xF3n';
  $$('[data-chip]').forEach((c) => {
    c.className = 'estado-chip act' + (loc ? ' loc' : S.enLinea ? '' : ' off');
    c.textContent = txt;
    c.title = loc ? 'Los datos viven solo en este equipo' : 'Toca para actualizar';
  });
}

function conteoInsignias() {
  const e = S.est;
  const enT = e.traspasos.filter((t) => t.estado === 'en_transito').length;
  const ped = e.pedidos.filter((p) => p.estado === 'pendiente').length;
  return { inventario: bajosDe(S.rol).length, mover: S.rol === 'tienda' ? enT : ped };
}
function pintarNav() {
  const ins = S.est ? conteoInsignias() : {};
  $$('[data-tab]').forEach((b) => {
    const on = b.dataset.tab === S.tab;
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    const bd = $('.badge', b), n = ins[b.dataset.tab] || 0;
    if (bd) { bd.hidden = !n; bd.textContent = n > 99 ? '99+' : n; }
  });
  const rn = $('[data-rol-nombre]'), ng = $('[data-negocio]');
  if (rn && S.rol) rn.textContent = ROLES[S.rol].nombre;
  if (ng && S.est) ng.textContent = S.est.negocio.nombre;
  const dm = $('#demo-b');
  if (dm) dm.hidden = !S.demo;
}

const VISTAS = {};
function irA(tab, o) {
  o = o || {};
  if (!VISTAS[tab]) tab = 'inicio';
  const cambio = tab !== S.tab || !$('[data-vista]') || o.forzar;
  S.tab = tab;
  if (o.bajo !== undefined) S.filtro.bajo = o.bajo;
  if (cambio) {
    poner($('#vista-in'), VISTAS[tab].armar());
    if (VISTAS[tab].montar) VISTAS[tab].montar();
    window.scrollTo(0, 0);
  }
  VISTAS[tab].actualizar();
  pintarNav();
  try { history.replaceState(null, '', '#' + tab); } catch (e) { /* sin historial */ }
}
function pintar() {
  if (!S.est) return;
  if (!$('#vista-in')) { montarApp(); irA(S.tab, { forzar: true }); } else VISTAS[S.tab].actualizar();
  pintarChips();
  pintarNav();
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 INICIO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
VISTAS.inicio = { armar: () => html\`<div class="pila" data-vista="inicio" id="v-inicio"></div>\`, actualizar: pintarInicio };

function pendientesDeAtencion() {
  const e = S.est, items = [];
  const enT = e.traspasos.filter((t) => t.estado === 'en_transito');
  const ped = e.pedidos.filter((p) => p.estado === 'pendiente');
  const pzEnT = sumar(enT, (t) => sumar(t.lineas, (l) => l.cant));
  const pzPed = sumar(ped, (p) => sumar(p.lineas, (l) => l.cant));
  if (S.rol === 'tienda' && enT.length) items.push({ c: 'info', ic: 'camion', t: plural(enT.length, 'env\xEDo por recibir', 'env\xEDos por recibir'), s: plural(pzEnT, 'pieza', 'piezas') + ' en camino desde el almac\xE9n', btn: 'Recibir', act: 'recibir-ya' });
  if (S.rol === 'local' && ped.length) items.push({ c: 'acc', ic: 'pedido', t: plural(ped.length, 'pedido de la tienda', 'pedidos de la tienda'), s: plural(pzPed, 'pieza', 'piezas') + ' por surtir', btn: 'Ver pedidos', act: 'ir', tab: 'mover' });
  if (S.rol === 'local' && enT.length) items.push({ c: 'info', ic: 'camion', t: plural(enT.length, 'env\xEDo en camino', 'env\xEDos en camino'), s: 'Esperan a que la tienda confirme el recibo', btn: 'Ver', act: 'ir', tab: 'mover' });
  if (S.rol === 'tienda' && ped.length) items.push({ c: 'info', ic: 'pedido', t: plural(ped.length, 'pedido esperando', 'pedidos esperando'), s: 'El almac\xE9n a\xFAn no los surte', btn: 'Ver', act: 'ir', tab: 'mover' });
  const bajos = bajosDe(S.rol);
  if (bajos.length) {
    const agot = bajos.filter((p) => nivel(p, S.rol) === 'agotado').length;
    items.push({ c: agot ? 'bad' : 'warn', ic: 'alerta', t: plural(bajos.length, 'producto con stock bajo', 'productos con stock bajo'), s: bajos.slice(0, 3).map((p) => p.nombre).join(' \xB7 ') + (bajos.length > 3 ? ' y ' + (bajos.length - 3) + ' m\xE1s' : ''), btn: 'Revisar', act: 'ver-bajos' });
  }
  return items;
}

function pintarInicio() {
  const cont = $('#v-inicio');
  if (!cont) return;
  const e = S.est, r = e.resumen, hoy = new Date();
  const bases = e.productos.filter((p) => p.cat === 'base' && p.activo);
  const bLocal = sumar(bases, (p) => p.stock_local), bTienda = sumar(bases, (p) => p.stock_tienda), bCamino = sumar(bases, (p) => S.camino[p.id] || 0);
  const activos = e.productos.filter((p) => p.activo);
  const valor = S.rol === 'local' ? sumar(activos, (p) => (p.stock_local + p.stock_tienda) * (p.costo || 0)) : sumar(activos, (p) => p.stock_tienda * (p.precio || 0));
  const saludo = hoy.getHours() < 12 ? 'Buenos d\xEDas' : hoy.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
  const pend = pendientesDeAtencion();
  const vacioTodo = activos.length > 0 && sumar(activos, (p) => p.stock_local + p.stock_tienda + (S.camino[p.id] || 0)) === 0;
  const ops = agrupar(e.recientes).slice(0, 5);
  const topMax = r.top.length ? r.top[0].pzas : 1;

  poner(cont, html\`
    <div class="cabecera">
      <div><h1 class="t-pant">\${saludo}</h1><p class="t-peq" style="margin-top:8px">\${mayus(fmtDiaLargo.format(hoy))} \xB7 \${ROLES[S.rol].nombre}</p></div>
    </div>
    \${vacioTodo ? html\`<section class="card" aria-label="Empezar"><div class="fila" style="align-items:flex-start;gap:14px"><span class="ico-c acc">\${ico('cubo')}</span><div class="grow"><div class="item-t">Empieza cargando tus existencias</div><div class="item-s" style="margin-bottom:12px">\${S.rol === 'local' ? 'A\xFAn no hay piezas registradas. Cuenta lo que tienes en el almac\xE9n y an\xF3talo de un jal\xF3n, o registra una entrada cada vez que fabriques o compres.' : 'A\xFAn no hay piezas registradas. Cuando el almac\xE9n env\xEDe mercanc\xEDa te aparecer\xE1 aqu\xED para recibirla; si ya tienes bases en la tienda, cu\xE9ntalas.'}</div><div class="fila w"><button type="button" class="btn btn-p btn-s" data-act="forma" data-tipo="conteo">\${ico('conteo')}Contar existencias</button>\${S.rol === 'local' ? html\`<button type="button" class="btn btn-g btn-s" data-act="forma" data-tipo="entrada">\${ico('entrada')}Registrar entrada</button>\` : ''}</div></div></div></section>\` : ''}
    \${pend.length ? html\`<section class="card flat" aria-label="Por atender"><ul class="lista">\${pend.map((p) => html\`<li class="item">
        <span class="ico-c \${p.c}">\${ico(p.ic)}</span>
        <div class="grow"><div class="item-t">\${p.t}</div><div class="item-s">\${p.s}</div></div>
        <button type="button" class="btn btn-s \${p.c === 'bad' || p.c === 'acc' ? 'btn-p' : 'btn-d'}" data-act="\${p.act}" \${p.tab ? raw('data-tab-ir="' + p.tab + '"') : ''}>\${p.btn}</button></li>\`)}</ul></section>\`
      : vacioTodo ? '' : html\`<section class="card"><div class="fila"><span class="ico-c ok">\${ico('check')}</span><div><div class="item-t">Todo al d\xEDa</div><div class="item-s">No hay env\xEDos, pedidos ni productos con stock bajo por atender.</div></div></div></section>\`}
    <section class="grid-kpi" aria-label="Resumen">
      <div class="kpi"><span class="t-sec">Bases en el almac\xE9n</span><span class="num-g cifras">\${num(bLocal)}</span><small>\${plural(bases.filter((p) => p.stock_local > 0).length, 'modelo con existencias', 'modelos con existencias')}</small></div>
      <div class="kpi"><span class="t-sec">Bases en tienda</span><span class="num-g cifras">\${num(bTienda)}</span><small>\${plural(bases.filter((p) => p.stock_tienda > 0).length, 'modelo con existencias', 'modelos con existencias')}</small></div>
      <div class="kpi"><span class="t-sec">Bases en camino</span><span class="num-g cifras" style="color:\${bCamino ? 'var(--info)' : 'inherit'}">\${num(bCamino)}</span><small>\${bCamino ? 'Sin confirmar en tienda' : 'Nada por llegar'}</small></div>
      <div class="kpi dest"><span class="t-sec">Ventas de hoy</span><span class="num-g cifras">\${dinero(r.hoy.total)}</span><small>\${plural(r.hoy.n, 'venta', 'ventas')} \xB7 \${plural(r.hoy.pzas, 'pieza', 'piezas')}</small></div>
      <div class="kpi"><span class="t-sec">Ventas del mes</span><span class="num-g cifras">\${dinero(r.mes.total)}</span><small>\${plural(r.mes.n, 'venta', 'ventas')} \xB7 \${plural(r.mes.pzas, 'pieza', 'piezas')}</small></div>
      <div class="kpi"><span class="t-sec">\${S.rol === 'local' ? 'Valor a costo' : 'Valor en tienda'}</span><span class="num-g cifras">\${dinero(valor)}</span><small>\${S.rol === 'local' ? 'Almac\xE9n y tienda, al costo' : 'Existencias a precio de venta'}</small></div>
    </section>
    <div class="dos-col">
      <div class="pila">
        <section class="card" aria-label="Ventas de los \xFAltimos 7 d\xEDas">
          <div class="card-t"><h2 class="t-sec">Ventas \xB7 \xFAltimos 7 d\xEDas</h2><button type="button" class="btn btn-s btn-g" data-act="tabla-vtas" aria-pressed="\${String(S.verTabla)}">\${ico(S.verTabla ? 'cubo' : 'tabla')}\${S.verTabla ? 'Ver gr\xE1fica' : 'Ver tabla'}</button></div>
          <div class="graf" id="graf"></div>
        </section>
      </div>
      <div class="pila">
        <section class="card" aria-label="Lo m\xE1s vendido">
          <div class="card-t"><h2 class="t-sec">M\xE1s vendido \xB7 30 d\xEDas</h2></div>
          \${r.top.length ? html\`<ol class="rank">\${r.top.map((t) => html\`<li class="rank-i"><span class="n">\${nombreProd(t.id)}</span><span class="v">\${plural(t.pzas, 'pza', 'pzas')}</span><span class="b"><i style="width:\${Math.max(4, Math.round(t.pzas / topMax * 100))}%"></i></span></li>\`)}</ol>\`
            : html\`<div class="vacio" style="padding:20px 8px"><b>Sin ventas todav\xEDa</b><span>Cuando la tienda registre ventas ver\xE1s aqu\xED lo que m\xE1s sale.</span></div>\`}
        </section>
        <section class="card flat" aria-label="\xDAltimos movimientos">
          <div class="card-t" style="padding:14px 16px 0;margin:0"><h2 class="t-sec">\xDAltimos movimientos</h2><button type="button" class="btn btn-s btn-g" data-act="ir" data-tab-ir="historial">Ver todo</button></div>
          \${ops.length ? html\`<ul class="lista" style="margin-top:6px">\${ops.map(filaOperacion)}</ul>\` : html\`<div class="vacio"><b>A\xFAn no hay movimientos</b><span>Registra una entrada, un env\xEDo o una venta y aparecer\xE1 aqu\xED.</span></div>\`}
        </section>
      </div>
    </div>\`);
  dibujarGrafica();
}

function filaOperacion(g) {
  const t = TIPOS[g.tipo] || { t: g.tipo, ic: 'info', c: '' };
  return html\`<li><button type="button" class="item" data-act="op-det" data-grupo="\${g.grupo}">
    <span class="ico-c \${g.anulado ? '' : t.c}">\${ico(t.ic)}</span>
    <div class="grow"><div class="item-t \${g.anulado ? 'tachado' : ''}">\${tituloOp(g)}</div><div class="item-s">\${resumenOp(g)} \xB7 \${ROLES[g.rol].corto} \xB7 \${hace(g.ts)}</div></div>
    \${g.anulado ? html\`<span class="pill bad">Anulada</span>\` : g.total ? html\`<b class="cifras" style="font:700 18px var(--f-etiqueta)">\${dinero(g.total)}</b>\` : ''}
  </button></li>\`;
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 gr\xE1fica de ventas (columnas, una sola serie) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function escalaY(max) {
  if (max <= 0) return { tope: 1000, ticks: [0, 500, 1000] };
  const p0 = max / 4, mag = Math.pow(10, Math.floor(Math.log10(p0))), f = p0 / mag;
  const paso = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const n = Math.max(2, Math.ceil(max / paso - 1e-9));
  return { tope: paso * n, ticks: Array.from({ length: n + 1 }, (_, i) => i * paso) };
}
const compactoMXN = (v) => (v >= 1000 ? '$' + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace(/\\.0$/, '') + 'k' : '$' + Math.round(v));
const fmtDiaSemana = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
const fmtDiaMes = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });

function dibujarGrafica() {
  const cont = $('#graf');
  if (!cont || !S.est) return;
  const dias = S.est.resumen.dias;
  const fechaDe = (k) => new Date(k + 'T12:00:00');
  const hoyK = dias[dias.length - 1].k;
  if (!dias.some((d) => d.total !== 0 || d.pzas !== 0)) {
    poner(cont, html\`<div class="vacio" style="padding:26px 8px"><b>Sin ventas esta semana</b><span>La gr\xE1fica aparece en cuanto la tienda registre la primera venta.</span></div>\`);
    return;
  }
  if (S.verTabla) {
    poner(cont, html\`<table class="tabla"><thead><tr><th>D\xEDa</th><th class="r">Ventas</th><th class="r">Piezas</th></tr></thead><tbody>\${dias.slice().reverse().map((d) => html\`<tr><td>\${d.k === hoyK ? 'Hoy' : mayus(fmtDiaMes.format(fechaDe(d.k)).replace(/\\./g, ''))}</td><td class="r">\${dinero(d.total)}</td><td class="r">\${num(d.pzas)}</td></tr>\`)}</tbody></table>\`);
    return;
  }
  const W = Math.max(280, Math.round(cont.clientWidth || 320)), H = 210;
  const m = { t: 28, r: 8, b: 30, l: 46 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b, base = m.t + ph;
  const max = Math.max(...dias.map((d) => d.total), 0);
  const { tope, ticks } = escalaY(max);
  const slot = pw / dias.length, bw = Math.min(24, slot * 0.58);
  const iMax = dias.findIndex((d) => d.total === max && max > 0);
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Ventas de los \xFAltimos 7 d\xEDas">';
  ticks.forEach((v) => {
    const y = base - (v / tope) * ph;
    svg += '<line class="gl" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text x="' + (m.l - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + esc(compactoMXN(v)) + '</text>';
  });
  dias.forEach((d, i) => {
    const cx = m.l + i * slot + slot / 2, x = cx - bw / 2;
    const h = d.total > 0 ? Math.max(3, (d.total / tope) * ph) : 0, y = base - h, r = Math.min(4, bw / 2, h);
    const esHoy = d.k === hoyK;
    const etiqueta = (esHoy ? 'Hoy' : mayus(fmtDiaMes.format(fechaDe(d.k)).replace(/\\./g, ''))) + ': ' + dinero(d.total) + ', ' + plural(d.pzas, 'pieza', 'piezas');
    svg += '<g class="col" tabindex="0" role="img" aria-label="' + esc(etiqueta) + '" data-i="' + i + '"><rect class="hit" x="' + (m.l + i * slot).toFixed(1) + '" y="' + m.t + '" width="' + slot.toFixed(1) + '" height="' + (ph + m.b - 6) + '" rx="6"/>';
    if (h > 0) svg += '<path class="barra' + (esHoy ? ' hi' : '') + '" d="M' + x.toFixed(1) + ',' + base + ' V' + (y + r).toFixed(1) + ' Q' + x.toFixed(1) + ',' + y.toFixed(1) + ' ' + (x + r).toFixed(1) + ',' + y.toFixed(1) + ' H' + (x + bw - r).toFixed(1) + ' Q' + (x + bw).toFixed(1) + ',' + y.toFixed(1) + ' ' + (x + bw).toFixed(1) + ',' + (y + r).toFixed(1) + ' V' + base + ' Z"/>';
    if (h > 0 && (i === iMax || esHoy)) svg += '<text class="val" x="' + cx.toFixed(1) + '" y="' + (y - 7).toFixed(1) + '" text-anchor="middle">' + esc(compactoMXN(d.total)) + '</text>';
    svg += '<text class="' + (esHoy ? 'hoy-x' : '') + '" x="' + cx.toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle">' + esc(esHoy ? 'Hoy' : fmtDiaSemana.format(fechaDe(d.k)).replace(/\\./g, '')) + '</text></g>';
  });
  svg += '</svg><div class="tip" hidden></div>';
  poner(cont, raw(svg));
  const tip = $('.tip', cont);
  const mostrar = (g) => {
    const i = +g.dataset.i, d = dias[i];
    const cx = m.l + i * slot + slot / 2;
    const h = d.total > 0 ? Math.max(3, (d.total / tope) * ph) : 0;
    tip.hidden = false;
    poner(tip, html\`<b>\${dinero(d.total)}</b><span>\${d.k === hoyK ? 'Hoy' : mayus(fmtDiaMes.format(fechaDe(d.k)).replace(/\\./g, ''))} \xB7 \${plural(d.pzas, 'pieza', 'piezas')}</span>\`);
    const ancho = tip.offsetWidth || 140;
    tip.style.left = Math.min(Math.max(cx, ancho / 2 + 4), W - ancho / 2 - 4) + 'px';
    tip.style.top = Math.max(base - h - 10, 40) + 'px';
    g.classList.add('act');
  };
  $$('.col', cont).forEach((g) => {
    g.addEventListener('pointerenter', () => mostrar(g));
    g.addEventListener('focus', () => mostrar(g));
    g.addEventListener('pointerleave', () => { tip.hidden = true; g.classList.remove('act'); });
    g.addEventListener('blur', () => { tip.hidden = true; g.classList.remove('act'); });
    g.addEventListener('click', () => mostrar(g));
  });
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 INVENTARIO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
VISTAS.inventario = {
  armar: () => html\`<div data-vista="inventario">
    <div class="cabecera"><div><h1 class="t-pant">Inventario</h1><p class="t-peq" id="inv-sub" style="margin-top:8px"></p></div><div class="acciones-fab" id="inv-acc"></div></div>
    <div class="barra-filtros">
      <div class="buscar">\${ico('buscar')}<input class="inp" id="inv-q" type="search" placeholder="Buscar producto, medida o tono" autocomplete="off" aria-label="Buscar producto" value="\${S.filtro.q}"></div>
      <div class="chips" id="inv-chips" style="margin-top:10px"></div>
    </div>
    <div id="inv-lista"></div>
  </div>\`,
  montar() {
    $('#inv-q').addEventListener('input', (ev) => { S.filtro.q = ev.target.value; pintarListaInv(); });
  },
  actualizar() {
    const e = S.est, activos = e.productos.filter((p) => p.activo), bajos = bajosDe(S.rol).length;
    $('#inv-sub').textContent = plural(activos.length, 'producto', 'productos') + (bajos ? ' \xB7 ' + plural(bajos, 'con stock bajo', 'con stock bajo') : ' \xB7 todo en orden');
    poner($('#inv-acc'), S.rol === 'local' ? html\`<button type="button" class="btn btn-p" data-act="prod-nuevo">\${ico('plus')}Producto</button><button type="button" class="btn btn-g" data-act="variantes">\${ico('capas')}Crear bases</button>\` : '');
    const chips = [['todo', 'Todo'], ['base', 'Bases'], ['material', 'Materiales'], ['accesorio', 'Accesorios']];
    poner($('#inv-chips'), html\`\${chips.map(([k, t]) => html\`<button type="button" class="chip" data-act="filtro-cat" data-cat="\${k}" aria-pressed="\${String(S.filtro.cat === k)}">\${t}</button>\`)}<button type="button" class="chip" data-act="filtro-bajo" aria-pressed="\${String(S.filtro.bajo)}">\${ico('alerta')}Stock bajo\${bajos ? ' (' + bajos + ')' : ''}</button>\${S.rol === 'local' && e.productos.some((p) => !p.activo) ? html\`<button type="button" class="chip" data-act="filtro-arch" aria-pressed="\${String(S.filtro.archivados)}">Archivados</button>\` : ''}\`);
    pintarListaInv();
  }
};

function filaProducto(p, corto) {
  const lv = (loc) => nivel(p, loc);
  const cl = (loc) => { const v = lv(loc), st = loc === 'local' ? p.stock_local : p.stock_tienda; return v === 'agotado' ? 'agotado' : v === 'bajo' ? 'bajo' : st === 0 ? 'cero' : ''; };
  const cam = S.camino[p.id] || 0;
  return html\`<button type="button" class="prod \${p.activo ? '' : 'arch'}" data-act="prod" data-id="\${p.id}">
    <span class="prod-ico">\${iconoProd(p, 34)}</span>
    <span class="prod-main"><span class="prod-n">\${p.nombre}</span><span class="prod-s">\${p.activo ? subProd(p, corto) : 'Archivado'}</span></span>
    <span class="stocks"><span class="st \${cl('local')}"><b>\${num(p.stock_local)}</b><i>Almac\xE9n</i></span><span class="st \${cl('tienda')}"><b>\${num(p.stock_tienda)}</b><i>Tienda</i></span>\${cam ? html\`<span class="st cam"><b>\${num(cam)}</b><i>Camino</i></span>\` : ''}</span>
  </button>\`;
}

function pintarListaInv() {
  const cont = $('#inv-lista');
  if (!cont || !S.est) return;
  const F = S.filtro, q = norm(F.q);
  let lista = S.est.productos.filter((p) => (F.archivados ? true : p.activo));
  if (F.cat !== 'todo') lista = lista.filter((p) => p.cat === F.cat);
  if (F.bajo) lista = lista.filter((p) => p.activo && nivel(p, S.rol) !== 'ok');
  if (q) {
    lista = lista.filter((p) => {
      const m = medidaDe(p.medida), t = tonoDe(p.tono);
      return coincide(p.nombre + ' ' + (m ? m.nombre + ' ' + m.dims : '') + ' ' + (t ? t.nombre : '') + ' ' + CATS[p.cat], q);
    });
  }
  lista.sort(ordenProductos);
  if (!lista.length) {
    poner(cont, html\`<div class="vacio">\${ico('buscar')}<b>\${q || F.bajo ? 'Nada coincide con tu b\xFAsqueda' : 'Todav\xEDa no hay productos'}</b><span>\${q || F.bajo ? 'Prueba con otra palabra o quita los filtros.' : S.rol === 'local' ? 'Agrega tu primer producto o crea las bases por medida y tono.' : 'El almac\xE9n debe dar de alta los productos.'}</span></div>\`);
    return;
  }
  // las bases se agrupan por medida cuando no hay b\xFAsqueda, para ubicarlas r\xE1pido
  const grupos = [];
  const agrupado = !q;
  lista.forEach((p) => {
    const m = p.cat === 'base' ? medidaDe(p.medida) : null;
    const titulo = !q && F.cat !== 'base' && p.cat !== 'base' ? CATS[p.cat] : !q && p.cat === 'base' ? (m ? m.nombre + ' \xB7 ' + m.dims : 'Bases') : '';
    let g = grupos[grupos.length - 1];
    if (!g || g.titulo !== titulo) { g = { titulo, items: [] }; grupos.push(g); }
    g.items.push(p);
  });
  poner(cont, html\`\${grupos.map((g) => html\`\${g.titulo ? html\`<h2 class="t-sec grupo-t">\${g.titulo}</h2>\` : ''}<div class="prods">\${g.items.map((p) => filaProducto(p, agrupado && p.cat === 'base'))}</div>\`)}<p class="res-n">\${plural(lista.length, 'producto', 'productos')}</p>\`);
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 MOVER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
VISTAS.mover = {
  armar: () => html\`<div class="pila" data-vista="mover"><div class="cabecera"><div><h1 class="t-pant">Mover</h1><p class="t-peq" style="margin-top:8px">\${S.rol === 'local' ? 'Registra lo que entra, sale y viaja a la tienda.' : 'Registra ventas, mercanc\xEDa recibida y pedidos al almac\xE9n.'}</p></div></div><div id="mv-acc"></div><div id="mv-env"></div><div id="mv-ped"></div></div>\`,
  actualizar() {
    const e = S.est;
    const enT = e.traspasos.filter((t) => t.estado === 'en_transito');
    const acc = S.rol === 'local'
      ? [['envio', 'camion', 'Enviar a tienda', 'Arma el env\xEDo y la tienda lo confirma', true], ['entrada', 'entrada', 'Registrar entrada', 'Producci\xF3n o compra de material'], ['salida', 'salida', 'Registrar salida', 'Uso, merma u otra baja'], ['conteo', 'conteo', 'Conteo f\xEDsico', 'Ajusta el sistema a lo que contaste']]
      : [['venta', 'recibo', 'Registrar venta', 'Descuenta y suma al total del d\xEDa', true], ['recibir', 'camion', 'Recibir mercanc\xEDa', enT.length ? plural(enT.length, 'env\xEDo en camino', 'env\xEDos en camino') : 'No hay env\xEDos en camino'], ['pedido', 'pedido', 'Pedir al almac\xE9n', 'Avisa qu\xE9 bases hacen falta'], ['devolucion', 'devolver', 'Devoluci\xF3n', 'Un cliente regresa una base'], ['merma', 'basura', 'Merma', 'Da\xF1o o p\xE9rdida en tienda'], ['conteo', 'conteo', 'Conteo f\xEDsico', 'Ajusta el sistema a lo que contaste']];
    poner($('#mv-acc'), html\`<div class="atajos">\${acc.map(([k, ic, t, s, pri]) => html\`<button type="button" class="atajo \${pri ? 'pri' : ''}" data-act="forma" data-tipo="\${k}"><span class="ico-c \${pri ? '' : 'acc'}">\${ico(ic)}</span><b>\${t}</b><span>\${s}</span></button>\`)}</div>\`);

    const cerr = (arr, n) => arr.filter((x) => x.estado !== 'en_transito' && x.estado !== 'pendiente').slice(0, n);
    const envios = e.traspasos.filter((t) => t.estado === 'en_transito').concat(cerr(e.traspasos, 5));
    const pedidos = e.pedidos.filter((p) => p.estado === 'pendiente').concat(cerr(e.pedidos, 5));
    poner($('#mv-env'), html\`<section><h2 class="t-sec" style="margin:6px 2px 8px">Env\xEDos del almac\xE9n a la tienda</h2>
      \${envios.length ? html\`<div class="card flat"><ul class="lista">\${envios.map(tarjetaEnvio)}</ul></div>\` : html\`<div class="card"><div class="vacio" style="padding:18px"><b>Sin env\xEDos todav\xEDa</b><span>\${S.rol === 'local' ? 'Cuando mandes bases a la tienda aparecer\xE1n aqu\xED hasta que las confirmen.' : 'Aqu\xED ver\xE1s lo que el almac\xE9n te mande.'}</span></div></div>\`}</section>\`);
    poner($('#mv-ped'), html\`<section><h2 class="t-sec" style="margin:6px 2px 8px">Pedidos de la tienda</h2>
      \${pedidos.length ? html\`<div class="card flat"><ul class="lista">\${pedidos.map(tarjetaPedido)}</ul></div>\` : html\`<div class="card"><div class="vacio" style="padding:18px"><b>Sin pedidos</b><span>\${S.rol === 'tienda' ? 'Usa \u201CPedir al almac\xE9n\u201D cuando falten bases en tienda.' : 'Cuando la tienda pida bases las ver\xE1s aqu\xED.'}</span></div></div>\`}</section>\`);
  }
};

const ESTADO_TRASP = { en_transito: ['En camino', 'info'], recibido: ['Recibido', 'ok'], cancelado: ['Cancelado', 'bad'] };
const ESTADO_PED = { pendiente: ['Pendiente', 'warn'], surtido: ['Surtido', 'ok'], cancelado: ['Cancelado', 'bad'] };
const resumenLineas = (ls) => plural(ls.length, 'producto', 'productos') + ' \xB7 ' + plural(sumar(ls, (l) => l.cant), 'pieza', 'piezas');
function tarjetaEnvio(t) {
  const [txt, cl] = t.estado === 'recibido' && t.dif ? ['Con diferencias', 'warn'] : ESTADO_TRASP[t.estado];
  return html\`<li><button type="button" class="item" data-act="traspaso" data-id="\${t.id}"><span class="ico-c \${cl === 'info' ? 'info' : cl}">\${ico('camion')}</span>
    <div class="grow"><div class="item-t">\${resumenLineas(t.lineas)}</div><div class="item-s">Sali\xF3 \${hace(t.ts)}\${t.nota ? ' \xB7 ' + t.nota : ''}</div></div>
    <span class="pill \${cl}">\${txt}</span></button></li>\`;
}
function tarjetaPedido(p) {
  const [txt, cl] = ESTADO_PED[p.estado];
  return html\`<li><button type="button" class="item" data-act="pedido-det" data-id="\${p.id}"><span class="ico-c \${cl}">\${ico('pedido')}</span>
    <div class="grow"><div class="item-t">\${resumenLineas(p.lineas)}</div><div class="item-s">Pedido \${hace(p.ts)}\${p.nota ? ' \xB7 ' + p.nota : ''}</div></div>
    <span class="pill \${cl}">\${txt}</span></button></li>\`;
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 HISTORIAL \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const FILTROS_TIPO = [['todo', 'Todo', null], ['ventas', 'Ventas', 'venta,devolucion'], ['entradas', 'Entradas', 'entrada,inicial'], ['salidas', 'Salidas', 'salida,merma'], ['traspasos', 'Env\xEDos', 'envio,recibo,envio_cancelado'], ['ajustes', 'Ajustes', 'ajuste']];
VISTAS.historial = {
  armar: () => html\`<div data-vista="historial">
    <div class="cabecera"><div><h1 class="t-pant">Historial</h1><p class="t-peq" style="margin-top:8px">Todo lo que pas\xF3 con el inventario, con fecha y responsable.</p></div><button type="button" class="btn btn-g" data-act="exportar-movs">\${ico('bajar')}Exportar CSV</button></div>
    <div class="barra-filtros">
      <div class="grid2" style="grid-template-columns:minmax(0,1fr) 150px"><div class="buscar">\${ico('buscar')}<input class="inp" id="hs-q" type="search" placeholder="Buscar producto" autocomplete="off" aria-label="Buscar producto en el historial" value="\${S.hist.q}"></div>
      <select class="inp" id="hs-rango" aria-label="Periodo">\${[['hoy', 'Hoy'], ['7', '7 d\xEDas'], ['30', '30 d\xEDas'], ['todo', 'Todo']].map(([k, t]) => html\`<option value="\${k}" \${S.hist.rango === k ? raw('selected') : ''}>\${t}</option>\`)}</select></div>
      <div class="chips" id="hs-chips" style="margin-top:10px"></div>
    </div>
    <div id="hs-lista"></div>
  </div>\`,
  montar() {
    let t = null;
    $('#hs-q').addEventListener('input', (ev) => { S.hist.q = ev.target.value; clearTimeout(t); t = setTimeout(() => cargarHistorial(true), 250); });
    $('#hs-rango').addEventListener('change', (ev) => { S.hist.rango = ev.target.value; cargarHistorial(true); });
    S.hist.rev = null;
  },
  actualizar() {
    poner($('#hs-chips'), html\`\${FILTROS_TIPO.map(([k, t]) => html\`<button type="button" class="chip" data-act="hist-tipo" data-tipo="\${k}" aria-pressed="\${String(S.hist.tipo === k)}">\${t}</button>\`)}\`);
    if (S.hist.rev !== S.est.rev && !S.hist.cargando) cargarHistorial(true);
    else pintarHist();
  }
};

async function cargarHistorial(reiniciar) {
  const H = S.hist;
  if (H.cargando && !reiniciar) return;
  const q = { limite: 60 };
  const tipos = FILTROS_TIPO.find((f) => f[0] === H.tipo)[2];
  if (tipos) q.tipos = tipos;
  if (H.rango === 'hoy') q.desde = inicioDeDia(Date.now());
  else if (H.rango !== 'todo') q.desde = Date.now() - Number(H.rango) * DIA;
  const bq = norm(H.q);
  if (bq) {
    const ids = S.est.productos.filter((p) => coincide(p.nombre, bq)).map((p) => p.id).slice(0, 40);
    if (!ids.length) { H.items = []; H.siguiente = null; H.rev = S.est.rev; pintarHist(); return; }
    q.prods = ids.join(',');
  }
  if (!reiniciar && H.siguiente) q.antes = H.siguiente;
  const miSolicitud = (H.solicitud = (H.solicitud || 0) + 1);
  H.cargando = true;
  pintarHist();
  try {
    const r = await llamar('GET', '/movs', null, q);
    if (miSolicitud !== H.solicitud) return;
    if (r.json.ok) {
      H.items = reiniciar ? r.json.items : H.items.concat(r.json.items);
      H.siguiente = r.json.siguiente;
      H.rev = S.est.rev;
    } else if (r.status === 401) salir(r.json.error.mensaje);
  } catch (e) { toast(e.message, { tipo: 'error' }); } finally {
    if (miSolicitud === H.solicitud) { H.cargando = false; pintarHist(); }
  }
}

function pintarHist() {
  const cont = $('#hs-lista');
  if (!cont || S.tab !== 'historial') return;
  const H = S.hist, ops = agrupar(H.items);
  if (!ops.length) {
    poner(cont, H.cargando ? html\`<div class="cargando"><i></i></div>\` : html\`<div class="vacio">\${ico('reloj')}<b>No hay movimientos con estos filtros</b><span>Cambia el periodo o el tipo para ver m\xE1s.</span></div>\`);
    return;
  }
  let dia = '';
  const bloques = [];
  ops.forEach((g) => {
    const d = etiquetaDia(g.ts);
    if (d !== dia) { dia = d; bloques.push(html\`<h2 class="t-sec hist-dia">\${d}</h2>\`); }
    bloques.push(html\`<div class="card flat" style="margin-bottom:8px"><ul class="lista">\${filaOperacion(g)}</ul></div>\`);
  });
  poner(cont, html\`\${bloques}\${H.siguiente ? html\`<div style="text-align:center;margin-top:14px"><button type="button" class="btn btn-g" data-act="hist-mas" \${H.cargando ? raw('aria-busy="true"') : ''}>Cargar m\xE1s</button></div>\` : ''}\`);
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 editor de l\xEDneas: lista de productos con cantidades (y precio en ventas) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
let edN = 0;
function editorLineas(o) {
  const uid = 'ed' + (++edN);
  const L = (o.inicial || []).map((l) => Object.assign({}, l));
  const max = o.max || Core.MAX_LINEAS;
  const disp = (p) => (o.loc === 'local' ? p.stock_local : o.loc === 'tienda' ? p.stock_tienda : null);
  const el = document.createElement('div');
  poner(el, html\`<div class="lin-add">
      <label class="lbl" for="\${uid}-q">Agregar producto <span class="muted" data-cuenta></span></label>
      <div class="buscar">\${ico('buscar')}<input class="inp" id="\${uid}-q" type="search" autocomplete="off" placeholder="Busca por nombre, medida o tono" aria-controls="\${uid}-r"></div>
      <ul class="lin-res" id="\${uid}-r" role="listbox" hidden></ul>
    </div>
    <ul class="lin-lista" aria-live="polite"></ul>\`);
  const lista = $('.lin-lista', el), q = $('#' + uid + '-q', el), res = $('#' + uid + '-r', el), zona = $('.lin-add', el);
  const subBase = (p) => {
    const d = disp(p);
    if (o.modo === 'restar') return 'Disponible: ' + num(d);
    return d != null ? 'Ahora hay: ' + num(d) : subProd(p);
  };
  function lineaHtml(l, i) {
    const p = S.idx[l.id];
    if (!p) return '';
    return html\`<li class="lin" data-i="\${i}">
      <span class="prod-ico">\${iconoProd(p, 30)}</span>
      <div style="min-width:0"><div class="lin-n">\${p.nombre}</div><div class="lin-s" data-sub>\${subBase(p)}</div></div>
      <button type="button" class="icon-btn" data-quitar aria-label="Quitar \${p.nombre}">\${ico('x')}</button>
      <div class="lin-ctl">
        <div class="paso"><button type="button" data-menos aria-label="Una menos">\${ico('minus')}</button><input type="text" inputmode="numeric" pattern="[0-9]*" value="\${l.cant}" data-cant aria-label="Cantidad de \${p.nombre}"><button type="button" data-mas aria-label="Una m\xE1s">\${ico('plus')}</button></div>
        \${o.precio ? html\`<label class="precio"><span class="muted">$</span><input type="text" inputmode="decimal" value="\${l.precio}" data-precio placeholder="0" aria-label="Precio de \${p.nombre}"></label><span class="lin-sub cifras" data-sub-total></span>\` : ''}
      </div>
    </li>\`;
  }
  function marcar(li, l) {
    const p = S.idx[l.id], d = p ? disp(p) : null;
    const mal = o.modo === 'restar' && d != null && l.cant > d;
    li.classList.toggle('mal', mal);
    const s = $('[data-sub]', li);
    if (s) { s.classList.toggle('mal', mal); s.textContent = mal ? 'Solo hay ' + num(d) : subBase(p); }
    const st = $('[data-sub-total]', li);
    if (st) st.textContent = dinero(l.cant * decimal(l.precio));
    if (o.alCambiar) o.alCambiar();
  }
  function pintarLineas() {
    poner(lista, L.map(lineaHtml));
    $$('.lin', lista).forEach((li) => marcar(li, L[+li.dataset.i]));
    if (!L.length) poner(lista, html\`<li class="t-peq" style="padding:6px 2px">\${o.vacio || 'Todav\xEDa no agregas productos.'}</li>\`);
    const cuenta = $('[data-cuenta]', el);
    if (cuenta) cuenta.textContent = L.length ? '\xB7 ' + L.length + ' de ' + max : '';
    if (o.alCambiar) o.alCambiar();
  }
  function agregar(id, cant) {
    const p = S.idx[id];
    if (!p || L.some((l) => l.id === id) || L.length >= max) return;
    L.push({ id, cant: cant || 1, precio: o.precio ? (p.precio ? String(p.precio) : '') : undefined });
    pintarLineas();
  }
  function candidatos() {
    const ya = new Set(L.map((l) => l.id));
    return S.est.productos.filter((p) => p.activo && !ya.has(p.id) && o.cand(p) && coincide(p.nombre + ' ' + CATS[p.cat], q.value)).sort(ordenProductos);
  }
  function pintarRes() {
    if (L.length >= max) { res.hidden = false; poner(res, html\`<li class="nada">Llegaste al m\xE1ximo de \${max} productos por operaci\xF3n.</li>\`); return; }
    const c = candidatos();
    res.hidden = false;
    poner(res, c.length ? c.slice(0, 40).map((p) => html\`<li role="option"><button type="button" data-add="\${p.id}"><span class="prod-ico" style="width:38px;height:38px">\${iconoProd(p, 28)}</span><span class="prod-main"><span class="prod-n">\${p.nombre}</span><span class="prod-s">\${subBase(p)}</span></span></button></li>\`)
      : html\`<li class="nada">\${norm(q.value) ? 'Ning\xFAn producto coincide.' : (o.sinCand || 'No hay productos disponibles.')}</li>\`);
  }
  lista.addEventListener('click', (ev) => {
    const li = ev.target.closest('.lin');
    if (!li) return;
    const i = +li.dataset.i, l = L[i];
    if (ev.target.closest('[data-quitar]')) { L.splice(i, 1); pintarLineas(); return; }
    const inp = $('[data-cant]', li);
    if (ev.target.closest('[data-menos]')) { l.cant = Math.max(1, l.cant - 1); inp.value = l.cant; marcar(li, l); }
    if (ev.target.closest('[data-mas]')) { l.cant = Math.min(99999, l.cant + 1); inp.value = l.cant; marcar(li, l); }
  });
  lista.addEventListener('input', (ev) => {
    const li = ev.target.closest('.lin');
    if (!li) return;
    const l = L[+li.dataset.i];
    if (ev.target.matches('[data-cant]')) l.cant = entero(ev.target.value);
    if (ev.target.matches('[data-precio]')) l.precio = ev.target.value;
    marcar(li, l);
  });
  q.addEventListener('focus', pintarRes);
  q.addEventListener('click', pintarRes);
  q.addEventListener('input', pintarRes);
  q.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); const c = candidatos()[0]; if (c) { agregar(c.id); q.value = ''; pintarRes(); } }
    if (ev.key === 'Escape' && !res.hidden) { ev.stopPropagation(); res.hidden = true; }
  });
  res.addEventListener('mousedown', (ev) => ev.preventDefault());
  res.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-add]');
    if (b) { agregar(b.dataset.add); q.value = ''; pintarRes(); }
  });
  document.addEventListener('click', function fuera(ev) {
    if (!el.isConnected) { document.removeEventListener('click', fuera); return; }
    if (ev.target.isConnected && !zona.contains(ev.target)) res.hidden = true;
  });
  pintarLineas();
  return {
    el,
    lineas: () => L.map((l) => (o.precio ? { id: l.id, cant: l.cant, precio: decimal(l.precio) } : { id: l.id, cant: l.cant })),
    total: () => sumar(L, (l) => l.cant * decimal(l.precio)),
    cuantas: () => L.length,
    validar() {
      if (!L.length) return 'Agrega al menos un producto.';
      for (const l of L) {
        const p = S.idx[l.id], nom = p ? p.nombre : 'un producto';
        if (!p) return 'Un producto ya no existe. Qu\xEDtalo de la lista.';
        if (l.cant < 1) return 'Pon una cantidad en ' + nom + '.';
        if (o.modo === 'restar' && l.cant > disp(p)) return 'No alcanza ' + nom + ': solo hay ' + num(disp(p)) + '.';
        if (o.precio && !(decimal(l.precio) > 0)) return 'Falta el precio de ' + nom + '.';
      }
      return '';
    },
    agregar
  };
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 formularios de movimiento \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const FORMAS = {
  entrada: { titulo: 'Registrar entrada', op: 'mov.entrada', loc: 'local', modo: 'sumar', motivos: ['produccion', 'compra', 'otro'], ok: 'Guardar entrada', cand: () => true, ayuda: 'Suma al almac\xE9n lo que se fabric\xF3 o se compr\xF3.' },
  salida: { titulo: 'Registrar salida', op: 'mov.salida', loc: 'local', modo: 'restar', motivos: ['uso', 'merma', 'otro'], ok: 'Guardar salida', cand: (p) => p.stock_local > 0, ayuda: 'Resta del almac\xE9n lo que se us\xF3 o se perdi\xF3. Para mandar a la tienda usa \u201CEnviar a tienda\u201D.', sinCand: 'No hay productos con existencias en el almac\xE9n.' },
  venta: { titulo: 'Registrar venta', op: 'mov.venta', loc: 'tienda', modo: 'restar', precio: true, venta: true, ok: 'Registrar venta', cand: (p) => p.stock_tienda > 0, sinCand: 'No hay productos con existencias en la tienda.' },
  devolucion: { titulo: 'Devoluci\xF3n de cliente', op: 'mov.devolucion', loc: 'tienda', modo: 'sumar', precio: true, ok: 'Guardar devoluci\xF3n', cand: () => true, ayuda: 'La base regresa a la tienda y el monto se resta de las ventas.' },
  merma: { titulo: 'Merma en tienda', op: 'mov.merma', loc: 'tienda', modo: 'restar', ok: 'Guardar merma', cand: (p) => p.stock_tienda > 0, notaEt: '\xBFQu\xE9 pas\xF3?', ayuda: 'Para da\xF1os o p\xE9rdidas en la tienda.', sinCand: 'No hay productos con existencias en la tienda.' },
  envio: { titulo: 'Enviar a la tienda', op: 'traspaso.enviar', loc: 'local', modo: 'restar', ok: 'Enviar a la tienda', cand: (p) => p.stock_local > 0, ayuda: 'Las piezas salen del almac\xE9n ahora y entran a la tienda cuando alguien confirme que llegaron.', sinCand: 'No hay productos con existencias en el almac\xE9n.' },
  pedido: { titulo: 'Pedir al almac\xE9n', op: 'pedido.crear', loc: 'tienda', modo: 'sumar', ok: 'Enviar pedido', cand: () => true, ayuda: 'El almac\xE9n ver\xE1 tu pedido y preparar\xE1 el env\xEDo.' }
};
const waLink = (tel, texto) => 'https://wa.me/' + (tel || '') + '?text=' + encodeURIComponent(texto);
const lineasTexto = (ls) => ls.map((l) => '\u2022 ' + l.cant + ' \xD7 ' + nombreProd(l.id)).join('\\n');

function abrirForma(tipo, o) {
  o = o || {};
  if (tipo === 'conteo') return abrirConteo();
  const f = FORMAS[tipo];
  if (!f) return;
  const cid = nuevoCid();
  let motivo = f.motivos ? f.motivos[0] : '', pago = 'efectivo';
  const ed = editorLineas({
    modo: f.modo, loc: f.loc || S.rol, precio: f.precio, cand: f.cand, inicial: o.inicial, sinCand: f.sinCand,
    alCambiar: () => { const t = $('#f-total'); if (t) t.textContent = dinero(ed ? ed.total() : 0); }
  });
  const d = dialogo({
    titulo: f.titulo,
    clase: 'ancho',
    cuerpo: html\`
      \${f.ayuda ? html\`<p class="t-peq" style="margin-bottom:14px">\${f.ayuda}</p>\` : ''}
      \${tipo === 'pedido' && bajosDe('tienda').length ? html\`<div class="aviso warn" style="margin-bottom:14px;align-items:center">\${ico('alerta')}<span class="grow">\${plural(bajosDe('tienda').length, 'producto est\xE1 bajo', 'productos est\xE1n bajos')} en la tienda.</span><button type="button" class="btn btn-s btn-g" id="f-bajos">Agregarlos</button></div>\` : ''}
      \${f.motivos ? html\`<div class="campo"><span class="lbl">Motivo</span><div class="opciones" id="f-motivos">\${f.motivos.map((m) => html\`<button type="button" class="opcion" data-motivo="\${m}" aria-pressed="\${String(m === motivo)}">\${MOTIVOS[m]}</button>\`)}</div></div>\` : ''}
      <div id="f-ed"></div>
      \${f.precio ? html\`<div class="total-b"><span>Total</span><b id="f-total">\${dinero(0)}</b></div>\` : ''}
      \${f.venta ? html\`<label class="campo"><span class="lbl">Cliente (opcional)</span><input class="inp" id="f-cliente" maxlength="60" placeholder="Nombre o referencia" autocomplete="off"></label>
        <div class="campo"><span class="lbl">Forma de pago</span><div class="opciones g4" id="f-pagos">\${Object.keys(PAGOS).map((k) => html\`<button type="button" class="opcion" data-pago="\${k}" aria-pressed="\${String(k === pago)}" style="padding:0 6px">\${PAGOS[k]}</button>\`)}</div></div>\` : ''}
      <label class="campo"><span class="lbl">\${f.notaEt || 'Nota (opcional)'}</span><textarea class="inp" id="f-nota" rows="2" maxlength="200" placeholder="\${tipo === 'envio' ? 'Ej. sale en la camioneta de las 4' : 'Escribe algo que ayude a recordar'}"></textarea></label>
      <p class="err" id="f-err" hidden></p>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="f-ok">\${f.ok}</button>\`
  });
  $('#f-ed', d.el).appendChild(ed.el);
  const bj = $('#f-bajos', d.el);
  if (bj) bj.addEventListener('click', () => { bajosDe('tienda').forEach((p) => ed.agregar(p.id, Math.max(1, p.min_tienda * 2 - p.stock_tienda))); bj.disabled = true; });
  if (f.precio) $('#f-total', d.el).textContent = dinero(ed.total());
  const grupo = (sel, attr, fn) => {
    const cont = $(sel, d.el);
    if (!cont) return;
    cont.addEventListener('click', (ev) => {
      const b = ev.target.closest('[' + attr + ']');
      if (!b) return;
      fn(b.getAttribute(attr));
      $$('button', cont).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
  };
  grupo('#f-motivos', 'data-motivo', (v) => { motivo = v; });
  grupo('#f-pagos', 'data-pago', (v) => { pago = v; });
  const btn = $('#f-ok', d.el), err = $('#f-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    const msg = ed.validar();
    if (msg) throw new ErrorApi({ mensaje: msg });
    const cuerpo = { op: f.op, cid, lineas: ed.lineas(), nota: $('#f-nota', d.el).value.trim() };
    if (f.motivos) cuerpo.motivo = motivo;
    if (f.venta) { cuerpo.cliente = $('#f-cliente', d.el).value.trim(); cuerpo.pago = pago; }
    if (o.pedido) cuerpo.pedido = o.pedido;
    const res = await op(cuerpo);
    d.cerrar();
    exitoForma(tipo, res, cuerpo);
  }));
  return d;
}

async function deshacerOp(grupo) {
  try { await op({ op: 'mov.anular', grupo, motivo: 'Deshecho al momento' }); toast('Operaci\xF3n deshecha.'); } catch (e) { toast(e.message, { tipo: 'error' }); }
}
function exitoForma(tipo, res, cuerpo) {
  const e = S.est.negocio;
  const deshacer = res.grupo ? { texto: 'Deshacer', fn: () => deshacerOp(res.grupo) } : null;
  if (tipo === 'venta') toast('Venta registrada \xB7 ' + dinero(res.total), { accion: deshacer });
  else if (tipo === 'devolucion') toast('Devoluci\xF3n guardada \xB7 ' + dinero(res.total), { accion: deshacer });
  else if (tipo === 'entrada' || tipo === 'salida' || tipo === 'merma') toast('Guardado \xB7 ' + plural(res.piezas, 'pieza', 'piezas'), { accion: deshacer });
  else if (tipo === 'envio') {
    const texto = 'Bases Box Tepic \xB7 Env\xEDo a la tienda\\n' + lineasTexto(cuerpo.lineas) + '\\nTotal: ' + plural(res.piezas, 'pieza', 'piezas') + '.\\nConf\xEDrmalo en el inventario cuando llegue.';
    toast('Env\xEDo creado \xB7 ' + plural(res.piezas, 'pieza', 'piezas') + ' en camino', { accion: { texto: 'Avisar por WhatsApp', href: waLink(e.telTienda, texto) } });
  } else if (tipo === 'pedido') {
    const texto = 'Bases Box Tepic \xB7 Pedido de la tienda\\n' + lineasTexto(cuerpo.lineas) + (cuerpo.nota ? '\\nNota: ' + cuerpo.nota : '') + '\\nRev\xEDsalo en el inventario.';
    toast('Pedido enviado al almac\xE9n', { accion: { texto: 'Avisar por WhatsApp', href: waLink(e.telLocal, texto) } });
  }
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 conteo f\xEDsico general: todos los productos en una lista \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function abrirConteo() {
  const loc = S.rol, cid = nuevoCid();
  const vals = {};
  let cat = 'todo';
  const sist = (p) => (loc === 'local' ? p.stock_local : p.stock_tienda);
  const d = dialogo({
    titulo: 'Conteo f\xEDsico',
    clase: 'ancho',
    cuerpo: html\`<p class="t-peq" style="margin-bottom:12px">Escribe cu\xE1ntas piezas contaste de verdad en \${loc === 'local' ? 'el almac\xE9n' : 'la tienda'}. Lo que dejes en blanco no se toca. El sistema se ajusta a tus n\xFAmeros y cada ajuste queda registrado.</p>
      <div class="buscar">\${ico('buscar')}<input class="inp" id="cn-q" type="search" placeholder="Buscar producto" autocomplete="off" aria-label="Buscar producto"></div>
      <div class="chips" id="cn-chips" style="margin:10px 0 12px"></div>
      <div class="cnt-lista" id="cn-lista"></div>
      <label class="campo" style="margin-top:14px"><span class="lbl">Nota (opcional)</span><textarea class="inp" id="cn-nota" rows="2" maxlength="140" placeholder="Ej. conteo de fin de mes"></textarea></label>
      <p class="err" id="cn-err" hidden></p>\`,
    pie: html\`<span class="resumen" id="cn-res"></span><button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="cn-ok">Guardar conteo</button>\`
  });
  const cambios = () => S.est.productos.filter((p) => p.activo && vals[p.id] !== undefined && vals[p.id] !== '' && Number(vals[p.id]) !== sist(p)).map((p) => ({ id: p.id, contado: Number(vals[p.id]) }));
  const resumen = () => { const n = cambios().length; $('#cn-res', d.el).textContent = n ? plural(n, 'producto con diferencia', 'productos con diferencia') : 'Sin diferencias todav\xEDa'; };
  const chips = () => poner($('#cn-chips', d.el), html\`\${[['todo', 'Todo'], ['base', 'Bases'], ['material', 'Materiales'], ['accesorio', 'Accesorios']].map(([k, t]) => html\`<button type="button" class="chip" data-cat="\${k}" aria-pressed="\${String(cat === k)}">\${t}</button>\`)}\`);
  const filas = () => {
    const q = $('#cn-q', d.el).value;
    let lista = S.est.productos.filter((p) => p.activo && (cat === 'todo' || p.cat === cat) && (!q || coincide(p.nombre + ' ' + CATS[p.cat], q))).sort(ordenProductos);
    let ult = '';
    const out = [];
    lista.forEach((p) => {
      const m = p.cat === 'base' ? medidaDe(p.medida) : null;
      const g = !norm(q) ? (p.cat === 'base' ? (m ? m.nombre + ' \xB7 ' + m.dims : 'Bases') : CATS[p.cat]) : '';
      if (g && g !== ult) { ult = g; out.push(html\`<div class="cnt-h">\${g}</div>\`); }
      const v = vals[p.id];
      out.push(html\`<div class="cnt \${v !== undefined && v !== '' && Number(v) !== sist(p) ? 'cambio' : ''}" data-id="\${p.id}"><span class="prod-ico" style="width:38px;height:38px">\${iconoProd(p, 28)}</span><div class="grow"><div class="lin-n">\${p.nombre}</div><div class="lin-s">En el sistema: \${num(sist(p))}</div></div><input class="cnt-in" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="\${sist(p)}" value="\${v === undefined ? '' : v}" aria-label="Contado de \${p.nombre}"></div>\`);
    });
    poner($('#cn-lista', d.el), out.length ? out : html\`<div class="vacio" style="padding:22px"><b>Nada coincide</b><span>Prueba con otra palabra.</span></div>\`);
  };
  chips(); filas(); resumen();
  $('#cn-q', d.el).addEventListener('input', filas);
  $('#cn-chips', d.el).addEventListener('click', (ev) => { const b = ev.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; chips(); filas(); } });
  $('#cn-lista', d.el).addEventListener('input', (ev) => {
    const fila = ev.target.closest('.cnt');
    if (!fila || !ev.target.matches('.cnt-in')) return;
    const limpio = ev.target.value.replace(/\\D/g, '').slice(0, 5);
    if (limpio !== ev.target.value) ev.target.value = limpio;
    vals[fila.dataset.id] = limpio;
    const p = S.idx[fila.dataset.id];
    fila.classList.toggle('cambio', limpio !== '' && Number(limpio) !== sist(p));
    resumen();
  });
  const btn = $('#cn-ok', d.el), err = $('#cn-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    const cs = cambios();
    if (!cs.length) throw new ErrorApi({ mensaje: 'No hay diferencias: lo que escribiste coincide con el sistema.' });
    const nota = $('#cn-nota', d.el).value.trim();
    const trozos = [];
    for (let i = 0; i < cs.length; i += Core.MAX_LINEAS) trozos.push(cs.slice(i, i + Core.MAX_LINEAS));
    let hechos = 0;
    for (let i = 0; i < trozos.length; i++) {
      try {
        await op({ op: 'mov.conteo', cid: cid + '-' + i, nota, lineas: trozos[i] });
      } catch (e) {
        if (e.code === 'sin_cambios') { hechos += trozos[i].length; continue; } // ese tramo ya estaba guardado
        if (hechos) throw new ErrorApi({ mensaje: 'Se guardaron ' + hechos + ' de ' + cs.length + ' productos. ' + e.message + ' Vuelve a guardar: lo que ya qued\xF3 no se repite.' });
        throw e;
      }
      hechos += trozos[i].length;
    }
    d.cerrar();
    toast('Inventario ajustado \xB7 ' + plural(cs.length, 'producto', 'productos'));
  }));
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 recibir mercanc\xEDa \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function formRecibir(id) {
  const t = S.est.traspasos.find((x) => x.id === id);
  if (!t || t.estado !== 'en_transito') { toast('Ese env\xEDo ya no est\xE1 en camino.'); return; }
  const cid = nuevoCid();
  const rec = {};
  t.lineas.forEach((l) => { rec[l.id] = l.cant; });
  const d = dialogo({
    titulo: 'Recibir mercanc\xEDa',
    clase: 'ancho',
    cuerpo: html\`<p style="margin-bottom:4px"><b>Sali\xF3 \${hace(t.ts)}</b>\${t.nota ? ' \xB7 ' + t.nota : ''}</p><p class="t-peq" style="margin-bottom:14px">Revisa que cada pieza haya llegado. Si falta o lleg\xF3 da\xF1ada, corrige el n\xFAmero y anota qu\xE9 pas\xF3.</p>
      <ul class="lin-lista">\${t.lineas.map((l) => html\`<li class="lin" data-id="\${l.id}">
        <span class="prod-ico">\${S.idx[l.id] ? iconoProd(S.idx[l.id], 30) : ''}</span>
        <div style="min-width:0"><div class="lin-n">\${nombreProd(l.id)}</div><div class="lin-s" data-sub>Enviadas: \${num(l.cant)}</div></div><span></span>
        <div class="lin-ctl"><div class="paso"><button type="button" data-menos aria-label="Una menos">\${ico('minus')}</button><input type="text" inputmode="numeric" value="\${l.cant}" data-cant aria-label="Recibidas de \${nombreProd(l.id)}"><button type="button" data-mas aria-label="Una m\xE1s">\${ico('plus')}</button></div><span class="t-peq">de \${num(l.cant)}</span></div>
      </li>\`)}</ul>
      <label class="campo"><span class="lbl" id="r-nota-et">Nota (obligatoria si hay diferencia)</span><textarea class="inp" id="r-nota" rows="2" maxlength="200" placeholder="Ej. lleg\xF3 una base rota"></textarea></label>
      <p class="err" id="r-err" hidden></p>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="r-ok">\${ico('check')}Confirmar recibido</button>\`
  });
  const lista = $('.lin-lista', d.el);
  const marcar = (li) => {
    const l = t.lineas.find((x) => x.id === li.dataset.id), r = rec[l.id], dif = r !== l.cant;
    li.classList.toggle('mal', dif);
    const s = $('[data-sub]', li);
    s.classList.toggle('mal', dif);
    s.textContent = dif ? (r < l.cant ? 'Faltan ' + (l.cant - r) + ' de ' + num(l.cant) : 'No puede ser m\xE1s de lo enviado') : 'Enviadas: ' + num(l.cant);
  };
  lista.addEventListener('click', (ev) => {
    const li = ev.target.closest('.lin');
    if (!li) return;
    const l = t.lineas.find((x) => x.id === li.dataset.id), inp = $('[data-cant]', li);
    if (ev.target.closest('[data-menos]')) rec[l.id] = Math.max(0, rec[l.id] - 1);
    else if (ev.target.closest('[data-mas]')) rec[l.id] = Math.min(l.cant, rec[l.id] + 1);
    else return;
    inp.value = rec[l.id];
    marcar(li);
  });
  lista.addEventListener('input', (ev) => {
    const li = ev.target.closest('.lin');
    if (!li || !ev.target.matches('[data-cant]')) return;
    rec[li.dataset.id] = entero(ev.target.value);
    marcar(li);
  });
  const btn = $('#r-ok', d.el), err = $('#r-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    const nota = $('#r-nota', d.el).value.trim();
    const dif = t.lineas.some((l) => rec[l.id] !== l.cant);
    if (t.lineas.some((l) => rec[l.id] > l.cant)) throw new ErrorApi({ mensaje: 'Lo recibido no puede ser m\xE1s de lo enviado.' });
    if (dif && nota.length < 3) { $('#r-nota', d.el).focus(); throw new ErrorApi({ mensaje: 'Anota qu\xE9 pas\xF3 con la diferencia (faltante o da\xF1o).' }); }
    const res = await op({ op: 'traspaso.recibir', cid, id, nota, lineas: t.lineas.map((l) => ({ id: l.id, recibida: rec[l.id] })) });
    d.cerrar();
    toast(res.dif ? 'Recibido con diferencias \xB7 ' + plural(res.piezas, 'pieza', 'piezas') : 'Mercanc\xEDa recibida \xB7 ' + plural(res.piezas, 'pieza', 'piezas'));
  }));
}

function recibirYa() {
  const enT = S.est.traspasos.filter((t) => t.estado === 'en_transito');
  if (!enT.length) { toast('No hay env\xEDos en camino.'); return; }
  if (enT.length === 1) { formRecibir(enT[0].id); return; }
  const d = dialogo({ titulo: 'Env\xEDos en camino', cuerpo: html\`<p class="t-peq" style="margin-bottom:10px">Elige cu\xE1l lleg\xF3.</p><div class="card flat"><ul class="lista">\${enT.map(tarjetaEnvio)}</ul></div>\` });
  d.el.addEventListener('click', (ev) => { if (ev.target.closest('[data-act="traspaso"]')) d.cerrar(); });
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 detalle de env\xEDo, pedido y operaci\xF3n \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function abrirTraspaso(id) {
  const t = S.est.traspasos.find((x) => x.id === id);
  if (!t) return;
  const [txt, cl] = t.estado === 'recibido' && t.dif ? ['Con diferencias', 'warn'] : ESTADO_TRASP[t.estado];
  const esLocal = S.rol === 'local';
  const abierto = t.estado === 'en_transito';
  const d = dialogo({
    titulo: 'Env\xEDo a la tienda',
    clase: 'ancho',
    cuerpo: html\`<div class="sep" style="margin-bottom:12px"><span class="pill \${cl}">\${txt}</span><span class="t-peq">Sali\xF3 \${hace(t.ts)}</span></div>
      <div class="card flat" style="margin-bottom:14px"><ul class="lista">\${t.lineas.map((l) => html\`<li class="item" style="min-height:52px"><span class="prod-ico" style="width:38px;height:38px">\${S.idx[l.id] ? iconoProd(S.idx[l.id], 28) : ''}</span><div class="grow"><div class="item-t">\${nombreProd(l.id)}</div></div><div style="text-align:right"><b class="cifras" style="font:700 18px var(--f-etiqueta)">\${num(t.estado === 'recibido' ? l.recibida : l.cant)}</b>\${t.estado === 'recibido' && l.recibida !== l.cant ? html\`<div class="t-peq" style="color:var(--warn)">de \${num(l.cant)} enviadas</div>\` : ''}</div></li>\`)}</ul></div>
      <dl class="kv">
        \${t.nota ? html\`<dt>Nota del env\xEDo</dt><dd>\${t.nota}</dd>\` : ''}
        \${t.estado === 'recibido' ? html\`<dt>Recibido</dt><dd>\${hace(t.recibido_ts)}</dd>\` : ''}
        \${t.nota_recibo ? html\`<dt>\${t.estado === 'cancelado' ? 'Motivo' : 'Nota al recibir'}</dt><dd>\${t.nota_recibo}</dd>\` : ''}
      </dl>
      \${abierto && esLocal ? html\`<div class="aviso" style="margin-top:14px">\${ico('info')}<span>Si cancelas, las piezas regresan al inventario del almac\xE9n.</span></div>\` : ''}\`,
    pie: abierto ? (esLocal ? html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-r" id="t-cancelar">Cancelar env\xEDo</button>\` : html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="t-recibir">\${ico('check')}Recibir mercanc\xEDa</button>\`) : html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>\`
  });
  const rc = $('#t-recibir', d.el);
  if (rc) rc.addEventListener('click', () => { d.cerrar(); formRecibir(id); });
  const cn = $('#t-cancelar', d.el);
  if (cn) cn.addEventListener('click', async () => {
    const motivo = await confirmar({ titulo: 'Cancelar env\xEDo', texto: 'Las piezas regresan al inventario del almac\xE9n.', ok: 'Cancelar env\xEDo', cancelar: 'Volver', peligro: true, campo: { etiqueta: 'Motivo', min: 3, error: 'Escribe por qu\xE9 cancelas el env\xEDo.' } });
    if (!motivo) return;
    try { await op({ op: 'traspaso.cancelar', id, motivo }); d.cerrar(); toast('Env\xEDo cancelado. Las piezas volvieron al almac\xE9n.'); } catch (e) { toast(e.message, { tipo: 'error' }); }
  });
}

function abrirPedido(id) {
  const p = S.est.pedidos.find((x) => x.id === id);
  if (!p) return;
  const [txt, cl] = ESTADO_PED[p.estado];
  const abierto = p.estado === 'pendiente';
  const d = dialogo({
    titulo: 'Pedido de la tienda',
    clase: 'ancho',
    cuerpo: html\`<div class="sep" style="margin-bottom:12px"><span class="pill \${cl}">\${txt}</span><span class="t-peq">Pedido \${hace(p.ts)}</span></div>
      <div class="card flat" style="margin-bottom:14px"><ul class="lista">\${p.lineas.map((l) => { const pr = S.idx[l.id]; return html\`<li class="item" style="min-height:52px"><span class="prod-ico" style="width:38px;height:38px">\${pr ? iconoProd(pr, 28) : ''}</span><div class="grow"><div class="item-t">\${nombreProd(l.id)}</div>\${pr ? html\`<div class="item-s">En almac\xE9n: \${num(pr.stock_local)} \xB7 En tienda: \${num(pr.stock_tienda)}</div>\` : ''}</div><b class="cifras" style="font:700 18px var(--f-etiqueta)">\${num(l.cant)}</b></li>\`; })}</ul></div>
      \${p.nota ? html\`<dl class="kv"><dt>Nota</dt><dd>\${p.nota}</dd></dl>\` : ''}\`,
    pie: abierto ? (S.rol === 'local' ? html\`<button type="button" class="btn btn-g" id="p-descartar">Descartar</button><button type="button" class="btn btn-p" id="p-surtir">\${ico('camion')}Preparar env\xEDo</button>\` : html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-r" id="p-descartar">Cancelar pedido</button>\`) : html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>\`
  });
  const sr = $('#p-surtir', d.el);
  if (sr) sr.addEventListener('click', () => {
    d.cerrar();
    const inicial = p.lineas.filter((l) => S.idx[l.id] && S.idx[l.id].activo && S.idx[l.id].stock_local > 0).map((l) => ({ id: l.id, cant: Math.min(l.cant, S.idx[l.id].stock_local) }));
    if (!inicial.length) toast('Ninguno de esos productos tiene existencias en el almac\xE9n.', { tipo: 'error' });
    abrirForma('envio', { inicial, pedido: id });
  });
  const ds = $('#p-descartar', d.el);
  if (ds) ds.addEventListener('click', async () => {
    const ok = await confirmar({ titulo: S.rol === 'local' ? 'Descartar pedido' : 'Cancelar pedido', texto: 'El pedido deja de estar pendiente.', ok: S.rol === 'local' ? 'Descartar' : 'Cancelar pedido', cancelar: 'Volver', peligro: true });
    if (!ok) return;
    try { await op({ op: 'pedido.cancelar', id }); d.cerrar(); toast('Pedido cancelado.'); } catch (e) { toast(e.message, { tipo: 'error' }); }
  });
}

function buscarOperacion(grupo) {
  const ls = S.hist.items.filter((m) => m.grupo === grupo);
  const src = ls.length ? ls : S.est.recientes.filter((m) => m.grupo === grupo);
  return src.length ? agrupar(src)[0] : null;
}
function abrirOperacion(grupo) {
  const g = buscarOperacion(grupo);
  if (!g) return;
  const t = TIPOS[g.tipo] || { t: g.tipo, ic: 'info', c: '' };
  const conPrecio = g.tipo === 'venta' || g.tipo === 'devolucion';
  const d = dialogo({
    titulo: tituloOp(g),
    cuerpo: html\`<div class="sep" style="margin-bottom:12px"><span class="t-peq">\${ROLES[g.rol].nombre} \xB7 \${hace(g.ts)}</span>\${g.anulado ? html\`<span class="pill bad">Anulada</span>\` : ''}</div>
      <div class="card flat" style="margin-bottom:14px"><ul class="lista">\${g.lineas.map((m) => html\`<li class="item" style="min-height:52px"><span class="prod-ico" style="width:38px;height:38px">\${S.idx[m.prod] ? iconoProd(S.idx[m.prod], 28) : ''}</span><div class="grow"><div class="item-t \${g.anulado ? 'tachado' : ''}">\${nombreProd(m.prod)}</div><div class="item-s">\${m.loc === 'local' ? 'Almac\xE9n' : 'Tienda'}\${conPrecio ? ' \xB7 ' + dinero(m.precio) + ' c/u' : ''}</div></div><b class="cifras" style="font:700 19px var(--f-etiqueta);color:\${m.delta < 0 ? 'var(--bad)' : 'var(--ok)'}">\${m.delta > 0 ? '+' : '\u2212'}\${num(Math.abs(m.delta))}</b></li>\`)}</ul></div>
      <dl class="kv">
        \${conPrecio ? html\`<dt>Total</dt><dd>\${dinero(g.total)}</dd>\` : ''}
        \${g.cliente ? html\`<dt>Cliente</dt><dd>\${g.cliente}</dd>\` : ''}
        \${g.pago && g.tipo === 'venta' ? html\`<dt>Pago</dt><dd>\${PAGOS[g.pago] || g.pago}</dd>\` : ''}
        \${g.nota ? html\`<dt>Nota</dt><dd>\${g.nota}</dd>\` : ''}
        \${g.anulado ? html\`<dt>Anulada</dt><dd>\${hace(g.anulado_ts)} \xB7 \${g.anulado_por === 'local' ? 'Almac\xE9n' : 'Tienda'}</dd><dt>Motivo</dt><dd>\${g.anulado_nota}</dd>\` : ''}
      </dl>\`,
    pie: puedeAnular(g) ? html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-r" id="o-anular">Anular operaci\xF3n</button>\` : html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>\`
  });
  const an = $('#o-anular', d.el);
  if (an) an.addEventListener('click', async () => {
    const motivo = await confirmar({ titulo: 'Anular operaci\xF3n', texto: 'El inventario vuelve a como estaba antes. La operaci\xF3n queda en el historial marcada como anulada.', ok: 'Anular', cancelar: 'Volver', peligro: true, campo: { etiqueta: 'Motivo', min: 3, error: 'Escribe el motivo de la anulaci\xF3n.' } });
    if (!motivo) return;
    try { await op({ op: 'mov.anular', grupo, motivo }); d.cerrar(); toast('Operaci\xF3n anulada.'); S.hist.rev = null; if (S.tab === 'historial') cargarHistorial(true); } catch (e) { toast(e.message, { tipo: 'error' }); }
  });
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 producto: detalle y formularios \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function abrirProducto(id) {
  const p = S.idx[id];
  if (!p) return;
  const med = p.cat === 'base' ? medidaDe(p.medida) : null, tono = p.cat === 'base' ? tonoDe(p.tono) : null;
  const esLocal = S.rol === 'local';
  const cam = S.camino[p.id] || 0;
  const tile = (et, v, mn, loc) => { const nv = loc ? nivel(p, loc) : 'ok'; return html\`<div class="kpi"><span class="t-sec">\${et}</span><span class="num-g cifras" style="color:\${nv === 'agotado' ? 'var(--bad)' : nv === 'bajo' ? 'var(--warn)' : 'inherit'}">\${num(v)}</span><small>\${loc ? (nv === 'agotado' ? 'Agotado' : nv === 'bajo' ? 'Stock bajo' : mn > 0 ? 'M\xEDnimo ' + num(mn) : 'Sin m\xEDnimo') : 'Sin confirmar'}</small></div>\`; };
  const pie = !p.activo ? (esLocal ? html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="pd-reactivar">Reactivar producto</button>\` : html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>\`)
    : esLocal ? html\`<button type="button" class="btn btn-g" id="pd-editar">\${ico('editar')}Editar</button><button type="button" class="btn btn-g" id="pd-entrada">\${ico('entrada')}Entrada</button><button type="button" class="btn btn-p" id="pd-enviar">\${ico('camion')}Enviar a tienda</button>\`
    : html\`<button type="button" class="btn btn-g" id="pd-pedir">\${ico('pedido')}Pedir al almac\xE9n</button><button type="button" class="btn btn-p" id="pd-vender">\${ico('recibo')}Vender</button>\`;
  const d = dialogo({
    titulo: p.nombre,
    clase: 'ancho',
    cuerpo: html\`<div class="fila" style="gap:14px;margin-bottom:16px"><span class="prod-ico" style="width:68px;height:68px;border-radius:14px">\${iconoProd(p, 52)}</span>
        <div class="grow"><div class="t-peq">\${CATS[p.cat].replace(/s$/, '')}\${med ? ' \xB7 ' + med.nombre + ' ' + med.dims : ''}\${tono ? ' \xB7 ' + tono.nombre : ''}</div><div class="num-g" style="margin-top:6px">\${p.precio ? dinero(p.precio) : 'Sin precio'}</div></div>\${p.activo ? '' : html\`<span class="pill">Archivado</span>\`}</div>
      <div class="grid-kpi" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:16px">\${tile('Almac\xE9n', p.stock_local, p.min_local, 'local')}\${tile('Tienda', p.stock_tienda, p.min_tienda, 'tienda')}\${tile('En camino', cam, 0, null)}</div>
      <dl class="kv" style="margin-bottom:18px"><dt>Unidad</dt><dd>\${p.unidad}</dd>\${esLocal ? html\`<dt>Costo</dt><dd>\${p.costo ? dinero(p.costo) : '\u2014'}</dd>\${p.costo && p.precio ? html\`<dt>Margen</dt><dd>\${Math.round((1 - p.costo / p.precio) * 100)}%</dd>\` : ''}\` : ''}<dt>M\xEDnimos</dt><dd>Almac\xE9n \${num(p.min_local)} \xB7 Tienda \${num(p.min_tienda)}</dd></dl>
      <h3 class="t-sec" style="margin-bottom:8px">\xDAltimos movimientos</h3>
      <div class="card flat"><ul class="lista" id="pd-movs"><li class="item t-peq">Cargando\u2026</li></ul></div>\`,
    pie
  });
  llamar('GET', '/movs', null, { prods: p.id, limite: 8 }).then((r) => {
    const ul = $('#pd-movs', d.el);
    if (!ul || !r.json.ok) return;
    const ops = agrupar(r.json.items);
    poner(ul, ops.length ? ops.map((g) => { const m = g.lineas.find((x) => x.prod === p.id) || g.lineas[0]; const t = TIPOS[g.tipo] || {}; return html\`<li class="item" style="min-height:48px"><span class="ico-c \${g.anulado ? '' : t.c}" style="width:34px;height:34px">\${ico(t.ic || 'info')}</span><div class="grow"><div class="item-t \${g.anulado ? 'tachado' : ''}" style="font-size:15px">\${tituloOp(g)}</div><div class="item-s">\${hace(g.ts)} \xB7 \${ROLES[g.rol].corto}</div></div><b class="cifras" style="font:700 17px var(--f-etiqueta);color:\${m.delta < 0 ? 'var(--bad)' : 'var(--ok)'}">\${m.delta > 0 ? '+' : '\u2212'}\${num(Math.abs(m.delta))}</b></li>\`; })
      : html\`<li class="item t-peq">Sin movimientos todav\xEDa.</li>\`);
  }).catch(() => { const ul = $('#pd-movs', d.el); if (ul) poner(ul, html\`<li class="item t-peq">No se pudo cargar el historial.</li>\`); });
  const ir = (sel, fn) => { const b = $(sel, d.el); if (b) b.addEventListener('click', () => { d.cerrar(); fn(); }); };
  ir('#pd-editar', () => formProducto(p));
  ir('#pd-entrada', () => abrirForma('entrada', { inicial: [{ id: p.id, cant: 1 }] }));
  ir('#pd-enviar', () => { if (p.stock_local < 1) toast('No hay existencias en el almac\xE9n para enviar.', { tipo: 'error' }); else abrirForma('envio', { inicial: [{ id: p.id, cant: 1 }] }); });
  ir('#pd-pedir', () => abrirForma('pedido', { inicial: [{ id: p.id, cant: Math.max(1, p.min_tienda * 2 - p.stock_tienda) }] }));
  ir('#pd-vender', () => { if (p.stock_tienda < 1) toast('No hay existencias en la tienda para vender.', { tipo: 'error' }); else abrirForma('venta', { inicial: [{ id: p.id, cant: 1, precio: p.precio ? String(p.precio) : '' }] }); });
  const rx = $('#pd-reactivar', d.el);
  if (rx) rx.addEventListener('click', async () => { try { await op({ op: 'producto.archivar', id: p.id, activo: true }); d.cerrar(); toast('Producto reactivado.'); } catch (e) { toast(e.message, { tipo: 'error' }); } });
}

function formProducto(p) {
  const nuevo = !p;
  const e = S.est;
  const cid = nuevoCid();
  let nombreManual = !nuevo, precioManual = !nuevo;
  const sel = (id, lista, actual, vacio) => html\`<select class="inp" id="\${id}">\${vacio ? html\`<option value="">\${vacio}</option>\` : ''}\${lista.map((x) => html\`<option value="\${x.id}" \${x.id === actual ? raw('selected') : ''}>\${x.nombre}\${x.dims ? ' \xB7 ' + x.dims : ''}</option>\`)}</select>\`;
  const cat0 = nuevo ? 'base' : p.cat;
  const d = dialogo({
    titulo: nuevo ? 'Nuevo producto' : 'Editar producto',
    clase: 'ancho',
    cuerpo: html\`
      \${nuevo ? html\`<label class="campo"><span class="lbl">Categor\xEDa</span><select class="inp" id="pf-cat">\${Object.keys(CATS).map((k) => html\`<option value="\${k}" \${k === cat0 ? raw('selected') : ''}>\${CATS[k].replace(/s$/, '')}</option>\`)}</select></label>\` : ''}
      <div class="grid2" id="pf-base" \${cat0 === 'base' ? '' : raw('hidden')}>
        <label class="campo"><span class="lbl">Medida</span>\${sel('pf-medida', e.medidas, p ? p.medida : '', 'Sin medida')}</label>
        <label class="campo"><span class="lbl">Tono</span>\${sel('pf-tono', e.tonos, p ? p.tono : '', 'Sin tono')}</label>
      </div>
      <label class="campo"><span class="lbl">Nombre</span><input class="inp" id="pf-nombre" maxlength="80" value="\${p ? p.nombre : ''}" autocomplete="off" placeholder="Ej. Base Queen \xB7 Gris"></label>
      <div class="grid2">
        <label class="campo"><span class="lbl">Precio de venta ($)</span><input class="inp" id="pf-precio" inputmode="decimal" value="\${p && p.precio ? p.precio : ''}" placeholder="0"></label>
        <label class="campo"><span class="lbl">Costo ($)</span><input class="inp" id="pf-costo" inputmode="decimal" value="\${p && p.costo ? p.costo : ''}" placeholder="0"></label>
        <label class="campo"><span class="lbl">Unidad</span><input class="inp" id="pf-unidad" maxlength="12" value="\${p ? p.unidad : 'pza'}" placeholder="pza, hoja, m\u2026"></label>
        <span></span>
        <label class="campo"><span class="lbl">M\xEDnimo en almac\xE9n</span><input class="inp" id="pf-minl" inputmode="numeric" value="\${p ? p.min_local : 2}"></label>
        <label class="campo"><span class="lbl">M\xEDnimo en tienda</span><input class="inp" id="pf-mint" inputmode="numeric" value="\${p ? p.min_tienda : 1}"></label>
        \${nuevo ? html\`<label class="campo"><span class="lbl">Existencias en almac\xE9n</span><input class="inp" id="pf-sl" inputmode="numeric" value="0"></label><label class="campo"><span class="lbl">Existencias en tienda</span><input class="inp" id="pf-st" inputmode="numeric" value="0"></label>\` : ''}
      </div>
      <p class="ayuda" style="margin-top:-6px">Te avisamos cuando las existencias bajen del m\xEDnimo. Pon 0 si no quieres alertas.</p>
      \${!nuevo ? html\`<div class="aviso warn" style="margin-top:14px">\${ico('info')}<span>Para cambiar las existencias usa un <b>conteo f\xEDsico</b>, as\xED queda registrado. \${p.activo ? 'Para dejar de usar este producto, d\xE9jalo en cero y arch\xEDvalo.' : ''}</span></div>\` : ''}
      <p class="err" id="pf-err" hidden></p>\`,
    pie: html\`\${!nuevo && p.activo ? html\`<button type="button" class="btn btn-g" id="pf-archivar" style="flex:0 1 auto">\${ico('archivo')}Archivar</button>\` : ''}<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="pf-ok">\${nuevo ? 'Crear producto' : 'Guardar cambios'}</button>\`
  });
  const $d = (s) => $(s, d.el);
  const sugerir = () => {
    const cat = nuevo ? $d('#pf-cat').value : p.cat;
    if (cat !== 'base') return;
    const m = e.medidas.find((x) => x.id === $d('#pf-medida').value), t = e.tonos.find((x) => x.id === $d('#pf-tono').value);
    if (!nombreManual && (m || t)) $d('#pf-nombre').value = m && t ? 'Base ' + m.nombre + ' \xB7 ' + t.nombre : 'Base ' + (m ? m.nombre : t.nombre);
    if (!precioManual && m && m.precio) $d('#pf-precio').value = m.precio;
  };
  if (nuevo) {
    $d('#pf-cat').addEventListener('change', () => { $d('#pf-base').hidden = $d('#pf-cat').value !== 'base'; $d('#pf-unidad').value = $d('#pf-cat').value === 'base' ? 'pza' : $d('#pf-unidad').value; sugerir(); });
    $d('#pf-nombre').addEventListener('input', () => { nombreManual = true; });
    $d('#pf-precio').addEventListener('input', () => { precioManual = true; });
  }
  $d('#pf-medida').addEventListener('change', sugerir);
  $d('#pf-tono').addEventListener('change', sugerir);
  sugerir();
  const btn = $d('#pf-ok'), err = $d('#pf-err');
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    const cuerpo = {
      nombre: $d('#pf-nombre').value.trim(), precio: decimal($d('#pf-precio').value), costo: decimal($d('#pf-costo').value),
      unidad: $d('#pf-unidad').value.trim() || 'pza', min_local: entero($d('#pf-minl').value), min_tienda: entero($d('#pf-mint').value)
    };
    const cat = nuevo ? $d('#pf-cat').value : p.cat;
    if (cat === 'base') { cuerpo.medida = $d('#pf-medida').value; cuerpo.tono = $d('#pf-tono').value; }
    if (nuevo) {
      Object.assign(cuerpo, { op: 'producto.crear', cid, cat, stock_local: entero($d('#pf-sl').value), stock_tienda: entero($d('#pf-st').value) });
    } else Object.assign(cuerpo, { op: 'producto.editar', id: p.id });
    await op(cuerpo);
    d.cerrar();
    toast(nuevo ? 'Producto creado.' : 'Cambios guardados.');
  }));
  const ar = $d('#pf-archivar');
  if (ar) ar.addEventListener('click', async () => {
    const ok = await confirmar({ titulo: 'Archivar producto', texto: p.nombre + ' dejar\xE1 de aparecer en las listas. Sigue en el historial y puedes reactivarlo cuando quieras.', ok: 'Archivar', cancelar: 'Volver' });
    if (!ok) return;
    try { await op({ op: 'producto.archivar', id: p.id, activo: false }); d.cerrar(); toast('Producto archivado.'); } catch (er) { err.hidden = false; err.textContent = er.message; }
  });
}

function formVariantes() {
  const e = S.est, cid = nuevoCid();
  const existentes = new Set(e.productos.map((p) => norm(p.nombre)));
  const nombreDe = (m, t) => 'Base ' + m.nombre + ' \xB7 ' + t.nombre;
  const d = dialogo({
    titulo: 'Crear bases por medida y tono',
    clase: 'ancho',
    cuerpo: html\`<p class="t-peq" style="margin-bottom:14px">Marca las medidas y los tonos que fabricas. Se crea una base por cada combinaci\xF3n, con el precio de la medida. Las que ya existen se omiten.</p>
      <div class="campo"><span class="lbl">Medidas</span>\${e.medidas.map((m) => html\`<div class="check-fila" style="margin-bottom:6px"><input type="checkbox" id="vm-\${m.id}" data-med="\${m.id}" checked><label for="vm-\${m.id}">\${m.nombre}<small>\${m.dims}\${m.precio ? ' \xB7 ' + dinero(m.precio) : ' \xB7 sin precio'}</small></label></div>\`)}</div>
      <div class="campo"><span class="lbl">Tonos</span><div class="grid2">\${e.tonos.map((t) => html\`<div class="check-fila" style="margin-bottom:0"><input type="checkbox" id="vt-\${t.id}" data-ton="\${t.id}" checked><label for="vt-\${t.id}"><span class="mini-sw" style="background:\${hexOk(t.hex)}"></span>\${t.nombre}</label></div>\`)}</div></div>
      <div class="grid2"><label class="campo"><span class="lbl">M\xEDnimo en almac\xE9n</span><input class="inp" id="vr-minl" inputmode="numeric" value="2"></label><label class="campo"><span class="lbl">M\xEDnimo en tienda</span><input class="inp" id="vr-mint" inputmode="numeric" value="1"></label></div>
      <div class="aviso" id="vr-res">\${ico('info')}<span></span></div>
      <p class="err" id="vr-err" hidden></p>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="vr-ok">Crear bases</button>\`
  });
  const marcados = (attr) => $$('[' + attr + ']:checked', d.el).map((x) => x.getAttribute(attr));
  const calc = () => {
    const ms = e.medidas.filter((m) => marcados('data-med').includes(m.id)), ts = e.tonos.filter((t) => marcados('data-ton').includes(t.id));
    let nuevas = 0, ya = 0;
    ms.forEach((m) => ts.forEach((t) => { if (existentes.has(norm(nombreDe(m, t)))) ya++; else nuevas++; }));
    $('#vr-res span', d.el).textContent = nuevas ? 'Se crear\xE1n ' + plural(nuevas, 'base', 'bases') + (ya ? ' (' + plural(ya, 'ya existe', 'ya existen') + ').' : '.') : 'Todas esas combinaciones ya existen.';
    $('#vr-ok', d.el).disabled = !nuevas || nuevas > 60;
    return nuevas;
  };
  d.el.addEventListener('change', calc);
  calc();
  const btn = $('#vr-ok', d.el), err = $('#vr-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    const r = await op({ op: 'producto.variantes', cid, medidas: marcados('data-med'), tonos: marcados('data-ton'), min_local: entero($('#vr-minl', d.el).value), min_tienda: entero($('#vr-mint', d.el).value) });
    d.cerrar();
    toast('Se crearon ' + plural(r.creados, 'base', 'bases') + '.');
  }));
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 ajustes del negocio \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function formNegocio() {
  const n = S.est.negocio;
  const d = dialogo({
    titulo: 'Datos del negocio',
    cuerpo: html\`<label class="campo"><span class="lbl">Nombre del negocio</span><input class="inp" id="n-nombre" maxlength="60" value="\${n.nombre}"></label>
      <label class="campo"><span class="lbl">WhatsApp del almac\xE9n</span><input class="inp" id="n-tl" inputmode="tel" value="\${n.telLocal}" placeholder="523111234567"><span class="ayuda">Con la clave del pa\xEDs (52). La tienda lo usa para avisarte de sus pedidos.</span></label>
      <label class="campo"><span class="lbl">WhatsApp de la tienda</span><input class="inp" id="n-tt" inputmode="tel" value="\${n.telTienda}" placeholder="523111234567"><span class="ayuda">El almac\xE9n lo usa para avisar de sus env\xEDos.</span></label>
      <p class="err" id="n-err" hidden></p>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="n-ok">Guardar</button>\`
  });
  const btn = $('#n-ok', d.el), err = $('#n-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    await op({ op: 'config.guardar', negocio: { nombre: $('#n-nombre', d.el).value, telLocal: $('#n-tl', d.el).value, telTienda: $('#n-tt', d.el).value } });
    d.cerrar();
    toast('Datos guardados.');
  }));
}

function formMedidas() {
  const e = S.est;
  const filas = e.medidas.map((m) => Object.assign({}, m, { _orig: m.precio }));
  const enUso = (id) => e.productos.some((p) => p.cat === 'base' && p.medida === id);
  const d = dialogo({
    titulo: 'Medidas y precios',
    clase: 'ancho',
    cuerpo: html\`<p class="t-peq" style="margin-bottom:14px">El precio de cada medida se usa al crear bases nuevas. Los nombres de productos que ya existen no cambian.</p>
      <div id="md-filas"></div>
      <button type="button" class="btn btn-g btn-s" id="md-add">\${ico('plus')}Agregar medida</button>
      <label class="check-fila" style="margin-top:16px"><input type="checkbox" id="md-aplicar" checked><span style="flex:1;line-height:1.3">Aplicar los precios cambiados a las bases que ya existen<small>Solo afecta las bases de las medidas cuyo precio modificaste.</small></span></label>
      <p class="err" id="md-err" hidden></p>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="md-ok">Guardar</button>\`
  });
  const cont = $('#md-filas', d.el);
  const pintar = () => poner(cont, filas.map((m, i) => html\`<div class="fila-edit" data-i="\${i}"><input class="inp" data-k="nombre" value="\${m.nombre}" maxlength="30" placeholder="Nombre" aria-label="Nombre de la medida"><input class="inp" data-k="dims" value="\${m.dims}" maxlength="24" placeholder="1.50 \xD7 2.00 m" aria-label="Dimensiones"><input class="inp" data-k="precio" inputmode="decimal" value="\${m.precio || ''}" placeholder="Precio $" aria-label="Precio"><button type="button" class="icon-btn" data-quitar aria-label="Quitar \${m.nombre}" \${enUso(m.id) ? raw('disabled title="Hay productos con esta medida"') : ''}>\${ico('basura')}</button></div>\`));
  pintar();
  cont.addEventListener('input', (ev) => { const fila = ev.target.closest('.fila-edit'); if (fila) filas[+fila.dataset.i][ev.target.dataset.k] = ev.target.value; });
  cont.addEventListener('click', (ev) => { const b = ev.target.closest('[data-quitar]'); if (b && !b.disabled) { filas.splice(+b.closest('.fila-edit').dataset.i, 1); pintar(); } });
  $('#md-add', d.el).addEventListener('click', () => { filas.push({ id: '', nombre: '', dims: '', precio: 0, _orig: 0 }); pintar(); const ins = $$('.fila-edit', cont); const ult = ins[ins.length - 1]; if (ult) $('input', ult).focus(); });
  const btn = $('#md-ok', d.el), err = $('#md-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    const usados = new Set(filas.map((m) => m.id).filter(Boolean));
    const medidas = filas.map((m) => {
      let id = m.id;
      if (!id) { const base = slug(m.nombre); id = base; let n = 2; while (usados.has(id)) id = base.slice(0, 17) + '-' + n++; usados.add(id); }
      return { id, nombre: String(m.nombre).trim(), dims: String(m.dims).trim(), precio: decimal(m.precio) };
    });
    const cambiadas = medidas.filter((m, i) => filas[i].id && decimal(filas[i]._orig) !== m.precio).map((m) => m.id);
    await op({ op: 'config.guardar', medidas, aplicarPrecios: $('#md-aplicar', d.el).checked ? cambiadas : [] });
    d.cerrar();
    toast('Medidas guardadas.');
  }));
}

function formTonos() {
  const e = S.est;
  const filas = e.tonos.map((t) => Object.assign({}, t));
  const enUso = (id) => e.productos.some((p) => p.cat === 'base' && p.tono === id);
  const d = dialogo({
    titulo: 'Tonos',
    cuerpo: html\`<p class="t-peq" style="margin-bottom:14px">Los tonos aparecen como un c\xEDrculo de color en cada base.</p><div id="tn-filas"></div>
      <button type="button" class="btn btn-g btn-s" id="tn-add">\${ico('plus')}Agregar tono</button><p class="err" id="tn-err" hidden></p>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="tn-ok">Guardar</button>\`
  });
  const cont = $('#tn-filas', d.el);
  const pintar = () => poner(cont, filas.map((t, i) => html\`<div class="fila-edit tono" data-i="\${i}"><input type="color" data-k="hex" value="\${hexOk(t.hex).toLowerCase()}" aria-label="Color de \${t.nombre}"><input class="inp" data-k="nombre" value="\${t.nombre}" maxlength="24" placeholder="Nombre del tono" aria-label="Nombre del tono"><button type="button" class="icon-btn" data-quitar aria-label="Quitar \${t.nombre}" \${enUso(t.id) ? raw('disabled title="Hay productos con este tono"') : ''}>\${ico('basura')}</button></div>\`));
  pintar();
  cont.addEventListener('input', (ev) => { const fila = ev.target.closest('.fila-edit'); if (fila) filas[+fila.dataset.i][ev.target.dataset.k] = ev.target.value; });
  cont.addEventListener('click', (ev) => { const b = ev.target.closest('[data-quitar]'); if (b && !b.disabled) { filas.splice(+b.closest('.fila-edit').dataset.i, 1); pintar(); } });
  $('#tn-add', d.el).addEventListener('click', () => { filas.push({ id: '', nombre: '', hex: '#8A8D8F' }); pintar(); const ins = $$('.fila-edit', cont); const ult = ins[ins.length - 1]; if (ult) $('.inp', ult).focus(); });
  const btn = $('#tn-ok', d.el), err = $('#tn-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    const usados = new Set(filas.map((t) => t.id).filter(Boolean));
    const tonos = filas.map((t) => {
      let id = t.id;
      if (!id) { const base = slug(t.nombre); id = base; let n = 2; while (usados.has(id)) id = base.slice(0, 17) + '-' + n++; usados.add(id); }
      return { id, nombre: String(t.nombre).trim(), hex: hexOk(t.hex) };
    });
    await op({ op: 'config.guardar', tonos });
    d.cerrar();
    toast('Tonos guardados.');
  }));
}

function formPin(reiniciarTienda) {
  const d = dialogo({
    titulo: reiniciarTienda ? 'Nuevo PIN para el vendedor' : 'Cambiar mi PIN',
    cuerpo: html\`<p class="t-peq" style="margin-bottom:14px">\${reiniciarTienda ? 'Escribe tu PIN para confirmar y el PIN nuevo que usar\xE1 el vendedor de la tienda. Su sesi\xF3n actual se cerrar\xE1.' : 'Al cambiarlo se cierra tu sesi\xF3n en los dem\xE1s equipos.'}</p>
      <label class="campo"><span class="lbl">\${reiniciarTienda ? 'Tu PIN (almac\xE9n)' : 'PIN actual'}</span><input class="inp pin" id="pn-act" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <label class="campo"><span class="lbl">PIN nuevo (4 a 8 n\xFAmeros)</span><input class="inp pin" id="pn-nvo" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <label class="campo"><span class="lbl">Repite el PIN nuevo</span><input class="inp pin" id="pn-rep" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <p class="err" id="pn-err" hidden></p>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="pn-ok">Guardar PIN</button>\`
  });
  const btn = $('#pn-ok', d.el), err = $('#pn-err', d.el);
  const enviar = () => guardando(btn, err, async () => {
    const act = $('#pn-act', d.el).value, nvo = $('#pn-nvo', d.el).value, rep = $('#pn-rep', d.el).value;
    if (nvo !== rep) throw new ErrorApi({ mensaje: 'Los dos PIN nuevos no coinciden.' });
    await op(reiniciarTienda ? { op: 'pin.reiniciar', pinActual: act, pinNuevo: nvo } : { op: 'pin.cambiar', pinActual: act, pinNuevo: nvo });
    d.cerrar();
    toast(reiniciarTienda ? 'PIN del vendedor actualizado.' : 'PIN actualizado.');
  });
  btn.addEventListener('click', enviar);
  d.el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') enviar(); });
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 exportar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const csvCelda = (v) => { const s = v == null ? '' : String(v); return /[",\\r\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const aCsv = (filas) => '\uFEFF' + filas.map((f) => f.map(csvCelda).join(',')).join('\\r\\n');
const fechaArchivo = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fechaISO = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
async function descargar(nombre, contenido, tipo) {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const dl = await window.claude.use('downloads');
      if (dl) { await dl.save({ filename: nombre, data: contenido }); toast('Archivo listo: ' + nombre); return; }
    }
  } catch (e) { if (e && (e.code === 'declined' || e.code === 'rate_limited')) return; }
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  toast('Descargando ' + nombre);
}
function exportarInventario() {
  const e = S.est, loc = S.rol === 'local';
  const cab = ['Producto', 'Categor\xEDa', 'Medida', 'Tono', 'Unidad', 'Precio', ...(loc ? ['Costo'] : []), 'Existencias almac\xE9n', 'Existencias tienda', 'En camino', 'M\xEDnimo almac\xE9n', 'M\xEDnimo tienda', 'Activo'];
  const filas = e.productos.slice().sort(ordenProductos).map((p) => { const m = medidaDe(p.medida), t = tonoDe(p.tono); return [p.nombre, CATS[p.cat].replace(/s$/, ''), m ? m.nombre : '', t ? t.nombre : '', p.unidad, p.precio, ...(loc ? [p.costo] : []), p.stock_local, p.stock_tienda, S.camino[p.id] || 0, p.min_local, p.min_tienda, p.activo ? 'S\xED' : 'No']; });
  descargar('inventario-bases-box-' + fechaArchivo() + '.csv', aCsv([cab, ...filas]), 'text/csv;charset=utf-8');
}
async function traerMovimientos(max) {
  const todos = [];
  let antes = null;
  do {
    const r = await llamar('GET', '/movs', null, Object.assign({ limite: 500, anulaciones: 1 }, antes ? { antes } : {}));
    if (!r.json.ok) throw new ErrorApi(r.json.error);
    todos.push(...r.json.items);
    antes = r.json.siguiente;
  } while (antes && todos.length < (max || 100000));
  return todos;
}
async function exportarMovimientos(btn) {
  if (btn) btn.setAttribute('aria-busy', 'true');
  try {
    const movs = await traerMovimientos();
    const cab = ['Fecha', 'Operaci\xF3n', 'Producto', 'Lugar', 'Cantidad', 'Precio', 'Responsable', 'Motivo', 'Nota', 'Cliente', 'Pago', 'Anulada', 'Folio'];
    const filas = movs.map((m) => [fechaISO(m.ts), (TIPOS[m.tipo] ? TIPOS[m.tipo].t : m.tipo === 'anulacion' ? 'Anulaci\xF3n' : m.tipo), nombreProd(m.prod), m.loc === 'local' ? 'Almac\xE9n' : 'Tienda', m.delta, m.precio == null ? '' : m.precio, ROLES[m.rol].corto, MOTIVOS[m.motivo] || '', m.nota, m.cliente, PAGOS[m.pago] || '', m.anulado ? 'S\xED' : '', m.grupo]);
    await descargar('movimientos-bases-box-' + fechaArchivo() + '.csv', aCsv([cab, ...filas]), 'text/csv;charset=utf-8');
  } catch (e) { toast(e.message, { tipo: 'error' }); } finally { if (btn) btn.removeAttribute('aria-busy'); }
}
async function respaldoCompleto(btn) {
  if (btn) btn.setAttribute('aria-busy', 'true');
  try {
    const movs = await traerMovimientos();
    const e = S.est;
    const dato = { app: 'inventario-bases-box', version: Core.VERSION, creado: new Date().toISOString(), negocio: e.negocio, medidas: e.medidas, tonos: e.tonos, productos: e.productos, traspasos: e.traspasos, pedidos: e.pedidos, movimientos: movs };
    await descargar('respaldo-bases-box-' + fechaArchivo() + '.json', JSON.stringify(dato, null, 1), 'application/json');
  } catch (er) { toast(er.message, { tipo: 'error' }); } finally { if (btn) btn.removeAttribute('aria-busy'); }
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 M\xC1S \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
VISTAS.mas = {
  armar: () => html\`<div class="pila" data-vista="mas" id="v-mas"></div>\`,
  actualizar() {
    const cont = $('#v-mas');
    if (!cont) return;
    const e = S.est, local = S.rol === 'local', tema = store.get(CLAVE_TEMA) || 'auto';
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const fila = (ic, t, s, act) => html\`<li><button type="button" class="item" data-act="\${act}"><span class="ico-c">\${ico(ic)}</span><div class="grow"><div class="item-t">\${t}</div>\${s ? html\`<div class="item-s">\${s}</div>\` : ''}</div>\${ico('der', 'der')}</button></li>\`;
    poner(cont, html\`
      <div class="cabecera"><div><h1 class="t-pant">M\xE1s</h1><p class="t-peq" style="margin-top:8px">\${e.negocio.nombre} \xB7 \${ROLES[S.rol].nombre}</p></div></div>
      \${S.modo === 'local' ? html\`<div class="aviso warn">\${ico('alerta')}<div><b>Los datos est\xE1n solo en este equipo.</b> La otra persona (almac\xE9n o vendedor) no los ver\xE1. Para compartir el inventario entre los dos hay que publicar la app con su servidor (mira el archivo README).</div></div>\` : ''}
      <section class="sec-mas"><span class="t-sec">Mi cuenta</span><div class="card flat"><ul class="lista">
        \${fila('candado', 'Cambiar mi PIN', 'Cierra tu sesi\xF3n en los dem\xE1s equipos', 'pin-propio')}
        \${local ? fila('tienda', 'Reiniciar el PIN del vendedor', 'Si el vendedor lo olvid\xF3', 'pin-tienda') : ''}
        \${local ? fila('candado', 'C\xF3digo de recuperaci\xF3n', 'Genera uno nuevo si perdiste el anterior', 'codigo-nuevo') : ''}
        \${fila('x', 'Cerrar sesi\xF3n', '', 'salir')}
      </ul></div></section>
      \${local ? html\`<section class="sec-mas"><span class="t-sec">Negocio y cat\xE1logo</span><div class="card flat"><ul class="lista">
        \${fila('tienda', 'Datos del negocio y WhatsApp', e.negocio.nombre, 'negocio')}
        \${fila('cubo', 'Medidas y precios', plural(e.medidas.length, 'medida', 'medidas'), 'medidas')}
        \${fila('capas', 'Tonos', plural(e.tonos.length, 'tono', 'tonos'), 'tonos')}
      </ul></div></section>\` : ''}
      <section class="sec-mas"><span class="t-sec">Datos</span><div class="card flat"><ul class="lista">
        \${fila('bajar', 'Exportar inventario', 'Hoja de c\xE1lculo (CSV) con las existencias de hoy', 'exportar-inv')}
        \${fila('bajar', 'Exportar movimientos', 'Todo el historial en CSV', 'exportar-movs')}
        \${local ? fila('bajar', 'Respaldo completo', 'Archivo JSON con productos y movimientos', 'respaldo') : ''}
      </ul></div></section>
      <section class="sec-mas"><span class="t-sec">Apariencia</span><div class="card"><div class="opciones">\${[['auto', 'Autom\xE1tica'], ['claro', 'Clara'], ['oscuro', 'Oscura']].map(([k, t]) => html\`<button type="button" class="opcion" data-act="tema" data-v="\${k}" aria-pressed="\${String(tema === k)}">\${t}</button>\`)}</div></div></section>
      \${!standalone ? html\`<section class="sec-mas"><span class="t-sec">Instalar</span><div class="card">
        \${S.instalar ? html\`<div class="sep"><span>\xC1brela como una app, sin la barra del navegador.</span><button type="button" class="btn btn-p" data-act="instalar">Instalar app</button></div>\`
          : ios ? html\`<div class="fila" style="align-items:flex-start"><span class="ico-c info">\${ico('info')}</span><span>En el iPhone o iPad toca <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>.</span></div>\`
          : html\`<span class="t-peq">Desde el men\xFA del navegador elige \u201CInstalar app\u201D o \u201CAgregar a pantalla de inicio\u201D para abrirla como una app.</span>\`}</div></section>\` : ''}
      \${S.modo === 'local' ? html\`<section class="sec-mas"><span class="t-sec">Este equipo</span><div class="card flat"><ul class="lista">\${fila('basura', S.demo ? 'Salir de la demostraci\xF3n' : 'Borrar los datos de este equipo', S.demo ? 'Elimina los datos de ejemplo y vuelve al inicio' : 'Empezar desde cero. No se puede deshacer', S.demo ? 'salir-demo' : 'borrar-local')}</ul></div></section>\` : ''}
      <p class="pie-app">Inventario Bases Box \xB7 versi\xF3n \${Core.VERSION} \xB7 \${S.modo === 'local' ? 'datos en este equipo' : 'datos en la nube'}</p>\`);
  }
};

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 acciones de los botones \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const A = {
  ir: (b) => irA(b.dataset.tabIr),
  sync: async () => { await sincronizar(true); toast(S.enLinea ? 'Datos actualizados.' : 'Sin conexi\xF3n por ahora.', { tipo: S.enLinea ? undefined : 'error' }); },
  salir: () => salir(),
  'ver-bajos': () => irA('inventario', { bajo: true }),
  prod: (b) => abrirProducto(b.dataset.id),
  'prod-nuevo': () => formProducto(),
  variantes: () => formVariantes(),
  'filtro-cat': (b) => { S.filtro.cat = b.dataset.cat; VISTAS.inventario.actualizar(); },
  'filtro-bajo': () => { S.filtro.bajo = !S.filtro.bajo; VISTAS.inventario.actualizar(); },
  'filtro-arch': () => { S.filtro.archivados = !S.filtro.archivados; VISTAS.inventario.actualizar(); },
  forma: (b) => (b.dataset.tipo === 'recibir' ? recibirYa() : abrirForma(b.dataset.tipo)),
  'recibir-ya': () => recibirYa(),
  traspaso: (b) => abrirTraspaso(b.dataset.id),
  'pedido-det': (b) => abrirPedido(b.dataset.id),
  'op-det': (b) => abrirOperacion(b.dataset.grupo),
  'hist-tipo': (b) => { S.hist.tipo = b.dataset.tipo; S.hist.rev = null; VISTAS.historial.actualizar(); },
  'hist-mas': () => cargarHistorial(false),
  'tabla-vtas': () => { S.verTabla = !S.verTabla; pintarInicio(); },
  'exportar-inv': () => exportarInventario(),
  'exportar-movs': (b) => exportarMovimientos(b),
  respaldo: (b) => respaldoCompleto(b),
  negocio: () => formNegocio(),
  medidas: () => formMedidas(),
  tonos: () => formTonos(),
  'pin-propio': () => formPin(false),
  'pin-tienda': () => formPin(true),
  'codigo-nuevo': () => formCodigoNuevo(),
  tema: (b) => { store.set(CLAVE_TEMA, b.dataset.v); aplicarTema(); VISTAS.mas.actualizar(); },
  instalar: async () => {
    if (!S.instalar) return;
    S.instalar.prompt();
    try { await S.instalar.userChoice; } catch (e) { /* cerrado */ }
    S.instalar = null;
    VISTAS.mas.actualizar();
  },
  'salir-demo': async () => {
    const ok = await confirmar({ titulo: 'Salir de la demostraci\xF3n', texto: 'Se borran los datos de ejemplo de este equipo y vuelves al inicio.', ok: 'Salir y borrar', cancelar: 'Volver', peligro: true });
    if (ok) reiniciarLocal();
  },
  'borrar-local': async () => {
    const t = await confirmar({ titulo: 'Borrar datos de este equipo', texto: 'Se borran productos, movimientos y PIN de este equipo. No se puede deshacer. Haz antes un respaldo si lo necesitas.', ok: 'Borrar todo', cancelar: 'Volver', peligro: true, campo: { etiqueta: 'Escribe BORRAR para confirmar', min: 6, error: 'Escribe la palabra BORRAR.', ayuda: 'BORRAR' } });
    if (t && t.trim().toUpperCase() === 'BORRAR') reiniciarLocal();
    else if (t) toast('No se borr\xF3 nada: la palabra no coincide.', { tipo: 'error' });
  }
};
function reiniciarLocal() {
  if (repoLocal) repoLocal.borrar();
  [CLAVE_SESION, 'bb-inv:demo', CLAVE_ROL].forEach((k) => store.del(k));
  sesionTmp.del(CLAVE_SESION);
  location.reload();
}

function formCodigoNuevo() {
  const d = dialogo({
    titulo: 'C\xF3digo de recuperaci\xF3n',
    cuerpo: html\`<div id="cn-cont"><p class="t-peq" style="margin-bottom:14px">El c\xF3digo sirve para crear un PIN nuevo si lo olvidas. Al generar uno nuevo, el anterior deja de servir. Escribe tu PIN para confirmar.</p>
      <label class="campo"><span class="lbl">Tu PIN (almac\xE9n)</span><input class="inp pin" id="cn-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label><p class="err" id="cn-err" hidden></p></div>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="cn-ok">Generar c\xF3digo</button>\`
  });
  const btn = $('#cn-ok', d.el), err = $('#cn-err', d.el);
  const enviar = () => guardando(btn, err, async () => {
    const r = await op({ op: 'recup.nueva', pinActual: $('#cn-pin', d.el).value });
    poner($('#cn-cont', d.el), vistaCodigo(r.codigo));
    poner(d.pie, html\`<button type="button" class="btn btn-p" data-cerrar>Listo, ya lo guard\xE9</button>\`);
    enlazarCopiar(d.el, r.codigo);
  });
  btn.addEventListener('click', enviar);
  d.el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && $('#cn-pin', d.el)) enviar(); });
}
const vistaCodigo = (codigo) => html\`<p class="t-peq" style="margin-bottom:12px">Gu\xE1rdalo en un lugar seguro (una foto, tu gestor de contrase\xF1as o un papel). Solo se muestra ahora.</p><span class="codigo" id="codigo-v">\${codigo}</span><div style="margin-top:12px"><button type="button" class="btn btn-g btn-b" id="cod-copiar">\${ico('copiar')}Copiar c\xF3digo</button></div>\`;
function enlazarCopiar(raiz, codigo) {
  const b = $('#cod-copiar', raiz);
  if (!b) return;
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(codigo); toast('C\xF3digo copiado.'); } catch (e) {
      const r = document.createRange(); r.selectNodeContents($('#codigo-v', raiz)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Selecci\xF3nalo y c\xF3pialo.');
    }
  });
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 sesi\xF3n \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function salir(msg) {
  $$('dialog.sheet').forEach((d) => d.close());
  S.token = ''; S.est = null; S.rol = ''; S.idx = {};
  store.del(CLAVE_SESION); sesionTmp.del(CLAVE_SESION); store.del(CLAVE_CACHE);
  pantallaLogin(msg);
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 pantallas de acceso \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const cabeceraMarca = () => html\`<div class="marca-g"><span class="logo"><img src="logo.png" alt="" width="84" height="84"></span><h1>Bases Bo<b>x</b></h1><span class="sub">Tepic \xB7 Inventario</span><div class="tonos-fila" aria-hidden="true">\${Core.TONOS_BASE.map((t) => html\`<i style="background:\${t.hex}"></i>\`)}</div></div>\`;
const pie = () => html\`<p class="pie-app" style="margin-top:0">Versi\xF3n \${Core.VERSION} \xB7 \${S.modo === 'local' ? 'Los datos viven en este equipo' : 'Datos en la nube'}</p>\`;
function pinError(p) {
  if (!/^\\d{4,8}$/.test(p)) return 'El PIN debe tener de 4 a 8 n\xFAmeros.';
  if (/^(\\d)\\1+$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p)) return 'Ese PIN es muy f\xE1cil de adivinar. Elige otro.';
  return '';
}

function pantallaLogin(msg) {
  let rol = S.modo === 'local' && S.demo ? null : store.get(CLAVE_ROL);
  if (rol !== 'local' && rol !== 'tienda') rol = null;
  const render = () => {
    poner($('#raiz'), html\`<div class="acceso"><div class="acceso-in">
      \${cabeceraMarca()}
      \${msg ? html\`<div class="aviso warn">\${ico('info')}<span>\${msg}</span></div>\` : ''}
      \${S.demo ? html\`<div class="aviso">\${ico('info')}<span><b>Demostraci\xF3n.</b> PIN del almac\xE9n: <b>1111</b> \xB7 PIN del vendedor: <b>2222</b>.</span></div>\` : ''}
      \${!rol ? html\`<div class="pila"><h2 class="t-sec" style="text-align:center">\xBFQui\xE9n entra?</h2>\${Object.keys(ROLES).map((k) => html\`<button type="button" class="rol-btn" data-rol="\${k}"><span class="ico-c acc" style="width:48px;height:48px">\${ico(ROLES[k].ic, 'g')}</span><span><b>\${ROLES[k].nombre}</b><span>\${ROLES[k].desc}</span></span></button>\`)}</div>\`
        : html\`<form class="card pila" id="lg-form" novalidate>
          <div class="fila"><span class="ico-c acc">\${ico(ROLES[rol].ic)}</span><div class="grow"><div class="item-t">\${ROLES[rol].nombre}</div></div><button type="button" class="btn btn-g btn-s" id="lg-cambiar">Cambiar</button></div>
          <label class="campo" style="margin:0"><span class="lbl">Tu PIN</span><input class="inp pin" id="lg-pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8" autofocus></label>
          <label class="check-fila" style="margin:0"><input type="checkbox" id="lg-rec" \${S.recordar ? raw('checked') : ''}><label for="lg-rec" style="font-size:15px">Mantener la sesi\xF3n en este equipo</label></label>
          <p class="err" id="lg-err" hidden></p>
          <button type="submit" class="btn btn-p btn-b" id="lg-ok">Entrar</button>
          <button type="button" class="btn btn-g btn-s btn-b" id="lg-olvide">Olvid\xE9 mi PIN</button></form>\`}
      \${pie()}
    </div></div>\`);
    $$('[data-rol]').forEach((b) => b.addEventListener('click', () => { rol = b.dataset.rol; msg = ''; render(); }));
    const f = $('#lg-form');
    if (!f) return;
    $('#lg-cambiar').addEventListener('click', () => { rol = null; render(); });
    $('#lg-olvide').addEventListener('click', () => formOlvide(rol));
    const pin = $('#lg-pin');
    if (!matchMedia('(pointer:coarse)').matches) pin.focus();
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const btn = $('#lg-ok'), err = $('#lg-err');
      guardando(btn, err, async () => {
        if (!pin.value) { pin.focus(); throw new ErrorApi({ mensaje: 'Escribe tu PIN.' }); }
        const r = await llamar('POST', '/login', { rol, pin: pin.value });
        if (!r.json.ok) { pin.value = ''; pin.focus(); throw new ErrorApi(r.json.error); }
        S.token = r.json.token; S.rol = rol; S.recordar = $('#lg-rec').checked;
        store.set(CLAVE_ROL, rol);
        guardarSesion();
        await cargarEstado();
        irA('inicio', { forzar: true });
      });
    });
  };
  render();
}

function formOlvide(rolInicial) {
  let codigoNuevo = '';
  const d = dialogo({
    titulo: 'Olvid\xE9 mi PIN',
    cuerpo: html\`<div id="ol-cont"><p class="t-peq" style="margin-bottom:14px">Escribe el c\xF3digo de recuperaci\xF3n que te dieron al configurar la app y elige un PIN nuevo.</p>
      <label class="campo"><span class="lbl">C\xF3digo de recuperaci\xF3n</span><input class="inp" id="ol-cod" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX" maxlength="12" style="text-transform:uppercase;letter-spacing:.12em"></label>
      <label class="campo"><span class="lbl">\xBFDe qui\xE9n es el PIN?</span><select class="inp" id="ol-rol">\${Object.keys(ROLES).map((k) => html\`<option value="\${k}" \${k === rolInicial ? raw('selected') : ''}>\${ROLES[k].nombre}</option>\`)}</select></label>
      <label class="campo"><span class="lbl">PIN nuevo (4 a 8 n\xFAmeros)</span><input class="inp pin" id="ol-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <label class="campo"><span class="lbl">Repite el PIN nuevo</span><input class="inp pin" id="ol-pin2" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <p class="err" id="ol-err" hidden></p></div>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="ol-ok">Cambiar PIN</button>\`,
    alCerrar: () => { if (codigoNuevo) irA('inicio', { forzar: true }); }
  });
  const btn = $('#ol-ok', d.el), err = $('#ol-err', d.el);
  const enviar = () => guardando(btn, err, async () => {
    const pin = $('#ol-pin', d.el).value;
    if (pin !== $('#ol-pin2', d.el).value) throw new ErrorApi({ mensaje: 'Los dos PIN no coinciden.' });
    const rol = $('#ol-rol', d.el).value;
    const r = await llamar('POST', '/recuperar', { codigo: $('#ol-cod', d.el).value, rol, pin });
    if (!r.json.ok) throw new ErrorApi(r.json.error);
    S.token = r.json.token; S.rol = rol; store.set(CLAVE_ROL, rol);
    guardarSesion();
    codigoNuevo = r.json.codigo;
    poner($('#ol-cont', d.el), html\`<div class="aviso" style="margin-bottom:14px">\${ico('check')}<span>Listo, tu PIN nuevo ya funciona. El c\xF3digo anterior dej\xF3 de servir; guarda este.</span></div>\${vistaCodigo(codigoNuevo)}\`);
    poner(d.pie, html\`<button type="button" class="btn btn-p" data-cerrar>Entrar</button>\`);
    enlazarCopiar(d.el, codigoNuevo);
    await cargarEstado();
  });
  btn.addEventListener('click', enviar);
  d.el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && $('#ol-ok', d.el)) enviar(); });
}

async function pantallaSetup(info) {
  const local = S.modo === 'local';
  if (!info) { try { info = (await llamar('GET', '/ping')).json; } catch (e) { info = {}; } }
  const pideClave = !!info.requiereClave;
  const D = { nombre: 'Bases Box Tepic', clave: '', pinL: '', pinL2: '', pinT: '', pinT2: '', bases: true, extras: true };
  let paso = local ? 0 : 1, codigo = '';
  const nM = Core.MEDIDAS_BASE.length, nT = Core.TONOS_BASE.length;
  const puntos = () => html\`<div class="pasos" aria-label="Paso \${paso} de 3">\${[1, 2, 3].map((n) => html\`<i class="\${n <= paso ? 'on' : ''}"></i>\`)}</div>\`;
  const campoPin = (id, et, v) => html\`<label class="campo"><span class="lbl">\${et}</span><input class="inp pin" id="\${id}" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8" value="\${v}"></label>\`;

  function cuerpo() {
    if (paso === 0) {
      return html\`<div class="pila"><div class="aviso warn">\${ico('alerta')}<span>Esta copia funciona <b>sin servidor</b>: los datos se guardan solo en este equipo. Sirve para probar. Para que los dos usuarios compartan el inventario hay que publicar la app con su servidor (README).</span></div>
        <button type="button" class="rol-btn" id="su-empezar"><span class="ico-c acc" style="width:48px;height:48px">\${ico('cubo', 'g')}</span><span><b>Configurar mi inventario</b><span>Empieza con tu negocio, tus PIN y el cat\xE1logo.</span></span></button>
        <button type="button" class="rol-btn" id="su-demo"><span class="ico-c info" style="width:48px;height:48px">\${ico('reloj', 'g')}</span><span><b>Ver una demostraci\xF3n</b><span>Datos de ejemplo de un mes: ventas, env\xEDos y alertas.</span></span></button></div>\`;
    }
    if (paso === 1) {
      return html\`\${puntos()}<h2 class="t-sec" style="text-align:center">Tu negocio</h2>
        \${pideClave ? html\`<label class="campo"><span class="lbl">Clave de instalaci\xF3n</span><input class="inp" id="su-clave" maxlength="20" value="\${D.clave}" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX" style="text-transform:uppercase;letter-spacing:.08em"><span class="ayuda">La imprimi\xF3 el comando de publicaci\xF3n. Solo se pide en esta primera configuraci\xF3n.</span></label>\` : ''}
        <label class="campo"><span class="lbl">Nombre del negocio</span><input class="inp" id="su-nombre" maxlength="60" value="\${D.nombre}" autocomplete="off"></label>\`;
    }
    if (paso === 2) {
      return html\`\${puntos()}<h2 class="t-sec" style="text-align:center">Un PIN para cada usuario</h2><p class="t-peq" style="text-align:center">De 4 a 8 n\xFAmeros. Cada quien entra con el suyo y puede cambiarlo despu\xE9s.</p>
        <div class="card" style="padding:14px 14px 2px"><div class="item-t" style="margin-bottom:8px">\${ico('fabrica')} Almac\xE9n</div>\${campoPin('su-pl', 'PIN', D.pinL)}\${campoPin('su-pl2', 'Repite el PIN', D.pinL2)}</div>
        <div class="card" style="padding:14px 14px 2px"><div class="item-t" style="margin-bottom:8px">\${ico('tienda')} Vendedor tienda</div>\${campoPin('su-pt', 'PIN', D.pinT)}\${campoPin('su-pt2', 'Repite el PIN', D.pinT2)}</div>\`;
    }
    if (paso === 3) {
      return html\`\${puntos()}<h2 class="t-sec" style="text-align:center">Cat\xE1logo inicial</h2><p class="t-peq" style="text-align:center">Todo se puede cambiar o archivar despu\xE9s.</p>
        <div class="check-fila"><input type="checkbox" id="su-bases" \${D.bases ? raw('checked') : ''}><label for="su-bases">Bases por medida y tono<small>\${nM} medidas \xD7 \${nT} tonos = \${plural(nM * nT, 'base', 'bases')} para empezar. Los precios los pones t\xFA despu\xE9s.</small></label></div>
        <div class="check-fila"><input type="checkbox" id="su-extras" \${D.extras ? raw('checked') : ''}><label for="su-extras">Materiales y accesorios comunes<small>\${Core.EXTRAS_BASE.map((x) => x.nombre).join(', ')}.</small></label></div>\`;
    }
    return html\`<div class="pila"><div class="aviso">\${ico('check')}<span><b>\xA1Listo!</b> Tu inventario est\xE1 configurado y entraste como Almac\xE9n.</span></div>
      <h2 class="t-sec">C\xF3digo de recuperaci\xF3n</h2>\${vistaCodigo(codigo)}
      <label class="check-fila" style="margin:0"><input type="checkbox" id="su-guardado"><label for="su-guardado">Ya guard\xE9 mi c\xF3digo en un lugar seguro</label></label></div>\`;
  }

  function pintarPaso() {
    const ultimo = paso === 4;
    poner($('#raiz'), html\`<div class="acceso"><div class="acceso-in">\${cabeceraMarca()}
      \${paso === 0 ? cuerpo() : html\`<form class="card pila" id="su-form" novalidate>\${cuerpo()}<p class="err" id="su-err" hidden></p>
        <div class="fila w" style="justify-content:flex-end;gap:10px">\${paso > 1 && !ultimo ? html\`<button type="button" class="btn btn-g" id="su-atras" style="flex:1">Atr\xE1s</button>\` : paso === 1 && local ? html\`<button type="button" class="btn btn-g" id="su-atras" style="flex:1">Atr\xE1s</button>\` : ''}
        <button type="submit" class="btn btn-p" id="su-ok" style="flex:2">\${ultimo ? 'Entrar a mi inventario' : paso === 3 ? 'Crear mi inventario' : 'Siguiente'}</button></div></form>\`}
      \${pie()}</div></div>\`);
    enlazar();
  }
  function leer() {
    const v = (id) => { const el = $('#' + id); return el ? el.value : null; };
    if (paso === 1) { D.nombre = v('su-nombre'); if (pideClave) D.clave = v('su-clave'); }
    if (paso === 2) { D.pinL = v('su-pl'); D.pinL2 = v('su-pl2'); D.pinT = v('su-pt'); D.pinT2 = v('su-pt2'); }
    if (paso === 3) { D.bases = $('#su-bases').checked; D.extras = $('#su-extras').checked; }
  }
  function enlazar() {
    const em = $('#su-empezar'), dm = $('#su-demo');
    if (em) em.addEventListener('click', () => { paso = 1; pintarPaso(); });
    if (dm) dm.addEventListener('click', () => guardando(dm, null, async () => {
      await new Promise((r) => setTimeout(r, 30));
      await Core.sembrarDemo(repoLocal);
      store.set('bb-inv:demo', '1');
      S.demo = true;
      pantallaLogin();
    }));
    const f = $('#su-form');
    if (!f) return;
    const at = $('#su-atras');
    if (at) at.addEventListener('click', () => { leer(); paso = paso === 1 ? 0 : paso - 1; pintarPaso(); });
    const primero = $('input:not([type=checkbox])', f);
    if (primero && !matchMedia('(pointer:coarse)').matches) primero.focus();
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const btn = $('#su-ok'), err = $('#su-err');
      guardando(btn, err, async () => {
        if (paso === 4) {
          if (!$('#su-guardado').checked) throw new ErrorApi({ mensaje: 'Marca la casilla cuando hayas guardado tu c\xF3digo.' });
          await cargarEstado();
          irA('inicio', { forzar: true });
          return;
        }
        leer();
        if (paso === 1) {
          if (pideClave && !D.clave.trim()) throw new ErrorApi({ mensaje: 'Escribe la clave de instalaci\xF3n.' });
          if (!D.nombre.trim()) throw new ErrorApi({ mensaje: 'Escribe el nombre del negocio.' });
          paso = 2; pintarPaso(); return;
        }
        if (paso === 2) {
          const e1 = pinError(D.pinL), e2 = pinError(D.pinT);
          if (e1) throw new ErrorApi({ mensaje: 'PIN del almac\xE9n: ' + e1 });
          if (e2) throw new ErrorApi({ mensaje: 'PIN del vendedor: ' + e2 });
          if (D.pinL !== D.pinL2) throw new ErrorApi({ mensaje: 'Los dos PIN del almac\xE9n no coinciden.' });
          if (D.pinT !== D.pinT2) throw new ErrorApi({ mensaje: 'Los dos PIN del vendedor no coinciden.' });
          if (D.pinL === D.pinT) throw new ErrorApi({ mensaje: 'Cada usuario necesita un PIN distinto.' });
          paso = 3; pintarPaso(); return;
        }
        const r = await llamar('POST', '/setup', { nombre: D.nombre, clave: D.clave, pinLocal: D.pinL, pinTienda: D.pinT, catalogo: { bases: D.bases, extras: D.extras } });
        if (!r.json.ok) throw new ErrorApi(r.json.error);
        S.token = r.json.token; S.rol = 'local'; codigo = r.json.codigo;
        store.set(CLAVE_ROL, 'local');
        guardarSesion();
        paso = 4;
        pintarPaso();
        enlazarCopiar($('#raiz'), codigo);
      });
    });
    if (paso === 4) enlazarCopiar($('#raiz'), codigo);
  }
  pintarPaso();
}

function pantallaMensaje(titulo, texto, botones) {
  poner($('#raiz'), html\`<div class="acceso"><div class="acceso-in">\${cabeceraMarca()}<div class="card pila"><h2 class="t-sec">\${titulo}</h2><p>\${texto}</p><div class="pila">\${botones.map((b, i) => html\`<button type="button" class="btn \${i ? 'btn-g' : 'btn-p'} btn-b" data-i="\${i}">\${b[0]}</button>\`)}</div></div></div></div>\`);
  $$('[data-i]').forEach((el) => el.addEventListener('click', () => botones[+el.dataset.i][1]()));
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 arranque \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
// \xBFHay servidor? Una respuesta que no es de nuestra API (hosting est\xE1tico) o un bloqueo inicial = modo local.
// Si ya sab\xEDamos que este equipo usa el servidor, un fallo de red es \u201Csin internet\u201D, nunca \u201Csin servidor\u201D.
async function sondear() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch('api/ping', { cache: 'no-store', signal: ctl.signal });
    const j = await res.json().catch(() => null);
    if (j && j.ok && j.servidor) return 'servidor';
    if (j && j.error && j.error.code === 'sin_base_de_datos') return 'sin_db';
    return 'local';
  } catch (e) { return null; } finally { clearTimeout(t); }
}
async function detectarModo() {
  const previo = store.get(CLAVE_MODO);
  let r = await sondear();
  if (r === null && previo !== 'servidor' && navigator.onLine !== false) { await new Promise((ok) => setTimeout(ok, 1200)); r = await sondear(); }
  if (r === 'servidor' || r === 'local') { store.set(CLAVE_MODO, r); return r; }
  if (r === 'sin_db') return r;
  if (previo === 'servidor' || previo === 'local') return previo; // sin respuesta: seguimos con lo que ya usaba este equipo
  return navigator.onLine === false ? 'sin_red' : 'local';
}
const tabDeHash = () => { const h = location.hash.replace('#', ''); return VISTAS[h] ? h : 'inicio'; };

async function arrancar() {
  aplicarTema();
  const modo = await detectarModo();
  if (modo === 'sin_red') {
    pantallaMensaje('Sin conexi\xF3n', 'Esta es la primera vez que abres la app en este equipo y no hay internet. Con\xE9ctate y vuelve a intentarlo.', [['Reintentar', () => location.reload()]]);
    return;
  }
  if (modo === 'sin_db') {
    S.modo = 'servidor';
    pantallaMensaje('Falta conectar la base de datos', 'El servidor de la app est\xE1 en l\xEDnea pero no encuentra su base de datos D1 (el enlace debe llamarse \u201CDB\u201D). Revisa el README o usa la app solo en este equipo mientras lo resuelves.', [['Reintentar', () => location.reload()], ['Usar solo en este equipo', () => { S.modo = 'local'; iniciarLocal(); }]]);
    return;
  }
  S.modo = modo;
  if (modo === 'local') return iniciarLocal();
  return iniciar();
}
function iniciarLocal() {
  S.modo = 'local';
  repoLocal = Core.crearRepoLocal(almacenCore, CLAVE_LOCAL);
  S.demo = store.get('bb-inv:demo') === '1';
  return iniciar();
}
async function iniciar() {
  const ses = leerSesion();
  if (ses && ses.modo === S.modo) {
    S.token = ses.token; S.rol = ses.rol; S.recordar = ses.recordar;
    try {
      if (await cargarEstado()) irA(tabDeHash(), { forzar: true }); // si no, cargarEstado ya mostr\xF3 el acceso (sesi\xF3n vencida)
      return;
    } catch (e) {
      if (e instanceof ErrorRed) {
        try {
          const c = JSON.parse(store.get(CLAVE_CACHE) || 'null');
          if (c && c.est && c.est.rol === ses.rol) {
            aplicarEstado(c.est);
            irA(tabDeHash(), { forzar: true });
            toast('Sin conexi\xF3n. Est\xE1s viendo la \xFAltima copia (' + hace(c.ts) + ').', { tipo: 'error', ms: 8000 });
            return;
          }
        } catch (e2) { /* sin copia guardada */ }
        return pantallaMensaje('Sin conexi\xF3n', 'No pude cargar el inventario. Revisa tu internet e int\xE9ntalo de nuevo.', [['Reintentar', () => location.reload()]]);
      }
      if (e instanceof ErrorApi && e.code === 'no_configurado') return pantallaSetup();
      console.error(e);
      S.token = '';
    }
  }
  let ping;
  try { ping = await llamar('GET', '/ping'); } catch (e) {
    return pantallaMensaje('Sin conexi\xF3n', 'No pude hablar con el servidor. Revisa tu internet e int\xE9ntalo de nuevo.', [['Reintentar', () => location.reload()]]);
  }
  if (!ping.json.ok) return pantallaMensaje('Algo fall\xF3', ping.json.error ? ping.json.error.mensaje : 'No se pudo iniciar la app.', [['Reintentar', () => location.reload()]]);
  if (!ping.json.configurado) return pantallaSetup(ping.json);
  pantallaLogin();
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 eventos globales \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-tab]');
  if (t && t.closest('.rail, .tabbar')) { irA(t.dataset.tab); return; }
  const b = ev.target.closest('[data-act]');
  if (b && !b.disabled && A[b.dataset.act]) A[b.dataset.act](b, ev);
});
window.addEventListener('hashchange', () => { if (S.est && VISTAS[tabDeHash()] && tabDeHash() !== S.tab) irA(tabDeHash()); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(true); });
window.addEventListener('online', () => sincronizar(true));
window.addEventListener('focus', () => sincronizar());
window.addEventListener('storage', (ev) => { if (ev.key === CLAVE_LOCAL && S.modo === 'local' && S.est) sincronizar(true); });
let tRedim = null;
window.addEventListener('resize', () => { clearTimeout(tRedim); tRedim = setTimeout(() => { if (S.tab === 'inicio' && S.est) dibujarGrafica(); }, 150); });
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); S.instalar = ev; if (S.est && S.tab === 'mas') VISTAS.mas.actualizar(); });
window.addEventListener('appinstalled', () => { S.instalar = null; });
setInterval(() => sincronizar(), SYNC_MS);

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin service worker: la app funciona igual */ });
}
arrancar().catch((e) => {
  console.error(e);
  pantallaMensaje('Algo fall\xF3', 'No se pudo iniciar la app. Recarga la p\xE1gina.', [['Recargar', () => location.reload()]]);
});
})();
</script>
</body>
</html>
` }, "/logo.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"e967e688072e69475b1a"' }, "b64": "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" }, "/manifest.webmanifest": { "cabeceras": { "content-type": "application/manifest+json", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"53e0919fba13bb323d28"' }, "texto": '{\n  "name": "Inventario Bases Box Tepic",\n  "short_name": "Inventario",\n  "description": "Inventario compartido entre el almac\xE9n y el vendedor de la tienda.",\n  "lang": "es-MX",\n  "start_url": "./",\n  "scope": "./",\n  "display": "standalone",\n  "orientation": "any",\n  "background_color": "#F4F2ED",\n  "theme_color": "#1A1A1A",\n  "icons": [\n    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },\n    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },\n    { "src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }\n  ]\n}\n' }, "/sw.js": { "cabeceras": { "content-type": "text/javascript; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"580e32dcf4517faed0a1"' }, "texto": "// Service worker: guarda la app para abrirla aunque no haya internet.\n// Los datos (/api) nunca se guardan aqu\xED: siempre van a la red.\nconst VERSION = 'bb-inv-v2';\nconst BASE = ['./', 'index.html', 'core.js', 'manifest.webmanifest', 'logo.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];\n\nself.addEventListener('install', (e) => {\n  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));\n});\n\nself.addEventListener('activate', (e) => {\n  e.waitUntil(\n    caches.keys()\n      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))\n      .then(() => self.clients.claim())\n  );\n});\n\n// Red primero para que cada cambio de la app llegue en cuanto hay internet; sin red, la copia guardada.\nself.addEventListener('fetch', (e) => {\n  const r = e.request, u = new URL(r.url);\n  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;\n  e.respondWith(\n    fetch(r)\n      .then((res) => {\n        if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(r, copia)); }\n        return res;\n      })\n      .catch(() => caches.match(r).then((m) => m || caches.match('index.html')))\n  );\n});\n" } };

// functions/api/[[path]].js
var import_core2 = __toESM(require_core());

// functions/_d1.js
var import_core = __toESM(require_core());
var { ApiError } = import_core.default;
var SCHEMA = [
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
    pago TEXT NOT NULL DEFAULT '', grupo TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', anulado INTEGER NOT NULL DEFAULT 0,
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
  // tabla trampa: insertar aquí rompe el CHECK y deshace todo el batch (ver guardas)
  `CREATE TABLE IF NOT EXISTS guardas (g INTEGER NOT NULL CHECK (g = 0))`
];
var COLS_PRODUCTO = ["id", "nombre", "cat", "medida", "tono", "unidad", "precio", "costo", "min_local", "min_tienda", "activo", "stock_local", "stock_tienda", "hubo_local", "hubo_tienda", "creado", "actualizado"];
var COLS_MOV = ["id", "ts", "prod", "loc", "delta", "tipo", "motivo", "nota", "rol", "precio", "cliente", "pago", "grupo", "ref", "anulado", "anulado_ts", "anulado_por", "anulado_nota"];
var COLS_EDITABLES = ["nombre", "unidad", "precio", "costo", "min_local", "min_tienda", "medida", "tono", "activo", "actualizado"];
var insertarJson = (tabla, cols) => `INSERT INTO ${tabla} (${cols.join(", ")}) SELECT ${cols.map((c) => `json_extract(value, '$.${c}')`).join(", ")} FROM json_each(?1)`;
var migradas = /* @__PURE__ */ new WeakSet();
async function crearRepoD1(db) {
  if (!migradas.has(db)) {
    const existe = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'productos'`).first();
    if (!existe) await db.batch(SCHEMA.map((s) => db.prepare(s)));
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
      if (g.tipo === "traspaso_estado") st.push(q(`INSERT INTO guardas (g) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM traspasos WHERE id = ?1 AND estado = ?2)`, g.id, g.estado));
      else if (g.tipo === "pedido_estado") st.push(q(`INSERT INTO guardas (g) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pedidos WHERE id = ?1 AND estado = ?2)`, g.id, g.estado));
      else if (g.tipo === "grupo_sin_anular") st.push(q(`INSERT INTO guardas (g) SELECT 1 WHERE EXISTS (SELECT 1 FROM movs WHERE grupo = ?1 AND anulado = 1)`, g.grupo));
    });
    if (tx.configInsert) Object.keys(tx.configInsert).forEach((k) => st.push(q(`INSERT INTO config (k, v) VALUES (?1, ?2)`, k, JSON.stringify(tx.configInsert[k]))));
    Object.keys(tx.config).forEach((k) => st.push(q(`INSERT INTO config (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, JSON.stringify(tx.config[k]))));
    if (tx.productosInsert.length) st.push(q(insertarJson("productos", COLS_PRODUCTO), JSON.stringify(tx.productosInsert)));
    const grupos = {};
    tx.productosUpdate.forEach((u) => {
      const cols = Object.keys(u.set).filter((c) => COLS_EDITABLES.includes(c)).sort();
      const clave = cols.join(",");
      (grupos[clave] || (grupos[clave] = { cols, filas: [] })).filas.push(Object.assign({ id: u.id }, u.set));
    });
    Object.keys(grupos).forEach((clave) => {
      const g = grupos[clave];
      const sets = g.cols.map((c) => `${c} = (SELECT json_extract(j.value, '$.${c}') FROM json_each(?1) j WHERE json_extract(j.value, '$.id') = productos.id)`);
      st.push(q(`UPDATE productos SET ${sets.join(", ")} WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?1))`, JSON.stringify(g.filas)));
    });
    if (tx.stock.length) {
      const suma = (campo) => `COALESCE((SELECT SUM(json_extract(j.value, '$.${campo}')) FROM json_each(?1) j WHERE json_extract(j.value, '$.id') = productos.id), 0)`;
      st.push(q(
        `UPDATE productos SET
           stock_local = stock_local + ${suma("dl")},
           stock_tienda = stock_tienda + ${suma("dt")},
           hubo_local = MAX(hubo_local, (stock_local + ${suma("dl")}) > 0),
           hubo_tienda = MAX(hubo_tienda, (stock_tienda + ${suma("dt")}) > 0)
         WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?1))`,
        JSON.stringify(tx.stock)
      ));
    }
    if (tx.movsAnulados.length) {
      const a = tx.movsAnulados[0];
      st.push(q(
        `UPDATE movs SET anulado = 1, anulado_ts = ?2, anulado_por = ?3, anulado_nota = ?4 WHERE id IN (SELECT value FROM json_each(?1))`,
        JSON.stringify(tx.movsAnulados.map((m) => m.id)),
        a.ts,
        a.por,
        a.nota
      ));
    }
    if (tx.movs.length) st.push(q(insertarJson("movs", COLS_MOV), JSON.stringify(tx.movs)));
    tx.traspasos.forEach(({ t, lineas }) => {
      st.push(q(
        `INSERT INTO traspasos (id, ts, estado, nota, pedido, recibido_ts, nota_recibo, dif) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, nota = excluded.nota, pedido = excluded.pedido,
           recibido_ts = excluded.recibido_ts, nota_recibo = excluded.nota_recibo, dif = excluded.dif`,
        t.id,
        t.ts,
        t.estado,
        t.nota || "",
        t.pedido || "",
        t.recibido_ts || 0,
        t.nota_recibo || "",
        t.dif || 0
      ));
      st.push(q(`DELETE FROM traspaso_lineas WHERE traspaso_id = ?1`, t.id));
      st.push(q(
        `INSERT INTO traspaso_lineas (traspaso_id, prod, cant, recibida) SELECT ?1, json_extract(value, '$.id'), json_extract(value, '$.cant'), json_extract(value, '$.recibida') FROM json_each(?2)`,
        t.id,
        JSON.stringify(lineas)
      ));
    });
    tx.pedidos.forEach(({ p, lineas }) => {
      st.push(q(
        `INSERT INTO pedidos (id, ts, estado, nota, traspaso) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, nota = excluded.nota, traspaso = excluded.traspaso`,
        p.id,
        p.ts,
        p.estado,
        p.nota || "",
        p.traspaso || ""
      ));
      st.push(q(`DELETE FROM pedido_lineas WHERE pedido_id = ?1`, p.id));
      st.push(q(
        `INSERT INTO pedido_lineas (pedido_id, prod, cant) SELECT ?1, json_extract(value, '$.id'), json_extract(value, '$.cant') FROM json_each(?2)`,
        p.id,
        JSON.stringify(lineas)
      ));
    });
    if (!tx.sinRev) st.push(q(`INSERT INTO config (k, v) VALUES ('rev', '1') ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS INTEGER) + 1 AS TEXT)`));
    return st;
  }
  return {
    async config() {
      const o = {};
      (await todas(`SELECT k, v FROM config`)).forEach((r) => {
        try {
          o[r.k] = JSON.parse(r.v);
        } catch (e) {
        }
      });
      return o;
    },
    productos() {
      return todas(`SELECT * FROM productos ORDER BY nombre COLLATE NOCASE`);
    },
    async traspasos(f) {
      f = f || {};
      const filas = f.abiertos ? await todas(`SELECT * FROM traspasos WHERE estado = 'en_transito' ORDER BY ts DESC, id DESC LIMIT 80`) : await todas(`SELECT * FROM traspasos WHERE estado = 'en_transito' OR ts >= ?1 ORDER BY ts DESC, id DESC LIMIT 80`, f.desde || 0);
      return conLineas(filas, "traspaso_lineas", "traspaso_id", "recibida");
    },
    async traspaso(id) {
      const h = await q(`SELECT * FROM traspasos WHERE id = ?1`, id).first();
      return h ? (await conLineas([h], "traspaso_lineas", "traspaso_id", "recibida"))[0] : null;
    },
    async pedidos(f) {
      f = f || {};
      const filas = f.abiertos ? await todas(`SELECT * FROM pedidos WHERE estado = 'pendiente' ORDER BY ts DESC, id DESC LIMIT 80`) : await todas(`SELECT * FROM pedidos WHERE estado = 'pendiente' OR ts >= ?1 ORDER BY ts DESC, id DESC LIMIT 80`, f.desde || 0);
      return conLineas(filas, "pedido_lineas", "pedido_id", "0");
    },
    async pedido(id) {
      const h = await q(`SELECT * FROM pedidos WHERE id = ?1`, id).first();
      return h ? (await conLineas([h], "pedido_lineas", "pedido_id", "0"))[0] : null;
    },
    diferir(fn) {
      return fn();
    },
    // sin efecto: cada commit ya es una transacción (lo usa sembrarDemo en las pruebas)
    movsGrupo(grupo) {
      return todas(`SELECT * FROM movs WHERE grupo = ?1 ORDER BY id`, grupo);
    },
    async movs(f) {
      const w = [], a = [];
      if (!f.anulaciones) w.push(`tipo != 'anulacion'`);
      if (f.desde) {
        w.push("ts >= ?");
        a.push(f.desde);
      }
      if (f.hasta) {
        w.push("ts <= ?");
        a.push(f.hasta);
      }
      if (f.prods) {
        w.push("prod IN (SELECT value FROM json_each(?))");
        a.push(JSON.stringify(f.prods));
      }
      if (f.tipos) {
        w.push("tipo IN (SELECT value FROM json_each(?))");
        a.push(JSON.stringify(f.tipos));
      }
      if (f.rol) {
        w.push("rol = ?");
        a.push(f.rol);
      }
      if (f.antes) {
        const i = f.antes.indexOf("_");
        w.push("(ts < ? OR (ts = ? AND id < ?))");
        a.push(Number(f.antes.slice(0, i)), Number(f.antes.slice(0, i)), f.antes.slice(i + 1));
      }
      a.push(f.limite + 1);
      const filas = await todas(`SELECT * FROM movs ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY ts DESC, id DESC LIMIT ?`, ...a);
      const items = filas.slice(0, f.limite);
      const last = items[items.length - 1];
      return { items, siguiente: filas.length > f.limite && last ? last.ts + "_" + last.id : null };
    },
    ventas(desde) {
      return todas(`SELECT ts, prod, delta, precio, grupo, tipo FROM movs WHERE tipo IN ('venta', 'devolucion') AND anulado = 0 AND ts >= ?1`, desde);
    },
    async commit(tx) {
      try {
        await db.batch(construir(tx));
      } catch (e) {
        const m = String(e && (e.message || e.cause && e.cause.message) || e);
        if (/UNIQUE constraint failed: config\.k/i.test(m)) throw new ApiError(409, "ya_configurado", "Este inventario ya est\xE1 configurado.");
        if (/UNIQUE constraint failed/i.test(m)) throw new ApiError(409, "duplicado", "Esta operaci\xF3n ya se hab\xEDa guardado.");
        if (/CHECK constraint failed/i.test(m)) throw new ApiError(409, "conflicto", "El inventario cambi\xF3 mientras guardabas. Ya se actualiz\xF3 la pantalla; revisa e intenta de nuevo.");
        throw e;
      }
    }
  };
}

// functions/api/[[path]].js
var CABECERAS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
var responder = (status, json) => new Response(JSON.stringify(json), { status, headers: CABECERAS });
var error = (status, code, mensaje) => responder(status, { ok: false, error: { code, mensaje } });
async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "POST") return error(405, "metodo", "M\xE9todo no permitido.");
  if (!env.DB) return error(503, "sin_base_de_datos", 'Falta conectar la base de datos D1 con el nombre "DB".');
  const url = new URL(request.url);
  let body = null;
  if (request.method === "POST") {
    if (Number(request.headers.get("content-length") || 0) > 65536) return error(413, "muy_grande", "La petici\xF3n es demasiado grande.");
    try {
      body = await request.json();
    } catch (e) {
      return error(400, "json", "No pude leer la petici\xF3n.");
    }
  }
  const repo = await crearRepoD1(env.DB);
  const r = await import_core2.default.handle(repo, {
    method: request.method,
    path: url.pathname.replace(/^\/api/, "") || "/",
    query: Object.fromEntries(url.searchParams),
    body,
    token: (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")
  }, { claveInstalacion: env.SETUP_KEY });
  return responder(r.status, r.json);
}

// scripts/entrada-worker.js
var cuerpos = /* @__PURE__ */ new Map();
var cuerpoDe = (ruta, a) => {
  if (!cuerpos.has(ruta)) cuerpos.set(ruta, a.b64 ? Uint8Array.from(atob(a.b64), (c) => c.charCodeAt(0)) : a.texto);
  return cuerpos.get(ruta);
};
var entrada_worker_default = {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) return onRequest({ request, env });
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("M\xE9todo no permitido", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    const ruta = pathname === "/" ? "/index.html" : pathname;
    const a = archivos_default[ruta];
    if (!a) return new Response("No encontrado", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    const cabeceras = new Headers(a.cabeceras);
    if (request.headers.get("if-none-match") === a.cabeceras.etag) return new Response(null, { status: 304, headers: cabeceras });
    return new Response(request.method === "HEAD" ? null : cuerpoDe(ruta, a), { headers: cabeceras });
  }
};
export {
  entrada_worker_default as default
};
