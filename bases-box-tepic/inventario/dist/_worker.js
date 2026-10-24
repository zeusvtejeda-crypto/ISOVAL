/* huella:26f708b4f562be83 */
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
      const MAX_LINEAS = 15;
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

// ../../../../../tmp/bb-empaquetar-QzrNVy/archivos.js
var archivos_default = { "/apple-touch-icon.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"0256b8c17338f5959376"' }, "b64": "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" }, "/core.js": { "cabeceras": { "content-type": "text/javascript; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"24750b8e8a76208ca39a"' }, "texto": `/* N\xFAcleo del inventario de Bases Box Tepic.
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
  const MAX_LINEAS = 15;
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
` }, "/icon-192.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"ff7b4adf3b04fdffa3a8"' }, "b64": "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" }, "/icon-512.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"d39b3084f91a45fd8a7c"' }, "b64": "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" }, "/icon-maskable-512.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"38faa0c000f7a09a0895"' }, "b64": "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AABQigAAAKUIAABQigAAAKUIAABQigAAAKUIAABQigAAAKUIAABQigAAAKXapaWlWYAC9bqB+kM3UOhBN1BoIcO629OU38joDy0oAQGAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAAChFAACAUgQAACj1/wEAAP//Ftrq5gAAAAZJREFUAwAvIQTIhm93VwAAAABJRU5ErkJggg==" }, "/icon.svg": { "cabeceras": { "content-type": "image/svg+xml", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"494712c525ab48e28d91"' }, "texto": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <rect width="512" height="512" rx="112" fill="#1A1A1A"/>\n  <g transform="translate(256 256) scale(1.35) translate(0 -131)">\n    <g fill="#F2591F"><polygon points="-103.9,190 -83.9,201.5 -83.9,214 -103.9,202.5"/><polygon points="103.9,190 83.9,201.5 83.9,214 103.9,202.5"/><rect x="-6" y="250" width="12" height="12"/></g>\n    <polygon points="103.9,60 0,120 0,250 103.9,190" fill="#4A4A4A"/>\n    <polygon points="-103.9,60 0,120 0,250 -103.9,190" fill="#333333"/>\n    <polygon points="0,0 103.9,60 0,120 -103.9,60" fill="#ECEAE4" stroke="#1A1A1A" stroke-width="4" stroke-linejoin="round"/>\n    <g fill="#1A1A1A" opacity=".55"><circle cx="0" cy="40" r="3"/><circle cx="-34" cy="60" r="3"/><circle cx="34" cy="60" r="3"/><circle cx="0" cy="80" r="3"/><circle cx="0" cy="60" r="3.5"/></g>\n  </g>\n</svg>\n' }, "/index.html": { "cabeceras": { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"707db1b7285b56a3d460"' }, "texto": `<!DOCTYPE html>
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
<link rel="icon" href="icon.svg" type="image/svg+xml">
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
.logo{display:grid;place-items:center;width:38px;height:38px;border-radius:9px;background:#262626;flex:none}
.logo svg{width:28px;height:28px}
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
.lin-add{position:relative;margin-bottom:16px}
.lin-res{margin-top:6px;border:1px solid var(--line-2);border-radius:var(--radio);background:var(--surface);max-height:260px;overflow:auto}
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
.acceso .logo{width:68px;height:68px;border-radius:16px;background:var(--rail)}
.acceso .logo svg{width:50px;height:50px}
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
    <symbol id="i-logo" viewBox="-120 -20 240 300"><g fill="#F2591F"><polygon points="-103.9,190 -83.9,201.5 -83.9,214 -103.9,202.5"/><polygon points="103.9,190 83.9,201.5 83.9,214 103.9,202.5"/><rect x="-6" y="250" width="12" height="12"/></g><polygon points="103.9,60 0,120 0,250 103.9,190" fill="#3A3A3A"/><polygon points="-103.9,60 0,120 0,250 -103.9,190" fill="#2C2C2C"/><polygon points="0,0 103.9,60 0,120 -103.9,60" fill="#ECEAE4" stroke="#1A1A1A" stroke-width="4" stroke-linejoin="round"/><g fill="#1A1A1A" opacity=".55"><circle cx="0" cy="40" r="3"/><circle cx="-34" cy="60" r="3"/><circle cx="34" cy="60" r="3"/><circle cx="0" cy="80" r="3"/><circle cx="0" cy="60" r="3.5"/></g></symbol>
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
const marca = () => html\`<div class="marca"><span class="logo"><svg width="28" height="28" aria-hidden="true"><use href="#i-logo"/></svg></span><span class="marca-t"><span class="marca-n">Bases Bo<b>x</b></span><span class="marca-s">Tepic \xB7 Inventario</span></span></div>\`;

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
  poner(el, html\`<ul class="lin-lista" aria-live="polite"></ul>
    <div class="lin-add">
      <label class="lbl" for="\${uid}-q">Agregar producto</label>
      <div class="buscar">\${ico('buscar')}<input class="inp" id="\${uid}-q" type="search" autocomplete="off" placeholder="Busca por nombre, medida o tono" aria-controls="\${uid}-r"></div>
      <ul class="lin-res" id="\${uid}-r" role="listbox" hidden></ul>
    </div>\`);
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
    if (o.alCambiar) o.alCambiar();
  }
  function agregar(id, cant) {
    const p = S.idx[id];
    if (!p || L.some((l) => l.id === id) || L.length >= max) return;
    L.push({ id, cant: cant || 1, precio: o.precio ? (p.precio ? String(p.precio) : '') : undefined });
    pintarLineas();
    const li = lista.lastElementChild;
    if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
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
    if (ev.key === 'Enter') { ev.preventDefault(); const c = candidatos()[0]; if (c) { agregar(c.id); q.value = ''; res.hidden = true; } }
    if (ev.key === 'Escape' && !res.hidden) { ev.stopPropagation(); res.hidden = true; }
  });
  res.addEventListener('mousedown', (ev) => ev.preventDefault());
  res.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-add]');
    if (b) { agregar(b.dataset.add); q.value = ''; res.hidden = true; }
  });
  document.addEventListener('click', function fuera(ev) {
    if (!el.isConnected) { document.removeEventListener('click', fuera); return; }
    if (!zona.contains(ev.target)) res.hidden = true;
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
const cabeceraMarca = () => html\`<div class="marca-g"><span class="logo"><svg width="50" height="50" aria-hidden="true"><use href="#i-logo"/></svg></span><h1>Bases Bo<b>x</b></h1><span class="sub">Tepic \xB7 Inventario</span><div class="tonos-fila" aria-hidden="true">\${Core.TONOS_BASE.map((t) => html\`<i style="background:\${t.hex}"></i>\`)}</div></div>\`;
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
` }, "/manifest.webmanifest": { "cabeceras": { "content-type": "application/manifest+json", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "etag": '"b5732212917193295f3e"' }, "texto": '{\n  "name": "Inventario Bases Box Tepic",\n  "short_name": "Inventario",\n  "description": "Inventario compartido entre el almac\xE9n y el vendedor de la tienda.",\n  "lang": "es-MX",\n  "start_url": "./",\n  "scope": "./",\n  "display": "standalone",\n  "orientation": "any",\n  "background_color": "#1A1A1A",\n  "theme_color": "#1A1A1A",\n  "icons": [\n    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },\n    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },\n    { "src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },\n    { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml" }\n  ]\n}\n' }, "/sw.js": { "cabeceras": { "content-type": "text/javascript; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex", "referrer-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"1ba8d480c50a1cd356bc"' }, "texto": "// Service worker: guarda la app para abrirla aunque no haya internet.\n// Los datos (/api) nunca se guardan aqu\xED: siempre van a la red.\nconst VERSION = 'bb-inv-v1';\nconst BASE = ['./', 'index.html', 'core.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];\n\nself.addEventListener('install', (e) => {\n  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));\n});\n\nself.addEventListener('activate', (e) => {\n  e.waitUntil(\n    caches.keys()\n      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))\n      .then(() => self.clients.claim())\n  );\n});\n\n// Red primero para que cada cambio de la app llegue en cuanto hay internet; sin red, la copia guardada.\nself.addEventListener('fetch', (e) => {\n  const r = e.request, u = new URL(r.url);\n  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;\n  e.respondWith(\n    fetch(r)\n      .then((res) => {\n        if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(r, copia)); }\n        return res;\n      })\n      .catch(() => caches.match(r).then((m) => m || caches.match('index.html')))\n  );\n});\n" } };

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
