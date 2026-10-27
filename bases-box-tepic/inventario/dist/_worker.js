/* huella:8a91e875aaade783 */
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
      const SESION_DIAS = 14;
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
      const PINS_COMUNES = ["123456", "654321", "121212", "112233", "123123", "159753", "147258", "102030", "123321", "010203", "696969", "202020", "2580", "12345678", "87654321", "11223344", "12341234", "123654", "1234567"];
      function validarPin(pin) {
        if (!/^\d{6,8}$/.test(pin)) throw bad("pin_formato", "El PIN debe tener de 6 a 8 n\xFAmeros.");
        const debil = /^(\d)\1+$/.test(pin) || /^(\d{1,4})\1+$/.test(pin) || "01234567890123456789".includes(pin) || "98765432109876543210".includes(pin) || PINS_COMUNES.includes(pin);
        if (debil) throw bad("pin_debil", "Ese PIN es muy f\xE1cil de adivinar. Elige otro.");
      }
      function normalizarCfg(raw) {
        raw = raw || {};
        return {
          configurado: !!raw.configurado,
          negocio: Object.assign({ nombre: "Bases Box Tepic", telLocal: "", telTienda: "", envioTepic: 200, envioFuera: 250, descRecoge: 200 }, raw.negocio),
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
      async function reservar(ctx, clave) {
        const r = await ctx.repo.intento(clave, ctx.ahora);
        const espera = Math.max(0, Math.ceil((r.hasta - ctx.ahora) / 1e3));
        if (!r.adm) throw new ApiError2(423, "bloqueado", "Demasiados intentos. Espera " + fmtEspera(espera) + " para volver a intentar.", { espera });
        return { restantes: r.hasta > ctx.ahora ? 0 : 5 - r.n, espera };
      }
      function fallar(res, code, msg) {
        if (res.restantes === 0) throw new ApiError2(423, "bloqueado", "Demasiados intentos. Espera " + fmtEspera(res.espera) + " para volver a intentar.", { espera: res.espera });
        throw new ApiError2(401, code, msg + " Te quedan " + res.restantes + (res.restantes === 1 ? " intento." : " intentos."), { restantes: res.restantes });
      }
      const limpiarIntentos = (ctx, ...claves) => ctx.repo.limpiarIntentos(claves);
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
        sinRev: false,
        reiniciar: false
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
          const it = await reservar(ctx, "setup");
          if (!normCodigo(b.clave) || !igual(normCodigo(b.clave), normCodigo(ctx.claveInstalacion))) fallar(it, "clave_instalacion", "La clave de instalaci\xF3n no es correcta.");
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
        const it = await reservar(ctx, rol);
        const acc = cfg.acceso[rol];
        if (!acc || !igual(hashPin(acc.salt, String(b.pin || "")), acc.hash)) fallar(it, "pin_incorrecto", "PIN incorrecto.");
        await limpiarIntentos(ctx, rol);
        return ok({ token: firmar(cfg, rol, ctx.ahora), rol });
      }
      async function recuperar(ctx) {
        const cfg = await cargarCfg(ctx);
        if (!cfg.configurado) throw new ApiError2(409, "no_configurado", "Este inventario todav\xEDa no est\xE1 configurado.");
        const b = ctx.req.body || {};
        const rol = b.rol, pin = String(b.pin || "");
        if (!ROLES.includes(rol)) throw bad("rol_invalido", "Elige de qui\xE9n es el PIN.");
        validarPin(pin);
        const it = await reservar(ctx, "recup");
        const rec = cfg.acceso.recup;
        if (!rec || !igual(hashPin(rec.salt, normCodigo(b.codigo)), rec.hash)) fallar(it, "codigo_incorrecto", "C\xF3digo de recuperaci\xF3n incorrecto.");
        const otro = cfg.acceso[rol === "local" ? "tienda" : "local"];
        if (otro && igual(hashPin(otro.salt, pin), otro.hash)) throw bad("pin_igual", "Cada usuario necesita un PIN distinto.");
        const codigo = codigoRecuperacion();
        const acceso = Object.assign({}, cfg.acceso, {
          [rol]: nuevoAcceso(pin, (cfg.acceso[rol] && cfg.acceso[rol].v || 0) + 1),
          recup: nuevoAcceso(normCodigo(codigo))
        });
        const tx = nuevaTx();
        tx.config = { acceso };
        await ctx.repo.commit(tx);
        await limpiarIntentos(ctx, "recup", rol);
        return ok({ token: firmar(Object.assign({}, cfg, { acceso }), rol, ctx.ahora), rol, codigo });
      }
      function lunesDe(k) {
        const [y, m, d] = k.split("-").map(Number);
        const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
        return new Date(Date.UTC(y, m - 1, d - dow)).toISOString().slice(0, 10);
      }
      const redondear2 = (o) => {
        o.total = Math.round(o.total * 100) / 100;
        return o;
      };
      function detalleVentas(filas, ahora, tz) {
        const hoyK = diaKey(ahora, tz), mesK = hoyK.slice(0, 7), semK = lunesDe(hoyK);
        const per = {
          hoy: { desde: hoyK, test: (k) => k === hoyK },
          semana: { desde: semK, test: (k) => k >= semK && k <= hoyK },
          mes: { desde: mesK + "-01", test: (k) => k.slice(0, 7) === mesK }
        };
        const out = {};
        Object.keys(per).forEach((n) => {
          out[n] = { desde: per[n].desde, total: 0, envios: 0, pzas: 0, n: 0, g: /* @__PURE__ */ new Set(), prods: {}, dias: {} };
        });
        filas.forEach((r) => {
          const pzas = -r.delta, monto = pzas * (r.precio || 0), env = r.envio || 0, k = diaKey(r.ts, tz);
          Object.keys(per).forEach((n) => {
            if (!per[n].test(k)) return;
            const o = out[n];
            o.total += monto + env;
            o.envios += env;
            o.pzas += pzas;
            const pr = o.prods[r.prod] || (o.prods[r.prod] = { id: r.prod, pzas: 0, total: 0 });
            pr.pzas += pzas;
            pr.total += monto;
            const d = o.dias[k] || (o.dias[k] = { k, pzas: 0, total: 0, envios: 0, g: /* @__PURE__ */ new Set() });
            d.pzas += pzas;
            d.total += monto + env;
            d.envios += env;
            if (r.tipo === "venta") {
              o.g.add(r.grupo);
              d.g.add(r.grupo);
            }
          });
        });
        Object.keys(out).forEach((n) => {
          const o = out[n];
          o.n = o.g.size;
          delete o.g;
          o.productos = Object.values(o.prods).filter((t) => t.pzas !== 0).sort((a, b) => b.total - a.total || b.pzas - a.pzas).map(redondear2);
          o.dias = Object.values(o.dias).sort((a, b) => a.k < b.k ? 1 : -1).map((d) => {
            d.n = d.g.size;
            delete d.g;
            return redondear2(d);
          });
          delete o.prods;
          o.dias.forEach((d) => {
            d.envios = Math.round(d.envios * 100) / 100;
          });
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
          if (k in idxDia) {
            dias[idxDia[k]].total += monto + (r.envio || 0);
            dias[idxDia[k]].pzas += pzas;
          }
          if (r.ts >= ahora - 30 * DIA) {
            const t = top[r.prod] || (top[r.prod] = { id: r.prod, pzas: 0, total: 0 });
            t.pzas += pzas;
            t.total += monto;
          }
        });
        const res = (o) => ({ total: o.total, pzas: o.pzas, n: o.n, envios: o.envios });
        return {
          hoy: res(det.hoy),
          semana: res(det.semana),
          mes: res(det.mes),
          dias: dias.map(redondear2),
          top: Object.values(top).filter((t) => t.pzas > 0).sort((a, b) => b.pzas - a.pzas).slice(0, 5).map(redondear2)
        };
      }
      async function reporteDia(ctx) {
        const q = ctx.req.query || {};
        const hoyK = diaKey(ctx.ahora, ctx.tz);
        let dia = hoyK;
        if (q.dia !== void 0 && q.dia !== "") {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(q.dia)) || String(q.dia) > hoyK || diaKey(ctx.ahora - 34 * DIA, ctx.tz) > String(q.dia)) throw bad("dia_invalido", "Elige un d\xEDa de los \xFAltimos 30 d\xEDas.");
          dia = String(q.dia);
        }
        const filas = (await ctx.repo.ventas(ctx.ahora - 36 * DIA)).filter((r) => diaKey(r.ts, ctx.tz) === dia).sort((a, b) => a.ts - b.ts);
        const grupos = /* @__PURE__ */ Object.create(null), orden = [];
        filas.forEach((r) => {
          const g = grupos[r.grupo] || (grupos[r.grupo] = { grupo: r.grupo, ts: r.ts, tipo: r.tipo, cliente: r.cliente || "", pago: r.pago || "", entrega: r.tipo === "venta" ? r.motivo || "" : "", envio: 0, lineas: [], total: 0 });
          if (!orden.includes(g)) orden.push(g);
          const pzas = Math.abs(r.delta);
          g.lineas.push({ id: r.prod, pzas, precio: r.precio || 0 });
          g.envio += r.envio || 0;
          g.total += pzas * (r.precio || 0) + (r.envio || 0);
        });
        const redo = (n) => Math.round(n * 100) / 100;
        const ventas = orden.filter((g) => g.tipo === "venta").map((g) => Object.assign(g, { total: redo(g.total), envio: redo(g.envio) }));
        const devs = orden.filter((g) => g.tipo === "devolucion").map((g) => ({ grupo: g.grupo, ts: g.ts, lineas: g.lineas, total: redo(g.total) }));
        const t = { ventas: ventas.length, pzas: 0, envios: 0, vendido: 0, devuelto: 0, neto: 0, porPago: {} };
        ventas.forEach((g) => {
          t.vendido += g.total;
          t.envios += g.envio;
          g.lineas.forEach((l) => {
            t.pzas += l.pzas;
          });
          t.porPago[g.pago || "efectivo"] = redo((t.porPago[g.pago || "efectivo"] || 0) + g.total);
        });
        devs.forEach((g) => {
          t.devuelto += g.total;
          g.lineas.forEach((l) => {
            t.pzas -= l.pzas;
          });
        });
        t.vendido = redo(t.vendido);
        t.envios = redo(t.envios);
        t.devuelto = redo(t.devuelto);
        t.neto = redo(t.vendido - t.devuelto);
        const prods = await ctx.repo.productos();
        return { dia, hoy: dia === hoyK, ventas, devoluciones: devs, totales: t, tienda: { pzas: prods.filter((p) => p.activo).reduce((a, p) => a + p.stock_tienda, 0) } };
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
      const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : void 0;
      const indexar = (arr) => arr.reduce((o, x) => {
        o[x.id] = x;
        return o;
      }, /* @__PURE__ */ Object.create(null));
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
        return typeof b.cid === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(b.cid) && !(b.cid in Object.prototype) ? b.cid : uid(prefijo || "G");
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
          envio: 0,
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
      const ENTREGAS = { recoge: null, tepic: "envioTepic", xalisco: "envioFuera", cantera: "envioFuera" };
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
        let envio = 0;
        if (tipo === "venta" && Object.prototype.hasOwnProperty.call(ENTREGAS, b.entrega)) {
          extra.motivo = b.entrega;
          const neg = (await cargarCfg(ctx)).negocio;
          if (ENTREGAS[b.entrega]) envio = numero(b.envio == null || b.envio === "" ? neg[ENTREGAS[b.entrega]] : b.envio, 0, 1e5, neg[ENTREGAS[b.entrega]]);
        }
        let total = 0, piezas = 0;
        ls.forEach((l, i) => {
          const p = activoOError(prods[l.id]);
          const delta = def.signo * l.cant;
          revisarStock(p, def.loc, delta);
          const precio = def.precio ? numero(l.precio == null || l.precio === "" ? p.precio : l.precio, 0, 1e6, 0) : null;
          total += (precio || 0) * l.cant;
          piezas += l.cant;
          tx.stock.push(deltaStock(p.id, def.loc, delta));
          tx.movs.push(nuevoMov(ctx, grupo, i, p, def.loc, delta, tipo, Object.assign({ precio, envio: i === 0 ? envio : 0 }, extra)));
        });
        return { grupo, total: Math.round((total + envio) * 100) / 100, piezas, envio };
      }
      async function opRegreso(ctx, b, tx) {
        const ls = lineas(b.lineas);
        const prods = indexar(await ctx.repo.productos());
        const grupo = grupoDe(b, "R");
        const nota = clean(b.nota, 200);
        let piezas = 0;
        ls.forEach((l, i) => {
          const p = activoOError(prods[l.id]);
          revisarStock(p, "tienda", -l.cant);
          piezas += l.cant;
          tx.stock.push(deltaStock(p.id, "tienda", -l.cant), deltaStock(p.id, "local", l.cant));
          tx.movs.push(nuevoMov(ctx, grupo, i * 2, p, "tienda", -l.cant, "regreso", { nota }));
          tx.movs.push(nuevoMov(ctx, grupo, i * 2 + 1, p, "local", l.cant, "regreso", { nota }));
        });
        return { grupo, piezas };
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
            envio: 0,
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
        if (await ctx.repo.pedido(id)) throw new ApiError2(409, "duplicado", "Este pedido ya se hab\xEDa guardado.");
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
      const tarifa = (v, actual) => v === void 0 || v === null || v === "" ? actual : numero(v, 0, 1e5, actual);
      async function opConfigGuardar(ctx, b, tx) {
        const cfg = ctx.cfg, patch = {};
        const prods = await ctx.repo.productos();
        if (b.negocio) {
          patch.negocio = {
            nombre: clean(b.negocio.nombre, 60) || cfg.negocio.nombre,
            telLocal: String(b.negocio.telLocal || "").replace(/\D/g, "").slice(0, 15),
            telTienda: String(b.negocio.telTienda || "").replace(/\D/g, "").slice(0, 15),
            envioTepic: tarifa(b.negocio.envioTepic, cfg.negocio.envioTepic),
            envioFuera: tarifa(b.negocio.envioFuera, cfg.negocio.envioFuera),
            descRecoge: tarifa(b.negocio.descRecoge, cfg.negocio.descRecoge)
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
        const it = await reservar(ctx, rol);
        const acc = cfg.acceso[rol];
        if (!igual(hashPin(acc.salt, String(b.pinActual || "")), acc.hash)) fallar(it, "pin_incorrecto", "Tu PIN actual no coincide.");
        const nuevo = String(b.pinNuevo || "");
        validarPin(nuevo);
        await reservar(ctx, "cambio:" + rol);
        const otro = cfg.acceso[rol === "local" ? "tienda" : "local"];
        if (otro && igual(hashPin(otro.salt, nuevo), otro.hash)) throw bad("pin_igual", "Ese PIN no est\xE1 disponible. Elige otro.");
        await limpiarIntentos(ctx, rol);
        const acceso = Object.assign({}, cfg.acceso, { [rol]: nuevoAcceso(nuevo, acc.v + 1) });
        tx.config = { acceso };
        return { token: firmar(Object.assign({}, cfg, { acceso }), rol, ctx.ahora) };
      }
      async function opPinReiniciar(ctx, b, tx) {
        const cfg = ctx.cfg;
        const it = await reservar(ctx, "local");
        const acc = cfg.acceso.local;
        if (!igual(hashPin(acc.salt, String(b.pinActual || "")), acc.hash)) fallar(it, "pin_incorrecto", "Tu PIN no coincide.");
        await limpiarIntentos(ctx, "local", "tienda");
        const nuevo = String(b.pinNuevo || "");
        validarPin(nuevo);
        if (igual(hashPin(acc.salt, nuevo), acc.hash)) throw bad("pin_igual", "Cada usuario necesita un PIN distinto.");
        const t = cfg.acceso.tienda;
        const acceso = Object.assign({}, cfg.acceso, { tienda: nuevoAcceso(nuevo, (t && t.v || 0) + 1) });
        tx.config = { acceso };
        return {};
      }
      async function opRecupNueva(ctx, b, tx) {
        const cfg = ctx.cfg;
        const it = await reservar(ctx, "local");
        const acc = cfg.acceso.local;
        if (!igual(hashPin(acc.salt, String(b.pinActual || "")), acc.hash)) fallar(it, "pin_incorrecto", "Tu PIN no coincide.");
        await limpiarIntentos(ctx, "local");
        const codigo = codigoRecuperacion();
        tx.config = { acceso: Object.assign({}, cfg.acceso, { recup: nuevoAcceso(normCodigo(codigo)) }) };
        return { codigo };
      }
      async function opReiniciar(ctx, b, tx) {
        const cfg = ctx.cfg;
        const it = await reservar(ctx, "local");
        const acc = cfg.acceso.local;
        if (!igual(hashPin(acc.salt, String(b.pinActual || "")), acc.hash)) fallar(it, "pin_incorrecto", "Tu PIN no coincide.");
        await limpiarIntentos(ctx, "local");
        if (String(b.confirmacion || "").trim().toUpperCase() !== "BORRAR TODO") throw bad("falta_confirmacion", "Escribe BORRAR TODO para confirmar.");
        tx.reiniciar = true;
        tx.config = { reinicio: { ts: ctx.ahora, rol: ctx.rol } };
        return {};
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
        "mov.regreso": [["local", "tienda"], opRegreso],
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
        "recup.nueva": [["local"], opRecupNueva],
        "sistema.reiniciar": [["local"], opReiniciar]
      };
      async function correrOp(ctx, body) {
        const def = body && typeof body.op === "string" && Object.prototype.hasOwnProperty.call(OPS, body.op) ? OPS[body.op] : null;
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
          if (path === "/reporte-dia" && m === "GET") return ok(await reporteDia(ctx));
          if (path === "/ventas" && m === "GET") return ok({ ahora: ctx.ahora, ventas: detalleVentas(await ctx.repo.ventas(ctx.ahora - 35 * DIA), ctx.ahora, ctx.tz) });
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
        const vacio = () => ({ v: 1, config: {}, productos: {}, movs: [], traspasos: {}, pedidos: {}, intentos: {} });
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
          // cuenta un intento de PIN de forma atómica (ver reservar en el núcleo)
          async intento(clave2, ahora) {
            const m = S.intentos || (S.intentos = {});
            const it = Object.prototype.hasOwnProperty.call(m, clave2) ? m[clave2] : m[clave2] = { n: 0, b: 0, hasta: 0 };
            let adm = 1;
            if (it.hasta > ahora) adm = 0;
            else if (it.n + 1 >= 5) {
              it.hasta = ahora + Math.min(DIA, 5 * 6e4 * Math.pow(3, it.b));
              it.b += 1;
              it.n = 0;
            } else it.n += 1;
            guardar();
            return { n: it.n, b: it.b, hasta: it.hasta, adm };
          },
          async limpiarIntentos(claves) {
            const m = S.intentos || {};
            claves.forEach((c) => {
              delete m[c];
            });
            S.intentos = m;
            guardar();
          },
          async productos() {
            return Object.values(S.productos).map((p) => Object.assign({}, p));
          },
          async traspasos(f) {
            f = f || {};
            return Object.values(S.traspasos).filter((t) => f.abiertos ? t.estado === "en_transito" : t.estado === "en_transito" || t.ts >= (f.desde || 0)).sort(porFecha).slice(0, 80).map(conLineas);
          },
          async traspaso(id) {
            return conLineas(own(S.traspasos, id));
          },
          async pedidos(f) {
            f = f || {};
            return Object.values(S.pedidos).filter((t) => f.abiertos ? t.estado === "pendiente" : t.estado === "pendiente" || t.ts >= (f.desde || 0)).sort(porFecha).slice(0, 80).map(conLineas);
          },
          async pedido(id) {
            return conLineas(own(S.pedidos, id));
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
            return S.movs.filter((m) => (m.tipo === "venta" || m.tipo === "devolucion") && !m.anulado && m.ts >= desde).map((m) => ({ ts: m.ts, prod: m.prod, delta: m.delta, precio: m.precio, grupo: m.grupo, tipo: m.tipo, cliente: m.cliente, pago: m.pago, motivo: m.motivo, envio: m.envio || 0, rol: m.rol }));
          },
          async commit(tx) {
            (tx.guardas || []).forEach((g) => {
              if (g.tipo === "traspaso_estado" && (!own(S.traspasos, g.id) || S.traspasos[g.id].estado !== g.estado)) throw conflicto();
              if (g.tipo === "pedido_estado" && (!own(S.pedidos, g.id) || S.pedidos[g.id].estado !== g.estado)) throw conflicto();
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
              const p = own(S.productos, id);
              if (!p || p.stock_local + acum[id][0] < 0 || p.stock_tienda + acum[id][1] < 0) throw conflicto();
            });
            const antes = diferido ? null : JSON.stringify(S);
            try {
              if (tx.reiniciar) {
                S.movs = [];
                ids = /* @__PURE__ */ new Set();
                S.traspasos = {};
                S.pedidos = {};
                Object.keys(S.productos).forEach((k) => Object.assign(S.productos[k], { stock_local: 0, stock_tienda: 0, hubo_local: 0, hubo_tienda: 0 }));
              }
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

// ../../../../../tmp/bb-empaquetar-K2GoyZ/archivos.js
var archivos_default = { "/app.js": { "cabeceras": { "content-type": "text/javascript; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"d99c631c0705ab756923"' }, "texto": `(function () {
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
  regreso: { t: 'Regreso de tienda al almac\xE9n', ic: 'entrada', c: 'info' },
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
  if (r.status === 401 && r.json.error.code === 'sin_sesion') { salir(r.json.error.mensaje); return false; }
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
  if (r.status === 401 && er.code === 'sin_sesion') { salir(er.mensaje); throw new ErrorApi(er); }
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
    else if (r.status === 401 && r.json.error.code === 'sin_sesion') salir(r.json.error.mensaje);
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
  const out = [], idx = Object.create(null);
  movs.forEach((m) => {
    let g = idx[m.grupo];
    if (!g) {
      g = idx[m.grupo] = { grupo: m.grupo, ts: m.ts, tipo: m.tipo, rol: m.rol, nota: m.nota, motivo: m.motivo, cliente: m.cliente, pago: m.pago, ref: m.ref, anulado: !!m.anulado, anulado_ts: m.anulado_ts, anulado_por: m.anulado_por, anulado_nota: m.anulado_nota, lineas: [] };
      out.push(g);
    }
    if (m.tipo === 'regreso' && m.delta < 0) return; // un regreso guarda salida de tienda + entrada al almac\xE9n; se muestra una sola l\xEDnea
    g.lineas.push(m);
    if (m.ts < g.ts) g.ts = m.ts;
  });
  out.forEach((g) => {
    g.piezas = sumar(g.lineas, (m) => Math.abs(m.delta));
    g.envio = g.tipo === 'venta' ? sumar(g.lineas, (m) => m.envio || 0) : 0;
    g.total = (g.tipo === 'venta' || g.tipo === 'devolucion') ? sumar(g.lineas, (m) => Math.abs(m.delta) * (m.precio || 0)) + g.envio : 0;
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
    <button type="button" class="vtas" data-act="ventas" aria-label="Ver reporte de ventas">
      <span class="vtas-t"><span class="t-sec">Ventas</span><span class="vtas-ver">Ver reporte \${ico('der')}</span></span>
      <span class="vtas-g">\${[['Hoy', r.hoy], ['Semana', r.semana], ['Mes', r.mes]].map(([t, v]) => html\`<span class="vtas-c"><small>\${t}</small><b class="cifras">\${dinero(v.total)}</b><i>\${plural(v.n, 'venta', 'ventas')} \xB7 \${plural(v.pzas, 'pza', 'pzas')}</i></span>\`)}</span>
    </button>
    \${S.rol === 'tienda' ? html\`<button type="button" class="btn btn-p btn-b" data-act="reporte-dia" style="min-height:52px">\${ico('tabla')}Reporte del d\xEDa</button>\` : ''}
    <section class="grid-kpi" aria-label="Resumen">
      <div class="kpi"><span class="t-sec">Bases en el almac\xE9n</span><span class="num-g cifras">\${num(bLocal)}</span><small>\${plural(bases.filter((p) => p.stock_local > 0).length, 'modelo con existencias', 'modelos con existencias')}</small></div>
      <div class="kpi"><span class="t-sec">Bases en tienda</span><span class="num-g cifras">\${num(bTienda)}</span><small>\${plural(bases.filter((p) => p.stock_tienda > 0).length, 'modelo con existencias', 'modelos con existencias')}</small></div>
      <div class="kpi"><span class="t-sec">Bases en camino</span><span class="num-g cifras" style="color:\${bCamino ? 'var(--info)' : 'inherit'}">\${num(bCamino)}</span><small>\${bCamino ? 'Sin confirmar en tienda' : 'Nada por llegar'}</small></div>
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
    const pzL = sumar(activos, (p) => p.stock_local), pzT = sumar(activos, (p) => p.stock_tienda);
    $('#inv-sub').textContent = (S.rol === 'local' ? num(pzL) + ' pzas en almac\xE9n \xB7 ' + num(pzT) + ' en tienda' : num(pzT) + ' pzas en tienda') + (bajos ? ' \xB7 ' + plural(bajos, 'con stock bajo', 'con stock bajo') : ' \xB7 todo en orden');
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
  const vende = S.rol === 'tienda' && p.activo;
  const stA = html\`<span class="st \${cl('local')}"><b>\${num(p.stock_local)}</b><i>Almac\xE9n</i></span>\`;
  const stT = html\`<span class="st \${cl('tienda')}"><b>\${num(p.stock_tienda)}</b><i>Tienda</i></span>\`;
  return html\`<div class="prod \${p.activo ? '' : 'arch'}">
    <button type="button" class="prod-btn" data-act="prod" data-id="\${p.id}">
      <span class="prod-ico">\${iconoProd(p, 32)}</span>
      <span class="prod-main"><span class="prod-n">\${corto && p.cat === 'base' && tonoDe(p.tono) ? tonoDe(p.tono).nombre : p.nombre}</span><span class="prod-s">\${p.activo ? subProd(p, corto) : 'Archivado'}\${cam ? html\` \xB7 <span class="cam">\${cam} en camino</span>\` : ''}</span></span>
      <span class="stocks">\${S.rol === 'local' ? html\`\${stA}\${stT}\` : stT}</span>
    </button>
    \${vende ? html\`<button type="button" class="btn btn-s btn-p btn-vender" data-act="vender" data-id="\${p.id}" \${p.stock_tienda > 0 ? '' : 'disabled'} aria-label="Vender \${p.nombre}">Vender</button>\` : ''}
  </div>\`;
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
      ? [['envio', 'camion', 'Enviar a tienda', 'Arma el env\xEDo y la tienda lo confirma', true], ['entrada', 'entrada', 'Registrar entrada', 'Producci\xF3n o compra de material'], ['salida', 'salida', 'Registrar salida', 'Uso, merma u otra baja'], ['regreso', 'entrada', 'Regresar de tienda', 'Mueve piezas de la tienda al almac\xE9n'], ['conteo', 'conteo', 'Conteo f\xEDsico', 'Ajusta el sistema a lo que contaste']]
      : [['venta', 'recibo', 'Registrar venta', 'Descuenta y suma al total del d\xEDa', true], ['recibir', 'camion', 'Recibir mercanc\xEDa', enT.length ? plural(enT.length, 'env\xEDo en camino', 'env\xEDos en camino') : 'No hay env\xEDos en camino'], ['reporte', 'tabla', 'Reporte del d\xEDa', 'Total vendido, por forma de pago'], ['pedido', 'pedido', 'Pedir al almac\xE9n', 'Avisa qu\xE9 bases hacen falta'], ['regreso', 'entrada', 'Regresar al almac\xE9n', 'Mueve piezas de la tienda al almac\xE9n'], ['devolucion', 'devolver', 'Devoluci\xF3n', 'Un cliente regresa una base'], ['merma', 'basura', 'Merma', 'Da\xF1o o p\xE9rdida en tienda'], ['conteo', 'conteo', 'Conteo f\xEDsico', 'Ajusta el sistema a lo que contaste']];
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
const FILTROS_TIPO = [['todo', 'Todo', null], ['ventas', 'Ventas', 'venta,devolucion'], ['entradas', 'Entradas', 'entrada,inicial'], ['salidas', 'Salidas', 'salida,merma'], ['traspasos', 'Env\xEDos', 'envio,recibo,envio_cancelado,regreso'], ['ajustes', 'Ajustes', 'ajuste']];
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
    } else if (r.status === 401 && r.json.error.code === 'sin_sesion') salir(r.json.error.mensaje);
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
    L.push({ id, cant: cant || 1, precio: o.precio ? (o.precioDe ? o.precioDe(p) : p.precio ? String(p.precio) : '') : undefined });
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
    agregar,
    // vuelve a poner el precio sugerido en todas las l\xEDneas (el vendedor puede cambiarlo despu\xE9s)
    repreciar() { L.forEach((l) => { const p = S.idx[l.id]; if (p && o.precioDe) l.precio = o.precioDe(p); }); pintarLineas(); }
  };
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 formularios de movimiento \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const FORMAS = {
  entrada: { titulo: 'Registrar entrada', op: 'mov.entrada', loc: 'local', modo: 'sumar', motivos: ['produccion', 'compra', 'otro'], ok: 'Guardar entrada', cand: () => true, ayuda: 'Suma al almac\xE9n lo que se fabric\xF3 o se compr\xF3.' },
  salida: { titulo: 'Registrar salida', op: 'mov.salida', loc: 'local', modo: 'restar', motivos: ['uso', 'merma', 'otro'], ok: 'Guardar salida', cand: (p) => p.stock_local > 0, ayuda: 'Resta del almac\xE9n lo que se us\xF3 o se perdi\xF3. Para mandar a la tienda usa \u201CEnviar a tienda\u201D.', sinCand: 'No hay productos con existencias en el almac\xE9n.' },
  venta: { titulo: 'Registrar venta', op: 'mov.venta', loc: 'tienda', modo: 'restar', precio: true, venta: true, ok: 'Registrar venta', cand: (p) => p.stock_tienda > 0, sinCand: 'No hay productos con existencias en la tienda.' },
  devolucion: { titulo: 'Devoluci\xF3n de cliente', op: 'mov.devolucion', loc: 'tienda', modo: 'sumar', precio: true, ok: 'Guardar devoluci\xF3n', cand: () => true, ayuda: 'La base regresa a la tienda y el monto se resta de las ventas.' },
  merma: { titulo: 'Merma en tienda', op: 'mov.merma', loc: 'tienda', modo: 'restar', ok: 'Guardar merma', cand: (p) => p.stock_tienda > 0, notaEt: '\xBFQu\xE9 pas\xF3?', ayuda: 'Para da\xF1os o p\xE9rdidas en la tienda.', sinCand: 'No hay productos con existencias en la tienda.' },
  regreso: { titulo: 'Regresar al almac\xE9n', op: 'mov.regreso', loc: 'tienda', modo: 'restar', ok: 'Mover al almac\xE9n', cand: (p) => p.stock_tienda > 0, ayuda: 'Las piezas salen de la tienda y entran al almac\xE9n al momento.', sinCand: 'No hay productos con existencias en la tienda.' },
  envio: { titulo: 'Enviar a la tienda', op: 'traspaso.enviar', loc: 'local', modo: 'restar', ok: 'Enviar a la tienda', cand: (p) => p.stock_local > 0, ayuda: 'Las piezas salen del almac\xE9n ahora y entran a la tienda cuando alguien confirme que llegaron.', sinCand: 'No hay productos con existencias en el almac\xE9n.' },
  pedido: { titulo: 'Pedir al almac\xE9n', op: 'pedido.crear', loc: 'tienda', modo: 'sumar', ok: 'Enviar pedido', cand: () => true, ayuda: 'El almac\xE9n ver\xE1 tu pedido y preparar\xE1 el env\xEDo.' }
};
const ENTREGAS = [['', 'En tienda'], ['recoge', 'Recoge'], ['tepic', 'Env\xEDo Tepic'], ['xalisco', 'Xalisco'], ['cantera', 'La Cantera']];
const ENTREGA_T = { recoge: 'Recoge en tienda', tepic: 'Env\xEDo Tepic', xalisco: 'Env\xEDo Xalisco', cantera: 'Env\xEDo La Cantera' };
const waLink = (tel, texto) => 'https://wa.me/' + (tel || '') + '?text=' + encodeURIComponent(texto);
const lineasTexto = (ls) => ls.map((l) => '\u2022 ' + l.cant + ' \xD7 ' + nombreProd(l.id)).join('\\n');

function abrirForma(tipo, o) {
  o = o || {};
  if (tipo === 'conteo') return abrirConteo();
  const f = FORMAS[tipo];
  if (!f) return;
  const cid = nuevoCid();
  let motivo = f.motivos ? f.motivos[0] : '', pago = 'efectivo', entrega = '';
  const neg = S.est.negocio;
  const tarifaDe = (e) => (e === 'tepic' ? neg.envioTepic : e === 'xalisco' || e === 'cantera' ? neg.envioFuera : 0);
  const envioMonto = () => (tarifaDe(entrega) ? decimal(($('#f-envio') || {}).value) : 0);
  // precio sugerido por base: el de lista, menos el descuento si el cliente pasa por ella
  const precioDe = (p) => (!p.precio ? '' : String(entrega === 'recoge' ? Math.max(0, p.precio - neg.descRecoge) : p.precio));
  const refrescarTotal = () => {
    const t = $('#f-total'), sub = $('#f-total-sub');
    const e = envioMonto(), base = ed ? ed.total() : 0;
    if (t) t.textContent = dinero(base + e);
    if (sub) sub.textContent = e ? 'Bases ' + dinero(base) + ' + env\xEDo ' + dinero(e) : '';
  };
  let ed = null;
  ed = editorLineas({
    modo: f.modo, loc: f.loc || S.rol, precio: f.precio, cand: f.cand, inicial: o.inicial, sinCand: f.sinCand, precioDe: f.venta ? precioDe : null,
    alCambiar: refrescarTotal
  });
  const d = dialogo({
    titulo: f.titulo,
    clase: 'ancho',
    cuerpo: html\`
      \${f.ayuda ? html\`<p class="t-peq" style="margin-bottom:14px">\${f.ayuda}</p>\` : ''}
      \${tipo === 'pedido' && bajosDe('tienda').length ? html\`<div class="aviso warn" style="margin-bottom:14px;align-items:center">\${ico('alerta')}<span class="grow">\${plural(bajosDe('tienda').length, 'producto est\xE1 bajo', 'productos est\xE1n bajos')} en la tienda.</span><button type="button" class="btn btn-s btn-g" id="f-bajos">Agregarlos</button></div>\` : ''}
      \${f.motivos ? html\`<div class="campo"><span class="lbl">Motivo</span><div class="opciones" id="f-motivos">\${f.motivos.map((m) => html\`<button type="button" class="opcion" data-motivo="\${m}" aria-pressed="\${String(m === motivo)}">\${MOTIVOS[m]}</button>\`)}</div></div>\` : ''}
      <div id="f-ed"></div>
      \${f.precio ? html\`<div class="total-b"><span>Total</span><b id="f-total">\${dinero(0)}</b></div><p class="t-peq" id="f-total-sub" style="margin:-6px 0 14px"></p>\` : ''}
      \${f.venta ? html\`<div class="campo"><span class="lbl">Entrega</span><div class="opciones" id="f-entrega">\${ENTREGAS.map(([k, t]) => html\`<button type="button" class="opcion" data-entrega="\${k}" aria-pressed="\${String(k === entrega)}" style="padding:0 12px">\${t}</button>\`)}</div><p class="t-peq" id="f-entrega-ayuda" style="margin-top:8px"></p></div>
        <label class="campo" id="f-envio-campo" hidden><span class="lbl">Cobro de env\xEDo</span><span class="precio" style="max-width:160px"><span class="muted">$</span><input id="f-envio" type="text" inputmode="decimal" value="" aria-label="Cobro de env\xEDo"></span></label>
        <label class="campo"><span class="lbl">Cliente (opcional)</span><input class="inp" id="f-cliente" maxlength="60" placeholder="Nombre o referencia" autocomplete="off"></label>
        <div class="campo"><span class="lbl">Forma de pago</span><div class="opciones g4" id="f-pagos">\${Object.keys(PAGOS).map((k) => html\`<button type="button" class="opcion" data-pago="\${k}" aria-pressed="\${String(k === pago)}" style="padding:0 6px">\${PAGOS[k]}</button>\`)}</div></div>\` : ''}
      <label class="campo"><span class="lbl">\${f.notaEt || 'Nota (opcional)'}</span><textarea class="inp" id="f-nota" rows="2" maxlength="200" placeholder="\${tipo === 'envio' ? 'Ej. sale en la camioneta de las 4' : 'Escribe algo que ayude a recordar'}"></textarea></label>
      <p class="err" id="f-err" hidden></p>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="f-ok">\${f.ok}</button>\`
  });
  $('#f-ed', d.el).appendChild(ed.el);
  const bj = $('#f-bajos', d.el);
  if (bj) bj.addEventListener('click', () => { bajosDe('tienda').forEach((p) => ed.agregar(p.id, Math.max(1, p.min_tienda * 2 - p.stock_tienda))); bj.disabled = true; });
  if (f.precio) refrescarTotal();
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
  grupo('#f-entrega', 'data-entrega', (v) => {
    entrega = v;
    const t = tarifaDe(v), campo = $('#f-envio-campo', d.el);
    if (campo) { campo.hidden = !t; if (t) $('#f-envio', d.el).value = String(t); }
    const ay = $('#f-entrega-ayuda', d.el);
    if (ay) ay.textContent = v === 'recoge' ? 'Descuento de ' + dinero(neg.descRecoge) + ' por base ya aplicado en el precio. Puedes cambiar el precio de cada una.' : t ? 'Se suma el env\xEDo a la cuenta. Puedes cambiar el monto.' : '';
    ed.repreciar();
    refrescarTotal();
  });
  const envInp = $('#f-envio', d.el);
  if (envInp) envInp.addEventListener('input', refrescarTotal);
  const btn = $('#f-ok', d.el), err = $('#f-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    const msg = ed.validar();
    if (msg) throw new ErrorApi({ mensaje: msg });
    const cuerpo = { op: f.op, cid, lineas: ed.lineas(), nota: $('#f-nota', d.el).value.trim() };
    if (f.motivos) cuerpo.motivo = motivo;
    if (f.venta) {
      cuerpo.cliente = $('#f-cliente', d.el).value.trim(); cuerpo.pago = pago;
      if (entrega) cuerpo.entrega = entrega;
      if (tarifaDe(entrega)) cuerpo.envio = envioMonto();
    }
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
  else if (tipo === 'regreso') toast('Movido al almac\xE9n \xB7 ' + plural(res.piezas, 'pieza', 'piezas'), { accion: deshacer });
  else if (tipo === 'envio') {
    const texto = 'Bases Box Tepic \xB7 Env\xEDo a la tienda\\n' + lineasTexto(cuerpo.lineas) + '\\nTotal: ' + plural(res.piezas, 'pieza', 'piezas') + '.\\nConf\xEDrmalo en el inventario cuando llegue.';
    toast('Env\xEDo creado \xB7 ' + plural(res.piezas, 'pieza', 'piezas') + ' en camino', { accion: { texto: 'Avisar por WhatsApp', href: waLink(e.telTienda, texto) } });
  } else if (tipo === 'pedido') {
    const texto = 'Bases Box Tepic \xB7 Pedido de la tienda\\n' + lineasTexto(cuerpo.lineas) + (cuerpo.nota ? '\\nNota: ' + cuerpo.nota : '') + '\\nRev\xEDsalo en el inventario.';
    toast('Pedido enviado al almac\xE9n', { accion: { texto: 'Avisar por WhatsApp', href: waLink(e.telLocal, texto) } });
  }
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 reporte de ventas: hoy, semana y mes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const fmtMes = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });
const fechaDeKey = (k) => new Date(k + 'T12:00:00');
const PERIODOS = [['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes']];
function etiquetaPeriodo(per, v) {
  if (per === 'hoy') return mayus(fmtDiaLargo.format(fechaDeKey(v.desde)));
  if (per === 'semana') return 'Semana del lunes ' + fmtDiaCorto.format(fechaDeKey(v.desde)).replace(/^[^ ]+ /, '') + ' a hoy';
  return mayus(fmtMes.format(fechaDeKey(v.desde)));
}
async function abrirVentas(inicial) {
  let per = inicial || 'hoy', datos = null;
  const d = dialogo({
    titulo: 'Ventas',
    clase: 'ancho',
    cuerpo: html\`<div class="vt-seg" id="vt-seg" role="group" aria-label="Periodo"></div><div id="vt-cont"><p class="t-peq">Cargando\u2026</p></div>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="vt-csv" disabled>Descargar CSV</button>\`,
    enfocar: false
  });
  const pintar = () => {
    poner($('#vt-seg', d.el), html\`\${PERIODOS.map(([k, t]) => html\`<button type="button" class="chip" data-per="\${k}" aria-pressed="\${String(per === k)}">\${t}</button>\`)}\`);
    const v = datos && datos[per];
    if (!v) return;
    const vacio = !v.dias.length;
    poner($('#vt-cont', d.el), html\`
      <p class="t-peq" style="margin-bottom:10px">\${etiquetaPeriodo(per, v)}</p>
      <div class="total-b"><span>Vendido</span><b>\${dinero(v.total)}</b></div>
      <p class="t-peq" style="margin:-6px 0 14px">\${plural(v.n, 'venta', 'ventas')} \xB7 \${plural(v.pzas, 'pieza', 'piezas')}</p>
      \${vacio ? html\`<div class="vacio" style="padding:18px 8px"><b>Sin ventas en este periodo</b><span>Cuando la tienda registre ventas aparecer\xE1n aqu\xED.</span></div>\` : html\`
        <h3 class="t-sec">Por producto</h3>
        <div class="vt-lista">\${v.productos.map((t) => html\`<div class="vt-fila"><span class="n">\${nombreProd(t.id)}</span><span class="v">\${dinero(t.total)}</span><small>\${plural(t.pzas, 'pieza', 'piezas')}</small></div>\`)}</div>
        \${per === 'hoy' ? '' : html\`<h3 class="t-sec">Por d\xEDa</h3>
        <div class="vt-lista">\${v.dias.map((x) => html\`<div class="vt-fila"><span class="n">\${mayus(fmtDiaCorto.format(fechaDeKey(x.k)).replace('.', ''))}</span><span class="v">\${dinero(x.total)}</span><small>\${plural(x.n, 'venta', 'ventas')} \xB7 \${plural(x.pzas, 'pieza', 'piezas')}</small></div>\`)}</div>\`}\`}\`);
    $('#vt-csv', d.el).disabled = vacio;
  };
  $('#vt-seg', d.el).addEventListener('click', (ev) => { const b = ev.target.closest('[data-per]'); if (b) { per = b.dataset.per; pintar(); } });
  $('#vt-csv', d.el).addEventListener('click', () => {
    const v = datos[per], nombre = PERIODOS.find((x) => x[0] === per)[1];
    const filas = [['Periodo', 'Tipo', 'Detalle', 'Ventas', 'Piezas', 'Total'], [nombre, 'Total', etiquetaPeriodo(per, v), v.n, v.pzas, v.total]];
    v.dias.slice().reverse().forEach((x) => filas.push([nombre, 'D\xEDa', x.k, x.n, x.pzas, x.total]));
    v.productos.forEach((t) => filas.push([nombre, 'Producto', nombreProd(t.id), '', t.pzas, t.total]));
    descargar('ventas-' + per + '-bases-box-' + fechaArchivo() + '.csv', aCsv(filas), 'text/csv;charset=utf-8');
  });
  pintar();
  try {
    const r = await llamar('GET', '/ventas');
    if (!r.json.ok) throw new ErrorApi(r.json.error);
    datos = r.json.ventas;
    pintar();
  } catch (e) {
    poner($('#vt-cont', d.el), html\`<p class="err">\${e.message || 'No se pudo cargar el reporte.'}</p>\`);
  }
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 reporte del d\xEDa (el vendedor lo entrega al cierre) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
const hoyLocal = () => fechaArchivo();
function textoReporteDia(r) {
  const t = r.totales, neg = S.est.negocio;
  const [y, m, dd] = r.dia.split('-').map(Number);
  const fecha = mayus(new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, dd)));
  const L = [neg.nombre + ' \xB7 Reporte del d\xEDa', fecha + ' \xB7 ' + ROLES[S.rol].nombre, ''];
  L.push('Ventas: ' + t.ventas + ' \xB7 ' + plural(t.pzas, 'pieza', 'piezas'));
  L.push('Vendido: ' + dinero(t.vendido) + (t.envios ? ' (incluye env\xEDos ' + dinero(t.envios) + ')' : ''));
  if (t.devuelto) L.push('Devoluciones: -' + dinero(t.devuelto));
  L.push('TOTAL DEL D\xCDA: ' + dinero(t.neto), '');
  const pagos = Object.keys(t.porPago);
  if (pagos.length) { L.push('Por forma de pago:'); pagos.forEach((k) => L.push('\u2022 ' + (PAGOS[k] || k) + ': ' + dinero(t.porPago[k]))); L.push(''); }
  if (r.ventas.length) {
    L.push('Detalle:');
    r.ventas.forEach((v, i) => {
      L.push((i + 1) + ') ' + fmtHora.format(v.ts) + ' \xB7 ' + (v.cliente || 'Mostrador') + ' \xB7 ' + (PAGOS[v.pago] || 'Efectivo') + (ENTREGA_T[v.entrega] ? ' \xB7 ' + ENTREGA_T[v.entrega] : ''));
      v.lineas.forEach((l) => L.push('   ' + l.pzas + ' \xD7 ' + nombreProd(l.id) + ' \u2014 ' + dinero(l.pzas * l.precio)));
      if (v.envio) L.push('   Env\xEDo \u2014 ' + dinero(v.envio));
      L.push('   Total: ' + dinero(v.total));
    });
    L.push('');
  }
  if (r.devoluciones.length) {
    L.push('Devoluciones:');
    r.devoluciones.forEach((v) => L.push('\u2022 ' + fmtHora.format(v.ts) + ' \xB7 ' + v.lineas.map((l) => l.pzas + ' \xD7 ' + nombreProd(l.id)).join(', ') + ' \u2014 -' + dinero(v.total)));
    L.push('');
  }
  L.push('Existencias en tienda: ' + plural(r.tienda.pzas, 'pieza', 'piezas'));
  return L.join('\\n');
}
function csvReporteDia(r) {
  const filas = [['D\xEDa', 'Hora', 'Tipo', 'Cliente', 'Pago', 'Entrega', 'Producto', 'Piezas', 'Precio', 'Importe', 'Env\xEDo', 'Total de la venta']];
  r.ventas.forEach((v) => v.lineas.forEach((l, i) => filas.push([r.dia, fmtHora.format(v.ts), 'Venta', v.cliente, PAGOS[v.pago] || '', ENTREGA_T[v.entrega] || '', nombreProd(l.id), l.pzas, l.precio, l.pzas * l.precio, i === 0 ? v.envio : '', i === 0 ? v.total : ''])));
  r.devoluciones.forEach((v) => v.lineas.forEach((l, i) => filas.push([r.dia, fmtHora.format(v.ts), 'Devoluci\xF3n', '', '', '', nombreProd(l.id), -l.pzas, l.precio, -l.pzas * l.precio, '', i === 0 ? -v.total : ''])));
  filas.push([r.dia, '', 'TOTAL DEL D\xCDA', '', '', '', '', r.totales.pzas, '', '', r.totales.envios, r.totales.neto]);
  return aCsv(filas);
}
async function abrirReporteDia() {
  let datos = null, dia = hoyLocal();
  const d = dialogo({
    titulo: 'Reporte del d\xEDa',
    clase: 'ancho',
    cuerpo: html\`<label class="campo" style="max-width:220px"><span class="lbl">D\xEDa</span><input class="inp" type="date" id="rd-dia" value="\${dia}" max="\${dia}"></label><div id="rd-cont"><p class="t-peq">Cargando\u2026</p></div>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="rd-wa" disabled>\${ico('mensaje')}Enviar por WhatsApp</button>\`,
    enfocar: false
  });
  const min = new Date(); min.setDate(min.getDate() - 30);
  $('#rd-dia', d.el).min = min.getFullYear() + '-' + String(min.getMonth() + 1).padStart(2, '0') + '-' + String(min.getDate()).padStart(2, '0');
  const pintar = () => {
    if (!datos) return;
    const t = datos.totales;
    poner($('#rd-cont', d.el), html\`
      <div class="total-b"><span>Total del d\xEDa</span><b>\${dinero(t.neto)}</b></div>
      <p class="t-peq" style="margin:-6px 0 14px">\${plural(t.ventas, 'venta', 'ventas')} \xB7 \${plural(t.pzas, 'pieza', 'piezas')}\${t.envios ? ' \xB7 env\xEDos ' + dinero(t.envios) : ''}\${t.devuelto ? ' \xB7 devoluciones -' + dinero(t.devuelto) : ''}</p>
      \${Object.keys(t.porPago).length ? html\`<h3 class="t-sec">Por forma de pago</h3><div class="vt-lista">\${Object.keys(t.porPago).map((k) => html\`<div class="vt-fila"><span class="n">\${PAGOS[k] || k}</span><span class="v">\${dinero(t.porPago[k])}</span></div>\`)}</div>\` : ''}
      \${datos.ventas.length ? html\`<h3 class="t-sec">Ventas</h3><div class="vt-lista">\${datos.ventas.map((v) => html\`<div class="vt-fila"><span class="n">\${fmtHora.format(v.ts)} \xB7 \${v.cliente || 'Mostrador'}</span><span class="v">\${dinero(v.total)}</span><small>\${v.lineas.map((l) => l.pzas + ' \xD7 ' + nombreProd(l.id)).join(', ')}<br>\${PAGOS[v.pago] || 'Efectivo'}\${ENTREGA_T[v.entrega] ? ' \xB7 ' + ENTREGA_T[v.entrega] : ''}\${v.envio ? ' (env\xEDo ' + dinero(v.envio) + ')' : ''}</small></div>\`)}</div>\` : html\`<div class="vacio" style="padding:18px 8px"><b>Sin ventas este d\xEDa</b><span>Cuando registres ventas aparecer\xE1n aqu\xED.</span></div>\`}
      \${datos.devoluciones.length ? html\`<h3 class="t-sec">Devoluciones</h3><div class="vt-lista">\${datos.devoluciones.map((v) => html\`<div class="vt-fila"><span class="n">\${fmtHora.format(v.ts)}</span><span class="v">-\${dinero(v.total)}</span><small>\${v.lineas.map((l) => l.pzas + ' \xD7 ' + nombreProd(l.id)).join(', ')}</small></div>\`)}</div>\` : ''}
      <p class="t-peq">Existencias en tienda: \${plural(datos.tienda.pzas, 'pieza', 'piezas')}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button type="button" class="btn btn-s btn-g" id="rd-copiar">Copiar texto</button><button type="button" class="btn btn-s btn-g" id="rd-csv">Descargar CSV</button></div>\`);
    $('#rd-wa', d.el).disabled = false;
    $('#rd-copiar', d.el).addEventListener('click', async () => { try { await navigator.clipboard.writeText(textoReporteDia(datos)); toast('Reporte copiado.'); } catch (e) { toast('No se pudo copiar.', { tipo: 'error' }); } });
    $('#rd-csv', d.el).addEventListener('click', () => descargar('reporte-dia-bases-box-' + datos.dia + '.csv', csvReporteDia(datos), 'text/csv;charset=utf-8'));
  };
  const cargar = async () => {
    $('#rd-wa', d.el).disabled = true;
    try {
      const r = await llamar('GET', '/reporte-dia', null, { dia });
      if (!r.json.ok) throw new ErrorApi(r.json.error);
      datos = r.json;
      pintar();
    } catch (e) { poner($('#rd-cont', d.el), html\`<p class="err">\${e.message || 'No se pudo cargar el reporte.'}</p>\`); }
  };
  $('#rd-dia', d.el).addEventListener('change', (ev) => { if (ev.target.value) { dia = ev.target.value; cargar(); } });
  $('#rd-wa', d.el).addEventListener('click', () => {
    const tel = S.rol === 'tienda' ? S.est.negocio.telLocal : S.est.negocio.telTienda;
    window.open(waLink(tel, textoReporteDia(datos)), '_blank', 'noopener');
  });
  cargar();
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
        \${g.tipo === 'venta' && ENTREGA_T[g.motivo] ? html\`<dt>Entrega</dt><dd>\${ENTREGA_T[g.motivo]}\${g.envio ? ' \xB7 env\xEDo ' + dinero(g.envio) : ''}</dd>\` : ''}
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
      <h3 class="t-sec" style="margin:18px 0 8px">Env\xEDos y descuento (por venta)</h3>
      <label class="campo"><span class="lbl">Env\xEDo dentro de Tepic</span><input class="inp" id="n-et" inputmode="decimal" value="\${n.envioTepic}"></label>
      <label class="campo"><span class="lbl">Env\xEDo a Xalisco y La Cantera</span><input class="inp" id="n-ef" inputmode="decimal" value="\${n.envioFuera}"></label>
      <label class="campo"><span class="lbl">Descuento por base si recogen en tienda</span><input class="inp" id="n-dr" inputmode="decimal" value="\${n.descRecoge}"><span class="ayuda">El vendedor siempre puede cambiar el precio de cada base al vender.</span></label>
      <p class="err" id="n-err" hidden></p>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="n-ok">Guardar</button>\`
  });
  const btn = $('#n-ok', d.el), err = $('#n-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    await op({ op: 'config.guardar', negocio: { nombre: $('#n-nombre', d.el).value, telLocal: $('#n-tl', d.el).value, telTienda: $('#n-tt', d.el).value, envioTepic: decimal($('#n-et', d.el).value), envioFuera: decimal($('#n-ef', d.el).value), descRecoge: decimal($('#n-dr', d.el).value) } });
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
      <label class="campo"><span class="lbl">PIN nuevo (6 a 8 n\xFAmeros)</span><input class="inp pin" id="pn-nvo" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
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
const csvCelda = (v) => { let s = v == null ? '' : String(v); if (typeof v === 'string' && /^[=+\\-@\\t\\r]/.test(s)) s = "'" + s; // evita que Excel ejecute f\xF3rmulas escritas por otro usuario
   return /[",\\r\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
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
    const cab = ['Fecha', 'Operaci\xF3n', 'Producto', 'Lugar', 'Cantidad', 'Precio', 'Responsable', 'Motivo', 'Nota', 'Cliente', 'Pago', 'Entrega', 'Env\xEDo', 'Anulada', 'Folio'];
    const filas = movs.map((m) => [fechaISO(m.ts), (TIPOS[m.tipo] ? TIPOS[m.tipo].t : m.tipo === 'anulacion' ? 'Anulaci\xF3n' : m.tipo), nombreProd(m.prod), m.loc === 'local' ? 'Almac\xE9n' : 'Tienda', m.delta, m.precio == null ? '' : m.precio, ROLES[m.rol].corto, MOTIVOS[m.motivo] || '', m.nota, m.cliente, PAGOS[m.pago] || '', ENTREGA_T[m.motivo] || '', m.envio || '', m.anulado ? 'S\xED' : '', m.grupo]);
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
        \${local && S.modo !== 'local' ? fila('basura', 'Dejar todo en cero', 'Borra movimientos y existencias para empezar limpio', 'reiniciar') : ''}
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
  vender: (b) => { const p = S.idx[b.dataset.id]; if (p) abrirForma('venta', { inicial: [{ id: p.id, cant: 1, precio: p.precio ? String(p.precio) : '' }] }); },
  ventas: () => abrirVentas(),
  'prod-nuevo': () => formProducto(),
  variantes: () => formVariantes(),
  'filtro-cat': (b) => { S.filtro.cat = b.dataset.cat; VISTAS.inventario.actualizar(); },
  'filtro-bajo': () => { S.filtro.bajo = !S.filtro.bajo; VISTAS.inventario.actualizar(); },
  'filtro-arch': () => { S.filtro.archivados = !S.filtro.archivados; VISTAS.inventario.actualizar(); },
  forma: (b) => (b.dataset.tipo === 'recibir' ? recibirYa() : b.dataset.tipo === 'reporte' ? abrirReporteDia() : abrirForma(b.dataset.tipo)),
  'reporte-dia': () => abrirReporteDia(),
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
  reiniciar: () => formReiniciar(),
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
function formReiniciar() {
  const d = dialogo({
    titulo: 'Dejar todo en cero',
    cuerpo: html\`<div class="aviso warn" style="margin-bottom:14px">\${ico('alerta')}<span class="grow">Esto <b>borra todos los movimientos, env\xEDos, pedidos y existencias</b>. Se conservan los productos, los precios, los PIN y los datos del negocio. No se puede deshacer.</span></div>
      <button type="button" class="btn btn-g btn-b" id="rz-resp" style="margin-bottom:14px">Descargar respaldo antes</button>
      <label class="campo"><span class="lbl">Tu PIN (almac\xE9n)</span><input class="inp pin" id="rz-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <label class="campo"><span class="lbl">Escribe BORRAR TODO para confirmar</span><input class="inp" id="rz-frase" autocomplete="off" autocapitalize="characters" maxlength="20"></label>
      <p class="err" id="rz-err" hidden></p>\`,
    pie: html\`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-r" id="rz-ok">Dejar en cero</button>\`
  });
  $('#rz-resp', d.el).addEventListener('click', (ev) => respaldoCompleto(ev.currentTarget));
  const btn = $('#rz-ok', d.el), err = $('#rz-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    await op({ op: 'sistema.reiniciar', pinActual: $('#rz-pin', d.el).value, confirmacion: $('#rz-frase', d.el).value });
    S.hist.rev = null;
    d.cerrar();
    toast('Listo: todo qued\xF3 en cero.');
  }));
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
  if (!/^\\d{6,8}$/.test(p)) return 'El PIN debe tener de 6 a 8 n\xFAmeros.';
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
      <label class="campo"><span class="lbl">PIN nuevo (6 a 8 n\xFAmeros)</span><input class="inp pin" id="ol-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
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
      return html\`\${puntos()}<h2 class="t-sec" style="text-align:center">Un PIN para cada usuario</h2><p class="t-peq" style="text-align:center">De 6 a 8 n\xFAmeros. Cada quien entra con el suyo y puede cambiarlo despu\xE9s.</p>
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
` }, "/apple-touch-icon.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "etag": '"1acc6c85a28da7d51980"' }, "b64": "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" }, "/core.js": { "cabeceras": { "content-type": "text/javascript; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"bf31abcf242bae20b456"' }, "texto": `/* N\xFAcleo del inventario de Bases Box Tepic.
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
  const SESION_DIAS = 14;
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
  const PINS_COMUNES = ['123456', '654321', '121212', '112233', '123123', '159753', '147258', '102030', '123321', '010203', '696969', '202020', '2580', '12345678', '87654321', '11223344', '12341234', '123654', '1234567'];
  function validarPin(pin) {
    if (!/^\\d{6,8}$/.test(pin)) throw bad('pin_formato', 'El PIN debe tener de 6 a 8 n\xFAmeros.');
    const debil = /^(\\d)\\1+$/.test(pin) || /^(\\d{1,4})\\1+$/.test(pin) || '01234567890123456789'.includes(pin) || '98765432109876543210'.includes(pin) || PINS_COMUNES.includes(pin);
    if (debil) throw bad('pin_debil', 'Ese PIN es muy f\xE1cil de adivinar. Elige otro.');
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 configuraci\xF3n y sesi\xF3n

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

  // Bloqueo por intentos fallidos: se CUENTA el intento antes de comprobar el PIN y de forma at\xF3mica en el repo
  // (as\xED ni una r\xE1faga de peticiones en paralelo se salta el l\xEDmite). 5 intentos = bloqueo de 5 min; cada bloqueo
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
    movsAnulados: [], traspasos: [], pedidos: [], sinRev: false, reiniciar: false
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
      const it = await reservar(ctx, 'setup');
      if (!normCodigo(b.clave) || !igual(normCodigo(b.clave), normCodigo(ctx.claveInstalacion))) fallar(it, 'clave_instalacion', 'La clave de instalaci\xF3n no es correcta.');
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
    const it = await reservar(ctx, rol);
    const acc = cfg.acceso[rol];
    if (!acc || !igual(hashPin(acc.salt, String(b.pin || '')), acc.hash)) fallar(it, 'pin_incorrecto', 'PIN incorrecto.');
    await limpiarIntentos(ctx, rol);
    return ok({ token: firmar(cfg, rol, ctx.ahora), rol });
  }

  async function recuperar(ctx) {
    const cfg = await cargarCfg(ctx);
    if (!cfg.configurado) throw new ApiError(409, 'no_configurado', 'Este inventario todav\xEDa no est\xE1 configurado.');
    const b = ctx.req.body || {};
    const rol = b.rol, pin = String(b.pin || '');
    if (!ROLES.includes(rol)) throw bad('rol_invalido', 'Elige de qui\xE9n es el PIN.');
    validarPin(pin);
    const it = await reservar(ctx, 'recup');
    const rec = cfg.acceso.recup;
    if (!rec || !igual(hashPin(rec.salt, normCodigo(b.codigo)), rec.hash)) fallar(it, 'codigo_incorrecto', 'C\xF3digo de recuperaci\xF3n incorrecto.');
    const otro = cfg.acceso[rol === 'local' ? 'tienda' : 'local'];
    if (otro && igual(hashPin(otro.salt, pin), otro.hash)) throw bad('pin_igual', 'Cada usuario necesita un PIN distinto.');
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

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 estado para el cliente

  // lunes de la semana de una fecha 'YYYY-MM-DD' (semana lunes\u2013domingo)
  function lunesDe(k) {
    const [y, m, d] = k.split('-').map(Number);
    const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    return new Date(Date.UTC(y, m - 1, d - dow)).toISOString().slice(0, 10);
  }

  const redondear2 = (o) => { o.total = Math.round(o.total * 100) / 100; return o; };

  // ventas netas (ventas \u2212 devoluciones) de hoy, de la semana y del mes, con desglose por producto y por d\xEDa
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

  // reporte del d\xEDa de la tienda: cada venta con sus piezas, cobro por forma de pago, env\xEDos y devoluciones
  async function reporteDia(ctx) {
    const q = ctx.req.query || {};
    const hoyK = diaKey(ctx.ahora, ctx.tz);
    let dia = hoyK;
    if (q.dia !== undefined && q.dia !== '') {
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(q.dia)) || String(q.dia) > hoyK || diaKey(ctx.ahora - 34 * DIA, ctx.tz) > String(q.dia)) throw bad('dia_invalido', 'Elige un d\xEDa de los \xFAltimos 30 d\xEDas.');
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
    return { dia, hoy: dia === hoyK, ventas, devoluciones: devs, totales: t, tienda: { pzas: prods.filter((p) => p.activo).reduce((a, p) => a + p.stock_tienda, 0) } };
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

  // sin prototipo: un id como "__proto__" o "constructor" mandado por un cliente no encuentra nada
  const own = (o, k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
  const indexar = (arr) => arr.reduce((o, x) => { o[x.id] = x; return o; }, Object.create(null));
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
    if (!p.activo) throw new ApiError(409, 'producto_archivado', p.nombre + ' est\xE1 archivado.');
    return p;
  }

  // entrega de una venta \u2192 tarifa de env\xEDo en la configuraci\xF3n del negocio (null = sin cargo)
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
    // entrega de una venta: recoge en tienda, o env\xEDo con tarifa por zona (el vendedor puede ajustar el monto)
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

  // Regresa piezas de la tienda al almac\xE9n de inmediato (una sola operaci\xF3n: sale de la tienda y entra al almac\xE9n).
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
    if (await ctx.repo.pedido(id)) throw new ApiError(409, 'duplicado', 'Este pedido ya se hab\xEDa guardado.');
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

  const tarifa = (v, actual) => (v === undefined || v === null || v === '' ? actual : numero(v, 0, 100000, actual));

  async function opConfigGuardar(ctx, b, tx) {
    const cfg = ctx.cfg, patch = {};
    const prods = await ctx.repo.productos();
    if (b.negocio) {
      patch.negocio = {
        nombre: clean(b.negocio.nombre, 60) || cfg.negocio.nombre,
        telLocal: String(b.negocio.telLocal || '').replace(/\\D/g, '').slice(0, 15),
        telTienda: String(b.negocio.telTienda || '').replace(/\\D/g, '').slice(0, 15),
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
    // \u201Cese PIN ya lo usa el otro usuario\u201D revelar\xEDa el PIN ajeno a quien pruebe uno por uno: cada intento cuenta y no se borra con el acierto
    await reservar(ctx, 'cambio:' + rol);
    const otro = cfg.acceso[rol === 'local' ? 'tienda' : 'local'];
    if (otro && igual(hashPin(otro.salt, nuevo), otro.hash)) throw bad('pin_igual', 'Ese PIN no est\xE1 disponible. Elige otro.');
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
    if (igual(hashPin(acc.salt, nuevo), acc.hash)) throw bad('pin_igual', 'Cada usuario necesita un PIN distinto.');
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

  // Deja el inventario en cero (borra movimientos, env\xEDos y pedidos; conserva productos, precios, PIN y ajustes).
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
    'recup.nueva': [['local'], opRecupNueva],
    'sistema.reiniciar': [['local'], opReiniciar]
  };

  // Ejecuta una operaci\xF3n ya autenticada y la guarda de forma at\xF3mica.
  async function correrOp(ctx, body) {
    const def = body && typeof body.op === 'string' && Object.prototype.hasOwnProperty.call(OPS, body.op) ? OPS[body.op] : null;
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
      if (path === '/reporte-dia' && m === 'GET') return ok(await reporteDia(ctx));
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
      return fail(500, 'interno', 'Algo fall\xF3 en el servidor. Intenta de nuevo.');
    }
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 repo local (localStorage o memoria): mismo contrato que el repo D1

  function crearRepoLocal(almacen, clave) {
    const vacio = () => ({ v: 1, config: {}, productos: {}, movs: [], traspasos: {}, pedidos: {}, intentos: {} });
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
      // cuenta un intento de PIN de forma at\xF3mica (ver reservar en el n\xFAcleo)
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
        });
        if (tx.configInsert) Object.keys(tx.configInsert).forEach((k) => { if (k in S.config) throw new ApiError(409, 'ya_configurado', 'Este inventario ya est\xE1 configurado.'); });
        tx.movs.forEach((m) => { if (ids.has(m.id)) throw new ApiError(409, 'duplicado', 'Esta operaci\xF3n ya se hab\xEDa guardado.'); });
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
            S.movs = []; ids = new Set(); S.traspasos = {}; S.pedidos = {};
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
` }, "/fonts/anton-400.woff2": { "cabeceras": { "content-type": "font/woff2", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "public, max-age=31536000, immutable", "etag": '"23aab0b2692a0c89eb79"' }, "b64": "d09GMgABAAAAAC7kAA4AAAAAZFwAAC6LAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGoJQG5YyHIhABmAAhUQRCAqBggTlCQuEOAABNgIkA4hsBCAFhAwHik8bt1Kjoqz2BgcjEfZ6cgqQ/dWBbYhpg/6hMVQ1GTFxMEkKQTmq38jiCgspf1J59N0rWUM/VhLnYBw7CDV1eR7eTr5z30tm8iFvua5oVrudqA4u5dJI5oDX8+9lSVCxiogRQhDEWEGkkqBB7ISws41VY5Uu7dZFtWV3oNVBtVW69telpUu11a1b+3XoQpQtWvX07uXfkiAFwqAQElCAtSiJFQTWbNvev8Gx0xCKpAZp2h7xJ52+d+/OlvRACtAHgLFddoETudYHAMm3yMkm/7nAvCEqSTv2au79vaR4KbgqksSqiumgjOObpzq+whF9ItjsBT7g/2/T3nbevJVB+uBZ9A/vsgN8ens/lhPADsqc9KN7Z/TmzZuR5Blrd6TRmhdk2F1pUeuAxyHZIbKD0CEJPgLXAa6g4iopyqTuf5c+Kcr+dznx297vzZlc7CvbroiVIhKmMsggEqyERS6yf7U19UBEU+qb2oct19g8FpW6GUWOp4RpybY90ZOohczuwf/jI1C0AKQAii0MfQgD1hA2HCGcuEC48YfgCoAWaD5EiBCICJEQ8RIgVFQQmbKg5VsArVApRLVqiOVWQVlnHZRNNkHUqYfWpAmiWQu0Np0Qe3RDHHAAokcftGOOQZxwAuKUsxDnnYe45jrEmDGIV15BvPUW4ocfkAASQEcN0QAkWogWICEiREBHO/qQGMQAAoEGNgNWApMhCLh4stTZolmLniCAmIMrQKZ8C9Sp16xHr0P6AhBo+RaECAgwlq0EqM22EAhB67iDi3JBCwbQzapAoKCPPbwgFxz+Uf1g9pllThT0gQpHDR7oC+7gMLBAgDFjDAZbWlbPIJkx9k4FfTjaEOpQkIESHzLwoQnPk7NWdFbMGNGFgPZUCM/bBoiQuzakm235nHRnPIooL+2bC+/i64NUkJD2plFkayM4LgI2JlcOaCiMrdB/kMsCGHwS5e9F473BGWQNUbQ9unWwWBD6Cb1khtWSoL0aMWutGI5ypTgIGJ7vW0fzBarfBAstF5D+H5p0RR5kBIGx3AorrYNhxYoBdageDQ5SWc0EdM+YfgGvSDSWapLFSYxWe2nM1e9YVtIkTb9d3Zvu7Fa3ZnvH2tRkZZZ0rXjGouQmPdKOSYlNZEKeNyDs1cy4xuEVaaHEuKN+tBA80toFdQzwx3dT3nm5PeUTD9xxvfgyJOuAV850OOte9Mp/J/EAlCwviuW1IHIU5D/RSoj5J5M8X4jOyLhoPseKLUWJT5B3i1SLZYo+pM/oK1FP8nisoOlX+oP+EYeirOGZhJj19DidoRfO2Bf6UMxhYICGJgRx5HCrGmuhsDaXDQfkGUctslYCreJqvnADdRce0014TTTBnFnCb1opbHtpkODPKRpMQ2gojaCRNJrGUKEQTSgaKxJnE00SEpOa6D4FAWYNu6cHVUA1pG97YabzqZ62NTOZ5xnPvQxnyBcu5nQGcHR92Z/OtKexdm4D2ZIN0mB1lqF2ZUqSn8zIkxLxNj+6bimLIEHxjw/D3SEY/vhsYxmTXIxBtKOOYDAA//xE+VcfvDZhLADVGnXTVeed1L+V9+qG5Eh/nJThNsO6H72Ch/xfLA9wYkQz0x7fZsLLW04sF1FQ/rRtyu92LPetLT+19D8MFkRtoweKVg3PTLFs55pSjXrn+aIh/kJw8uJvTflHtCKxguYQgbPavDUg/r2mlqEfxFRl+YeXYwXWGx/Ns2jqYxmlT+kL61OFWNGzfiHqX7TcjvZ2xDJLP9OL9Kd8IVpN7kCEsDTNoYXIgCEjZOYoLFiismLPkRNnLty48+DJC5M3H37Y5vEXKMh8IXddiZdwwQoVKVaiVLVNmrTbaZfdOnTac+s1w4/R0lNOOyPO3/IrZ8wrb/2IGoJHCIg6ooFoIdrRiW70oh8Dc0Aeda22Ipu8kvVA7n9P66YBAq4YwPCVTwBSPxa1/vhnM3tBvPjfOK6PuW622+bazjVdVzYvIRVdi5pzu6TDLcQ7If55+sO6ilheyV9jJulheWojN5hF4I+XQJ0GbTp06dFHYozMhCkz1mzYskNnz2Gcfb5Yo9QNG+BUI3JwS0/lYifmBuizPBvadbtZ78GtBc6WhYj1tF0B/jpJiwczlhXa41vxudJei1t+NQWkzOKSOaW+FrZdr7uGQkQ30WkhsuBCpUm3MT+gwBcKOXR7yLc2BwVqtJcABQ8VMXUo7TAg091EgPd89+5lbBvuXke70SjvQYYdlf3M25hQwS9ijEKnme6Zzp9nx9xhBgZcXjkYkQh6xZiZ4Fx0oGh8XhFUgQDF3CpqXBQMpsAVUbSDLNgVp5bhBtGJDiwUggJFsggDK/CgqKwab1RidQSmaCkOwngbGJATDxd/MQMCf4XAgqNSMfuMOXVGTAHTPYdzRI3gCeG4sFzOWcxzl/f5xDdyFjjycF4uy4tW+xnJrCqA3nRjIQV8ngUBvt32JTpUGKzPpMG1GOtPcVo7LoJlyzS27sC5GXYmHHpoTj4o/Rl+zc3LgbT3AokMYj8yVBKI/MiTZUPIRgPK2V/FOQXABLvQBVWjeEogOnadxZhSPXDFOPpzpCwybezifJryIQ/SndykJTrsGDmic9tTiokOecFm60MSBQd1xjVJlFmtxoAL7vhoyq+gEcML6SLhGTZg0d4FhOb7l+h+F1PaLC9UWwntg24rwtI2CGRSpZSgo6Pu1KEvHCBYxoFl/YyUW2O9QRd98sXvYBAjEaFHdOmk3/4Ka21w3CWfffUnWIQEgdh4tUp1w0xI4HXNRZ3/p1aJxDIgBnBEK4u4S4oBHLHQvQLGLeqGzAZjJxw3Eyv61LMYO6LoMoRMzL8ExVh7UzHYyrbiPV2h2TJ7l2nUB6XOIShcHVIvev5EApahcdWx8g0DkCFETIhVZE/QhyZn63AU0BNqM1ss+EJ6I8gXoxgh8PkOe3L4Bqxkyl/arE2XgIq8d2wLR6c1/ggjKFBN9/kBPqILap3UUElUEux+EoaA0nGU/BBJWD4SRHGGARG2dOKY2p1NsKC/Vu8GcGMwi/siZZcD83oXgSOBY9Ir9IS30iI4C5Y+EjKGKWDcemXnYkCuAvQ/ayaAxdBAATufbgQCBVN6+UZWwYKbdoJFZhGXxJST5XIZK+MVQWPQBDS12i0mUMZRplOMKWYUSwqN4kbxoQRQ9ltYWmy2qLPUtZw7O1usULQvii4nVgO6ovHLp1GMKCbP35XifcZKN21AVwQYXj+a828ZiLW2H76e+PyMCPDVW+6Pa90JEcBXB02EPh19OvG08snTJzufiAEBWM9PkKfTDyBPYpg8joSfCnelPyz12Em5buN76ZZhYR6QaHXH/zF0IWj4pcZqUz4qMyDNB/ssstUj4TA0zUGkvbB2JnFrk2JAX1S575fGIlFihUYTarEBBtdTuBVsKZ11yo1FlC2gd2UDMaIJCaAtk+w7ZeaK814Ghf9ss9+01w5K9zA4+IfjsJvuSnTVkO2uuOyvcQQ4ajTgqcPSor+kcTMDZnQuK3Rwh530O154ShZXm81XIgSOB0lQCqdzyfYXO/HAdY1f/yJlZ6KxTl9+emaij+YcuWB1uAF4TKZmVSo9NeGJo95BVrcBkwDIPFf58ke4Dpj8DTD7CaB+AMp6AH0AClT39NRyjYkgGHU7WWCcDFknlH7o8rACM8AxYFyv1mRndhgHKwsDzWw0lFWjIaypjAr9ECg/dWus8ZA2k70xTSyaqlF2hBtGzVCn8MKsp+GsTm8DqxW2jI3CsMYNITsLhsBMSAeZmaoHYWayUhagwprn5e3bCTsZ4A4MOBTcwXaauoIhTeFcKMHUxIx/2I9wxhMOcDvarf8hH3cmx+J5m6ce5unQ2l27fH/fwjunp/d+ZK319u1mJrZs5hn5erbgR90OwZZgE/JHgs1tpWO/S2b37dpFxg7ZbbKbQAO+eZOTP3cNQ7Jed8+v4mnLs7tpqzU39+fg8y4fJvny7Sg4x1NhdJ+HRO12zHZGtlA8S3q9jlZmJqY89vcfo738RBQVtL09ND8ZHj/E0kK7L7u3ZWdt8HCUJ+YxROeO3GRVUXBZDCrXj/tCLqp4CXsFDRGPh4BB1unQbI/TUQfJydgDVaNY9ZrayAeNDcOIRzW2JnW14JXJhlhdiZx1XhfYjJ5wIXTrx6l8CnzAAuIb3+e362b11Iw4FdXTTx5qmfrzLCCVpKh78kG8r/hcAFwlli57aaDL+ZgOyy11pGIPu9NIdbIhqhpw4Gypxfi5rZBSDAfaMVAO03RQrmXf9eQDEtMyMoCNi0Mjl6uubPpvH2l2Et4bhhTgkZF5hhKZUW/VIqNIKs7H5oDhCkzQeZgL641bk+ac+pjX9iUiOTd+msV8bGmEP+BYLXdGH3hxNGZ5BeNkMWhDFCPST9n9EVLpGiulPLBOPXqAuref603+yrq370w0k4BV1yeKsNgPOoIKMtmx5VcH1VuNZWlnNFomyjlefR6WrC3EI2wcHvSlc29kyTg2EZQCfC9JY3SmuTag+NH1Odbm+6wdcOSY2Lag6pg+DcO9H6kbHeRMDKYTcmu/OQIQN2SG6scLwd8XKePGqKY+hLLkRCn2xqY4DgPNZGMmTd1FTr9Gt/bkW4bB1T9X1lr9a87SKLgMjUCcF0BbQ9dQ28/E9a4ovZ/flz+9bq60j6XJKOJyHqenT2XJEvWy5MTJOF2smj8Usjf6m7p/B9bjN0sjVvtwbUYW7+PLkPj3z3r+py6dtGMY88YO1J63+mJUsROYmKBZxCFrOxgku13qkCpxcK+uSbi2l1V6/SOQWYBvW4CnbsN3mqg9Gm5MzA/RPc3fL/NNZhXlpWpRTrpIIkyIQTqKo8p50i0hzrMOatdk62oTMvLP0L91YAVAYKfRRulXnsuRp4jLb2Pk1Z3UGACWOU1qOWUxIJx+5XLR/FJveCo4I3ABdvJLjF7ETTQZxQTXG2IvDnVQp1F5fWiwVNI9jMS4CmGyZVNBfT7xGYiyw2lmTd2IRH+3S+JVqAV1p23BM9EHmojJSoQXsUkaqaDMBFMZ41ilygQUkAl2HtCiJgDPhTM6Umd4iByV3AEeoDK7fedGCU4xdQ7k2b/kGHM6vf0EOWWSQPxM97B5pduyWoSgy0xRMi41R3vghzaE62essWBctqpl3x032TDxtlQJU717+5eJW1t+Umock65IlyKD5NJhumw102/s23M9rZRIOXLDPdkoFQhmy5qK0yz1slURWQF8wULLlBTI6RBQ094atUmsvRhSoriXAFr80/jwUMozv6SsdFRRgCbVJCfVq/JxpIoA/ZPNH0ZRTAQNMp/sf1tgbxJYvQU25I6gku2LFOUAO3W1PPVW//4OLg9+v6smNC7yCRDukSeadSGWFKpz1Ln8dCSxk/JsQ9SX0ZJp8acjMCWNTLa5ssD5zLTSlveE+WbDpe8uqNwpc3IP5pj3Oj8zp/VIbsLtc+Y8nDh5c2jlEfmzsIim30YpMlw5nwPLWvoIfJf+YorPVGk5mNF9QVGjCCSJA+87N9X6FWfttN/TB5fxbJ9uIf2KBzZp3eu3zG04cfK8YR292IoFeNQbEReBF5uGACtnuAf3Q24AzXAWiRPUBAao4ULIopun9kFzYBdY+aHyUPEqABPnbctPIjS6pq+WC3dDocJQaHn8nWE6UKalMQKxq0hviUS+01F4hgW59BSFcVuPc17sjp18YPvIqXjLcyPd9ibihLQZ4GDXAtPUiGXxnfn1cRX+sG60VOS9Pn05fGYqyS8GnZ3TWGiu/37YsTeELuvnUY+vav4YFPQ9sEnaOjWuKi+zNQyDxowCoS+7nKKmOMclJQViW4zfCxTtplPbYa0I0KH7BN91t2loW/CdZWkbkTL//+fDpTGd36285zYs8AcrvirU+/t5LR6MGcmI4wUiA5EbJpeUDofu4ASCq6bt4dBA0y41Pz1sFlppM2lDRyz+ylVcPG5mbAuwOQvPehBDQl18qV8QLIIbSF9guNGuYtP6bbh4FjEvgSIM+ENNHzD4LXBeeeIENCoDNKM7eBT+o8sz6DTfeBxCFUiyHucMqCutFOQ2EZgEdWdSPWgXv/zoQ50P1pIktSeWB14LjjGVEI3Njr11VTPqT3dtl2Tum61Hkc7YTNrNkX+/DdD6Y1RHL6f1RWFd5TKnnRwq4T9RL7xnxJQcsrao/4ZnFReKW88p9dRHepMHiQ6TZcsJ1l3zB9d3yEZNO5/kDFZrcw4geKIoTFrsEOjseGjcbhqwME8/+r7mqi0onYAWodmiou3JyB3OGOHEBbRa3va25Wg2ebDsmznpsriadjD0+ONIOpfEEW+RF1ONy4dZDGRw6Nbh9DD7AA7ow7/l4qTeOuMe6khhV4JOzwSfvRKHXQrREkoZ18yT+wYfAMVF3S1wDQO0e4hZ4tNrouZrLBJVHAqHTmem5rD4oB4JBbE5fRJSX/7jPl2/I/Zfru5AFnO5cJGXeonWJTsj1XCLvHtRevdugBQqjAAb0n96VEG3VYrsoKMcWkB8yIJzD0HPwtzJvJ3e3wNZqBAOuAkpqpH1eXuNhWpHTz6/oTWsOpoB2/zsBvfO9vIHM/XOCZF6yUSYEXl0Lpnh3o4ZWawNDvoGE9c9zGq17bWPeXiteXor/InaCNJ8xBuKu+M+Pnvw+P2wSnFDgmGJaeR42755s10bTXhhMN+FHOpxSBQagnJvXLNsPNQhls35FwVviGcmP95zgCHiq6rziXn965xTMBEldBeLIN8FwftsHa2Cff2kYZNvh0s+Qy9Pn7lzjfnrIPFRsaefJKVG/JxvE/mzPStMiBOECuoWxEG4Vehk6Giq4fa4ybiUl05cipEgRmAGA8Rykx8fe/tObZivc0nc7G0mcPGjRbmI5luJPZloFPw7xfkgst63LnFXnpGU4s7ilHPBrNMM2JYLccFghFh6IbHgyPLBpN2M+XYREsCGygBrW5Nz/VxulhNMOrfrrFQzhqb14niOJloojNghDbBHMh1uz2JECHAhuLuYNuBOa+6eZs2RT0/HjmSqU0NDKzgVYg10fj58iUae/PsS8Hz87d278J8HfFk8MG7xIpsSl4WLVyRE2wRBisPB1qa1Pd/5O1s9ovJ59ryH6V7OO7z8irx8/fj+3CAPKeQOBpuVLf4d8OLJ5EhckB77/5ow560LCAHvH2Ie5MZYul+f+ehqmuCf6ESKdnezEjATAs1j8LhUb9d2Lw3+3Nnu96F1ae3GwW/6UvucLDk9O9IGPJacMDz2x+3mg//fxbx48n5khC/Qi5gxSeXW1NcmNDV8FM2LaSZ2czeP9Z5HxYd7FnWfMVm1poIxXr+Jv09OidbmLktvTDwU9jKIClZCUXCbatahDz4Tv4x+xu1PGvezCmA4z/ePMs8OlwZyWup7O+8/G35/+esQoqYst1pFpedaW9uIuobO/6dY4te98Ge/EbwC7Ibb0ajo2x2K6TqKny5r3LuWO93W4PV/y/qGjX239aN9JVvC5hS5+vvYwEvi+K3vU4AlxP52IES62dq54qMcfseuzKmj2jAlW59F4PUPqrkfjBiPEx5o3JsQ4/TjcO5xfOzLuPq0J2niJjqx1RFYXgSQNUY6CDKWOCEpMik+fXhpXOiQ5/Ys6AEqT2dLS7IkRhKTpLO8hQcUf5J7UnbAU3fS7vQ1ASAmVi0rdPpvyRqPg8vyCmiPQxvLI/jShCQ1kvbEneOvyk4JczsqSuV9pORS2by5DubB9juDTaMSxOdWALZf5+nYw0TQej04AeTcWJc56KteN6xtcBmNOKNnda7embrVETawXZ5rfZiliqYG24VEK8q+ni+eHFi8hlVTWcMqOn9r9G6OAlk3l3Cn0i7HxcEiKm+RXLQj6OWh8h0Z21LMgiz425MMqo/ubd4ZyZubG0uWGeBB1rWJxD33naX6u4//fdrGvK1Yx3ErtFOxT8oVoqbtYpm0XZi6d9n69FPpcalffLbkRq19UJgUdrtnQEhLyVvGg+IhY5LcaSHVVBQaFmZm2q223LVPYWeypGs7JbAHNAovc94vppdYKKbBpoeo17QdvkoUrdcaOF6gBxWR71+JNDQx1Y7fITLmcHKlnPDITCMuqeOZkZle8lFfYz57mTQSEl7aO346WXhFp0gnu9n7Yx+dOmlp+mr/2K+brVtEj2ivj1Jp4J3feshd+f7Jctlfnxunl30kopLu9m4ytDrEvFG3rswySSchrSBatmI198nSTe6fqtbn8FME4bRlz5eEO3HtuPan+m9IaBOt52yc1+QnspMIWa36Zs96zbYeYlBSvFazg1xMqgp95xRahUIrUZwTSxG3ZwNuIns3JbooKaeu7O6B54XsgWWZMwbehnnRITGGuUwfUn5USJQcJ/ST+t9kkzrfgF8MqH2bhxsNtpw4hb7LjW1ZFyFnJCcSLiWqM5LkETWxzXe5p9AaMUJjj9I0Vr6MWVMjY7LyJaUeQuMYsDkR2yyZlyc0Cmpprnlmp6QE9UsJBKfktnWxLScNfidA7RGdNATYvUMksDxx5fSDf6YCJkBvw7wNetOq/Hn5oKqt33V82/Zdg/X1uwe3b9t9HNSJf+4gv26ejJi5srCv8mLcgr0LX+XccTcNchVX3WfYCBhOViGuf7Jwlbm955LhY4kqxebp25NkV647h+m50Zm/I02YOZysWl8Dv+P/kDp2br1usGf2z81u/887V22es+tAZ53+pdO7IedjNcf6LOv9ngv/1etvA9RKr6na7bWvEpnIHCDfeyrD8IbpSrriedEHhe9g92Nk3vO9l0r0V0t6ArjDrffu6ssX1kiSqtB3veaTtK9P+qmmBlqnTTPVPFdbt2Tz0w1LPm+uXfKJ2zdvmtiQrt1MGl3qa+LTq4ozNy/KWVqpWCFVNJxShDFMvpo2GGTOZXDqz+16BOf+bKlPSHCXFBW7pcXHT1Vj49I8y8vTPGJj67fwdh5pJSUeEtb4ihbHJbpVVia639+QuqA6OTWvUpKyYGlScv5SyCWml4f6rtA9rKo5UHG3LqcoyTx6t/xdGm2mkdJkuqGbZVRmqYeZ0sPHVOJTehKMRna1n+1raz17uH0HeKvZvu0ILySRwyGHh8rAUjmPrqSH0BxAf18P/FT+DKEtoKk3TPfFV6Mm0yevbhpuT2BK6pz4R+qfgMX59Sfm7nh0xyuJ3iihy6jsz2aUlpZBecL2rWnxxPIDJd1zD328qODYP6bRG6iuUomh3rj4QG7Hfxe3adcBxpNZi9fXfpRf/99gNRFnPY7KE9mx+1I94D2x/VRp1LO2xNuf793p3ZNzGc3DW9oSBBY2THJa+Ca5aE/084sFRNnG7qEomyBbewZPCDNTP0fImOKV8zpE9pEUXmMh49270YnXL8a+LvbdJ7ZOcfZqXVmMGSETly9N3sOkyTw9aTLmHuyIdVrTjkh6vIeXTXzkjiZgEWorOxv8I6zTSC9sEnjktWsql69asXhjiKUi8Dq5XGzcsLBzc7unzCKBQsm0kHmOMJU8KlFga57twVEC60rO8TS6kr5iXwK+fybxkz0Jc39Cj1ROoCaQRZOoSfgd7b+6QaR1BnPxz1ggz4gaPy+xtyB6yXbp7g2bzJJf/DR4c6M7N3rJppTM2gKHQezJuG+3S3fRUteTVinimi+LSQWQTHz6VftFnLxf7iYfkCd8eQ3vJ0ZmXyabsIwTWOi8Lvcd8HXz7fetYDCCbO0cgxik5I2y8XNVUPkEo0CU8Mwfg6S7OLjIGiiObvgYbmWQsYajw1F+/VoQaPJ4Od58nKoXPnf+CphZuAZXh3G525zU40rtvakCVoK9ekwcXb6Zt2d+yMzPNrEzq2xrYuQus/uVbZR/aUePpwGLQJdWSUXj/Xi6dqCNhYB6nUYMsPYVnaZ8vGC39nkoNTUt2aJVUml9rFj27DC69meSDIbqevqjA1YdKbQUQ0/WcCkE7nXbeeE09wjzAHOvQFSBhoC76N/GFaKVF5jQVwF8ik7fol/s0V52c1lYdWxMjriO3nA8q1rheyCLXO42sFRVLMuV6Qr35gAWN/tu7O5/wu3/7BgiO3eSwPWfp7EEfAC7PHvv+TddF4szAjZGkhaZRn84X8/7t6dxazppY4kgyp8T/dPDjOc2LAgNFQD2AFis1BlLThx7CFr3LieGjAWbj3WBftzjhrUNcdeifgfuV5Si06IzKm9hK1DRf01a/2qpvMq9lnEU937wRiuNlpqqtK+Va3ILpQ1//3sNfMBN5DeYxJRGRjavv9BRnZntst7BuschD6Dxy1gYw/F1TVU49RyJo6RW1VQuWNy0CZB7dpEGkHMYJVNmtGYAsONKXQfstYt7HVtNp4tVED+lTzS9by5ky9eytn3RURhER2DDTkBK2IcpnFin8yKy6sn5CwuejTshJF3xFrd6C1WiM6LTcLk/c2ffQxPgA3Y85aBhYqEkP2FRNIlnG5wrUFWtzHQ/WclXhG8OsdlCDLPxUIQ7GSQ72Q4ShXZUQK2MaVjbAPqx02hcbE7rvoVvlnG1f0Dmuy77n46fNwi4reluCeQgd6aJLMJCQdnrtJsE8UX8OT3kF25579pVW055RNweWZRn9ETZZZLmmjNdKyRpDtQQB7t0gpBuDt+jvDOC4oaC0zFWDvi4YLqvo7+fZL3Mm7+5pcj3zcFeEe7q5v0DNyqFv06NHzMzlJw6JyGgXyRXjS0Tsw3TozdsAh+CZKtCkX91ro0W35pabzX8aAd9qbCxoank5LadRbu7jDZSL5XJi/ieIUvC3KwfOwtF9w/Nlee3iXrxWGjSP6mTNeRNuZNNSWMmtejs+8mTa9d+9mTjiUk2Upe/6WXnsmon/I7O3k4Y/fjnzgiOdTTh9lk9R5q/6+NqobD6setQgM86Z0fOGvy705CXqkjt6u0OcE8Nfq7IKsrN2SJTsFoq2hP94mJht2wfmx6r43a0238XMW7USBG52quUP83/FVbgU+XOJM0vd09PInPIgHsG2034weYWHa+z/dd0qcO2u49zCdUmz3dsnRcaMlUSrV2RRlkuTtoZupSWQ7em+3Ii9XF6cw7tqR/cONiwcZ1x5VmF2OUxda2ld6d/QNC6DCDJNOQFTzpPXOvac/Lq3idHe0/2jXMTA9O5vPTARDgy6Pv6SJYt/b8drBCXizWs/6VeWbfXJ9w+J/jD6D9+ioQvP38GcPey273O+v4DazPza/17GoXANAg8iYFsLBn/i7PCtE+v6+LFhtqOmXmNpYDz/gxYtRTAqoHTiRbcy7qFs3uU9m86CqcRqslOiWeGRiT0APWEaU9EQigznp0SqqmBwv2ma8fuWYh9uQW2WFx+E2Bx74018fj1l2eyhs7dv3Tp/P2hrDPXXx7H2ojpr30teL4+lgE+r+nimGrbBOjw6sB8ILoQAbO8+LR35B06mw6tV9nl0cKu09H8aPhxeHh4cjwb/j7z5G5o1aVc2EyDD/Q2Ujwk0v5t751DnGgScblvdDkuutxe1UcqiPHcu5FDkbDsS9SFjNrcf0Nw/lrf9cWx04cO5BNfNfV0x10aKMyg3PdMuJT+CA7KIx660QDwo3LZwrTQhfhjLxS+D0GTuPUmQMuHgs5kKvpsATc9lAo/No1PLpHVhZbjV1V2Fym2WiK3dyjXTaToLwxp/wYLSxVa5Pgtyw6kxUSGa2VxBgQ0HdpyMHC2Dvf47QGkEofg8gOE5vt98jnx5PnS9F63cofwYmlU2v7TtfGByU3rllZ0DUWVHDlsUuDtaBbjKIiM+vt4hyqk5sa+0anHMKp74+nR6xGYSgktw8wsReqRZLXJp6Q7ZsUa5Rr5RlXeloGInKvDg1ddMJXJDm8ozsncEvdd8wu3x1evUa1Vrven61iE+eA1qQFVHionGTvapbEAQ+029OnWDTP1H6VNQPyWsW9N/rwGyYcvQWVnMwPvM5cuJNUytHWhYM6DcgW3zSHL6ox6elDQJcdM1xJ/HfUdsOBu7OtpE4/drBT+PmmYrZ2mfL/thTFv+2fYIGPya5t7BnhW24qy4OcfBIQdxR2dRpusLpbJF0vrFYr8Kwa0OXwatcPq1tgO+yUmuVrxydbT1tddYkROXrEpuH+YXgEPv+VN9m3mDdBJh8N41rIY7sqdk6vGcnTTtGQWV8YHLm7eWxz8YMu8XLLAynS3iyGDXEPONZmcUa/GiCOqlt2jwkLiZnnF4i6FjoKdxG4eXTnGusrSiDp9uMoA/GZA7UV+bHxi7rGNjwZHCv0H12blb+YcaowBpmFedH6AQbyHp4UooCiKlA8v9N6OfPs5kDEYZJnmx7ZIL3VIZK2K14BIVmJqZGp9LJMWy/PI1kC0vz579vb86LLAPSkWIdT5eXM7SvDjpuBAWFO5qTZ7NMeOb01RhpE8qeHu+sc9NjCT3czWuFLvW9dWr1hDMBLYygo55pTi9OalXeBwJf3HWXdEa/jHbtcfGlLhKHOwM37sURdW4yNPZM2fX2CXYmdDvs3s8DDkepcmBIN6bGhYsWOaAyPFyw1ZYJdU6VjOk1b6JCZ6LS+yS7ajPRpIlXduAg9u2d5qneRPtt3SPLY1vzivuOEYWoXfpZoiuKlUwBZWRw4v7gsSBcRU9obfXMq2EvuIW+4X4OzIpyPwQ2sHHn399rIpYrL6dHiKFzd9nU3EhABYXkXKXX6hfsHSXQusYizdExeP+XflHNm1ZMPGFYku68LyO9RYosXGF8D3dqqPC/qC0fC7TyeWLZI59pUl865Zp8JClBIPThmTNZPwNT8q94g4a/83mse+1FhQI84dV2Fl73B675RE0Tg0LPN094RXGqJxN5wbDVtIi8MV0rBuNHeN4vFy3IUY7IsYwOu40Wb6c5ZkLcpSR17N+a7a1rG+A+gzL/bbkLUYWkdPxOECItXkkfE6SrqWUBgrgQStg1elVw/uJLplJ0uKJEVJRGp248Gz0rMHzxIFRDB5ZCh7JTdp5fvTBtPG5ZowM+nprzPvjX++xr///hX+59zvvsw85dk5BjMUbOMkFss4ia1gMILB+159ae3akdqVTevWrWyqHVm7oXbZaaNu8qz1n9Rl36078oPg/fP3U0CthAFaHF3BJOoUGuoMKHWtS+o3xAtmZ/+lc5YmegYcbXVaqEOdcu6rMs7NOOhmSmrjnDYbULwK1+OohcA8w5k+7topA8VKdKLO+P+1oPacotQFs7CAWqs5utUptNQZsOpaVxfMzg6pm5qjWZ0C1Bnnx4Jaxx3fErrYYWPRQdrbGikP2qySmakE1HX5oZrM90zgQeOXJs1LIAqh5mZWnZp/6sz8sOogodV91cMGXQXMC2pblc3dmAewXe6WCu1o4/o6z/gqe/JuwPanzLtXXzY71Zd9SaZ3n9TI+2VFnaSngQvLxx4bQIWe2sbNX9q7OjV/1Jn5ZtXxkuwlCD1pYx5SLwkGnQCY6NngTRZmrW+3vhdQVHDwOGi0Svf7c1zkhvzXi1qi5g6iTh1QZ2bGqeMd3WukHhCI/twNg/rrWRsQJicRViwBCpiEOBn8CzPtLjyAxTcMTM0GC0F9dXAzzJCT7j9m9Njq+P+tqbubKeGgrsi1drP8bAnR5vuUJLjCL4O8v9f+3E35xsHtzh6UeyCx0uViSYJQaj2u2XKm4in3DKRXh50DBqWON9lMbPlO6EjlcEvVQb2E2AXN7RjRI0B2ORLYfzCxdxvW35o62P+AOIKD7RDoCUAqgyu1Bb2dm6/02Ga1VmqvTrH6rQL11wIG5EvpFhj9j0GoQ+cOyqMksPyyNgMb5G5wNPgXkhOyW/KsaSbwQX2h3Vjrw51qxyhVnj6z0fnl/c0vmzf6r2Zqt9o0WivnmVn5W/zLK3XdJSxHAkb72yE8OENpKoPbpn1w6Mag4aZDgLLgSd+tRuapRNYfeCIeAJ92d14E4LN2/8N/64eKcQfG+QANFEDA/2mZH2Za/i+YC/F8zsyr/4RnAoRnq98w2+bd6Bt3TzkqvNf4868xGYrubhZUW+MUdHUJnvHX9oexXVH3y9d1nwO3h8VKi3gCrVckJoNa9s/9+6f0Jf/tyjXE4XiCAeX8f44P46QOoZdOv4exO8TbpWxj+TmGuw+5T7GglvrT81H6hN1zzVqJoNN1Ry+eB/dDtLDPskMdsQqgZqMvXNvK6nrHP3da0SAoGzknsGeA+QyynXXYrj41VwTMbU79hOVqjj9bMNqgjnHWgVh/03wWkJe8MoxPxzZi6VvJspMc+4esowmHDuNa++J0lf0s5w7T9rHMezzQhblXq0ZYnVwxjTHlDXY3r7UUa6pcPb+lBi7LjW3u1tawxrDZrsrWK5eXRckZS+1i8pZPmtcdGX7s3OqYPTww+pnPrOXXvzVfKrU8VruGOG+mhJZJLVsawAddBFmu9Y8zXwXlOUwPA5BvOndIgftjL0MXY5Zr9CN+/tSYWtT6sr50ohjr3bSXaKi+F6B5evrZzWUO/YvfaZ6zmhsg/Q4rFa0zWBjcbzljn+lASh8jtOxbg1e1zXi9UjnUkau05kIDv7+Zj5ALNba6FaFnlFfO4buOE6JAJ5mYNA/YzhOMMZ76Kc79gtZcdj3Fq/08e4RrnoWWPMI7oLct+ONvZMUTjG6r19nIj3w723zH7bSgWenwanYhJpTNdMRYr/BxvY0+C1ikEdSfsCV5mymjweueurBPf4gHo0Mx0Cq55rf6TDEWHt9/ApK8ODQfON+z8l4GoFPu2lTZD5/Sdkd+hHo1YNJptlPkErPox8w8YmrSYCHAiF56UgNKaEiPAOBRP+NKhLpPK1G0TKxEc9a7EsPY1pVYQSI5jot4cq2jAI5SZDvmK+TDqbyQTIEM+aQUYmQzZAeed3BV7lkjBBHgyOV5/ow5iqagUiybRIFYCgUFkCmmcMXgYkc9+aLU4UqJKC7k6YeSq0ixVZJlYLrZbuy010IJa/Fclpc+3k9frYSTyRLO80G+8msKVQegTeHsshTCE1GEWuCRsmyeTE7IHoJzAc2IvKsCpuxjoJKRzRaTHiMyeXKY+E7yRrIpKHWxy5VOdZwgxmEUD9lBeb6q0XugdA1nHkhB0AgGrGzynyukDpA5yBqNnA1bClcNuebtGOzj218PFm646db+2B9fyVWvYbepjNisBwlyVB8xjbor3b09tA8elvf8BMiQZX1wiBqCh2ztMhFCgFwcEnNQ5Qg0T6oUadj8TVolSJ4nUYflHkQDTBGjicxBtGCdU+artiFERNtAdKgZh74M4cuf6f+eLEDO3BjY57A+FO9iCGOX4BiFFGNnGYUcE+cYxjRmTgqxBi/mocSChb26nXZGaCxDpU2gKFZKlMbafcXCQhMugrndIo3FJraxCz32PsfBlCgmcQxDGZxo5RaqdEgF/TjF2bRvcdGi1Q5VYqymQROeTlzj5kLc40FLHSFLO2FdcsRR/Y65SJ3IWo/jKTZeVjJjHGa8keITX7phQVshLn4+MQg783yPv4fhhKvG3PASkEBiiyyx1GLcBInPfAkSJfnguK2S6YWf4IQU3i6Y8N0FArXiEzKcnTnO2sESWXGRIjWEkZ0nyw4XBBD84UcBpbRseCeQpZE76+bsAuFeMnDl8syFbq5e2iapfgFdi8GEYTgAvDByOtwcGaamiVUStQmuri4emvITi1gKobGkjoe13E+QnFKQweVDEdWI9esOkoU5dreAVh6oxMJLzdDdbAJWEXOhjaJG5okGwyjoFH57kj5eJoRIdh6dk35iXha7IiSldH0sY492xjQ2Z4oMOy+MDh39/m5eEfdp7g0Q90oX13ZenjzXA8d8aRIyO3cgaCNl8HlBsFA0CvR4azBCYoLhomYbkCMDhGLnPgseR0iOQnGeWg8H9/8EiNnESg0He7Gg8OgylCeRywkw4aa1yF+J6aiF+7qTG6Ho6Gz59KPNaAhfdGZeAbBCsueqth0yxfkb0PUmID4xG9hMgoYtLg==" }, "/fonts/barlow-400.woff2": { "cabeceras": { "content-type": "font/woff2", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "public, max-age=31536000, immutable", "etag": '"7a686e76312866b7d506"' }, "b64": "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" }, "/fonts/barlow-500.woff2": { "cabeceras": { "content-type": "font/woff2", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "public, max-age=31536000, immutable", "etag": '"80e7dc5605dd451bb9b0"' }, "b64": "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" }, "/fonts/barlow-600.woff2": { "cabeceras": { "content-type": "font/woff2", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "public, max-age=31536000, immutable", "etag": '"488b58098126c00b8fa7"' }, "b64": "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" }, "/fonts/barlow-700.woff2": { "cabeceras": { "content-type": "font/woff2", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "public, max-age=31536000, immutable", "etag": '"98aa8b5c2582107d73a6"' }, "b64": "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" }, "/fonts/barlow-condensed-500.woff2": { "cabeceras": { "content-type": "font/woff2", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "public, max-age=31536000, immutable", "etag": '"31ff5e6e96a096fde4d7"' }, "b64": "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" }, "/fonts/barlow-condensed-600.woff2": { "cabeceras": { "content-type": "font/woff2", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "public, max-age=31536000, immutable", "etag": '"5bc49d41f32810a11476"' }, "b64": "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" }, "/fonts/barlow-condensed-700.woff2": { "cabeceras": { "content-type": "font/woff2", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "public, max-age=31536000, immutable", "etag": '"e3e520cb7468f2efd60b"' }, "b64": "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" }, "/fonts.css": { "cabeceras": { "content-type": "text/css; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"19aa24ea95505ecceeeb"' }, "texto": "/* Tipograf\xEDas propias (Anton, Barlow, Barlow Condensed; SIL Open Font License), solo caracteres latinos */\n@font-face {\n  font-family: 'Anton';\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n  src: url(fonts/anton-400.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;\n}\n@font-face {\n  font-family: 'Barlow';\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n  src: url(fonts/barlow-400.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;\n}\n@font-face {\n  font-family: 'Barlow';\n  font-style: normal;\n  font-weight: 500;\n  font-display: swap;\n  src: url(fonts/barlow-500.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;\n}\n@font-face {\n  font-family: 'Barlow';\n  font-style: normal;\n  font-weight: 600;\n  font-display: swap;\n  src: url(fonts/barlow-600.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;\n}\n@font-face {\n  font-family: 'Barlow';\n  font-style: normal;\n  font-weight: 700;\n  font-display: swap;\n  src: url(fonts/barlow-700.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;\n}\n@font-face {\n  font-family: 'Barlow Condensed';\n  font-style: normal;\n  font-weight: 500;\n  font-display: swap;\n  src: url(fonts/barlow-condensed-500.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;\n}\n@font-face {\n  font-family: 'Barlow Condensed';\n  font-style: normal;\n  font-weight: 600;\n  font-display: swap;\n  src: url(fonts/barlow-condensed-600.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;\n}\n@font-face {\n  font-family: 'Barlow Condensed';\n  font-style: normal;\n  font-weight: 700;\n  font-display: swap;\n  src: url(fonts/barlow-condensed-700.woff2) format('woff2');\n  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;\n}\n" }, "/icon-192.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "etag": '"320b41de409758534700"' }, "b64": "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" }, "/icon-512.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "etag": '"db772ac6cdca77f069f9"' }, "b64": "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" }, "/icon-maskable-512.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "etag": '"4a76c99c9b33a9f25c81"' }, "b64": "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" }, "/index.html": { "cabeceras": { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"a7d9409c5e8386c08145"' }, "texto": `<!DOCTYPE html>
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
<link rel="stylesheet" href="fonts.css">
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
.vtas{display:block;width:100%;text-align:left;background:var(--ink);color:var(--bg);border:1px solid var(--ink);border-radius:var(--radio-lg);padding:14px 14px 12px}
.vtas-t{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.vtas .t-sec{color:var(--bg);opacity:.75}
.vtas-ver{display:inline-flex;align-items:center;gap:2px;font-size:13px;font-weight:600;opacity:.85}
.vtas-ver svg{width:16px;height:16px}
.vtas-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.vtas-c{display:flex;flex-direction:column;min-width:0;padding-left:10px;border-left:1px solid rgba(255,255,255,.22)}
.vtas-c:first-child{padding-left:0;border-left:0}
.vtas-c small{font:600 11px/1 var(--f-etiqueta);letter-spacing:.08em;text-transform:uppercase;opacity:.75}
.vtas-c b{font:700 20px/1.1 var(--f-etiqueta);margin-top:6px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.vtas-c i{font-style:normal;font-size:12px;opacity:.75;margin-top:4px;line-height:1.25}
@media (min-width:520px){.vtas-c b{font-size:26px}}
.vt-seg{display:flex;gap:8px;margin-bottom:14px}
.vt-seg .chip{flex:1;justify-content:center}
.vt-lista{display:flex;flex-direction:column;margin:6px 0 16px}
.vt-fila{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:baseline;padding:10px 2px;border-bottom:1px solid var(--line)}
.vt-fila:last-child{border-bottom:0}
.vt-fila .n{font-weight:600;min-width:0;overflow-wrap:anywhere}
.vt-fila .v{font:700 16px var(--f-etiqueta);font-variant-numeric:tabular-nums;text-align:right}
.vt-fila small{grid-column:1/-1;color:var(--muted);font-size:13px}
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
.prod{display:flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radio-lg);padding-right:8px;min-width:0}
.prod:hover{border-color:var(--line-2);box-shadow:var(--sombra)}
.prod.arch{opacity:.6}
.prod-btn{display:flex;align-items:center;gap:10px;flex:1;min-width:0;padding:9px 6px 9px 10px;background:none;border:0;border-radius:var(--radio-lg);text-align:left;color:inherit}
.prod-ico{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:var(--surface-2);flex:none}
.prod-main{min-width:0;flex:1}
.prod-n{display:block;font-weight:600;line-height:1.2}
.prod-s{display:block;margin-top:2px;font-size:13px;color:var(--muted);line-height:1.25}
.prod-s .cam{color:var(--info);font-weight:600}
.stocks{display:flex;gap:0;flex:none}
.st{display:flex;flex-direction:column;align-items:center;min-width:48px;padding:2px 4px}
.st b{font:700 22px/1 var(--f-etiqueta);font-variant-numeric:tabular-nums}
.st i{font:600 10px/1 var(--f-etiqueta);font-style:normal;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:3px}
.st.agotado b{color:var(--bad)}
.st.bajo b{color:var(--warn)}
.st.cero b{color:var(--muted);font-weight:500}
.btn-vender{flex:none;min-height:40px;padding:0 14px}
.grupo-t{margin:20px 2px 2px}
@media (max-width:380px){.st{min-width:40px}.prod-ico{display:none}.btn-vender{padding:0 10px}}
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
<script src="app.js" defer></script>
</body>
</html>
` }, "/logo.png": { "cabeceras": { "content-type": "image/png", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "etag": '"e967e688072e69475b1a"' }, "b64": "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" }, "/manifest.webmanifest": { "cabeceras": { "content-type": "application/manifest+json", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "etag": '"53e0919fba13bb323d28"' }, "texto": '{\n  "name": "Inventario Bases Box Tepic",\n  "short_name": "Inventario",\n  "description": "Inventario compartido entre el almac\xE9n y el vendedor de la tienda.",\n  "lang": "es-MX",\n  "start_url": "./",\n  "scope": "./",\n  "display": "standalone",\n  "orientation": "any",\n  "background_color": "#F4F2ED",\n  "theme_color": "#1A1A1A",\n  "icons": [\n    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },\n    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },\n    { "src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }\n  ]\n}\n' }, "/sw.js": { "cabeceras": { "content-type": "text/javascript; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=63072000; includeSubDomains", "cross-origin-opener-policy": "same-origin", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()", "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "cache-control": "no-cache", "etag": '"66711e1c3e73b6140d29"' }, "texto": "// Service worker: guarda la app para abrirla aunque no haya internet.\n// Los datos (/api) nunca se guardan aqu\xED: siempre van a la red.\nconst VERSION = 'bb-inv-v4';\nconst BASE = ['./', 'index.html', 'core.js', 'app.js', 'fonts.css', 'manifest.webmanifest', 'logo.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',\n  'fonts/anton-400.woff2', 'fonts/barlow-400.woff2', 'fonts/barlow-500.woff2', 'fonts/barlow-600.woff2', 'fonts/barlow-700.woff2',\n  'fonts/barlow-condensed-500.woff2', 'fonts/barlow-condensed-600.woff2', 'fonts/barlow-condensed-700.woff2'];\n\nself.addEventListener('install', (e) => {\n  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));\n});\n\nself.addEventListener('activate', (e) => {\n  e.waitUntil(\n    caches.keys()\n      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))\n      .then(() => self.clients.claim())\n  );\n});\n\n// Red primero para que cada cambio de la app llegue en cuanto hay internet; sin red, la copia guardada.\nself.addEventListener('fetch', (e) => {\n  const r = e.request, u = new URL(r.url);\n  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;\n  e.respondWith(\n    fetch(r)\n      .then((res) => {\n        if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(r, copia)); }\n        return res;\n      })\n      .catch(() => caches.match(r).then((m) => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error())))\n  );\n});\n" } };

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
  `CREATE TABLE IF NOT EXISTS intentos (k TEXT PRIMARY KEY, n INTEGER NOT NULL, b INTEGER NOT NULL, hasta INTEGER NOT NULL, adm INTEGER NOT NULL)`,
  // tabla trampa: insertar aquí rompe el CHECK y deshace todo el batch (ver guardas)
  `CREATE TABLE IF NOT EXISTS guardas (g INTEGER NOT NULL CHECK (g = 0))`
];
var COLS_PRODUCTO = ["id", "nombre", "cat", "medida", "tono", "unidad", "precio", "costo", "min_local", "min_tienda", "activo", "stock_local", "stock_tienda", "hubo_local", "hubo_tienda", "creado", "actualizado"];
var COLS_MOV = ["id", "ts", "prod", "loc", "delta", "tipo", "motivo", "nota", "rol", "precio", "cliente", "pago", "envio", "grupo", "ref", "anulado", "anulado_ts", "anulado_por", "anulado_nota"];
var COLS_EDITABLES = ["nombre", "unidad", "precio", "costo", "min_local", "min_tienda", "medida", "tono", "activo", "actualizado"];
var insertarJson = (tabla, cols) => `INSERT INTO ${tabla} (${cols.join(", ")}) SELECT ${cols.map((c) => `json_extract(value, '$.${c}')`).join(", ")} FROM json_each(?1)`;
var migradas = /* @__PURE__ */ new WeakSet();
async function crearRepoD1(db) {
  if (!migradas.has(db)) {
    const existe = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'productos'`).first();
    if (!existe) await db.batch(SCHEMA.map((s) => db.prepare(s)));
    else {
      try {
        await db.prepare(`SELECT envio FROM movs LIMIT 0`).all();
      } catch (e) {
        try {
          await db.prepare(`ALTER TABLE movs ADD COLUMN envio REAL NOT NULL DEFAULT 0`).run();
        } catch (e2) {
        }
      }
    }
    await db.prepare(SCHEMA.find((x) => x.includes("TABLE IF NOT EXISTS intentos"))).run();
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
    if (tx.reiniciar) {
      ["movs", "traspaso_lineas", "traspasos", "pedido_lineas", "pedidos"].forEach((t) => st.push(q(`DELETE FROM ${t}`)));
      st.push(q(`UPDATE productos SET stock_local = 0, stock_tienda = 0, hubo_local = 0, hubo_tienda = 0`));
    }
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
         RETURNING n, b, hasta, adm`,
        clave,
        ahora
      ).first();
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
var CABECERAS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "cross-origin-resource-policy": "same-origin",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "strict-transport-security": "max-age=63072000; includeSubDomains"
};
var MAX_CUERPO = 65536;
var responder = (status, json) => new Response(JSON.stringify(json), { status, headers: CABECERAS });
var error = (status, code, mensaje) => responder(status, { ok: false, error: { code, mensaje } });
async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "POST") return error(405, "metodo", "M\xE9todo no permitido.");
  if (!env.DB) return error(503, "sin_base_de_datos", 'Falta conectar la base de datos D1 con el nombre "DB".');
  const url = new URL(request.url);
  const origen = request.headers.get("origin");
  if (origen && origen !== url.origin) return error(403, "origen", "Petici\xF3n no permitida desde este sitio.");
  let body = null;
  if (request.method === "POST") {
    if (Number(request.headers.get("content-length") || 0) > MAX_CUERPO) return error(413, "muy_grande", "La petici\xF3n es demasiado grande.");
    let texto;
    try {
      texto = await request.text();
    } catch (e) {
      return error(400, "json", "No pude leer la petici\xF3n.");
    }
    if (texto.length > MAX_CUERPO) return error(413, "muy_grande", "La petici\xF3n es demasiado grande.");
    try {
      body = JSON.parse(texto);
    } catch (e) {
      return error(400, "json", "No pude leer la petici\xF3n.");
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "json", "No pude leer la petici\xF3n.");
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
