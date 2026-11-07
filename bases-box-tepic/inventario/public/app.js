(function () {
'use strict';
const Core = window.BBCore;

/* ───────── claves y almacenamiento (si el navegador no deja guardar, se usa memoria) ───────── */
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
    if (!avisoMemoria && k in memoria) { avisoMemoria = true; setTimeout(() => toast('Este navegador no deja guardar datos: lo que captures se perderá al cerrar la pestaña.', { tipo: 'error', ms: 10000 }), 0); }
  },
  removeItem: store.del
};
const sesionTmp = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return memoria['s:' + k] || null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { memoria['s:' + k] = v; } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* nada */ } delete memoria['s:' + k]; }
};

/* ───────── plantillas con escape automático ───────── */
class Raw { constructor(s) { this.s = s; } }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : v == null || v === false ? '' : esc(v));
const html = (strs, ...vals) => new Raw(strs.reduce((a, s, i) => a + s + (i < vals.length ? val(vals[i]) : ''), ''));
const raw = (s) => new Raw(s);
const poner = (el, tpl) => { el.innerHTML = val(tpl); };
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const ico = (n, cls) => raw('<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>');

/* ───────── formatos ───────── */
const nf = new Intl.NumberFormat('es-MX');
const mf = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const mf2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
// sin centavos cuando es exacto ($1,800); con dos cuando los hay ($180.50)
const dinero = (n) => ((n || 0) % 1 ? mf2 : mf).format(n || 0);
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
  return fmtDiaCorto.format(ts).replace(/\./g, '') + ', ' + h;
}
const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// busca varias palabras sin importar el orden ni los signos: “queen gris” encuentra “Base Queen · Gris”
const coincide = (texto, q) => { const t = norm(q).split(/\s+/).filter(Boolean); const h = norm(texto); return t.every((x) => h.includes(x)); };
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'x';
const entero = (v) => Math.max(0, Math.min(99999, parseInt(String(v).replace(/\D/g, ''), 10) || 0));
const decimal = (v) => { const n = parseFloat(String(v).replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
const nuevoCid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/* ───────── estado ───────── */
class ErrorRed extends Error { constructor() { super('Sin conexión. Revisa tu internet e intenta de nuevo.'); } }
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
  local: { nombre: 'Almacén', corto: 'Almacén', desc: 'Bodega y fábrica: materiales, bases en producción y envíos a la tienda.', ic: 'fabrica' },
  tienda: { nombre: 'Vendedor tienda', corto: 'Tienda', desc: 'Venta al público: ventas, devoluciones, pedidos y recibo de mercancía.', ic: 'tienda' },
  dueno: { nombre: 'Dueño', corto: 'Dueño', desc: 'Solo consulta: resumen de producción, ventas, gastos y egresos.', ic: 'usuario' }
};
const CATS = { base: 'Bases', material: 'Materiales', accesorio: 'Accesorios' };
const TIPOS = {
  entrada: { t: 'Entrada al almacén', ic: 'entrada', c: 'ok' },
  salida: { t: 'Salida del almacén', ic: 'salida', c: 'warn' },
  venta: { t: 'Venta', ic: 'recibo', c: 'acc' },
  devolucion: { t: 'Devolución de cliente', ic: 'devolver', c: 'info' },
  merma: { t: 'Merma en tienda', ic: 'basura', c: 'bad' },
  ajuste: { t: 'Ajuste por conteo', ic: 'conteo', c: 'info' },
  inicial: { t: 'Inventario inicial', ic: 'cubo', c: '' },
  envio: { t: 'Envío a la tienda', ic: 'camion', c: 'info' },
  regreso: { t: 'Regreso de tienda al almacén', ic: 'entrada', c: 'info' },
  recibo: { t: 'Recibido en tienda', ic: 'check', c: 'ok' },
  envio_cancelado: { t: 'Envío cancelado', ic: 'x', c: 'bad' }
};
const MOTIVOS = { produccion: 'Producción', compra: 'Compra', uso: 'Uso en producción', merma: 'Merma', otro: 'Otro' };
const PAGOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };

/* ───────── tema ───────── */
function aplicarTema() {
  const t = store.get(CLAVE_TEMA) || 'auto';
  const r = document.documentElement;
  if (t === 'auto') r.removeAttribute('data-theme');
  else r.setAttribute('data-theme', t === 'oscuro' ? 'dark' : 'light');
}

/* ───────── ventanas, avisos y confirmaciones ───────── */
let dlgN = 0;
function dialogo(o) {
  const d = document.createElement('dialog');
  d.className = 'sheet' + (o.clase ? ' ' + o.clase : '');
  const tid = 'dt' + (++dlgN);
  d.setAttribute('aria-labelledby', tid);
  poner(d, html`<div class="sheet-in"><header class="sheet-head"><h2 id="${tid}">${o.titulo}</h2><button type="button" class="icon-btn" data-cerrar aria-label="Cerrar">${ico('x')}</button></header><div class="sheet-body"></div>${o.pie ? html`<footer class="sheet-foot"></footer>` : ''}</div>`);
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
  const nodo = html`<span style="flex:1">${texto}</span>`;
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

// confirmar({titulo, texto, ok, peligro, campo:{etiqueta, min, area}}) → true/false, o el texto escrito si hay campo
function confirmar(o) {
  return new Promise((resolver) => {
    let res = o.campo ? null : false;
    const d = dialogo({
      titulo: o.titulo,
      clase: '',
      cuerpo: html`${o.texto ? html`<p style="margin-bottom:14px">${o.texto}</p>` : ''}${o.campo ? html`<label class="campo"><span class="lbl">${o.campo.etiqueta}</span><textarea class="inp" id="cf-campo" rows="2" maxlength="140" placeholder="${o.campo.ayuda || ''}"></textarea></label><p class="err" id="cf-err" hidden></p>` : ''}`,
      pie: html`<button type="button" class="btn btn-g" data-cerrar>${o.cancelar || 'Cancelar'}</button><button type="button" class="btn ${o.peligro ? 'btn-r' : 'btn-p'}" id="cf-ok">${o.ok || 'Aceptar'}</button>`,
      alCerrar: () => resolver(res)
    });
    const campo = $('#cf-campo', d.el);
    if (campo) campo.addEventListener('input', () => { $('#cf-err', d.el).hidden = true; });
    $('#cf-ok', d.el).addEventListener('click', () => {
      if (o.campo) {
        const v = $('#cf-campo', d.el).value.trim();
        if (v.length < (o.campo.min || 1)) { const e = $('#cf-err', d.el); e.hidden = false; e.textContent = o.campo.error || 'Escribe una explicación corta.'; return; }
        res = v;
      } else res = true;
      d.cerrar();
    });
  });
}

// Ejecuta una acción de guardado dentro de una ventana: bloquea el botón, muestra el error en su lugar y devuelve true si salió bien
async function guardando(btn, errEl, fn) {
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  if (errEl) errEl.hidden = true;
  try { await fn(); return true; } catch (e) {
    let msg = e && e.message;
    if (!(e instanceof ErrorApi) && !(e instanceof ErrorRed)) { console.error(e); msg = 'Algo falló. Intenta de nuevo.'; }
    if (errEl) { errEl.hidden = false; errEl.textContent = msg; errEl.scrollIntoView({ block: 'nearest' }); }
    return false;
  } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
}

/* ───────── comunicación con el servidor (o con el modo local) ───────── */
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
  if (!S.avisoAgenda && e.rol === 'tienda') { S.avisoAgenda = true; setTimeout(mostrarAvisoAgenda, 700); }
  document.dispatchEvent(new Event('bb:estado')); // las hojas abiertas (gastos, ventas, reporte) se vuelven a cargar
}

async function cargarEstado() {
  const r = await llamar('GET', '/estado');
  if (r.json.ok) { aplicarEstado(r.json); return true; }
  if (r.status === 401 && r.json.error.code === 'sin_sesion') { salir(r.json.error.mensaje); return false; }
  throw new ErrorApi(r.json.error);
}

// Mutaciones. Devuelve el resultado de la operación; lanza ErrorApi / ErrorRed.
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
  if (S.modo === 'local' && !forzar) return; // sin servidor solo puede cambiar otra pestaña del mismo equipo (evento storage)
  sincronizando = true;
  try {
    if (S.modo === 'local') { repoLocal.recargar(); }
    const r = await llamar('GET', '/rev');
    if (r.json.ok) { if (r.json.rev !== S.est.rev) await cargarEstado(); }
    else if (r.status === 401 && r.json.error.code === 'sin_sesion') salir(r.json.error.mensaje);
  } catch (e) { /* sin red: el chip ya lo avisa */ } finally { sincronizando = false; }
}

/* ───────── piezas visuales del producto ───────── */
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
  return html`<span style="color:var(--ink-2)">${ico(p.cat === 'material' ? 'capas' : 'tuerca')}</span>`;
}
function subProd(p, corto) {
  const m = p.cat === 'base' ? medidaDe(p.medida) : null;
  const partes = [];
  if (!corto) partes.push(m ? m.nombre + ' ' + m.dims : CATS[p.cat].replace(/s$/, ''));
  if (p.precio) partes.push(dinero(p.precio));
  else if (corto) partes.push('Sin precio');
  return partes.join(' · ');
}
// nivel de existencias de un lugar frente a su mínimo
function nivel(p, loc) {
  const st = loc === 'local' ? p.stock_local : p.stock_tienda, mn = loc === 'local' ? p.min_local : p.min_tienda;
  if (!(mn > 0) || !(loc === 'local' ? p.hubo_local : p.hubo_tienda)) return 'ok'; // sin mínimo, o nunca ha tenido existencias: no es alerta
  if (st === 0) return 'agotado';
  if (st < mn) return 'bajo';
  return 'ok';
}
const bajoPara = (p, rol) => (rol === 'dueno' ? nivel(p, 'local') !== 'ok' || nivel(p, 'tienda') !== 'ok' : nivel(p, rol) !== 'ok');
const bajosDe = (loc) => S.est.productos.filter((p) => p.activo && bajoPara(p, loc));
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

/* agrupa los movimientos de una misma operación (venta de varias bases, entrada de varios productos…) */
function agrupar(movs) {
  const out = [], idx = Object.create(null);
  movs.forEach((m) => {
    let g = idx[m.grupo];
    if (!g) {
      g = idx[m.grupo] = { grupo: m.grupo, ts: m.ts, tipo: m.tipo, rol: m.rol, nota: m.nota, motivo: m.motivo, cliente: m.cliente, pago: m.pago, ref: m.ref, anulado: !!m.anulado, anulado_ts: m.anulado_ts, anulado_por: m.anulado_por, anulado_nota: m.anulado_nota, lineas: [] };
      out.push(g);
    }
    if (m.tipo === 'regreso' && m.delta < 0) return; // un regreso guarda salida de tienda + entrada al almacén; se muestra una sola línea
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
const nombreProd = (id) => (S.idx[id] ? S.idx[id].nombre : id === '' ? 'Solo monto (sin producto)' : 'Producto eliminado');
function tituloOp(g) {
  const t = TIPOS[g.tipo] ? TIPOS[g.tipo].t : g.tipo;
  if (g.tipo === 'entrada' || g.tipo === 'salida') return t + (g.motivo && g.motivo !== 'otro' ? ' · ' + MOTIVOS[g.motivo] : '');
  return t;
}
const resumenOp = (g) => (g.motivo === 'monto' && g.tipo === 'venta' ? 'Solo monto, sin producto' : plural(g.lineas.length, 'producto', 'productos') + ' · ' + plural(g.piezas, 'pieza', 'piezas'));
const puedeAnular = (g) => !g.anulado && !['envio', 'recibo', 'envio_cancelado', 'inicial', 'anulacion'].includes(g.tipo) && (S.rol === 'local' || g.rol === S.rol);

/* ───────── armazón de la app ───────── */
const TABS = [
  { id: 'inicio', t: 'Inicio', ic: 'home' },
  { id: 'inventario', t: 'Inventario', ic: 'cubo' },
  { id: 'mover', t: 'Mover', ic: 'mover' },
  { id: 'historial', t: 'Historial', ic: 'reloj' },
  { id: 'mas', t: 'Más', ic: 'mas' }
];
const tabsDe = () => TABS.filter((t) => !(S.rol === 'dueno' && t.id === 'mover')); // el dueño solo consulta
const marca = () => html`<div class="marca"><span class="logo"><img src="logo.png" alt="" width="38" height="38"></span><span class="marca-t"><span class="marca-n">Bases Bo<b>x</b></span><span class="marca-s">Tepic · Inventario</span></span></div>`;

function montarApp() {
  poner($('#raiz'), html`
    <div class="app ${S.rol === 'tienda' ? 'con-venta' : ''}">
      <aside class="rail" aria-label="Menú principal">
        ${marca()}
        <nav style="display:flex;flex-direction:column;gap:4px" aria-label="Secciones">
          ${tabsDe().map((t) => html`<button type="button" class="nav-it" data-tab="${t.id}">${ico(t.ic)}<span>${t.t}</span><span class="badge" hidden></span></button>`)}
        </nav>
        <div class="rail-pie">
          <div class="rail-rol"><span data-rol-nombre></span><small data-negocio></small></div>
          <button type="button" class="estado-chip act" data-act="sync" data-chip></button>
          <button type="button" class="btn btn-s btn-g" style="color:inherit;border-color:var(--rail-line)" data-act="salir">Cerrar sesión</button>
        </div>
      </aside>
      <div>
        <header class="top"><div class="top-in">${marca()}<button type="button" class="estado-chip act" data-act="sync" data-chip></button></div></header>
        <div class="demo-b" id="demo-b" hidden><span>Demostración · datos de ejemplo</span><button type="button" class="btn btn-s btn-g" data-act="salir-demo">Salir de la demo</button></div>
        <main class="main" id="vista" tabindex="-1"><div class="main-in" id="vista-in"></div></main>
      </div>
      ${S.rol === 'tienda' ? html`<button type="button" class="btn btn-p fab fab-venta" id="fab-venta" data-act="venta-nueva" aria-label="Nueva venta">${ico('recibo')}Nueva venta</button>` : ''}
      <nav class="tabbar" aria-label="Secciones" style="grid-template-columns:repeat(${tabsDe().length},1fr)">
        ${tabsDe().map((t) => html`<button type="button" class="tab" data-tab="${t.id}">${ico(t.ic)}<span>${t.t}</span><span class="badge" hidden></span></button>`)}
      </nav>
    </div>`);
}

function pintarChips() {
  const loc = S.modo === 'local';
  const txt = loc ? 'Solo este equipo' : S.enLinea ? 'En línea' : 'Sin conexión';
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
  const fv = $('#fab-venta');
  if (fv) fv.hidden = S.tab === 'inicio' || S.tab === 'mas';
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

/* ───────── INICIO ───────── */
VISTAS.inicio = { armar: () => html`<div class="pila" data-vista="inicio" id="v-inicio"></div>`, actualizar: pintarInicio };

function pendientesDeAtencion() {
  const e = S.est, items = [];
  const enT = e.traspasos.filter((t) => t.estado === 'en_transito');
  const ped = e.pedidos.filter((p) => p.estado === 'pendiente');
  const pzEnT = sumar(enT, (t) => sumar(t.lineas, (l) => l.cant));
  const pzPed = sumar(ped, (p) => sumar(p.lineas, (l) => l.cant));
  if (S.rol === 'tienda' && enT.length) items.push({ c: 'info', ic: 'camion', t: plural(enT.length, 'envío por recibir', 'envíos por recibir'), s: plural(pzEnT, 'pieza', 'piezas') + ' en camino desde el almacén', btn: 'Recibir', act: 'recibir-ya' });
  if (S.rol === 'local' && ped.length) items.push({ c: 'acc', ic: 'pedido', t: plural(ped.length, 'pedido de la tienda', 'pedidos de la tienda'), s: plural(pzPed, 'pieza', 'piezas') + ' por surtir', btn: 'Ver pedidos', act: 'ir', tab: 'mover' });
  if (S.rol === 'local' && enT.length) items.push({ c: 'info', ic: 'camion', t: plural(enT.length, 'envío en camino', 'envíos en camino'), s: 'Esperan a que la tienda confirme el recibo', btn: 'Ver', act: 'ir', tab: 'mover' });
  if (S.rol === 'tienda' && ped.length) items.push({ c: 'info', ic: 'pedido', t: plural(ped.length, 'pedido esperando', 'pedidos esperando'), s: 'El almacén aún no los surte', btn: 'Ver', act: 'ir', tab: 'mover' });
  const bajos = bajosDe(S.rol);
  if (bajos.length) {
    const agot = bajos.filter((p) => nivel(p, S.rol) === 'agotado').length;
    items.push({ c: agot ? 'bad' : 'warn', ic: 'alerta', t: plural(bajos.length, 'producto con stock bajo', 'productos con stock bajo'), s: bajos.slice(0, 3).map((p) => p.nombre).join(' · ') + (bajos.length > 3 ? ' y ' + (bajos.length - 3) + ' más' : ''), btn: 'Revisar', act: 'ver-bajos' });
  }
  return items;
}

function pintarInicio() {
  const cont = $('#v-inicio');
  if (!cont) return;
  if (S.rol === 'dueno') return pintarResumenDueno();
  const e = S.est, r = e.resumen, hoy = new Date();
  const bases = e.productos.filter((p) => p.cat === 'base' && p.activo);
  const bLocal = sumar(bases, (p) => p.stock_local), bTienda = sumar(bases, (p) => p.stock_tienda), bCamino = sumar(bases, (p) => S.camino[p.id] || 0);
  const activos = e.productos.filter((p) => p.activo);
  const valor = S.rol === 'local' ? sumar(activos, (p) => (p.stock_local + p.stock_tienda) * (p.costo || 0)) : sumar(activos, (p) => p.stock_tienda * (p.precio || 0));
  const saludo = hoy.getHours() < 12 ? 'Buenos días' : hoy.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
  const pend = pendientesDeAtencion();
  const vacioTodo = activos.length > 0 && sumar(activos, (p) => p.stock_local + p.stock_tienda + (S.camino[p.id] || 0)) === 0;
  const ops = agrupar(e.recientes).slice(0, 5);
  const topMax = r.top.length ? r.top[0].pzas : 1;

  poner(cont, html`
    <div class="cabecera">
      <div><h1 class="t-pant">${saludo}</h1><p class="t-peq" style="margin-top:8px">${mayus(fmtDiaLargo.format(hoy))} · ${ROLES[S.rol].nombre}</p></div>
    </div>
    ${S.rol === 'tienda' ? html`<button type="button" class="btn btn-p btn-b btn-venta-grande" data-act="venta-nueva">${ico('recibo')}Nueva venta</button>` : ''}
    ${vacioTodo ? html`<section class="card" aria-label="Empezar"><div class="fila" style="align-items:flex-start;gap:14px"><span class="ico-c acc">${ico('cubo')}</span><div class="grow"><div class="item-t">Empieza cargando tus existencias</div><div class="item-s" style="margin-bottom:12px">${S.rol === 'local' ? 'Aún no hay piezas registradas. Cuenta lo que tienes en el almacén y anótalo de un jalón, o registra una entrada cada vez que fabriques o compres.' : 'Aún no hay piezas registradas. Cuando el almacén envíe mercancía te aparecerá aquí para recibirla; si ya tienes bases en la tienda, cuéntalas.'}</div><div class="fila w"><button type="button" class="btn btn-p btn-s" data-act="forma" data-tipo="conteo">${ico('conteo')}Contar existencias</button>${S.rol === 'local' ? html`<button type="button" class="btn btn-g btn-s" data-act="forma" data-tipo="entrada">${ico('entrada')}Registrar entrada</button>` : ''}</div></div></div></section>` : ''}
    ${pend.length ? html`<section class="card flat" aria-label="Por atender"><ul class="lista">${pend.map((p) => html`<li class="item">
        <span class="ico-c ${p.c}">${ico(p.ic)}</span>
        <div class="grow"><div class="item-t">${p.t}</div><div class="item-s">${p.s}</div></div>
        <button type="button" class="btn btn-s ${p.c === 'bad' || p.c === 'acc' ? 'btn-p' : 'btn-d'}" data-act="${p.act}" ${p.tab ? raw('data-tab-ir="' + p.tab + '"') : ''}>${p.btn}</button></li>`)}</ul></section>`
      : vacioTodo ? '' : html`<section class="card"><div class="fila"><span class="ico-c ok">${ico('check')}</span><div><div class="item-t">Todo al día</div><div class="item-s">No hay envíos, pedidos ni productos con stock bajo por atender.</div></div></div></section>`}
    <button type="button" class="vtas" data-act="ventas" aria-label="Ver reporte de ventas">
      <span class="vtas-t"><span class="t-sec">Ventas</span><span class="vtas-ver">Ver reporte ${ico('der')}</span></span>
      <span class="vtas-g">${[['Hoy', r.hoy], ['Semana', r.semana], ['Mes', r.mes]].map(([t, v]) => html`<span class="vtas-c"><small>${t}</small><b class="cifras">${dinero(v.total)}</b><i>${plural(v.n, 'venta', 'ventas')} · ${plural(v.pzas, 'pza', 'pzas')}</i></span>`)}</span>
    </button>
    ${S.rol === 'local' ? html`<div id="card-cuentas"></div>` : ''}
    ${tarjetaAgenda()}
    <button type="button" class="gastos-b" data-act="gastos" aria-label="Ver gastos">
      <span class="ico-c warn">${ico('salida')}</span>
      <span class="grow"><b>Gastos</b><small>Hoy ${dinero((r.gastos || {}).hoy || 0)} · semana ${dinero((r.gastos || {}).semana || 0)} · mes ${dinero((r.gastos || {}).mes || 0)}</small></span>
      <span class="gastos-mas">${ico('plus')}</span>
    </button>
    ${S.rol === 'local' ? html`<div class="acciones-fab"><button type="button" class="btn btn-p" data-act="prod-nuevo">${ico('plus')}Agregar producto</button><button type="button" class="btn btn-g" data-act="variantes">${ico('capas')}Agregar bases</button></div>` : ''}
    ${S.rol === 'tienda' ? html`<button type="button" class="btn btn-p btn-b" data-act="reporte-dia" style="min-height:52px">${ico('tabla')}Reporte del día</button>` : ''}
    <section class="grid-kpi" aria-label="Resumen">
      <div class="kpi"><span class="t-sec">Bases en el almacén</span><span class="num-g cifras">${num(bLocal)}</span><small>${plural(bases.filter((p) => p.stock_local > 0).length, 'modelo con existencias', 'modelos con existencias')}</small></div>
      <div class="kpi"><span class="t-sec">Bases en tienda</span><span class="num-g cifras">${num(bTienda)}</span><small>${plural(bases.filter((p) => p.stock_tienda > 0).length, 'modelo con existencias', 'modelos con existencias')}</small></div>
      <div class="kpi"><span class="t-sec">Bases en camino</span><span class="num-g cifras" style="color:${bCamino ? 'var(--info)' : 'inherit'}">${num(bCamino)}</span><small>${bCamino ? 'Sin confirmar en tienda' : 'Nada por llegar'}</small></div>
      <div class="kpi"><span class="t-sec">${S.rol === 'local' ? 'Valor a costo' : 'Valor en tienda'}</span><span class="num-g cifras">${dinero(valor)}</span><small>${S.rol === 'local' ? 'Almacén y tienda, al costo' : 'Existencias a precio de venta'}</small></div>
    </section>
    <div class="dos-col">
      <div class="pila">
        <section class="card" aria-label="Ventas de los últimos 7 días">
          <div class="card-t"><h2 class="t-sec">Ventas · últimos 7 días</h2><button type="button" class="btn btn-s btn-g" data-act="tabla-vtas" aria-pressed="${String(S.verTabla)}">${ico(S.verTabla ? 'cubo' : 'tabla')}${S.verTabla ? 'Ver gráfica' : 'Ver tabla'}</button></div>
          <div class="graf" id="graf"></div>
        </section>
      </div>
      <div class="pila">
        <section class="card" aria-label="Lo más vendido">
          <div class="card-t"><h2 class="t-sec">Más vendido · 30 días</h2></div>
          ${r.top.length ? html`<ol class="rank">${r.top.map((t) => html`<li class="rank-i"><span class="n">${nombreProd(t.id)}</span><span class="v">${plural(t.pzas, 'pza', 'pzas')}</span><span class="b"><i style="width:${Math.max(4, Math.round(t.pzas / topMax * 100))}%"></i></span></li>`)}</ol>`
            : html`<div class="vacio" style="padding:20px 8px"><b>Sin ventas todavía</b><span>Cuando la tienda registre ventas verás aquí lo que más sale.</span></div>`}
        </section>
        <section class="card flat" aria-label="Últimos movimientos">
          <div class="card-t" style="padding:14px 16px 0;margin:0"><h2 class="t-sec">Últimos movimientos</h2><button type="button" class="btn btn-s btn-g" data-act="ir" data-tab-ir="historial">Ver todo</button></div>
          ${ops.length ? html`<ul class="lista" style="margin-top:6px">${ops.map(filaOperacion)}</ul>` : html`<div class="vacio"><b>Aún no hay movimientos</b><span>Registra una entrada, un envío o una venta y aparecerá aquí.</span></div>`}
        </section>
      </div>
    </div>`);
  dibujarGrafica();
  if (S.rol === 'local') { pintarCardCuentas(); cargarCuentas(); }
}

function filaOperacion(g) {
  const t = TIPOS[g.tipo] || { t: g.tipo, ic: 'info', c: '' };
  return html`<li><button type="button" class="item" data-act="op-det" data-grupo="${g.grupo}">
    <span class="ico-c ${g.anulado ? '' : t.c}">${ico(t.ic)}</span>
    <div class="grow"><div class="item-t ${g.anulado ? 'tachado' : ''}">${tituloOp(g)}</div><div class="item-s">${resumenOp(g)} · ${ROLES[g.rol].corto} · ${hace(g.ts)}</div></div>
    ${g.anulado ? html`<span class="pill bad">Anulada</span>` : g.total ? html`<b class="cifras" style="font:700 18px var(--f-etiqueta)">${dinero(g.total)}</b>` : ''}
  </button></li>`;
}

/* ───────── gráfica de ventas (columnas, una sola serie) ───────── */
function escalaY(max) {
  if (max <= 0) return { tope: 1000, ticks: [0, 500, 1000] };
  const p0 = max / 4, mag = Math.pow(10, Math.floor(Math.log10(p0))), f = p0 / mag;
  const paso = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const n = Math.max(2, Math.ceil(max / paso - 1e-9));
  return { tope: paso * n, ticks: Array.from({ length: n + 1 }, (_, i) => i * paso) };
}
const compactoMXN = (v) => (v >= 1000 ? '$' + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k' : '$' + Math.round(v));
const fmtDiaSemana = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });
const fmtDiaMes = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });

function dibujarGrafica() {
  const cont = $('#graf');
  if (!cont || !S.est) return;
  const dias = S.est.resumen.dias;
  const fechaDe = (k) => new Date(k + 'T12:00:00');
  const hoyK = dias[dias.length - 1].k;
  if (!dias.some((d) => d.total !== 0 || d.pzas !== 0)) {
    poner(cont, html`<div class="vacio" style="padding:26px 8px"><b>Sin ventas esta semana</b><span>La gráfica aparece en cuanto la tienda registre la primera venta.</span></div>`);
    return;
  }
  if (S.verTabla) {
    poner(cont, html`<table class="tabla"><thead><tr><th>Día</th><th class="r">Ventas</th><th class="r">Piezas</th></tr></thead><tbody>${dias.slice().reverse().map((d) => html`<tr><td>${d.k === hoyK ? 'Hoy' : mayus(fmtDiaMes.format(fechaDe(d.k)).replace(/\./g, ''))}</td><td class="r">${dinero(d.total)}</td><td class="r">${num(d.pzas)}</td></tr>`)}</tbody></table>`);
    return;
  }
  const W = Math.max(280, Math.round(cont.clientWidth || 320)), H = 210;
  const m = { t: 28, r: 8, b: 30, l: 46 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b, base = m.t + ph;
  const max = Math.max(...dias.map((d) => d.total), 0);
  const { tope, ticks } = escalaY(max);
  const slot = pw / dias.length, bw = Math.min(24, slot * 0.58);
  const iMax = dias.findIndex((d) => d.total === max && max > 0);
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Ventas de los últimos 7 días">';
  ticks.forEach((v) => {
    const y = base - (v / tope) * ph;
    svg += '<line class="gl" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text x="' + (m.l - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + esc(compactoMXN(v)) + '</text>';
  });
  dias.forEach((d, i) => {
    const cx = m.l + i * slot + slot / 2, x = cx - bw / 2;
    const h = d.total > 0 ? Math.max(3, (d.total / tope) * ph) : 0, y = base - h, r = Math.min(4, bw / 2, h);
    const esHoy = d.k === hoyK;
    const etiqueta = (esHoy ? 'Hoy' : mayus(fmtDiaMes.format(fechaDe(d.k)).replace(/\./g, ''))) + ': ' + dinero(d.total) + ', ' + plural(d.pzas, 'pieza', 'piezas');
    svg += '<g class="col" tabindex="0" role="img" aria-label="' + esc(etiqueta) + '" data-i="' + i + '"><rect class="hit" x="' + (m.l + i * slot).toFixed(1) + '" y="' + m.t + '" width="' + slot.toFixed(1) + '" height="' + (ph + m.b - 6) + '" rx="6"/>';
    if (h > 0) svg += '<path class="barra' + (esHoy ? ' hi' : '') + '" d="M' + x.toFixed(1) + ',' + base + ' V' + (y + r).toFixed(1) + ' Q' + x.toFixed(1) + ',' + y.toFixed(1) + ' ' + (x + r).toFixed(1) + ',' + y.toFixed(1) + ' H' + (x + bw - r).toFixed(1) + ' Q' + (x + bw).toFixed(1) + ',' + y.toFixed(1) + ' ' + (x + bw).toFixed(1) + ',' + (y + r).toFixed(1) + ' V' + base + ' Z"/>';
    if (h > 0 && (i === iMax || esHoy)) svg += '<text class="val" x="' + cx.toFixed(1) + '" y="' + (y - 7).toFixed(1) + '" text-anchor="middle">' + esc(compactoMXN(d.total)) + '</text>';
    svg += '<text class="' + (esHoy ? 'hoy-x' : '') + '" x="' + cx.toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle">' + esc(esHoy ? 'Hoy' : fmtDiaSemana.format(fechaDe(d.k)).replace(/\./g, '')) + '</text></g>';
  });
  svg += '</svg><div class="tip" hidden></div>';
  poner(cont, raw(svg));
  const tip = $('.tip', cont);
  const mostrar = (g) => {
    const i = +g.dataset.i, d = dias[i];
    const cx = m.l + i * slot + slot / 2;
    const h = d.total > 0 ? Math.max(3, (d.total / tope) * ph) : 0;
    tip.hidden = false;
    poner(tip, html`<b>${dinero(d.total)}</b><span>${d.k === hoyK ? 'Hoy' : mayus(fmtDiaMes.format(fechaDe(d.k)).replace(/\./g, ''))} · ${plural(d.pzas, 'pieza', 'piezas')}</span>`);
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

/* ───────── INVENTARIO ───────── */
VISTAS.inventario = {
  armar: () => html`<div data-vista="inventario">
    <div class="cabecera"><div><h1 class="t-pant">Inventario</h1><p class="t-peq" id="inv-sub" style="margin-top:8px"></p></div><div class="acciones-fab" id="inv-acc"></div></div>
    <div class="barra-filtros">
      <div class="buscar">${ico('buscar')}<input class="inp" id="inv-q" type="search" placeholder="Buscar producto, medida o tono" autocomplete="off" aria-label="Buscar producto" value="${S.filtro.q}"></div>
      <div class="chips" id="inv-chips" style="margin-top:10px"></div>
    </div>
    <div id="inv-lista" class="${S.rol === 'local' ? 'con-fab' : ''}"></div>
    ${S.rol === 'local' ? html`<button type="button" class="btn btn-p fab" data-act="agregar" aria-label="Agregar producto o crear bases">${ico('plus')}Agregar</button>` : ''}
  </div>`,
  montar() {
    $('#inv-q').addEventListener('input', (ev) => { S.filtro.q = ev.target.value; pintarListaInv(); });
  },
  actualizar() {
    const e = S.est, activos = e.productos.filter((p) => p.activo), bajos = bajosDe(S.rol).length;
    const pzL = sumar(activos, (p) => p.stock_local), pzT = sumar(activos, (p) => p.stock_tienda);
    $('#inv-sub').textContent = (S.rol !== 'tienda' ? num(pzL) + ' pzas en almacén · ' + num(pzT) + ' en tienda' : num(pzT) + ' pzas en tienda') + (bajos ? ' · ' + plural(bajos, 'con stock bajo', 'con stock bajo') : ' · todo en orden');
    poner($('#inv-acc'), S.rol === 'dueno' ? html`<button type="button" class="btn btn-g" data-act="gastos">Ver gastos</button>` : S.rol === 'local' ? html`<button type="button" class="btn btn-p" data-act="prod-nuevo">${ico('plus')}Producto</button><button type="button" class="btn btn-g" data-act="variantes">${ico('capas')}Crear bases</button><button type="button" class="btn btn-g" data-act="gasto-nuevo">${ico('salida')}Gasto</button><button type="button" class="btn btn-g" data-act="gastos">Ver gastos</button>` : html`<button type="button" class="btn btn-g" data-act="gasto-nuevo">${ico('salida')}Registrar gasto</button><button type="button" class="btn btn-g" data-act="gastos">Ver gastos</button>`);
    const chips = [['todo', 'Todo'], ['base', 'Bases'], ['material', 'Materiales'], ['accesorio', 'Accesorios']];
    poner($('#inv-chips'), html`${chips.map(([k, t]) => html`<button type="button" class="chip" data-act="filtro-cat" data-cat="${k}" aria-pressed="${String(S.filtro.cat === k)}">${t}</button>`)}<button type="button" class="chip" data-act="filtro-bajo" aria-pressed="${String(S.filtro.bajo)}">${ico('alerta')}Stock bajo${bajos ? ' (' + bajos + ')' : ''}</button>${S.rol === 'local' && e.productos.some((p) => !p.activo) ? html`<button type="button" class="chip" data-act="filtro-arch" aria-pressed="${String(S.filtro.archivados)}">Archivados</button>` : ''}`);
    pintarListaInv();
  }
};

function filaProducto(p, corto) {
  const lv = (loc) => nivel(p, loc);
  const cl = (loc) => { const v = lv(loc), st = loc === 'local' ? p.stock_local : p.stock_tienda; return v === 'agotado' ? 'agotado' : v === 'bajo' ? 'bajo' : st === 0 ? 'cero' : ''; };
  const cam = S.camino[p.id] || 0;
  const vende = S.rol === 'tienda' && p.activo;
  const stA = html`<span class="st ${cl('local')}"><b>${num(p.stock_local)}</b><i>Almacén</i></span>`;
  const stT = html`<span class="st ${cl('tienda')}"><b>${num(p.stock_tienda)}</b><i>Tienda</i></span>`;
  return html`<div class="prod ${p.activo ? '' : 'arch'}">
    <button type="button" class="prod-btn" data-act="prod" data-id="${p.id}">
      <span class="prod-ico">${iconoProd(p, 32)}</span>
      <span class="prod-main"><span class="prod-n">${corto && p.cat === 'base' && tonoDe(p.tono) ? tonoDe(p.tono).nombre : p.nombre}</span><span class="prod-s">${p.activo ? subProd(p, corto) : 'Archivado'}${cam ? html` · <span class="cam">${cam} en camino</span>` : ''}</span></span>
      <span class="stocks">${S.rol !== 'tienda' ? html`${stA}${stT}` : stT}</span>
    </button>
    ${vende ? html`<button type="button" class="btn btn-s btn-p btn-vender" data-act="vender" data-id="${p.id}" ${p.stock_tienda > 0 ? '' : 'disabled'} aria-label="Vender ${p.nombre}">Vender</button>` : ''}
  </div>`;
}

function pintarListaInv() {
  const cont = $('#inv-lista');
  if (!cont || !S.est) return;
  const F = S.filtro, q = norm(F.q);
  let lista = S.est.productos.filter((p) => (F.archivados ? true : p.activo));
  if (F.cat !== 'todo') lista = lista.filter((p) => p.cat === F.cat);
  if (F.bajo) lista = lista.filter((p) => p.activo && bajoPara(p, S.rol));
  if (q) {
    lista = lista.filter((p) => {
      const m = medidaDe(p.medida), t = tonoDe(p.tono);
      return coincide(p.nombre + ' ' + (m ? m.nombre + ' ' + m.dims : '') + ' ' + (t ? t.nombre : '') + ' ' + CATS[p.cat], q);
    });
  }
  lista.sort(ordenProductos);
  if (!lista.length) {
    poner(cont, html`<div class="vacio">${ico('buscar')}<b>${q || F.bajo ? 'Nada coincide con tu búsqueda' : 'Todavía no hay productos'}</b><span>${q || F.bajo ? 'Prueba con otra palabra o quita los filtros.' : S.rol === 'local' ? 'Agrega tu primer producto o crea las bases por medida y tono.' : 'El almacén debe dar de alta los productos.'}</span></div>`);
    return;
  }
  // las bases se agrupan por medida cuando no hay búsqueda, para ubicarlas rápido
  const grupos = [];
  const agrupado = !q;
  lista.forEach((p) => {
    const m = p.cat === 'base' ? medidaDe(p.medida) : null;
    const titulo = !q && F.cat !== 'base' && p.cat !== 'base' ? CATS[p.cat] : !q && p.cat === 'base' ? (m ? m.nombre + ' · ' + m.dims : 'Bases') : '';
    let g = grupos[grupos.length - 1];
    if (!g || g.titulo !== titulo) { g = { titulo, items: [] }; grupos.push(g); }
    g.items.push(p);
  });
  poner(cont, html`${grupos.map((g) => html`${g.titulo ? html`<h2 class="t-sec grupo-t">${g.titulo}</h2>` : ''}<div class="prods">${g.items.map((p) => filaProducto(p, agrupado && p.cat === 'base'))}</div>`)}<p class="res-n">${plural(lista.length, 'producto', 'productos')}</p>`);
}

/* ───────── MOVER ───────── */
VISTAS.mover = {
  armar: () => html`<div class="pila" data-vista="mover"><div class="cabecera"><div><h1 class="t-pant">Mover</h1><p class="t-peq" style="margin-top:8px">${S.rol === 'local' ? 'Registra lo que entra, sale y viaja a la tienda.' : 'Registra ventas, mercancía recibida y pedidos al almacén.'}</p></div></div><div id="mv-acc"></div><div id="mv-env"></div><div id="mv-ped"></div></div>`,
  actualizar() {
    const e = S.est;
    const enT = e.traspasos.filter((t) => t.estado === 'en_transito');
    const acc = S.rol === 'local'
      ? [['envio', 'camion', 'Enviar a tienda', 'Arma el envío y la tienda lo confirma', true], ['entrada', 'entrada', 'Registrar entrada', 'Producción o compra de material'], ['salida', 'salida', 'Registrar salida', 'Uso, merma u otra baja'], ['regreso', 'entrada', 'Regresar de tienda', 'Mueve piezas de la tienda al almacén'], ['gasto', 'salida', 'Registrar gasto', 'Salida de dinero: material, comida, gasolina…'], ['agenda', 'reloj', 'Pedidos de clientes', 'Agenda de entregas y pedidos por día'], ['conteo', 'conteo', 'Conteo físico', 'Ajusta el sistema a lo que contaste']]
      : [['venta', 'recibo', 'Registrar venta', 'Descuenta y suma al total del día', true], ['recibir', 'camion', 'Recibir mercancía', enT.length ? plural(enT.length, 'envío en camino', 'envíos en camino') : 'No hay envíos en camino'], ['reporte', 'tabla', 'Reporte del día', 'Total vendido, por forma de pago'], ['pedido', 'pedido', 'Pedir al almacén', 'Avisa qué bases hacen falta'], ['regreso', 'entrada', 'Regresar al almacén', 'Mueve piezas de la tienda al almacén'], ['gasto', 'salida', 'Registrar gasto', 'Salida de dinero de la tienda'], ['agenda', 'reloj', 'Pedidos de clientes', 'Agenda de entregas y pedidos por día'], ['devolucion', 'devolver', 'Devolución', 'Un cliente regresa una base'], ['merma', 'basura', 'Merma', 'Daño o pérdida en tienda'], ['conteo', 'conteo', 'Conteo físico', 'Ajusta el sistema a lo que contaste']];
    poner($('#mv-acc'), html`<div class="atajos">${acc.map(([k, ic, t, s, pri]) => html`<button type="button" class="atajo ${pri ? 'pri' : ''}" data-act="forma" data-tipo="${k}"><span class="ico-c ${pri ? '' : 'acc'}">${ico(ic)}</span><b>${t}</b><span>${s}</span></button>`)}</div>`);

    const cerr = (arr, n) => arr.filter((x) => x.estado !== 'en_transito' && x.estado !== 'pendiente').slice(0, n);
    const envios = e.traspasos.filter((t) => t.estado === 'en_transito').concat(cerr(e.traspasos, 5));
    const pedidos = e.pedidos.filter((p) => p.estado === 'pendiente').concat(cerr(e.pedidos, 5));
    poner($('#mv-env'), html`<section><h2 class="t-sec" style="margin:6px 2px 8px">Envíos del almacén a la tienda</h2>
      ${envios.length ? html`<div class="card flat"><ul class="lista">${envios.map(tarjetaEnvio)}</ul></div>` : html`<div class="card"><div class="vacio" style="padding:18px"><b>Sin envíos todavía</b><span>${S.rol === 'local' ? 'Cuando mandes bases a la tienda aparecerán aquí hasta que las confirmen.' : 'Aquí verás lo que el almacén te mande.'}</span></div></div>`}</section>`);
    poner($('#mv-ped'), html`<section><h2 class="t-sec" style="margin:6px 2px 8px">Pedidos de la tienda</h2>
      ${pedidos.length ? html`<div class="card flat"><ul class="lista">${pedidos.map(tarjetaPedido)}</ul></div>` : html`<div class="card"><div class="vacio" style="padding:18px"><b>Sin pedidos</b><span>${S.rol === 'tienda' ? 'Usa “Pedir al almacén” cuando falten bases en tienda.' : 'Cuando la tienda pida bases las verás aquí.'}</span></div></div>`}</section>`);
  }
};

const ESTADO_TRASP = { en_transito: ['En camino', 'info'], recibido: ['Recibido', 'ok'], cancelado: ['Cancelado', 'bad'] };
const ESTADO_PED = { pendiente: ['Pendiente', 'warn'], surtido: ['Surtido', 'ok'], cancelado: ['Cancelado', 'bad'] };
const resumenLineas = (ls) => plural(ls.length, 'producto', 'productos') + ' · ' + plural(sumar(ls, (l) => l.cant), 'pieza', 'piezas');
function tarjetaEnvio(t) {
  const [txt, cl] = t.estado === 'recibido' && t.dif ? ['Con diferencias', 'warn'] : ESTADO_TRASP[t.estado];
  return html`<li><button type="button" class="item" data-act="traspaso" data-id="${t.id}"><span class="ico-c ${cl === 'info' ? 'info' : cl}">${ico('camion')}</span>
    <div class="grow"><div class="item-t">${resumenLineas(t.lineas)}</div><div class="item-s">Salió ${hace(t.ts)}${t.nota ? ' · ' + t.nota : ''}</div></div>
    <span class="pill ${cl}">${txt}</span></button></li>`;
}
function tarjetaPedido(p) {
  const [txt, cl] = ESTADO_PED[p.estado];
  return html`<li><button type="button" class="item" data-act="pedido-det" data-id="${p.id}"><span class="ico-c ${cl}">${ico('pedido')}</span>
    <div class="grow"><div class="item-t">${resumenLineas(p.lineas)}</div><div class="item-s">Pedido ${hace(p.ts)}${p.nota ? ' · ' + p.nota : ''}</div></div>
    <span class="pill ${cl}">${txt}</span></button></li>`;
}

/* ───────── HISTORIAL ───────── */
const FILTROS_TIPO = [['todo', 'Todo', null], ['ventas', 'Ventas', 'venta,devolucion'], ['entradas', 'Entradas', 'entrada,inicial'], ['salidas', 'Salidas', 'salida,merma'], ['traspasos', 'Envíos', 'envio,recibo,envio_cancelado,regreso'], ['ajustes', 'Ajustes', 'ajuste']];
VISTAS.historial = {
  armar: () => html`<div data-vista="historial">
    <div class="cabecera"><div><h1 class="t-pant">Historial</h1><p class="t-peq" style="margin-top:8px">Todo lo que pasó con el inventario, con fecha y responsable.</p></div><button type="button" class="btn btn-g" data-act="exportar-movs">${ico('bajar')}Exportar CSV</button></div>
    <div class="barra-filtros">
      <div class="grid2" style="grid-template-columns:minmax(0,1fr) 150px"><div class="buscar">${ico('buscar')}<input class="inp" id="hs-q" type="search" placeholder="Buscar producto" autocomplete="off" aria-label="Buscar producto en el historial" value="${S.hist.q}"></div>
      <select class="inp" id="hs-rango" aria-label="Periodo">${[['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['todo', 'Todo']].map(([k, t]) => html`<option value="${k}" ${S.hist.rango === k ? raw('selected') : ''}>${t}</option>`)}</select></div>
      <div class="chips" id="hs-chips" style="margin-top:10px"></div>
    </div>
    <div id="hs-lista"></div>
  </div>`,
  montar() {
    let t = null;
    $('#hs-q').addEventListener('input', (ev) => { S.hist.q = ev.target.value; clearTimeout(t); t = setTimeout(() => cargarHistorial(true), 250); });
    $('#hs-rango').addEventListener('change', (ev) => { S.hist.rango = ev.target.value; cargarHistorial(true); });
    S.hist.rev = null;
  },
  actualizar() {
    poner($('#hs-chips'), html`${FILTROS_TIPO.map(([k, t]) => html`<button type="button" class="chip" data-act="hist-tipo" data-tipo="${k}" aria-pressed="${String(S.hist.tipo === k)}">${t}</button>`)}`);
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
    poner(cont, H.cargando ? html`<div class="cargando"><i></i></div>` : html`<div class="vacio">${ico('reloj')}<b>No hay movimientos con estos filtros</b><span>Cambia el periodo o el tipo para ver más.</span></div>`);
    return;
  }
  let dia = '';
  const bloques = [];
  ops.forEach((g) => {
    const d = etiquetaDia(g.ts);
    if (d !== dia) { dia = d; bloques.push(html`<h2 class="t-sec hist-dia">${d}</h2>`); }
    bloques.push(html`<div class="card flat" style="margin-bottom:8px"><ul class="lista">${filaOperacion(g)}</ul></div>`);
  });
  poner(cont, html`${bloques}${H.siguiente ? html`<div style="text-align:center;margin-top:14px"><button type="button" class="btn btn-g" data-act="hist-mas" ${H.cargando ? raw('aria-busy="true"') : ''}>Cargar más</button></div>` : ''}`);
}

/* ───────── editor de líneas: lista de productos con cantidades (y precio en ventas) ───────── */
let edN = 0;
function editorLineas(o) {
  const uid = 'ed' + (++edN);
  const L = (o.inicial || []).map((l) => Object.assign({}, l));
  const max = o.max || Core.MAX_LINEAS;
  const disp = (p) => (o.loc === 'local' ? p.stock_local : o.loc === 'tienda' ? p.stock_tienda : null);
  const el = document.createElement('div');
  poner(el, html`<div class="lin-add">
      <label class="lbl" for="${uid}-q">Agregar producto <span class="muted" data-cuenta></span></label>
      <div class="buscar">${ico('buscar')}<input class="inp" id="${uid}-q" type="search" autocomplete="off" placeholder="Busca por nombre, medida o tono" aria-controls="${uid}-r"></div>
      <ul class="lin-res" id="${uid}-r" role="listbox" hidden></ul>
    </div>
    <ul class="lin-lista" aria-live="polite"></ul>`);
  const lista = $('.lin-lista', el), q = $('#' + uid + '-q', el), res = $('#' + uid + '-r', el), zona = $('.lin-add', el);
  const subBase = (p) => {
    const d = disp(p);
    if (o.modo === 'restar') return 'Disponible: ' + num(d);
    return d != null ? 'Ahora hay: ' + num(d) : subProd(p);
  };
  function lineaHtml(l, i) {
    const p = S.idx[l.id];
    if (!p) return '';
    return html`<li class="lin" data-i="${i}">
      <span class="prod-ico">${iconoProd(p, 30)}</span>
      <div style="min-width:0"><div class="lin-n">${p.nombre}</div><div class="lin-s" data-sub>${subBase(p)}</div></div>
      <button type="button" class="icon-btn" data-quitar aria-label="Quitar ${p.nombre}">${ico('x')}</button>
      <div class="lin-ctl">
        <div class="paso"><button type="button" data-menos aria-label="Una menos">${ico('minus')}</button><input type="text" inputmode="numeric" pattern="[0-9]*" value="${l.cant}" data-cant aria-label="Cantidad de ${p.nombre}"><button type="button" data-mas aria-label="Una más">${ico('plus')}</button></div>
        ${o.precio ? html`<label class="precio"><span class="muted">$</span><input type="text" inputmode="decimal" value="${l.precio}" data-precio placeholder="0" aria-label="Precio de ${p.nombre}"></label><span class="lin-sub cifras" data-sub-total></span>` : ''}
      </div>
    </li>`;
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
    if (!L.length) poner(lista, html`<li class="t-peq" style="padding:6px 2px">${o.vacio || 'Todavía no agregas productos.'}</li>`);
    const cuenta = $('[data-cuenta]', el);
    if (cuenta) cuenta.textContent = L.length ? '· ' + L.length + ' de ' + max : '';
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
    if (L.length >= max) { res.hidden = false; poner(res, html`<li class="nada">Llegaste al máximo de ${max} productos por operación.</li>`); return; }
    const c = candidatos();
    res.hidden = false;
    poner(res, c.length ? c.slice(0, 40).map((p) => html`<li role="option"><button type="button" data-add="${p.id}"><span class="prod-ico" style="width:38px;height:38px">${iconoProd(p, 28)}</span><span class="prod-main"><span class="prod-n">${p.nombre}</span><span class="prod-s">${subBase(p)}</span></span></button></li>`)
      : html`<li class="nada">${norm(q.value) ? 'Ningún producto coincide.' : (o.sinCand || 'No hay productos disponibles.')}</li>`);
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
        if (!p) return 'Un producto ya no existe. Quítalo de la lista.';
        if (l.cant < 1) return 'Pon una cantidad en ' + nom + '.';
        if (o.modo === 'restar' && l.cant > disp(p)) return 'No alcanza ' + nom + ': solo hay ' + num(disp(p)) + '.';
        if (o.precio && !(decimal(l.precio) > 0)) return 'Falta el precio de ' + nom + '.';
      }
      return '';
    },
    agregar,
    // vuelve a poner el precio sugerido en todas las líneas (el vendedor puede cambiarlo después)
    repreciar() { L.forEach((l) => { const p = S.idx[l.id]; if (p && o.precioDe) l.precio = o.precioDe(p); }); pintarLineas(); }
  };
}

/* ───────── formularios de movimiento ───────── */
const FORMAS = {
  entrada: { titulo: 'Registrar entrada', op: 'mov.entrada', loc: 'local', modo: 'sumar', motivos: ['produccion', 'compra', 'otro'], ok: 'Guardar entrada', cand: () => true, ayuda: 'Suma al almacén lo que se fabricó o se compró.' },
  salida: { titulo: 'Registrar salida', op: 'mov.salida', loc: 'local', modo: 'restar', motivos: ['uso', 'merma', 'otro'], ok: 'Guardar salida', cand: (p) => p.stock_local > 0, ayuda: 'Resta del almacén lo que se usó o se perdió. Para mandar a la tienda usa “Enviar a tienda”.', sinCand: 'No hay productos con existencias en el almacén.' },
  venta: { titulo: 'Registrar venta', op: 'mov.venta', loc: 'tienda', modo: 'restar', precio: true, venta: true, ok: 'Registrar venta', cand: (p) => p.stock_tienda > 0, sinCand: 'No hay productos con existencias en la tienda.' },
  devolucion: { titulo: 'Devolución de cliente', op: 'mov.devolucion', loc: 'tienda', modo: 'sumar', precio: true, ok: 'Guardar devolución', cand: () => true, ayuda: 'La base regresa a la tienda y el monto se resta de las ventas.' },
  merma: { titulo: 'Merma en tienda', op: 'mov.merma', loc: 'tienda', modo: 'restar', ok: 'Guardar merma', cand: (p) => p.stock_tienda > 0, notaEt: '¿Qué pasó?', ayuda: 'Para daños o pérdidas en la tienda.', sinCand: 'No hay productos con existencias en la tienda.' },
  regreso: { titulo: 'Regresar al almacén', op: 'mov.regreso', loc: 'tienda', modo: 'restar', ok: 'Mover al almacén', cand: (p) => p.stock_tienda > 0, ayuda: 'Las piezas salen de la tienda y entran al almacén al momento.', sinCand: 'No hay productos con existencias en la tienda.' },
  envio: { titulo: 'Enviar a la tienda', op: 'traspaso.enviar', loc: 'local', modo: 'restar', ok: 'Enviar a la tienda', cand: (p) => p.stock_local > 0, ayuda: 'Las piezas salen del almacén ahora y entran a la tienda cuando alguien confirme que llegaron.', sinCand: 'No hay productos con existencias en el almacén.' },
  pedido: { titulo: 'Pedir al almacén', op: 'pedido.crear', loc: 'tienda', modo: 'sumar', ok: 'Enviar pedido', cand: () => true, ayuda: 'El almacén verá tu pedido y preparará el envío.' }
};
const ENTREGAS = [['', 'En tienda'], ['recoge', 'Recoge'], ['tepic', 'Envío Tepic'], ['xalisco', 'Xalisco'], ['cantera', 'La Cantera']];
const ENTREGA_T = { recoge: 'Recoge en tienda', tepic: 'Envío Tepic', xalisco: 'Envío Xalisco', cantera: 'Envío La Cantera' };
const waLink = (tel, texto) => 'https://wa.me/' + (tel || '') + '?text=' + encodeURIComponent(texto);
const lineasTexto = (ls) => ls.map((l) => '• ' + l.cant + ' × ' + nombreProd(l.id)).join('\n');

function abrirForma(tipo, o) {
  o = o || {};
  if (tipo === 'conteo') return abrirConteo();
  const f = FORMAS[tipo];
  if (!f) return;
  const cid = nuevoCid();
  let motivo = f.motivos ? f.motivos[0] : '', pago = 'efectivo', entrega = o.entrega || '';
  const neg = S.est.negocio;
  const tarifaDe = (e) => (e === 'tepic' ? neg.envioTepic : e === 'xalisco' || e === 'cantera' ? neg.envioFuera : 0);
  const envioMonto = () => (tarifaDe(entrega) ? decimal(($('#f-envio') || {}).value) : 0);
  // precio sugerido por base: el de lista, menos el descuento si el cliente pasa por ella
  const precioDe = (p) => (!p.precio ? '' : String(entrega === 'recoge' ? Math.max(0, p.precio - neg.descRecoge) : p.precio));
  const refrescarTotal = () => {
    const t = $('#f-total'), sub = $('#f-total-sub');
    const e = envioMonto(), base = ed ? ed.total() : 0;
    if (t) t.textContent = dinero(base + e);
    if (sub) sub.textContent = e ? 'Bases ' + dinero(base) + ' + envío ' + dinero(e) : '';
  };
  let ed = null;
  ed = editorLineas({
    modo: f.modo, loc: f.loc || S.rol, precio: f.precio, cand: f.cand, inicial: o.inicial, sinCand: f.sinCand, precioDe: f.venta ? precioDe : null,
    alCambiar: refrescarTotal
  });
  const d = dialogo({
    titulo: f.titulo,
    clase: 'ancho',
    cuerpo: html`
      ${f.ayuda ? html`<p class="t-peq" style="margin-bottom:14px">${f.ayuda}</p>` : ''}
      ${tipo === 'pedido' && bajosDe('tienda').length ? html`<div class="aviso warn" style="margin-bottom:14px;align-items:center">${ico('alerta')}<span class="grow">${plural(bajosDe('tienda').length, 'producto está bajo', 'productos están bajos')} en la tienda.</span><button type="button" class="btn btn-s btn-g" id="f-bajos">Agregarlos</button></div>` : ''}
      ${f.motivos ? html`<div class="campo"><span class="lbl">Motivo</span><div class="opciones" id="f-motivos">${f.motivos.map((m) => html`<button type="button" class="opcion" data-motivo="${m}" aria-pressed="${String(m === motivo)}">${MOTIVOS[m]}</button>`)}</div></div>` : ''}
      <div id="f-ed"></div>
      ${f.precio ? html`<div class="total-b"><span>Total</span><b id="f-total">${dinero(0)}</b></div><p class="t-peq" id="f-total-sub" style="margin:-6px 0 14px"></p>` : ''}
      ${f.venta ? html`<div class="campo"><span class="lbl">Entrega</span><div class="opciones" id="f-entrega">${ENTREGAS.map(([k, t]) => html`<button type="button" class="opcion" data-entrega="${k}" aria-pressed="${String(k === entrega)}" style="padding:0 12px">${t}</button>`)}</div><p class="t-peq" id="f-entrega-ayuda" style="margin-top:8px"></p></div>
        <label class="campo" id="f-envio-campo" hidden><span class="lbl">Cobro de envío</span><span class="precio" style="max-width:160px"><span class="muted">$</span><input id="f-envio" type="text" inputmode="decimal" value="" aria-label="Cobro de envío"></span></label>
        <label class="campo"><span class="lbl">Cliente (opcional)</span><input class="inp" id="f-cliente" maxlength="60" placeholder="Nombre o referencia" autocomplete="off" value="${o.cliente || ''}"></label>
        <div class="campo"><span class="lbl">Forma de pago</span><div class="opciones g4" id="f-pagos">${Object.keys(PAGOS).map((k) => html`<button type="button" class="opcion" data-pago="${k}" aria-pressed="${String(k === pago)}" style="padding:0 6px">${PAGOS[k]}</button>`)}</div></div>` : ''}
      <label class="campo"><span class="lbl">${f.notaEt || 'Nota (opcional)'}</span><textarea class="inp" id="f-nota" rows="2" maxlength="200" placeholder="${tipo === 'envio' ? 'Ej. sale en la camioneta de las 4' : 'Escribe algo que ayude a recordar'}">${o.nota || ''}</textarea></label>
      <p class="err" id="f-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="f-ok">${f.ok}</button>`
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
    if (ay) ay.textContent = v === 'recoge' ? 'Descuento de ' + dinero(neg.descRecoge) + ' por base ya aplicado en el precio. Puedes cambiar el precio de cada una.' : t ? 'Se suma el envío a la cuenta. Puedes cambiar el monto.' : '';
    ed.repreciar();
    refrescarTotal();
  });
  if (entrega && tarifaDe(entrega)) { const campo = $('#f-envio-campo', d.el); if (campo) { campo.hidden = false; $('#f-envio', d.el).value = String(tarifaDe(entrega)); } refrescarTotal(); }
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
    if (o.alExito) o.alExito(res);
  }));
  return d;
}

async function deshacerOp(grupo) {
  try { await op({ op: 'mov.anular', grupo, motivo: 'Deshecho al momento' }); toast('Operación deshecha.'); } catch (e) { toast(e.message, { tipo: 'error' }); }
}
function exitoForma(tipo, res, cuerpo) {
  const e = S.est.negocio;
  const deshacer = res.grupo ? { texto: 'Deshacer', fn: () => deshacerOp(res.grupo) } : null;
  if (tipo === 'venta') toast('Venta registrada · ' + dinero(res.total), { accion: deshacer });
  else if (tipo === 'devolucion') toast('Devolución guardada · ' + dinero(res.total), { accion: deshacer });
  else if (tipo === 'entrada' || tipo === 'salida' || tipo === 'merma') toast('Guardado · ' + plural(res.piezas, 'pieza', 'piezas'), { accion: deshacer });
  else if (tipo === 'regreso') toast('Movido al almacén · ' + plural(res.piezas, 'pieza', 'piezas'), { accion: deshacer });
  else if (tipo === 'envio') {
    const texto = 'Bases Box Tepic · Envío a la tienda\n' + lineasTexto(cuerpo.lineas) + '\nTotal: ' + plural(res.piezas, 'pieza', 'piezas') + '.\nConfírmalo en el inventario cuando llegue.';
    toast('Envío creado · ' + plural(res.piezas, 'pieza', 'piezas') + ' en camino', { accion: { texto: 'Avisar por WhatsApp', href: waLink(e.telTienda, texto) } });
  } else if (tipo === 'pedido') {
    const texto = 'Bases Box Tepic · Pedido de la tienda\n' + lineasTexto(cuerpo.lineas) + (cuerpo.nota ? '\nNota: ' + cuerpo.nota : '') + '\nRevísalo en el inventario.';
    toast('Pedido enviado al almacén', { accion: { texto: 'Avisar por WhatsApp', href: waLink(e.telLocal, texto) } });
  }
}

/* ───────── reporte de ventas: hoy, semana y mes ───────── */
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
    cuerpo: html`<div class="vt-seg" id="vt-seg" role="group" aria-label="Periodo"></div><div id="vt-cont"><p class="t-peq">Cargando…</p></div>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="vt-csv" disabled>Descargar CSV</button>`,
    enfocar: false
  });
  const pintar = () => {
    poner($('#vt-seg', d.el), html`${PERIODOS.map(([k, t]) => html`<button type="button" class="chip" data-per="${k}" aria-pressed="${String(per === k)}">${t}</button>`)}`);
    const v = datos && datos[per];
    if (!v) return;
    const vacio = !v.dias.length;
    poner($('#vt-cont', d.el), html`
      <p class="t-peq" style="margin-bottom:10px">${etiquetaPeriodo(per, v)}</p>
      ${S.rol !== 'tienda' ? html`<div class="acciones-fab" style="margin-bottom:14px"><button type="button" class="btn btn-s btn-p" data-act="pdf-semana" data-sem="0">${ico('bajar')}PDF semanal con gráficas</button><button type="button" class="btn btn-s btn-g" data-act="pdf-semana" data-sem="1">Semana pasada</button></div>` : ''}
      <div class="total-b"><span>Vendido</span><b>${dinero(v.total)}</b></div>
      <p class="t-peq" style="margin:-6px 0 14px">${plural(v.n, 'venta', 'ventas')} · ${plural(v.pzas, 'pieza', 'piezas')}</p>
      ${vacio ? html`<div class="vacio" style="padding:18px 8px"><b>Sin ventas en este periodo</b><span>Cuando la tienda registre ventas aparecerán aquí.</span></div>` : html`
        <h3 class="t-sec">Por producto</h3>
        <div class="vt-lista">${v.productos.map((t) => html`<div class="vt-fila"><span class="n">${nombreProd(t.id)}</span><span class="v">${dinero(t.total)}</span><small>${plural(t.pzas, 'pieza', 'piezas')}</small></div>`)}</div>
        ${per === 'hoy' ? '' : html`<h3 class="t-sec">Por día</h3>
        <div class="vt-lista">${v.dias.map((x) => html`<div class="vt-fila"><span class="n">${mayus(fmtDiaCorto.format(fechaDeKey(x.k)).replace('.', ''))}</span><span class="v">${dinero(x.total)}</span><small>${plural(x.n, 'venta', 'ventas')} · ${plural(x.pzas, 'pieza', 'piezas')}</small></div>`)}</div>`}`}`);
    $('#vt-csv', d.el).disabled = vacio;
  };
  $('#vt-seg', d.el).addEventListener('click', (ev) => { const b = ev.target.closest('[data-per]'); if (b) { per = b.dataset.per; pintar(); } });
  $('#vt-csv', d.el).addEventListener('click', () => {
    const v = datos[per], nombre = PERIODOS.find((x) => x[0] === per)[1];
    const filas = [['Periodo', 'Tipo', 'Detalle', 'Ventas', 'Piezas', 'Total'], [nombre, 'Total', etiquetaPeriodo(per, v), v.n, v.pzas, v.total]];
    v.dias.slice().reverse().forEach((x) => filas.push([nombre, 'Día', x.k, x.n, x.pzas, x.total]));
    v.productos.forEach((t) => filas.push([nombre, 'Producto', nombreProd(t.id), '', t.pzas, t.total]));
    descargar('ventas-' + per + '-bases-box-' + fechaArchivo() + '.csv', aCsv(filas), 'text/csv;charset=utf-8');
  });
  pintar();
  const cargar = async () => {
    try {
      const r = await llamar('GET', '/ventas');
      if (!r.json.ok) throw new ErrorApi(r.json.error);
      datos = r.json.ventas;
      pintar();
    } catch (e) {
      poner($('#vt-cont', d.el), html`<p class="err">${e.message || 'No se pudo cargar el reporte.'}</p>`);
    }
  };
  enVivo(d, cargar);
  await cargar();
}

/* ───────── revisión de cuentas: ¿está todo claro? ───────── */
async function cargarCuentas(forzar) {
  if (!S.est || (S.rol !== 'local' && S.rol !== 'dueno')) return;
  if (!forzar && S.cuentasTs && Date.now() - S.cuentasTs < 8000) return;
  S.cuentasTs = Date.now();
  try {
    const r = await llamar('GET', '/cuentas');
    if (!r.json.ok) return;
    S.cuentas = r.json;
    pintarCardCuentas();
    if (!S.avisoCuentas) { S.avisoCuentas = true; if (r.json.estado === 'error') setTimeout(mostrarAvisoCuentas, 600); }
  } catch (e) { /* sin red: se queda lo último que se vio */ }
}
const CU_TXT = { claras: ['Cuentas claras', 'ok'], revisar: ['Hay cosas por revisar', 'warn'], error: ['Hay un error en las cuentas', 'bad'] };
function pintarCardCuentas() {
  const el = $('#card-cuentas');
  if (!el) return;
  const c = S.cuentas;
  const [t, cl] = c ? CU_TXT[c.estado] : ['Revisando las cuentas…', 'info'];
  const n = c ? c.hallazgos.length : 0, errores = c ? c.hallazgos.filter((h) => h.nivel === 'error').length : 0;
  poner(el, html`<button type="button" class="gastos-b cuentas-b ${c ? c.estado : ''}" data-act="cuentas" aria-label="Revisar cuentas">
    <span class="ico-c ${cl}">${ico(c && c.estado !== 'claras' ? 'alerta' : 'check')}</span>
    <span class="grow"><b>${t}</b><small>${!c ? 'Un momento' : c.estado === 'claras' ? 'Todo cuadra con los registros de esta semana' : errores ? plural(errores, 'error', 'errores') + (n > errores ? ' y ' + plural(n - errores, 'aviso', 'avisos') : '') + ' · toca para ver' : plural(n, 'aviso', 'avisos') + ' · toca para ver'}</small></span>
  </button>`);
}
function textoCuentas(c) {
  const L = [S.est.negocio.nombre + ' · Revisión de cuentas', c.desde + ' al ' + c.hasta, ''];
  L.push(c.estado === 'claras' ? 'CUENTAS CLARAS' : c.estado === 'error' ? 'HAY UN ERROR EN LAS CUENTAS' : 'HAY COSAS POR REVISAR', '');
  L.push('Efectivo esperado en caja: ' + dinero(c.efectivo.esperado) + (c.efectivo.contado !== null ? ' · contado ' + dinero(c.efectivo.contado) : ''));
  L.push('Tarjeta + transferencias: ' + dinero(c.digital.sistema) + (c.digital.reportado !== null ? ' · reportado ' + dinero(c.digital.reportado) : ''), '');
  c.hallazgos.forEach((h) => L.push((h.nivel === 'error' ? 'ERROR: ' : 'Aviso: ') + h.titulo + ' — ' + h.detalle));
  return L.join('\n');
}
function mostrarAvisoCuentas() {
  const c = S.cuentas;
  if (!c || c.estado !== 'error' || $('dialog.sheet[open]')) return;
  const errores = c.hallazgos.filter((h) => h.nivel === 'error');
  const d = dialogo({
    titulo: 'Hay un error en las cuentas',
    cuerpo: html`<div class="aviso warn" style="margin-bottom:12px">${ico('alerta')}<span class="grow">La revisión automática encontró ${plural(errores.length, 'error', 'errores')}. Conviene revisarlo antes de cerrar la semana.</span></div>${errores.map((h) => html`<div class="cu-h error"><b>${h.titulo}</b><span>${h.detalle}</span></div>`)}`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Después</button><button type="button" class="btn btn-p" id="cu-ver">Ver detalle</button>`,
    enfocar: false
  });
  $('#cu-ver', d.el).addEventListener('click', () => { d.cerrar(); abrirCuentas(); });
}
async function abrirCuentas() {
  const hoy = hoyK();
  const lunes = (() => { const dd = new Date(hoy + 'T12:00:00'); return sumaK(hoy, -((dd.getDay() + 6) % 7)); })();
  let desde = lunes, hasta = hoy, datos = null, err = '';
  const d = dialogo({
    titulo: 'Revisar cuentas',
    clase: 'ancho',
    cuerpo: html`<div class="vt-seg" id="cu-seg" role="group" aria-label="Periodo"></div><div id="cu-cont"><p class="t-peq">Revisando…</p></div>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="cu-wa" hidden>${ico('mensaje')}Enviar aviso por WhatsApp</button>`,
    enfocar: false
  });
  const cargar = async () => {
    const q = { desde, hasta };
    const ec = $('#cu-contado', d.el), ed = $('#cu-digital', d.el);
    if (ec && ec.value.trim()) q.contado = decimal(ec.value);
    if (ed && ed.value.trim()) q.digital = decimal(ed.value);
    err = '';
    try { const r = await llamar('GET', '/cuentas', null, q); if (!r.json.ok) throw new ErrorApi(r.json.error); datos = r.json; } catch (e) { err = e.message || 'No se pudo revisar.'; }
    pintar(ec ? ec.value : '', ed ? ed.value : '');
    if (datos && !err) { S.cuentas = datos.desde === lunes && !('contado' in q) && !('digital' in q) ? datos : S.cuentas; pintarCardCuentas(); }
  };
  const pintar = (vc, vd) => {
    poner($('#cu-seg', d.el), html`<button type="button" class="chip" data-cp="hoy" aria-pressed="${String(desde === hoy)}">Hoy</button><button type="button" class="chip" data-cp="semana" aria-pressed="${String(desde === lunes && hasta === hoy)}">Esta semana</button><button type="button" class="chip" data-cp="mes" aria-pressed="${String(desde === hoy.slice(0, 7) + '-01')}">Este mes</button>`);
    const wa = $('#cu-wa', d.el);
    if (err) { poner($('#cu-cont', d.el), html`<p class="err">${err}</p>`); if (wa) wa.hidden = true; return; }
    const c = datos, [t, cl] = CU_TXT[c.estado];
    if (wa) wa.hidden = c.estado === 'claras';
    poner($('#cu-cont', d.el), html`
      <div class="cu-banner ${c.estado}"><span class="ico-c ${cl}" style="width:44px;height:44px">${ico(c.estado === 'claras' ? 'check' : 'alerta')}</span><div><b>${c.estado === 'claras' ? 'Las cuentas están claras' : t}</b><span>${c.estado === 'claras' ? 'No encontré errores en los registros de este periodo.' : c.hallazgos.filter((h) => h.nivel === 'error').length ? 'Hay al menos un error que conviene corregir.' : 'No hay errores, pero hay cosas que conviene revisar.'}</span></div></div>
      <div class="campo" style="margin-top:14px"><span class="lbl">Desde</span><input class="inp" type="date" id="cu-desde" value="${desde}" max="${hoy}" min="${sumaK(hoy, -35)}" style="max-width:200px" aria-label="Desde"></div>
      <h3 class="t-sec" style="margin-top:6px">Efectivo en caja</h3>
      <div class="vt-lista"><div class="vt-fila"><span class="n">Vendido en efectivo</span><span class="v">${dinero(c.efectivo.vendido)}</span></div><div class="vt-fila"><span class="n">Gastos pagados en efectivo</span><span class="v">-${dinero(c.efectivo.gastos)}</span></div><div class="vt-fila"><span class="n"><b>Debe haber en caja</b></span><span class="v">${dinero(c.efectivo.esperado)}</span></div>${c.efectivo.diferencia !== null ? html`<div class="vt-fila"><span class="n">Diferencia contra lo contado</span><span class="v ${Math.abs(c.efectivo.diferencia) > 0.009 ? 'mal' : 'bien'}">${c.efectivo.diferencia > 0 ? '+' : ''}${dinero(c.efectivo.diferencia)}</span></div>` : ''}</div>
      <label class="campo"><span class="lbl">¿Cuánto efectivo contaste en la caja? (opcional)</span><span class="precio" style="max-width:220px"><span class="muted">$</span><input id="cu-contado" type="text" inputmode="decimal" placeholder="0" value="${vc || ''}" aria-label="Efectivo contado"></span></label>
      <h3 class="t-sec" style="margin-top:6px">Tarjeta, link y transferencias</h3>
      <div class="vt-lista"><div class="vt-fila"><span class="n">Tarjeta / link de pago</span><span class="v">${dinero(c.digital.tarjeta)}</span></div><div class="vt-fila"><span class="n">Transferencias</span><span class="v">${dinero(c.digital.transferencia)}</span></div><div class="vt-fila"><span class="n"><b>Total según el sistema</b></span><span class="v">${dinero(c.digital.sistema)}</span></div>${c.digital.diferencia !== null ? html`<div class="vt-fila"><span class="n">Diferencia contra lo reportado</span><span class="v ${Math.abs(c.digital.diferencia) > 0.009 ? 'mal' : 'bien'}">${c.digital.diferencia > 0 ? '+' : ''}${dinero(c.digital.diferencia)}</span></div>` : ''}</div>
      <label class="campo"><span class="lbl">¿Cuánto entró en banco y Mercado Pago? (opcional)</span><span class="precio" style="max-width:220px"><span class="muted">$</span><input id="cu-digital" type="text" inputmode="decimal" placeholder="0" value="${vd || ''}" aria-label="Cobros digitales reportados"></span></label>
      <div style="margin-bottom:14px"><button type="button" class="btn btn-s btn-p" id="cu-comprobar">Comprobar</button></div>
      <h3 class="t-sec">${c.hallazgos.length ? 'Lo que encontré' : 'Revisiones hechas'}</h3>
      ${c.hallazgos.length ? html`<div>${c.hallazgos.map((h) => html`<div class="cu-h ${h.nivel}"><b>${h.nivel === 'error' ? 'Error · ' : 'Aviso · '}${h.titulo}</b><span>${h.detalle}</span></div>`)}</div>`
        : html`<ul class="cu-ok"><li>El efectivo esperado no es negativo</li><li>Las existencias coinciden con todos los movimientos</li><li>No hay ventas sin precio ni repetidas</li><li>No hay devoluciones sin venta</li><li>No hay envíos viejos sin confirmar ni pedidos atrasados</li></ul>`}`);
  };
  d.el.addEventListener('click', (ev) => {
    const p = ev.target.closest('[data-cp]');
    if (p) { desde = p.dataset.cp === 'hoy' ? hoy : p.dataset.cp === 'mes' ? hoy.slice(0, 7) + '-01' : lunes; hasta = hoy; cargar(); return; }
    if (ev.target.closest('#cu-comprobar')) { const x = $('#cu-desde', d.el); if (x && x.value) desde = x.value; cargar(); }
  });
  d.el.addEventListener('change', (ev) => { if (ev.target.id === 'cu-desde' && ev.target.value) { desde = ev.target.value; cargar(); } });
  d.el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('#cu-contado, #cu-digital')) cargar(); });
  $('#cu-wa', d.el).addEventListener('click', () => { if (datos) window.open(waLink('', textoCuentas(datos)), '_blank', 'noopener'); });
  enVivo(d, cargar);
  await cargar();
  return d;
}

/* ───────── agenda: pedidos de clientes ───────── */
const AG_EST = { pendiente: ['Pendiente', 'warn'], listo: ['Listo', 'ok'], entregado: ['Entregado', 'info'], cancelado: ['Cancelado', 'bad'] };
const AG_ENT = { '': 'Entrega sin definir', recoge: 'Recoge en tienda', tepic: 'Envío Tepic', xalisco: 'Envío Xalisco', cantera: 'Envío La Cantera' };
const hoyK = () => (S.est && S.est.hoy) || fechaArchivo();
const sumaK = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fmtDiaAg = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDiaAgLargo = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtMesAg = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });
const etiquetaDiaAg = (k) => { const h = hoyK(); return k === h ? 'Hoy' : k === sumaK(h, 1) ? 'Mañana' : k === sumaK(h, -1) ? 'Ayer' : mayus(fmtDiaAg.format(fechaDeKey(k)).replace(/\./g, '')); };
const resumenPedido = (a) => (a.lineas.length ? a.lineas.map((l) => l.cant + ' × ' + nombreProd(l.id).replace(/^Base /, '')).join(', ') : '') + (a.detalle ? (a.lineas.length ? ' · ' : '') + a.detalle : '');
const totalPedido = (a) => a.lineas.reduce((t, l) => t + l.cant * (l.precio || 0), 0);
function conteoAgenda() {
  const h = hoyK(), m = sumaK(h, 1), fin = sumaK(h, 7);
  const ab = (S.est && S.est.agenda) || [];
  return { atrasados: ab.filter((a) => a.dia < h), hoy: ab.filter((a) => a.dia === h), manana: ab.filter((a) => a.dia === m), semana: ab.filter((a) => a.dia > m && a.dia <= fin), total: ab.length };
}
function tarjetaAgenda() {
  const c = conteoAgenda();
  const urg = c.atrasados.length + c.hoy.length;
  const partes = [];
  if (c.atrasados.length) partes.push(c.atrasados.length + ' atrasado' + (c.atrasados.length === 1 ? '' : 's'));
  partes.push('Hoy ' + c.hoy.length, 'Mañana ' + c.manana.length, 'Próx. 7 días ' + c.semana.length);
  return html`<button type="button" class="gastos-b agenda-b ${urg ? 'urgente' : ''}" data-act="agenda" aria-label="Ver pedidos de clientes">
    <span class="ico-c ${urg ? 'bad' : 'info'}">${ico('reloj')}</span>
    <span class="grow"><b>Pedidos de clientes</b><small>${c.total ? partes.join(' · ') : 'Sin pedidos programados'}</small></span>
    ${S.rol === 'dueno' ? '' : html`<span class="gastos-mas">${ico('plus')}</span>`}
  </button>`;
}
// aviso al entrar: lo que hay que tener hecho hoy, mañana o ya se pasó
function mostrarAvisoAgenda() {
  const c = conteoAgenda();
  const lista = [['Atrasados', c.atrasados, 'bad'], ['Hoy', c.hoy, 'warn'], ['Mañana', c.manana, 'info']].filter((x) => x[1].length);
  if (!lista.length || $('dialog.sheet[open]')) return;
  const d = dialogo({
    titulo: 'Pedidos de clientes',
    cuerpo: html`<p class="t-peq" style="margin-bottom:12px">${c.atrasados.length ? 'Hay pedidos que ya se pasaron de fecha. ' : ''}Esto es lo que hay que tener listo y entregar.</p>
      ${lista.map(([t, arr, cl]) => html`<h3 class="t-sec" style="margin-top:10px">${t} · ${arr.length}</h3><div class="vt-lista">${arr.map((a) => html`<div class="vt-fila"><span class="n">${a.hora ? a.hora + ' · ' : ''}${a.cliente}${cl === 'bad' ? html` <span class="pill bad">${etiquetaDiaAg(a.dia)}</span>` : ''}</span><span class="v"><span class="pill ${AG_EST[a.estado][1]}">${AG_EST[a.estado][0]}</span></span><small>${resumenPedido(a)} · ${AG_ENT[a.entrega]}</small></div>`)}</div>`)}`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Entendido</button><button type="button" class="btn btn-p" id="av-ver">Ver agenda</button>`,
    enfocar: false
  });
  $('#av-ver', d.el).addEventListener('click', () => { d.cerrar(); abrirAgenda(); });
}

async function abrirAgenda(inicial) {
  let vista = (inicial && inicial.vista) || 'proximos', mes = hoyK().slice(0, 7), sel = hoyK(), cerrados = false, datos = [];
  const puede = S.rol !== 'dueno';
  const d = dialogo({
    titulo: 'Pedidos de clientes',
    clase: 'ancho',
    cuerpo: html`<div class="vt-seg" id="ag-seg" role="group" aria-label="Vista"></div><div id="ag-cont"><p class="t-peq">Cargando…</p></div>`,
    pie: puede ? html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="ag-nuevo">${ico('plus')}Nuevo pedido</button>` : html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>`,
    enfocar: false
  });
  const rango = () => {
    if (vista === 'calendario') { const [y, m] = mes.split('-').map(Number); const ini = mes + '-01', fin = y + '-' + String(m).padStart(2, '0') + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0'); return [ini, fin]; }
    return [sumaK(hoyK(), -35), sumaK(hoyK(), 60)];
  };
  const filaPedido = (a) => html`<button type="button" class="ag-item ${a.estado}" data-pedido="${a.id}">
      <span class="ag-hora">${a.hora || '—'}</span>
      <span class="ag-main"><b>${a.cliente}</b><small>${resumenPedido(a) || 'Sin detalle'}</small><small>${AG_ENT[a.entrega]}${a.direccion ? ' · ' + a.direccion : ''}${a.anticipo ? ' · anticipo ' + dinero(a.anticipo) : ''}${totalPedido(a) ? ' · total ' + dinero(totalPedido(a)) : ''}</small></span>
      <span class="pill ${AG_EST[a.estado][1]}">${AG_EST[a.estado][0]}</span></button>`;
  const visibles = () => datos.filter((a) => cerrados || a.estado === 'pendiente' || a.estado === 'listo');
  const pintarProximos = () => {
    const h = hoyK(), v = visibles();
    const grupos = [];
    const atras = v.filter((a) => a.dia < h && (a.estado === 'pendiente' || a.estado === 'listo'));
    if (atras.length) grupos.push(['Atrasados (ya pasó la fecha)', atras, true]);
    const dias = [...new Set(v.filter((a) => a.dia >= h).map((a) => a.dia))].sort();
    dias.forEach((k) => grupos.push([etiquetaDiaAg(k) + (k === h || k === sumaK(h, 1) ? ' · ' + mayus(fmtDiaAg.format(fechaDeKey(k)).replace(/\./g, '')) : ''), v.filter((a) => a.dia === k), false]));
    if (cerrados) { const pas = v.filter((a) => a.dia < h && !(a.estado === 'pendiente' || a.estado === 'listo')); if (pas.length) grupos.push(['Anteriores (entregados / cancelados)', pas, false]); }
    return grupos.length ? html`${grupos.map(([t, arr, mal]) => html`<h3 class="t-sec ${mal ? 'ag-mal' : ''}" style="margin:14px 0 6px">${t} · ${arr.length}</h3><div class="ag-lista">${arr.map(filaPedido)}</div>`)}`
      : html`<div class="vacio" style="padding:22px 8px"><b>No hay pedidos programados</b><span>${puede ? 'Toca “Nuevo pedido” para apuntar uno, aunque sea de ayer.' : 'Cuando se apunte un pedido aparecerá aquí.'}</span></div>`;
  };
  const pintarCalendario = () => {
    const [y, m] = mes.split('-').map(Number);
    const primero = new Date(y, m - 1, 1), dow = (primero.getDay() + 6) % 7, dias = new Date(y, m, 0).getDate();
    const celdas = [];
    for (let i = 0; i < dow; i++) celdas.push(null);
    for (let n = 1; n <= dias; n++) celdas.push(mes + '-' + String(n).padStart(2, '0'));
    const porDia = {};
    visibles().forEach((a) => { (porDia[a.dia] || (porDia[a.dia] = [])).push(a); });
    const h = hoyK();
    const delDia = (porDia[sel] || []);
    return html`<div class="cal-nav"><button type="button" class="icon-btn" data-mes="-1" aria-label="Mes anterior">${ico('der', 'izq')}</button><b>${mayus(fmtMesAg.format(primero))}</b><button type="button" class="icon-btn" data-mes="1" aria-label="Mes siguiente">${ico('der')}</button></div>
      <div class="cal"><span class="cal-h">L</span><span class="cal-h">M</span><span class="cal-h">M</span><span class="cal-h">J</span><span class="cal-h">V</span><span class="cal-h">S</span><span class="cal-h">D</span>
      ${celdas.map((k) => (k ? html`<button type="button" class="cal-d ${k === h ? 'hoy' : ''} ${k === sel ? 'sel' : ''} ${porDia[k] ? 'con' : ''}" data-dia="${k}" aria-label="${mayus(fmtDiaAgLargo.format(fechaDeKey(k)))}${porDia[k] ? ', ' + porDia[k].length + ' pedidos' : ''}"><span>${Number(k.slice(8))}</span>${porDia[k] ? html`<i class="cal-n ${porDia[k].some((a) => a.estado === 'pendiente' && k <= h) ? 'urg' : ''}">${porDia[k].length}</i>` : ''}</button>` : html`<span></span>`))}</div>
      <h3 class="t-sec" style="margin:16px 0 6px">${mayus(fmtDiaAgLargo.format(fechaDeKey(sel)))} · ${delDia.length}</h3>
      ${delDia.length ? html`<div class="ag-lista">${delDia.map(filaPedido)}</div>` : html`<p class="t-peq">Sin pedidos este día.</p>`}
      ${puede ? html`<div style="margin-top:12px"><button type="button" class="btn btn-s btn-g" id="ag-nuevo-dia">${ico('plus')}Pedido para este día</button></div>` : ''}`;
  };
  const pintar = () => {
    poner($('#ag-seg', d.el), html`<button type="button" class="chip" data-vista="proximos" aria-pressed="${String(vista === 'proximos')}">Próximos</button><button type="button" class="chip" data-vista="calendario" aria-pressed="${String(vista === 'calendario')}">Calendario</button><button type="button" class="chip" data-cerrados="1" aria-pressed="${String(cerrados)}">Entregados</button>`);
    poner($('#ag-cont', d.el), vista === 'calendario' ? pintarCalendario() : pintarProximos());
    const nd = $('#ag-nuevo-dia', d.el);
    if (nd) nd.addEventListener('click', () => formPedidoCliente(null, sel, cargar));
  };
  const cargar = async () => {
    try {
      const [desde, hasta] = rango();
      const r = await llamar('GET', '/agenda', null, { desde, hasta });
      if (!r.json.ok) throw new ErrorApi(r.json.error);
      // los abiertos más viejos que el rango también cuentan como atrasados
      const extra = ((S.est && S.est.agenda) || []).filter((a) => a.dia < desde && vista === 'proximos');
      datos = [...extra, ...r.json.items.filter((a) => !extra.some((x) => x.id === a.id))];
      pintar();
    } catch (e) { poner($('#ag-cont', d.el), html`<p class="err">${e.message || 'No se pudo cargar la agenda.'}</p>`); }
  };
  d.el.addEventListener('click', (ev) => {
    const v = ev.target.closest('[data-vista]'), c = ev.target.closest('[data-cerrados]'), m = ev.target.closest('[data-mes]'), k = ev.target.closest('[data-dia]'), p = ev.target.closest('[data-pedido]');
    if (v) { vista = v.dataset.vista; cargar(); } else if (c) { cerrados = !cerrados; pintar(); } else if (m) {
      const [y, mm] = mes.split('-').map(Number); const nd = new Date(y, mm - 1 + Number(m.dataset.mes), 1); mes = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0'); sel = mes + '-01'; cargar();
    } else if (k) { sel = k.dataset.dia; pintar(); } else if (p) { const a = datos.find((x) => x.id === p.dataset.pedido); if (a) abrirPedidoCliente(a, cargar); }
  });
  const nuevo = $('#ag-nuevo', d.el);
  if (nuevo) nuevo.addEventListener('click', () => formPedidoCliente(null, vista === 'calendario' ? sel : sumaK(hoyK(), 1), cargar));
  enVivo(d, cargar);
  pintar();
  await cargar();
  return d;
}

function abrirPedidoCliente(a, alCambiar) {
  const puede = S.rol !== 'dueno', abierto = a.estado === 'pendiente' || a.estado === 'listo';
  const tot = totalPedido(a);
  const d = dialogo({
    titulo: a.cliente,
    cuerpo: html`<div class="sep" style="margin-bottom:12px"><span class="t-peq">${mayus(fmtDiaAgLargo.format(fechaDeKey(a.dia)))}${a.hora ? ' · ' + a.hora : ''}</span><span class="pill ${AG_EST[a.estado][1]}">${AG_EST[a.estado][0]}</span></div>
      ${a.lineas.length ? html`<div class="card flat" style="margin-bottom:14px"><ul class="lista">${a.lineas.map((l) => html`<li class="item" style="min-height:48px"><span class="prod-ico" style="width:36px;height:36px">${S.idx[l.id] ? iconoProd(S.idx[l.id], 26) : ''}</span><div class="grow"><div class="item-t">${nombreProd(l.id)}</div><div class="item-s">${dinero(l.precio)} c/u</div></div><b class="cifras">× ${l.cant}</b></li>`)}</ul></div>` : ''}
      <dl class="kv">
        ${a.detalle ? html`<dt>Detalle</dt><dd>${a.detalle}</dd>` : ''}
        <dt>Entrega</dt><dd>${AG_ENT[a.entrega]}${a.direccion ? ' · ' + a.direccion : ''}</dd>
        ${a.tel ? html`<dt>Teléfono</dt><dd><a href="tel:${a.tel}">${a.tel}</a> · <a href="${waLink(a.tel.length === 10 ? '52' + a.tel : a.tel, 'Hola ' + a.cliente + ', te escribimos de ' + S.est.negocio.nombre + ' sobre tu pedido.')}" target="_blank" rel="noopener">WhatsApp</a></dd>` : ''}
        ${tot ? html`<dt>Total estimado</dt><dd>${dinero(tot)}</dd>` : ''}
        ${a.anticipo ? html`<dt>Anticipo</dt><dd>${dinero(a.anticipo)}${tot ? ' · saldo ' + dinero(Math.max(0, tot - a.anticipo)) : ''}</dd>` : ''}
        ${a.nota ? html`<dt>Nota</dt><dd>${a.nota}</dd>` : ''}
        <dt>Apuntó</dt><dd>${ROLES[a.rol] ? ROLES[a.rol].nombre : a.rol} · ${hace(a.ts)}</dd>
        ${a.estado === 'entregado' || a.estado === 'cancelado' ? html`<dt>${AG_EST[a.estado][0]}</dt><dd>${hace(a.estado_ts)}${a.estado_nota ? ' · ' + a.estado_nota : ''}</dd>` : ''}
      </dl>`,
    pie: !puede ? html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>`
      : abierto ? html`<button type="button" class="btn btn-g" id="pc-cerrar-p" data-cerrar>Cerrar</button><button type="button" class="btn btn-g" id="pc-editar">${ico('editar')}Editar</button>${a.estado === 'pendiente' ? html`<button type="button" class="btn btn-g" id="pc-listo">Marcar listo</button>` : ''}<button type="button" class="btn btn-p" id="pc-entregar">${S.rol === 'tienda' && a.lineas.length ? 'Entregar y cobrar' : 'Marcar entregado'}</button>`
        : S.rol === 'local' ? html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="pc-reabrir">Reabrir</button>` : html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>`
  });
  const ir = (sel, fn) => { const b = $(sel, d.el); if (b) b.addEventListener('click', fn); };
  const cambiar = async (estado, extra) => { await op(Object.assign({ op: 'agenda.estado', id: a.id, estado }, extra)); if (alCambiar) alCambiar(); };
  ir('#pc-editar', () => { d.cerrar(); formPedidoCliente(a, null, alCambiar); });
  ir('#pc-listo', async () => { try { await cambiar('listo'); d.cerrar(); toast('Marcado como listo.'); } catch (e) { toast(e.message, { tipo: 'error' }); } });
  ir('#pc-reabrir', async () => { try { await cambiar('pendiente'); d.cerrar(); toast('Pedido reabierto.'); } catch (e) { toast(e.message, { tipo: 'error' }); } });
  ir('#pc-entregar', async () => {
    d.cerrar();
    if (S.rol === 'tienda' && a.lineas.length) {
      abrirForma('venta', {
        inicial: a.lineas.map((l) => ({ id: l.id, cant: l.cant, precio: l.precio ? String(l.precio) : '' })), cliente: a.cliente, entrega: a.entrega === 'recoge' || a.entrega === 'tepic' || a.entrega === 'xalisco' || a.entrega === 'cantera' ? a.entrega : '',
        nota: 'Pedido de cliente' + (a.anticipo ? ' · anticipo ' + dinero(a.anticipo) : ''),
        alExito: async (res) => { try { await cambiar('entregado', { venta: res.grupo }); } catch (e) { toast(e.message, { tipo: 'error' }); } }
      });
    } else { try { await cambiar('entregado'); toast('Marcado como entregado.'); } catch (e) { toast(e.message, { tipo: 'error' }); } }
  });
  const cancelar = $('#pc-cerrar-p', d.el);
  if (cancelar && puede && abierto) {
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'btn btn-s btn-g'; c.style.cssText = 'color:var(--bad);margin-right:auto'; c.textContent = 'Cancelar pedido';
    cancelar.replaceWith(c);
    c.addEventListener('click', async () => {
      const motivo = await confirmar({ titulo: 'Cancelar pedido', texto: a.cliente + ' · ' + mayus(fmtDiaAg.format(fechaDeKey(a.dia))) + '. Queda marcado como cancelado en la agenda.', ok: 'Cancelar pedido', cancelar: 'Volver', peligro: true, campo: { etiqueta: 'Motivo', min: 3, ayuda: 'Ej. el cliente ya no lo quiere' } });
      if (!motivo) return;
      try { await cambiar('cancelado', { nota: motivo }); d.cerrar(); toast('Pedido cancelado.'); } catch (e) { toast(e.message, { tipo: 'error' }); }
    });
  }
}

function formPedidoCliente(a, diaInicial, alGuardar) {
  const edit = !!a, cid = nuevoCid();
  const h = hoyK();
  let entrega = a ? a.entrega : '';
  const ed = editorLineas({
    modo: 'sumar', loc: null, precio: true, cand: () => true, inicial: a ? a.lineas.map((l) => ({ id: l.id, cant: l.cant, precio: l.precio ? String(l.precio) : '' })) : [], vacio: 'Agrega las bases del pedido (o escribe el detalle abajo).',
    alCambiar: () => { const t = $('#pc-total'); if (t) t.textContent = ed ? dinero(ed.total()) : ''; }
  });
  const sab = (() => { const dd = new Date(h + 'T12:00:00'); const falta = (6 - dd.getDay() + 7) % 7; return sumaK(h, falta === 0 ? 7 : falta); })();
  const d = dialogo({
    titulo: edit ? 'Editar pedido' : 'Nuevo pedido de cliente',
    clase: 'ancho',
    cuerpo: html`<label class="campo"><span class="lbl">Cliente</span><input class="inp" id="pc-cliente" maxlength="60" autocomplete="off" placeholder="Nombre o referencia" value="${a ? a.cliente : ''}"></label>
      <label class="campo"><span class="lbl">Teléfono (opcional)</span><input class="inp" id="pc-tel" inputmode="tel" maxlength="20" autocomplete="off" placeholder="311 123 4567" value="${a ? a.tel : ''}"></label>
      <div class="campo"><span class="lbl">¿Para qué día?</span>
        <div class="opciones" id="pc-atajos" style="margin-bottom:8px"><button type="button" class="opcion" data-atajo="${h}" style="padding:0 14px">Hoy</button><button type="button" class="opcion" data-atajo="${sumaK(h, 1)}" style="padding:0 14px">Mañana</button><button type="button" class="opcion" data-atajo="${sab}" style="padding:0 14px">Sábado</button></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><input class="inp" type="date" id="pc-dia" value="${a ? a.dia : diaInicial || sumaK(h, 1)}" min="${sumaK(h, -35)}" max="${sumaK(h, 190)}" style="max-width:200px" aria-label="Día de entrega"><input class="inp" type="time" id="pc-hora" value="${a ? a.hora : ''}" style="max-width:140px" aria-label="Hora (opcional)"></div>
        <span class="ayuda">Puedes elegir un día pasado si no alcanzaron a apuntarlo. La hora es opcional.</span></div>
      <div id="pc-ed"></div>
      <div class="total-b"><span>Total estimado</span><b id="pc-total">${dinero(0)}</b></div>
      <label class="campo"><span class="lbl">Detalle (si no está en el catálogo)</span><textarea class="inp" id="pc-detalle" rows="2" maxlength="200" placeholder="Ej. 5 matrimoniales negras con cabecera">${a ? a.detalle : ''}</textarea></label>
      <div class="campo"><span class="lbl">Entrega</span><div class="opciones" id="pc-entrega">${[['', 'Sin definir'], ['recoge', 'Recoge'], ['tepic', 'Envío Tepic'], ['xalisco', 'Xalisco'], ['cantera', 'La Cantera']].map(([k, t]) => html`<button type="button" class="opcion" data-entrega="${k}" aria-pressed="${String(k === entrega)}" style="padding:0 12px">${t}</button>`)}</div></div>
      <label class="campo"><span class="lbl">Dirección o referencia (opcional)</span><input class="inp" id="pc-dir" maxlength="120" autocomplete="off" value="${a ? a.direccion : ''}"></label>
      <label class="campo" style="max-width:220px"><span class="lbl">Anticipo (opcional)</span><span class="precio"><span class="muted">$</span><input id="pc-anticipo" type="text" inputmode="decimal" placeholder="0" value="${a && a.anticipo ? a.anticipo : ''}" aria-label="Anticipo"></span></label>
      <label class="campo"><span class="lbl">Nota (opcional)</span><textarea class="inp" id="pc-nota" rows="2" maxlength="200">${a ? a.nota : ''}</textarea></label>
      <p class="err" id="pc-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="pc-ok">${edit ? 'Guardar cambios' : 'Guardar pedido'}</button>`
  });
  $('#pc-ed', d.el).appendChild(ed.el);
  $('#pc-total', d.el).textContent = dinero(ed.total());
  $('#pc-atajos', d.el).addEventListener('click', (ev) => { const b = ev.target.closest('[data-atajo]'); if (b) $('#pc-dia', d.el).value = b.dataset.atajo; });
  $('#pc-entrega', d.el).addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-entrega]');
    if (!b) return;
    entrega = b.dataset.entrega;
    $$('#pc-entrega button', d.el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });
  const btn = $('#pc-ok', d.el), err = $('#pc-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    const cliente = $('#pc-cliente', d.el).value.trim(), dia = $('#pc-dia', d.el).value, detalle = $('#pc-detalle', d.el).value.trim();
    if (!cliente) throw new ErrorApi({ mensaje: 'Escribe el nombre del cliente.' });
    if (!dia) throw new ErrorApi({ mensaje: 'Elige para qué día es el pedido.' });
    const ls = ed.lineas();
    if (!ls.length && !detalle) throw new ErrorApi({ mensaje: 'Agrega las bases del pedido o escribe el detalle.' });
    if (ls.some((l) => !(l.cant >= 1))) throw new ErrorApi({ mensaje: 'Pon la cantidad de cada producto.' });
    const cuerpo = { op: edit ? 'agenda.editar' : 'agenda.crear', cliente, tel: $('#pc-tel', d.el).value, dia, hora: $('#pc-hora', d.el).value, lineas: ls.map((l) => ({ id: l.id, cant: l.cant, precio: l.precio || 0 })), detalle, entrega, direccion: $('#pc-dir', d.el).value.trim(), anticipo: decimal($('#pc-anticipo', d.el).value), nota: $('#pc-nota', d.el).value.trim() };
    if (edit) cuerpo.id = a.id; else cuerpo.cid = cid;
    await op(cuerpo);
    d.cerrar();
    toast('Pedido guardado para ' + etiquetaDiaAg(dia).toLowerCase() + '.');
    if (alGuardar) alGuardar();
  }));
  return d;
}

/* ───────── resumen del negocio (Dueño; el Almacén también lo puede abrir) ───────── */
async function cargarResumen() {
  const r = await llamar('GET', '/resumen');
  if (!r.json.ok) throw new ErrorApi(r.json.error);
  return r.json;
}
const fmtDiaCorto2 = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric' });
function htmlResumen(d, per) {
  const p = d.periodos[per], v = p.ventas, g = p.gastos, pr = p.produccion, inv = d.inventario;
  const maxDia = Math.max(1, ...d.dias.map((x) => Math.max(x.ventas, x.gastos)));
  const pagos = Object.keys(v.porPago).sort((a, b) => v.porPago[b] - v.porPago[a]);
  const cats = Object.keys(g.porCat).sort((a, b) => g.porCat[b] - g.porCat[a]);
  return html`
    <section class="res-hero ${p.resultado < 0 ? 'neg' : ''}" aria-label="Resultado"><small>Resultado del periodo</small><b class="cifras">${dinero(p.resultado)}</b><span>Vendido ${dinero(v.bruto)} − egresos ${dinero(p.egresos)}</span></section>
    <div class="grid-kpi">
      <div class="kpi"><span class="t-sec">Ventas</span><span class="num-g cifras">${dinero(v.bruto)}</span><small>${plural(v.n, 'venta', 'ventas')} · ${plural(v.pzas, 'pieza', 'piezas')}${v.envios ? ' · envíos ' + dinero(v.envios) : ''}</small></div>
      <div class="kpi"><span class="t-sec">Gastos</span><span class="num-g cifras">${dinero(g.total)}</span><small>${plural(g.n, 'gasto', 'gastos')}</small></div>
      <div class="kpi"><span class="t-sec">Egresos</span><span class="num-g cifras">${dinero(p.egresos)}</span><small>Gastos + devoluciones ${dinero(v.devuelto)}</small></div>
      <div class="kpi"><span class="t-sec">Producción</span><span class="num-g cifras">${num(pr.pzas)}</span><small>${pr.pzas === 1 ? 'pieza' : 'piezas'} · costo ${dinero(pr.costo)}${pr.compras ? ' · compras ' + num(pr.compras) + ' pzas (' + dinero(pr.comprasCosto) + ')' : ''}</small></div>
    </div>
    <div class="acciones-fab" aria-label="Reporte en PDF"><button type="button" class="btn btn-p" data-act="pdf-semana" data-sem="0">${ico('bajar')}PDF de esta semana</button><button type="button" class="btn btn-g" data-act="pdf-semana" data-sem="1">PDF de la semana pasada</button></div>
    ${pagos.length ? html`<section class="card" aria-label="Ventas por forma de pago"><h2 class="t-sec">Ventas por forma de pago</h2><div class="vt-lista">${pagos.map((k) => html`<div class="vt-fila"><span class="n">${PAGOS[k] || k}</span><span class="v">${dinero(v.porPago[k])}</span></div>`)}</div></section>` : ''}
    ${cats.length ? html`<section class="card" aria-label="Gastos por categoría"><h2 class="t-sec">Gastos por categoría</h2><div class="vt-lista">${cats.map((c) => html`<div class="vt-fila"><span class="n">${GASTO_CATS[c] || c}</span><span class="v">${dinero(g.porCat[c])}</span></div>`)}</div></section>` : ''}
    ${pr.porProducto.length ? html`<section class="card" aria-label="Producción"><h2 class="t-sec">Producción por producto</h2><div class="vt-lista">${pr.porProducto.map((x) => html`<div class="vt-fila"><span class="n">${nombreProd(x.id)}</span><span class="v">${plural(x.pzas, 'pza', 'pzas')}</span></div>`)}</div></section>` : ''}
    <section class="card" aria-label="Ventas contra gastos, 7 días"><h2 class="t-sec">Últimos 7 días · ventas y gastos</h2>
      <div class="dias7">${d.dias.map((x) => html`<div class="dia7"><span class="n">${mayus(fmtDiaCorto2.format(fechaDeKey(x.k)).replace('.', ''))}</span><span class="b2 area-b1"><i class="ven" style="width:${Math.round(Math.max(0, x.ventas) / maxDia * 100)}%"></i></span><span class="v area-v1">${dinero(x.ventas)}</span><span class="b2 area-b2"><i class="gas" style="width:${Math.round(x.gastos / maxDia * 100)}%"></i></span><span class="v mal area-v2">${x.gastos ? '-' : ''}${dinero(x.gastos)}</span></div>`)}</div>
      <p class="t-peq" style="margin-top:8px"><i class="pt ven"></i> Ventas &nbsp; <i class="pt gas"></i> Gastos</p></section>
    <section class="card" aria-label="Inventario"><h2 class="t-sec">Inventario hoy</h2>
      <dl class="kv"><dt>En el almacén</dt><dd>${plural(inv.pzasAlmacen, 'pieza', 'piezas')}</dd><dt>En la tienda</dt><dd>${plural(inv.pzasTienda, 'pieza', 'piezas')}</dd><dt>En camino</dt><dd>${plural(inv.pzasCamino, 'pieza', 'piezas')}${inv.enviosEnCamino ? ' (' + plural(inv.enviosEnCamino, 'envío', 'envíos') + ')' : ''}</dd>
      <dt>Valor a costo</dt><dd>${dinero(inv.valorCosto)}</dd><dt>Valor a precio de venta</dt><dd>${dinero(inv.valorVenta)}</dd>
      <dt>Con stock bajo</dt><dd>${inv.bajos}</dd><dt>Pedidos por surtir</dt><dd>${inv.pedidosPendientes}</dd></dl></section>
    ${d.top.length ? html`<section class="card" aria-label="Lo más vendido"><h2 class="t-sec">Más vendido del mes</h2><div class="vt-lista">${d.top.map((x) => html`<div class="vt-fila"><span class="n">${nombreProd(x.id)}</span><span class="v">${dinero(x.total)}</span><small>${plural(x.pzas, 'pieza', 'piezas')}</small></div>`)}</div></section>` : ''}
    <p class="t-peq" style="margin:4px 2px 0">Resultado = lo vendido (con envíos) menos gastos y devoluciones. Los costos de producción ya cuentan como gastos cuando se registran (materiales, sueldos…), por eso aquí se muestran solo como dato.</p>`;
}
const chipsPeriodo = (per) => html`<div class="vt-seg" role="group" aria-label="Periodo">${PERIODOS.map(([k, t]) => html`<button type="button" class="chip" data-res-per="${k}" aria-pressed="${String(per === k)}">${t}</button>`)}</div>`;
async function pintarResumenDueno() {
  const cont = $('#v-inicio');
  if (!cont) return;
  const hoy = new Date();
  if (!$('#res-cont', cont)) {
    poner(cont, html`
      <div class="cabecera"><div><h1 class="t-pant">Resumen</h1><p class="t-peq" style="margin-top:8px">${mayus(fmtDiaLargo.format(hoy))} · ${S.est.negocio.nombre}</p></div></div>
      <div id="card-cuentas"></div>
      ${tarjetaAgenda()}
      <div id="res-seg"></div>
      <div class="pila" id="res-cont"><p class="t-peq">Cargando…</p></div>
      <div class="acciones-fab"><button type="button" class="btn btn-g" data-act="ventas">Ver ventas</button><button type="button" class="btn btn-g" data-act="gastos">Ver gastos</button></div>`);
    cont.addEventListener('click', (ev) => { const b = ev.target.closest('[data-res-per]'); if (b) { S.perRes = b.dataset.resPer; pintarResumenDueno(); } });
  }
  const per = S.perRes || 'hoy';
  pintarCardCuentas(); cargarCuentas();
  poner($('#res-seg', cont), chipsPeriodo(per));
  if (S.resumenDueno) poner($('#res-cont', cont), htmlResumen(S.resumenDueno, per));
  try {
    const nuevo = await cargarResumen();
    S.resumenDueno = nuevo;
    if ($('#res-cont')) poner($('#res-cont'), htmlResumen(nuevo, S.perRes || 'hoy'));
  } catch (e) {
    if (!S.resumenDueno && $('#res-cont')) poner($('#res-cont'), html`<p class="err">${e.message || 'No se pudo cargar el resumen.'}</p>`);
  }
}
async function abrirResumen() {
  let per = 'hoy', datos = null;
  const d = dialogo({
    titulo: 'Resumen del negocio',
    clase: 'ancho',
    cuerpo: html`<div id="rs-seg"></div><div class="pila" id="rs-cont"><p class="t-peq">Cargando…</p></div>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>`,
    enfocar: false
  });
  const pintar = () => {
    poner($('#rs-seg', d.el), chipsPeriodo(per));
    if (datos) poner($('#rs-cont', d.el), htmlResumen(datos, per));
  };
  d.el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-res-per]'); if (b) { per = b.dataset.resPer; pintar(); } });
  const cargar = async () => {
    try { datos = await cargarResumen(); pintar(); } catch (e) { poner($('#rs-cont', d.el), html`<p class="err">${e.message || 'No se pudo cargar.'}</p>`); }
  };
  pintar();
  enVivo(d, cargar);
  await cargar();
}

/* ───────── PDF semanal: ventas, gastos, sueldos, producción y cómo quedó el inventario ───────── */
const COL_PDF = { tinta: [26, 26, 26], gris: [107, 114, 128], linea: [222, 220, 214], fondo: [244, 242, 237], acento: [241, 90, 34], ven: [55, 65, 81], gas: [180, 35, 24], ok: [31, 122, 77], blanco: [255, 255, 255] };
function pdfSemanal(d) {
  const neg = S.est.negocio.nombre;
  const fk = (k) => fechaDeKey(k);
  const fLargo = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const fDia = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric' });
  const fCorta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
  const rango = 'Semana del ' + fLargo.format(fk(d.desde)).replace(/\./g, '') + ' al ' + fLargo.format(fk(d.hasta)).replace(/\./g, '');
  const P = new BBPdf.Doc({ titulo: neg + ' · Resumen semanal · ' + d.desde });
  const L = 40, R = P.w - 40, ANCHO = R - L;
  let y = 0;
  const pie = () => { P.line(L, P.h - 34, R, P.h - 34, { color: COL_PDF.linea }); P.text(L, P.h - 20, neg + ' · Resumen semanal · ' + rango, { size: 8, color: COL_PDF.gris }); P.text(R, P.h - 20, 'Página ' + P.numPaginas, { size: 8, color: COL_PDF.gris, align: 'right' }); };
  const pagina = (titulo) => {
    P.page(); pie();
    if (titulo) { P.rect(0, 0, P.w, 44, { fill: COL_PDF.tinta }); P.text(L, 28, titulo, { size: 14, bold: true, color: COL_PDF.blanco }); P.text(R, 28, rango, { size: 9, color: [210, 210, 210], align: 'right' }); y = 66; }
  };
  const asegura = (alto, titulo) => { if (y + alto > P.h - 50) pagina(titulo || neg + ' · Resumen semanal (continuación)'); };
  const titulo = (t, espacio) => { asegura(espacio || 40); P.text(L, y, t.toUpperCase(), { size: 10, bold: true, color: COL_PDF.gris }); P.line(L, y + 5, R, y + 5, { color: COL_PDF.linea }); y += 22; };
  const corto = (n) => (Math.abs(n) >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(Math.round(n)));

  // ── portada
  P.page(); pie();
  P.rect(0, 0, P.w, 96, { fill: COL_PDF.tinta });
  P.rect(0, 96, P.w, 4, { fill: COL_PDF.acento });
  P.text(L, 44, neg.toUpperCase(), { size: 11, bold: true, color: COL_PDF.acento });
  P.text(L, 70, 'Resumen semanal', { size: 24, bold: true, color: COL_PDF.blanco });
  P.text(L, 88, rango + (d.sem === 0 ? ' (en curso)' : ''), { size: 10, color: [210, 210, 210] });
  P.text(R, 70, 'Generado ' + new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d.ahora)), { size: 8, color: [190, 190, 190], align: 'right' });
  y = 124;
  // tarjetas
  const tarjetas = [
    ['VENDIDO', dinero(d.ventas.bruto), plural(d.ventas.n, 'venta', 'ventas') + ' · ' + plural(d.ventas.pzas, 'pieza', 'piezas'), COL_PDF.tinta],
    ['EGRESOS', dinero(d.egresos), 'Gastos ' + dinero(d.gastos.total) + ' + devol. ' + dinero(d.ventas.devuelto), COL_PDF.gas],
    ['RESULTADO', dinero(d.resultado), 'Vendido − egresos', d.resultado < 0 ? COL_PDF.gas : COL_PDF.ok],
    ['PRODUCCIÓN', num(d.produccion.pzas) + ' pzas', 'Costo ' + dinero(d.produccion.costo), COL_PDF.tinta]
  ];
  const tw = (ANCHO - 3 * 10) / 4;
  tarjetas.forEach(([et, val, sub, col], i) => {
    const x = L + i * (tw + 10);
    P.rect(x, y, tw, 62, { fill: COL_PDF.fondo });
    P.rect(x, y, 3, 62, { fill: col });
    P.text(x + 12, y + 17, et, { size: 7.5, bold: true, color: COL_PDF.gris });
    P.text(x + 12, y + 38, P.ajustar(val, 15, true, tw - 18), { size: 15, bold: true, color: col });
    P.text(x + 12, y + 53, P.ajustar(sub, 7, false, tw - 18), { size: 7, color: COL_PDF.gris });
  });
  y += 82;
  P.text(L, y, 'Sueldos pagados: ' + dinero(d.sueldosTotal) + '   ·   Envíos cobrados: ' + dinero(d.ventas.envios) + '   ·   Compras de material: ' + num(d.produccion.compras) + ' pzas', { size: 9, color: COL_PDF.tinta });
  y += 28;

  // ── gráfica 1: ventas y gastos por día (barras agrupadas)
  titulo('Ventas y gastos por día');
  const gx = L + 6, gw = ANCHO - 12, gh = 120, base = y + gh;
  const max = Math.max(1, ...d.dias.map((x) => Math.max(x.ventas, x.gastos)));
  [0, 0.5, 1].forEach((f) => { const yy = base - gh * f; P.line(gx, yy, gx + gw, yy, { color: COL_PDF.linea, lw: 0.5 }); P.text(gx - 3, yy + 3, corto(max * f), { size: 6.5, color: COL_PDF.gris, align: 'right' }); });
  const paso = gw / 7, bw = Math.min(26, paso / 2 - 4);
  d.dias.forEach((x, i) => {
    const cx = gx + paso * i + paso / 2;
    const hv = Math.max(0, x.ventas) / max * gh, hg = x.gastos / max * gh;
    if (hv > 0) P.rect(cx - bw - 1, base - hv, bw, hv, { fill: COL_PDF.ven });
    if (hg > 0) P.rect(cx + 1, base - hg, bw, hg, { fill: COL_PDF.gas });
    if (x.ventas > 0) P.text(cx - bw / 2 - 1, base - hv - 3, corto(x.ventas), { size: 6.5, color: COL_PDF.ven, align: 'center' });
    if (x.gastos > 0) P.text(cx + bw / 2 + 1, base - hg - 3, corto(x.gastos), { size: 6.5, color: COL_PDF.gas, align: 'center' });
    P.text(cx, base + 12, mayus(fDia.format(fk(x.k)).replace('.', '')), { size: 8, color: COL_PDF.tinta, align: 'center' });
  });
  P.rect(L + 6, base + 26, 8, 8, { fill: COL_PDF.ven }); P.text(L + 18, base + 33, 'Ventas', { size: 8, color: COL_PDF.tinta });
  P.rect(L + 66, base + 26, 8, 8, { fill: COL_PDF.gas }); P.text(L + 78, base + 33, 'Gastos', { size: 8, color: COL_PDF.tinta });
  y = base + 56;

  // ── barras horizontales (categorías de gasto y formas de pago)
  const barras = (tit, pares, col) => {
    titulo(tit);
    if (!pares.length) { P.text(L, y, 'Sin movimientos esta semana.', { size: 9, color: COL_PDF.gris }); y += 22; return; }
    const m = Math.max(...pares.map((x) => x[1])), lw = 150, aw = ANCHO - lw - 80;
    pares.forEach(([nom, val]) => {
      asegura(20);
      P.text(L, y + 8, P.ajustar(nom, 9, false, lw - 6), { size: 9, color: COL_PDF.tinta });
      P.rect(L + lw, y, aw, 11, { fill: COL_PDF.fondo });
      P.rect(L + lw, y, Math.max(1, aw * val / m), 11, { fill: col });
      P.text(R, y + 9, dinero(val), { size: 9, bold: true, color: COL_PDF.tinta, align: 'right' });
      y += 18;
    });
    y += 16;
  };
  barras('Gastos por categoría', Object.keys(d.gastos.porCat).sort((a, b) => d.gastos.porCat[b] - d.gastos.porCat[a]).map((c) => [GASTO_CATS[c] || c, d.gastos.porCat[c]]), COL_PDF.gas);
  barras('Ventas por forma de pago', Object.keys(d.ventas.porPago).sort((a, b) => d.ventas.porPago[b] - d.ventas.porPago[a]).map((c) => [PAGOS[c] || c, d.ventas.porPago[c]]), COL_PDF.ven);

  // ── tablas
  const tabla = (cols, filas, opc) => {
    opc = opc || {};
    const cabecera = () => { P.rect(L, y - 11, ANCHO, 17, { fill: COL_PDF.fondo }); cols.forEach((c) => P.text(c.align === 'right' ? c.x + c.w : c.x, y + 1, c.t, { size: 8, bold: true, color: COL_PDF.gris, align: c.align })); y += 18; };
    asegura(70); cabecera();
    filas.forEach((f, i) => {
      if (y + 16 > P.h - 50) { pagina(neg + ' · Resumen semanal (continuación)'); cabecera(); }
      if (i % 2) P.rect(L, y - 10, ANCHO, 15, { fill: [250, 249, 246] });
      cols.forEach((c, j) => P.text(c.align === 'right' ? c.x + c.w : c.x, y + 1, P.ajustar(f[j], 8.5, false, c.w - 4), { size: 8.5, color: COL_PDF.tinta, align: c.align }));
      y += 15;
    });
    if (opc.total) { asegura(24); P.line(L, y - 8, R, y - 8, { color: COL_PDF.tinta, lw: 1 }); P.text(L, y + 5, opc.total[0], { size: 9.5, bold: true, color: COL_PDF.tinta }); P.text(R, y + 5, opc.total[1], { size: 9.5, bold: true, color: COL_PDF.tinta, align: 'right' }); y += 22; }
    y += 6;
  };
  const fh = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const filaGasto = (g) => [mayus(fh.format(new Date(g.ts)).replace(/\./g, '')), GASTO_CATS[g.cat] || g.cat, g.concepto || '', PAGOS[g.pago] || '', ROLES[g.rol] ? ROLES[g.rol].corto : '', dinero(g.monto)];
  const colsG = [{ t: 'Fecha', x: L, w: 78 }, { t: 'Categoría', x: L + 80, w: 100 }, { t: 'Concepto', x: L + 182, w: 140 }, { t: 'Pago', x: L + 324, w: 70 }, { t: 'Registró', x: L + 396, w: 50 }, { t: 'Monto', x: R - 66, w: 66, align: 'right' }];

  pagina(neg + ' · Sueldos, gastos y producción');
  titulo('Sueldos pagados', 110);
  if (d.sueldos.length) tabla(colsG, d.sueldos.map(filaGasto), { total: ['Total de sueldos de la semana', dinero(d.sueldosTotal)] });
  else { P.text(L, y, 'No se registraron sueldos esta semana.', { size: 9.5, color: COL_PDF.gris }); y += 28; }
  titulo('Detalle de todos los gastos', 110);
  if (d.listaGastos.length) tabla(colsG, d.listaGastos.map(filaGasto), { total: ['Total de gastos (incluye sueldos)', dinero(d.gastos.total)] });
  else { P.text(L, y, 'No se registraron gastos esta semana.', { size: 9.5, color: COL_PDF.gris }); y += 28; }

  titulo('Producción de la semana', 110);
  if (d.produccion.porProducto.length) tabla([{ t: 'Producto', x: L, w: 330 }, { t: 'Piezas', x: R - 80, w: 80, align: 'right' }], d.produccion.porProducto.map((x) => [nombreProd(x.id), num(x.pzas)]), { total: ['Total producido · costo ' + dinero(d.produccion.costo), plural(d.produccion.pzas, 'pieza', 'piezas')] });
  else { P.text(L, y, 'No se registró producción esta semana.', { size: 9.5, color: COL_PDF.gris }); y += 28; }
  if (d.produccion.compras) { P.text(L, y, 'Compras de material: ' + plural(d.produccion.compras, 'pieza', 'piezas') + ' · ' + dinero(d.produccion.comprasCosto), { size: 9, color: COL_PDF.tinta }); y += 22; }

  titulo('Lo más vendido', 110);
  if (d.masVendido.length) tabla([{ t: 'Producto', x: L, w: 300 }, { t: 'Piezas', x: R - 150, w: 60, align: 'right' }, { t: 'Vendido', x: R - 80, w: 80, align: 'right' }], d.masVendido.map((x) => [nombreProd(x.id), num(x.pzas), dinero(x.total)]));
  else { P.text(L, y, 'No hubo ventas esta semana.', { size: 9.5, color: COL_PDF.gris }); y += 28; }

  titulo('Cómo quedó el inventario (al generar este reporte)', 170);
  const inv = d.inventario;
  [['En el almacén', plural(inv.pzasAlmacen, 'pieza', 'piezas')], ['En la tienda', plural(inv.pzasTienda, 'pieza', 'piezas')], ['En camino', plural(inv.pzasCamino, 'pieza', 'piezas')], ['Valor a costo', dinero(inv.valorCosto)], ['Valor a precio de venta', dinero(inv.valorVenta)], ['Productos con stock bajo', String(inv.bajos)], ['Pedidos por surtir', String(inv.pedidosPendientes)]].forEach(([k, v]) => {
    asegura(18); P.text(L, y, k, { size: 9.5, color: COL_PDF.gris }); P.text(L + 200, y, v, { size: 9.5, bold: true, color: COL_PDF.tinta }); y += 17;
  });
  y += 10; asegura(50);
  P.text(L, y, 'Resultado = lo vendido (con envíos) menos gastos (incluye sueldos) y devoluciones. La producción se muestra a costo solo como dato:', { size: 7.5, color: COL_PDF.gris });
  P.text(L, y + 11, 'el material y los sueldos ya cuentan como gastos cuando se registran, por eso no se restan dos veces.', { size: 7.5, color: COL_PDF.gris });
  return P.bytes();
}
async function descargarPdfSemanal(sem, btn) {
  if (btn) btn.setAttribute('aria-busy', 'true');
  try {
    const r = await llamar('GET', '/reporte-semana', null, { sem: sem || 0 });
    if (!r.json.ok) throw new ErrorApi(r.json.error);
    await descargar('resumen-semanal-bases-box-' + r.json.desde + '.pdf', pdfSemanal(r.json), 'application/pdf');
  } catch (e) { toast(e.message || 'No se pudo armar el PDF.', { tipo: 'error' }); } finally { if (btn) btn.removeAttribute('aria-busy'); }
}

/* ───────── gastos (salidas de dinero) ───────── */
const GASTO_CATS = { materiales: 'Materiales', sueldos: 'Sueldos', renta: 'Renta', servicios: 'Luz, agua, internet', transporte: 'Gasolina y transporte', comida: 'Comida', mantenimiento: 'Mantenimiento', publicidad: 'Publicidad', comisiones: 'Comisiones (Mercado Pago, banco)', retiro: 'Retiro del dueño', otro: 'Otro' };
const fechaLocal = (ts) => fechaISO(ts).slice(0, 10);
function enPeriodo(ts, per) {
  const hoy = new Date(), k = fechaLocal(ts), kh = fechaLocal(hoy.getTime());
  if (per === 'hoy') return k === kh;
  if (per === 'mes') return k.slice(0, 7) === kh.slice(0, 7);
  const dow = (hoy.getDay() + 6) % 7, lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dow);
  return k >= fechaLocal(lunes.getTime()) && k <= kh;
}
// una hoja abierta se vuelve a cargar sola cuando llegan cambios hechos por el otro usuario
function enVivo(d, fn) {
  const h = () => { if (d.el.isConnected) fn(); };
  document.addEventListener('bb:estado', h);
  d.el.addEventListener('close', () => document.removeEventListener('bb:estado', h));
}
async function abrirGastos(inicial) {
  let per = inicial || 'hoy', datos = null;
  const d = dialogo({
    titulo: 'Gastos',
    clase: 'ancho',
    cuerpo: html`<div class="vt-seg" id="gs-seg" role="group" aria-label="Periodo"></div><div id="gs-cont"><p class="t-peq">Cargando…</p></div>`,
    pie: S.rol === 'dueno' ? html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>` : html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="gs-nuevo">${ico('plus')}Registrar gasto</button>`,
    enfocar: false
  });
  const pintar = () => {
    poner($('#gs-seg', d.el), html`${PERIODOS.map(([k, t]) => html`<button type="button" class="chip" data-per="${k}" aria-pressed="${String(per === k)}">${t}</button>`)}`);
    if (!datos) return;
    const res = datos.resumen[per];
    const items = datos.items.filter((g) => enPeriodo(g.ts, per));
    const cats = Object.keys(res.porCat).sort((a, b) => res.porCat[b] - res.porCat[a]);
    poner($('#gs-cont', d.el), html`
      <div class="total-b"><span>Gastado</span><b>${dinero(res.total)}</b></div>
      <p class="t-peq" style="margin:-6px 0 14px">${plural(res.n, 'gasto', 'gastos')}</p>
      ${cats.length ? html`<h3 class="t-sec">Por categoría</h3><div class="vt-lista">${cats.map((c) => html`<div class="vt-fila"><span class="n">${GASTO_CATS[c] || c}</span><span class="v">${dinero(res.porCat[c])}</span></div>`)}</div>` : ''}
      ${items.length ? html`<h3 class="t-sec">Detalle</h3><div class="vt-lista">${items.map((g) => html`<button type="button" class="vt-fila gs-fila ${g.anulado ? 'anulado' : ''}" data-gasto="${g.id}"><span class="n">${per === 'hoy' ? fmtHora.format(g.ts) : mayus(fmtDiaCorto.format(new Date(g.ts)).replace('.', '')) + ' ' + fmtHora.format(g.ts)} · ${GASTO_CATS[g.cat] || g.cat}</span><span class="v">${g.anulado ? '' : '-'}${dinero(g.monto)}</span><small>${g.concepto || ''}${g.concepto ? ' · ' : ''}${PAGOS[g.pago] || ''}${S.rol === 'local' ? ' · ' + ROLES[g.rol].corto : ''}${g.anulado ? ' · ANULADO: ' + g.anulado_nota : ''}</small></button>`)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-s btn-g" id="gs-csv">Descargar CSV</button></div>`
        : html`<div class="vacio" style="padding:18px 8px"><b>Sin gastos en este periodo</b><span>Registra una salida de dinero con el botón de abajo.</span></div>`}`);
    const csv = $('#gs-csv', d.el);
    if (csv) csv.addEventListener('click', () => {
      const filas = [['Fecha', 'Categoría', 'Concepto', 'Forma de pago', 'Monto', 'Registró', 'Anulado', 'Motivo de anulación']];
      items.slice().reverse().forEach((g) => filas.push([fechaISO(g.ts), GASTO_CATS[g.cat] || g.cat, g.concepto, PAGOS[g.pago] || '', g.monto, ROLES[g.rol].corto, g.anulado ? 'Sí' : '', g.anulado_nota]));
      descargar('gastos-' + per + '-bases-box-' + fechaArchivo() + '.csv', aCsv(filas), 'text/csv;charset=utf-8');
    });
  };
  const cargar = async () => {
    try {
      const r = await llamar('GET', '/gastos');
      if (!r.json.ok) throw new ErrorApi(r.json.error);
      datos = r.json;
      pintar();
    } catch (e) { poner($('#gs-cont', d.el), html`<p class="err">${e.message || 'No se pudo cargar.'}</p>`); }
  };
  $('#gs-seg', d.el).addEventListener('click', (ev) => { const b = ev.target.closest('[data-per]'); if (b) { per = b.dataset.per; pintar(); } });
  const nuevo = $('#gs-nuevo', d.el);
  if (nuevo) nuevo.addEventListener('click', () => formGasto(cargar));
  enVivo(d, cargar);
  d.el.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-gasto]');
    if (!b || !datos) return;
    const g = datos.items.find((x) => x.id === b.dataset.gasto);
    if (!g || g.anulado || (S.rol !== 'local' && g.rol !== S.rol)) return;
    const motivo = await confirmar({ titulo: 'Anular gasto', texto: (GASTO_CATS[g.cat] || g.cat) + ' · ' + dinero(g.monto) + (g.concepto ? ' · ' + g.concepto : '') + '. Dejará de contar en los totales y queda marcado como anulado.', ok: 'Anular gasto', cancelar: 'Volver', peligro: true, campo: { etiqueta: 'Motivo', min: 3, ayuda: 'Ej. me equivoqué de monto' } });
    if (!motivo) return;
    try { await op({ op: 'gasto.anular', id: g.id, motivo }); toast('Gasto anulado.'); cargar(); } catch (e) { toast(e.message, { tipo: 'error' }); }
  });
  cargar();
  return d;
}
function formGasto(alGuardar) {
  const cid = nuevoCid();
  let cat = '', pago = 'efectivo';
  const hoy = fechaArchivo(), min = new Date(); min.setDate(min.getDate() - 30);
  const minK = min.getFullYear() + '-' + String(min.getMonth() + 1).padStart(2, '0') + '-' + String(min.getDate()).padStart(2, '0');
  const d = dialogo({
    titulo: 'Registrar gasto',
    clase: 'ancho',
    cuerpo: html`<label class="campo"><span class="lbl">Monto</span><span class="precio gs-monto"><span class="muted">$</span><input id="gs-monto" type="text" inputmode="decimal" autocomplete="off" placeholder="0" aria-label="Monto del gasto"></span></label>
      <div class="campo"><span class="lbl">¿En qué fue?</span><div class="opciones" id="gs-cats">${Object.keys(GASTO_CATS).map((k) => html`<button type="button" class="opcion" data-cat="${k}" aria-pressed="false" style="padding:0 12px">${GASTO_CATS[k]}</button>`)}</div></div>
      <label class="campo"><span class="lbl" id="gs-lbl-con">Detalle (opcional)</span><input class="inp" id="gs-concepto" maxlength="80" placeholder="Ej. gasolina camioneta, tela, comida del equipo" autocomplete="off"></label>
      <div class="campo"><span class="lbl">Cómo se pagó</span><div class="opciones g4" id="gs-pagos">${Object.keys(PAGOS).map((k) => html`<button type="button" class="opcion" data-pago="${k}" aria-pressed="${String(k === pago)}" style="padding:0 6px">${PAGOS[k]}</button>`)}</div></div>
      <label class="campo" style="max-width:220px"><span class="lbl">Día</span><input class="inp" type="date" id="gs-dia" value="${hoy}" max="${hoy}" min="${minK}"></label>
      <p class="err" id="gs-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="gs-ok">Guardar gasto</button>`
  });
  const marca = (sel, attr, fn) => $(sel, d.el).addEventListener('click', (ev) => {
    const b = ev.target.closest('[' + attr + ']');
    if (!b) return;
    fn(b.getAttribute(attr));
    $$('button', $(sel, d.el)).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });
  marca('#gs-cats', 'data-cat', (v) => { cat = v; $('#gs-lbl-con', d.el).textContent = v === 'otro' ? 'Detalle (obligatorio)' : 'Detalle (opcional)'; });
  marca('#gs-pagos', 'data-pago', (v) => { pago = v; });
  const btn = $('#gs-ok', d.el), err = $('#gs-err', d.el);
  const enviar = () => guardando(btn, err, async () => {
    const monto = decimal($('#gs-monto', d.el).value);
    if (!(monto > 0)) throw new ErrorApi({ mensaje: 'Escribe cuánto se gastó.' });
    if (!cat) throw new ErrorApi({ mensaje: 'Elige en qué fue el gasto.' });
    const concepto = $('#gs-concepto', d.el).value.trim();
    if (cat === 'otro' && !concepto) throw new ErrorApi({ mensaje: 'Escribe en qué se gastó.' });
    const dia = $('#gs-dia', d.el).value;
    const res = await op({ op: 'gasto.crear', cid, monto, cat, concepto, pago, dia: dia && dia !== hoy ? dia : undefined });
    d.cerrar();
    toast('Gasto guardado · ' + dinero(res.monto), { accion: { texto: 'Deshacer', fn: async () => { try { await op({ op: 'gasto.anular', id: res.id, motivo: 'Deshecho al momento' }); toast('Gasto deshecho.'); if (alGuardar) alGuardar(); } catch (e) { toast(e.message, { tipo: 'error' }); } } } });
    if (alGuardar) alGuardar();
  });
  btn.addEventListener('click', enviar);
  d.el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('input')) enviar(); });
  return d;
}

/* ───────── reporte del día (el vendedor lo entrega al cierre) ───────── */
const hoyLocal = () => fechaArchivo();
function textoReporteDia(r) {
  const t = r.totales, neg = S.est.negocio;
  const [y, m, dd] = r.dia.split('-').map(Number);
  const fecha = mayus(new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, dd)));
  const L = [neg.nombre + ' · Reporte del día', fecha + ' · ' + ROLES[S.rol].nombre, ''];
  L.push('Ventas: ' + t.ventas + ' · ' + plural(t.pzas, 'pieza', 'piezas'));
  L.push('Vendido: ' + dinero(t.vendido) + (t.envios ? ' (incluye envíos ' + dinero(t.envios) + ')' : ''));
  if (t.devuelto) L.push('Devoluciones: -' + dinero(t.devuelto));
  if (t.gastos) L.push('Gastos: -' + dinero(t.gastos) + (t.gastosEfectivo ? ' (en efectivo ' + dinero(t.gastosEfectivo) + ')' : ''));
  L.push('TOTAL DEL DÍA: ' + dinero(t.neto));
  L.push('EFECTIVO EN CAJA (ventas en efectivo − gastos en efectivo): ' + dinero(t.efectivoNeto), '');
  const pagos = Object.keys(t.porPago);
  if (pagos.length) { L.push('Por forma de pago:'); pagos.forEach((k) => L.push('• ' + (PAGOS[k] || k) + ': ' + dinero(t.porPago[k]))); L.push(''); }
  if (r.ventas.length) {
    L.push('Detalle:');
    r.ventas.forEach((v, i) => {
      L.push((i + 1) + ') ' + fmtHora.format(v.ts) + ' · ' + (v.cliente || 'Mostrador') + ' · ' + (PAGOS[v.pago] || 'Efectivo') + (ENTREGA_T[v.entrega] ? ' · ' + ENTREGA_T[v.entrega] : ''));
      if (v.soloMonto) L.push('   Solo monto, sin producto');
      v.lineas.forEach((l) => L.push('   ' + l.pzas + ' × ' + nombreProd(l.id) + ' — ' + dinero(l.pzas * l.precio)));
      if (v.envio) L.push('   Envío — ' + dinero(v.envio));
      L.push('   Total: ' + dinero(v.total));
    });
    L.push('');
  }
  if (r.devoluciones.length) {
    L.push('Devoluciones:');
    r.devoluciones.forEach((v) => L.push('• ' + fmtHora.format(v.ts) + ' · ' + v.lineas.map((l) => l.pzas + ' × ' + nombreProd(l.id)).join(', ') + ' — -' + dinero(v.total)));
    L.push('');
  }
  if (r.gastos.length) {
    L.push('Gastos:');
    r.gastos.forEach((g) => L.push('• ' + fmtHora.format(g.ts) + ' · ' + (GASTO_CATS[g.cat] || g.cat) + (g.concepto ? ' · ' + g.concepto : '') + ' · ' + (PAGOS[g.pago] || '') + ' — -' + dinero(g.monto)));
    L.push('');
  }
  L.push('Existencias en tienda: ' + plural(r.tienda.pzas, 'pieza', 'piezas'));
  return L.join('\n');
}
function csvReporteDia(r) {
  const filas = [['Día', 'Hora', 'Tipo', 'Cliente', 'Pago', 'Entrega', 'Producto', 'Piezas', 'Precio', 'Importe', 'Envío', 'Total de la venta']];
  r.ventas.forEach((v) => v.lineas.forEach((l, i) => filas.push([r.dia, fmtHora.format(v.ts), 'Venta', v.cliente, PAGOS[v.pago] || '', ENTREGA_T[v.entrega] || '', nombreProd(l.id), l.pzas, l.precio, l.pzas * l.precio, i === 0 ? v.envio : '', i === 0 ? v.total : ''])));
  r.devoluciones.forEach((v) => v.lineas.forEach((l, i) => filas.push([r.dia, fmtHora.format(v.ts), 'Devolución', '', '', '', nombreProd(l.id), -l.pzas, l.precio, -l.pzas * l.precio, '', i === 0 ? -v.total : ''])));
  r.gastos.forEach((g) => filas.push([r.dia, fmtHora.format(g.ts), 'Gasto', g.concepto, PAGOS[g.pago] || '', GASTO_CATS[g.cat] || g.cat, '', '', '', -g.monto, '', -g.monto]));
  filas.push([r.dia, '', 'TOTAL DEL DÍA', '', '', '', '', r.totales.pzas, '', '', r.totales.envios, r.totales.neto]);
  return aCsv(filas);
}
async function abrirReporteDia() {
  let datos = null, dia = hoyLocal();
  const d = dialogo({
    titulo: 'Reporte del día',
    clase: 'ancho',
    cuerpo: html`<label class="campo" style="max-width:220px"><span class="lbl">Día</span><input class="inp" type="date" id="rd-dia" value="${dia}" max="${dia}"></label><div id="rd-cont"><p class="t-peq">Cargando…</p></div>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="rd-wa" disabled>${ico('mensaje')}Enviar por WhatsApp</button>`,
    enfocar: false
  });
  const min = new Date(); min.setDate(min.getDate() - 30);
  $('#rd-dia', d.el).min = min.getFullYear() + '-' + String(min.getMonth() + 1).padStart(2, '0') + '-' + String(min.getDate()).padStart(2, '0');
  const pintar = () => {
    if (!datos) return;
    const t = datos.totales;
    poner($('#rd-cont', d.el), html`
      <div class="total-b"><span>Total del día</span><b>${dinero(t.neto)}</b></div>
      <p class="t-peq" style="margin:-6px 0 14px">${plural(t.ventas, 'venta', 'ventas')} · ${plural(t.pzas, 'pieza', 'piezas')}${t.envios ? ' · envíos ' + dinero(t.envios) : ''}${t.devuelto ? ' · devoluciones -' + dinero(t.devuelto) : ''}</p>
      ${Object.keys(t.porPago).length ? html`<h3 class="t-sec">Por forma de pago</h3><div class="vt-lista">${Object.keys(t.porPago).map((k) => html`<div class="vt-fila"><span class="n">${PAGOS[k] || k}</span><span class="v">${dinero(t.porPago[k])}</span></div>`)}</div>` : ''}
      ${datos.ventas.length ? html`<h3 class="t-sec">Ventas</h3><div class="vt-lista">${datos.ventas.map((v) => html`<div class="vt-fila"><span class="n">${fmtHora.format(v.ts)} · ${v.cliente || 'Mostrador'}</span><span class="v">${dinero(v.total)}</span><small>${v.soloMonto ? 'Solo monto, sin producto' : v.lineas.map((l) => l.pzas + ' × ' + nombreProd(l.id)).join(', ')}<br>${PAGOS[v.pago] || 'Efectivo'}${ENTREGA_T[v.entrega] ? ' · ' + ENTREGA_T[v.entrega] : ''}${v.envio ? ' (envío ' + dinero(v.envio) + ')' : ''}</small></div>`)}</div>` : html`<div class="vacio" style="padding:18px 8px"><b>Sin ventas este día</b><span>Cuando registres ventas aparecerán aquí.</span></div>`}
      ${t.gastos || t.efectivoNeto ? html`<h3 class="t-sec">Caja</h3><div class="vt-lista"><div class="vt-fila"><span class="n">Efectivo vendido</span><span class="v">${dinero(t.porPago.efectivo || 0)}</span></div><div class="vt-fila"><span class="n">Gastos en efectivo</span><span class="v">-${dinero(t.gastosEfectivo)}</span></div><div class="vt-fila"><span class="n">Efectivo en caja</span><span class="v">${dinero(t.efectivoNeto)}</span></div></div>` : ''}
      ${datos.gastos.length ? html`<h3 class="t-sec">Gastos</h3><div class="vt-lista">${datos.gastos.map((g) => html`<div class="vt-fila"><span class="n">${fmtHora.format(g.ts)} · ${GASTO_CATS[g.cat] || g.cat}</span><span class="v">-${dinero(g.monto)}</span><small>${g.concepto || ''}${g.concepto ? ' · ' : ''}${PAGOS[g.pago] || ''}</small></div>`)}</div>` : ''}
      ${datos.devoluciones.length ? html`<h3 class="t-sec">Devoluciones</h3><div class="vt-lista">${datos.devoluciones.map((v) => html`<div class="vt-fila"><span class="n">${fmtHora.format(v.ts)}</span><span class="v">-${dinero(v.total)}</span><small>${v.lineas.map((l) => l.pzas + ' × ' + nombreProd(l.id)).join(', ')}</small></div>`)}</div>` : ''}
      <p class="t-peq">Existencias en tienda: ${plural(datos.tienda.pzas, 'pieza', 'piezas')}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button type="button" class="btn btn-s btn-g" id="rd-copiar">Copiar texto</button><button type="button" class="btn btn-s btn-g" id="rd-csv">Descargar CSV</button></div>`);
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
    } catch (e) { poner($('#rd-cont', d.el), html`<p class="err">${e.message || 'No se pudo cargar el reporte.'}</p>`); }
  };
  $('#rd-dia', d.el).addEventListener('change', (ev) => { if (ev.target.value) { dia = ev.target.value; cargar(); } });
  $('#rd-wa', d.el).addEventListener('click', () => {
    const tel = S.rol === 'tienda' ? S.est.negocio.telLocal : S.est.negocio.telTienda;
    window.open(waLink(tel, textoReporteDia(datos)), '_blank', 'noopener');
  });
  enVivo(d, cargar);
  cargar();
}

/* ───────── conteo físico general: todos los productos en una lista ───────── */
function abrirConteo() {
  const loc = S.rol, cid = nuevoCid();
  const vals = {};
  let cat = 'todo';
  const sist = (p) => (loc === 'local' ? p.stock_local : p.stock_tienda);
  const d = dialogo({
    titulo: 'Conteo físico',
    clase: 'ancho',
    cuerpo: html`<p class="t-peq" style="margin-bottom:12px">Escribe cuántas piezas contaste de verdad en ${loc === 'local' ? 'el almacén' : 'la tienda'}. Lo que dejes en blanco no se toca. El sistema se ajusta a tus números y cada ajuste queda registrado.</p>
      <div class="buscar">${ico('buscar')}<input class="inp" id="cn-q" type="search" placeholder="Buscar producto" autocomplete="off" aria-label="Buscar producto"></div>
      <div class="chips" id="cn-chips" style="margin:10px 0 12px"></div>
      <div class="cnt-lista" id="cn-lista"></div>
      <label class="campo" style="margin-top:14px"><span class="lbl">Nota (opcional)</span><textarea class="inp" id="cn-nota" rows="2" maxlength="140" placeholder="Ej. conteo de fin de mes"></textarea></label>
      <p class="err" id="cn-err" hidden></p>`,
    pie: html`<span class="resumen" id="cn-res"></span><button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="cn-ok">Guardar conteo</button>`
  });
  const cambios = () => S.est.productos.filter((p) => p.activo && vals[p.id] !== undefined && vals[p.id] !== '' && Number(vals[p.id]) !== sist(p)).map((p) => ({ id: p.id, contado: Number(vals[p.id]) }));
  const resumen = () => { const n = cambios().length; $('#cn-res', d.el).textContent = n ? plural(n, 'producto con diferencia', 'productos con diferencia') : 'Sin diferencias todavía'; };
  const chips = () => poner($('#cn-chips', d.el), html`${[['todo', 'Todo'], ['base', 'Bases'], ['material', 'Materiales'], ['accesorio', 'Accesorios']].map(([k, t]) => html`<button type="button" class="chip" data-cat="${k}" aria-pressed="${String(cat === k)}">${t}</button>`)}`);
  const filas = () => {
    const q = $('#cn-q', d.el).value;
    let lista = S.est.productos.filter((p) => p.activo && (cat === 'todo' || p.cat === cat) && (!q || coincide(p.nombre + ' ' + CATS[p.cat], q))).sort(ordenProductos);
    let ult = '';
    const out = [];
    lista.forEach((p) => {
      const m = p.cat === 'base' ? medidaDe(p.medida) : null;
      const g = !norm(q) ? (p.cat === 'base' ? (m ? m.nombre + ' · ' + m.dims : 'Bases') : CATS[p.cat]) : '';
      if (g && g !== ult) { ult = g; out.push(html`<div class="cnt-h">${g}</div>`); }
      const v = vals[p.id];
      out.push(html`<div class="cnt ${v !== undefined && v !== '' && Number(v) !== sist(p) ? 'cambio' : ''}" data-id="${p.id}"><span class="prod-ico" style="width:38px;height:38px">${iconoProd(p, 28)}</span><div class="grow"><div class="lin-n">${p.nombre}</div><div class="lin-s">En el sistema: ${num(sist(p))}</div></div><input class="cnt-in" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="${sist(p)}" value="${v === undefined ? '' : v}" aria-label="Contado de ${p.nombre}"></div>`);
    });
    poner($('#cn-lista', d.el), out.length ? out : html`<div class="vacio" style="padding:22px"><b>Nada coincide</b><span>Prueba con otra palabra.</span></div>`);
  };
  chips(); filas(); resumen();
  $('#cn-q', d.el).addEventListener('input', filas);
  $('#cn-chips', d.el).addEventListener('click', (ev) => { const b = ev.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; chips(); filas(); } });
  $('#cn-lista', d.el).addEventListener('input', (ev) => {
    const fila = ev.target.closest('.cnt');
    if (!fila || !ev.target.matches('.cnt-in')) return;
    const limpio = ev.target.value.replace(/\D/g, '').slice(0, 5);
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
        if (hechos) throw new ErrorApi({ mensaje: 'Se guardaron ' + hechos + ' de ' + cs.length + ' productos. ' + e.message + ' Vuelve a guardar: lo que ya quedó no se repite.' });
        throw e;
      }
      hechos += trozos[i].length;
    }
    d.cerrar();
    toast('Inventario ajustado · ' + plural(cs.length, 'producto', 'productos'));
  }));
}

/* ───────── recibir mercancía ───────── */
function formRecibir(id) {
  const t = S.est.traspasos.find((x) => x.id === id);
  if (!t || t.estado !== 'en_transito') { toast('Ese envío ya no está en camino.'); return; }
  const cid = nuevoCid();
  const rec = {};
  t.lineas.forEach((l) => { rec[l.id] = l.cant; });
  const d = dialogo({
    titulo: 'Recibir mercancía',
    clase: 'ancho',
    cuerpo: html`<p style="margin-bottom:4px"><b>Salió ${hace(t.ts)}</b>${t.nota ? ' · ' + t.nota : ''}</p><p class="t-peq" style="margin-bottom:14px">Revisa que cada pieza haya llegado. Si falta o llegó dañada, corrige el número y anota qué pasó.</p>
      <ul class="lin-lista">${t.lineas.map((l) => html`<li class="lin" data-id="${l.id}">
        <span class="prod-ico">${S.idx[l.id] ? iconoProd(S.idx[l.id], 30) : ''}</span>
        <div style="min-width:0"><div class="lin-n">${nombreProd(l.id)}</div><div class="lin-s" data-sub>Enviadas: ${num(l.cant)}</div></div><span></span>
        <div class="lin-ctl"><div class="paso"><button type="button" data-menos aria-label="Una menos">${ico('minus')}</button><input type="text" inputmode="numeric" value="${l.cant}" data-cant aria-label="Recibidas de ${nombreProd(l.id)}"><button type="button" data-mas aria-label="Una más">${ico('plus')}</button></div><span class="t-peq">de ${num(l.cant)}</span></div>
      </li>`)}</ul>
      <label class="campo"><span class="lbl" id="r-nota-et">Nota (obligatoria si hay diferencia)</span><textarea class="inp" id="r-nota" rows="2" maxlength="200" placeholder="Ej. llegó una base rota"></textarea></label>
      <p class="err" id="r-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="r-ok">${ico('check')}Confirmar recibido</button>`
  });
  const lista = $('.lin-lista', d.el);
  const marcar = (li) => {
    const l = t.lineas.find((x) => x.id === li.dataset.id), r = rec[l.id], dif = r !== l.cant;
    li.classList.toggle('mal', dif);
    const s = $('[data-sub]', li);
    s.classList.toggle('mal', dif);
    s.textContent = dif ? (r < l.cant ? 'Faltan ' + (l.cant - r) + ' de ' + num(l.cant) : 'No puede ser más de lo enviado') : 'Enviadas: ' + num(l.cant);
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
    if (t.lineas.some((l) => rec[l.id] > l.cant)) throw new ErrorApi({ mensaje: 'Lo recibido no puede ser más de lo enviado.' });
    if (dif && nota.length < 3) { $('#r-nota', d.el).focus(); throw new ErrorApi({ mensaje: 'Anota qué pasó con la diferencia (faltante o daño).' }); }
    const res = await op({ op: 'traspaso.recibir', cid, id, nota, lineas: t.lineas.map((l) => ({ id: l.id, recibida: rec[l.id] })) });
    d.cerrar();
    toast(res.dif ? 'Recibido con diferencias · ' + plural(res.piezas, 'pieza', 'piezas') : 'Mercancía recibida · ' + plural(res.piezas, 'pieza', 'piezas'));
  }));
}

function recibirYa() {
  const enT = S.est.traspasos.filter((t) => t.estado === 'en_transito');
  if (!enT.length) { toast('No hay envíos en camino.'); return; }
  if (enT.length === 1) { formRecibir(enT[0].id); return; }
  const d = dialogo({ titulo: 'Envíos en camino', cuerpo: html`<p class="t-peq" style="margin-bottom:10px">Elige cuál llegó.</p><div class="card flat"><ul class="lista">${enT.map(tarjetaEnvio)}</ul></div>` });
  d.el.addEventListener('click', (ev) => { if (ev.target.closest('[data-act="traspaso"]')) d.cerrar(); });
}

/* ───────── detalle de envío, pedido y operación ───────── */
function abrirTraspaso(id) {
  const t = S.est.traspasos.find((x) => x.id === id);
  if (!t) return;
  const [txt, cl] = t.estado === 'recibido' && t.dif ? ['Con diferencias', 'warn'] : ESTADO_TRASP[t.estado];
  const esLocal = S.rol === 'local';
  const abierto = t.estado === 'en_transito';
  const d = dialogo({
    titulo: 'Envío a la tienda',
    clase: 'ancho',
    cuerpo: html`<div class="sep" style="margin-bottom:12px"><span class="pill ${cl}">${txt}</span><span class="t-peq">Salió ${hace(t.ts)}</span></div>
      <div class="card flat" style="margin-bottom:14px"><ul class="lista">${t.lineas.map((l) => html`<li class="item" style="min-height:52px"><span class="prod-ico" style="width:38px;height:38px">${S.idx[l.id] ? iconoProd(S.idx[l.id], 28) : ''}</span><div class="grow"><div class="item-t">${nombreProd(l.id)}</div></div><div style="text-align:right"><b class="cifras" style="font:700 18px var(--f-etiqueta)">${num(t.estado === 'recibido' ? l.recibida : l.cant)}</b>${t.estado === 'recibido' && l.recibida !== l.cant ? html`<div class="t-peq" style="color:var(--warn)">de ${num(l.cant)} enviadas</div>` : ''}</div></li>`)}</ul></div>
      <dl class="kv">
        ${t.nota ? html`<dt>Nota del envío</dt><dd>${t.nota}</dd>` : ''}
        ${t.estado === 'recibido' ? html`<dt>Recibido</dt><dd>${hace(t.recibido_ts)}</dd>` : ''}
        ${t.nota_recibo ? html`<dt>${t.estado === 'cancelado' ? 'Motivo' : 'Nota al recibir'}</dt><dd>${t.nota_recibo}</dd>` : ''}
      </dl>
      ${abierto && esLocal ? html`<div class="aviso" style="margin-top:14px">${ico('info')}<span>Si cancelas, las piezas regresan al inventario del almacén.</span></div>` : ''}`,
    pie: abierto ? (esLocal ? html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-r" id="t-cancelar">Cancelar envío</button>` : html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="t-recibir">${ico('check')}Recibir mercancía</button>`) : html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>`
  });
  const rc = $('#t-recibir', d.el);
  if (rc) rc.addEventListener('click', () => { d.cerrar(); formRecibir(id); });
  const cn = $('#t-cancelar', d.el);
  if (cn) cn.addEventListener('click', async () => {
    const motivo = await confirmar({ titulo: 'Cancelar envío', texto: 'Las piezas regresan al inventario del almacén.', ok: 'Cancelar envío', cancelar: 'Volver', peligro: true, campo: { etiqueta: 'Motivo', min: 3, error: 'Escribe por qué cancelas el envío.' } });
    if (!motivo) return;
    try { await op({ op: 'traspaso.cancelar', id, motivo }); d.cerrar(); toast('Envío cancelado. Las piezas volvieron al almacén.'); } catch (e) { toast(e.message, { tipo: 'error' }); }
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
    cuerpo: html`<div class="sep" style="margin-bottom:12px"><span class="pill ${cl}">${txt}</span><span class="t-peq">Pedido ${hace(p.ts)}</span></div>
      <div class="card flat" style="margin-bottom:14px"><ul class="lista">${p.lineas.map((l) => { const pr = S.idx[l.id]; return html`<li class="item" style="min-height:52px"><span class="prod-ico" style="width:38px;height:38px">${pr ? iconoProd(pr, 28) : ''}</span><div class="grow"><div class="item-t">${nombreProd(l.id)}</div>${pr ? html`<div class="item-s">En almacén: ${num(pr.stock_local)} · En tienda: ${num(pr.stock_tienda)}</div>` : ''}</div><b class="cifras" style="font:700 18px var(--f-etiqueta)">${num(l.cant)}</b></li>`; })}</ul></div>
      ${p.nota ? html`<dl class="kv"><dt>Nota</dt><dd>${p.nota}</dd></dl>` : ''}`,
    pie: abierto ? (S.rol === 'local' ? html`<button type="button" class="btn btn-g" id="p-descartar">Descartar</button><button type="button" class="btn btn-p" id="p-surtir">${ico('camion')}Preparar envío</button>` : html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-r" id="p-descartar">Cancelar pedido</button>`) : html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>`
  });
  const sr = $('#p-surtir', d.el);
  if (sr) sr.addEventListener('click', () => {
    d.cerrar();
    const inicial = p.lineas.filter((l) => S.idx[l.id] && S.idx[l.id].activo && S.idx[l.id].stock_local > 0).map((l) => ({ id: l.id, cant: Math.min(l.cant, S.idx[l.id].stock_local) }));
    if (!inicial.length) toast('Ninguno de esos productos tiene existencias en el almacén.', { tipo: 'error' });
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
    cuerpo: html`<div class="sep" style="margin-bottom:12px"><span class="t-peq">${ROLES[g.rol].nombre} · ${hace(g.ts)}</span>${g.anulado ? html`<span class="pill bad">Anulada</span>` : ''}</div>
      <div class="card flat" style="margin-bottom:14px"><ul class="lista">${g.lineas.map((m) => html`<li class="item" style="min-height:52px"><span class="prod-ico" style="width:38px;height:38px">${S.idx[m.prod] ? iconoProd(S.idx[m.prod], 28) : ''}</span><div class="grow"><div class="item-t ${g.anulado ? 'tachado' : ''}">${nombreProd(m.prod)}</div><div class="item-s">${m.loc === 'local' ? 'Almacén' : 'Tienda'}${conPrecio ? ' · ' + dinero(m.precio) + ' c/u' : ''}</div></div><b class="cifras" style="font:700 19px var(--f-etiqueta);color:${m.delta < 0 ? 'var(--bad)' : 'var(--ok)'}">${m.delta > 0 ? '+' : '−'}${num(Math.abs(m.delta))}</b></li>`)}</ul></div>
      <dl class="kv">
        ${conPrecio ? html`<dt>Total</dt><dd>${dinero(g.total)}</dd>` : ''}
        ${g.cliente ? html`<dt>Cliente</dt><dd>${g.cliente}</dd>` : ''}
        ${g.pago && g.tipo === 'venta' ? html`<dt>Pago</dt><dd>${PAGOS[g.pago] || g.pago}</dd>` : ''}
        ${g.tipo === 'venta' && ENTREGA_T[g.motivo] ? html`<dt>Entrega</dt><dd>${ENTREGA_T[g.motivo]}${g.envio ? ' · envío ' + dinero(g.envio) : ''}</dd>` : ''}
        ${g.nota ? html`<dt>Nota</dt><dd>${g.nota}</dd>` : ''}
        ${g.anulado ? html`<dt>Anulada</dt><dd>${hace(g.anulado_ts)} · ${g.anulado_por === 'local' ? 'Almacén' : 'Tienda'}</dd><dt>Motivo</dt><dd>${g.anulado_nota}</dd>` : ''}
      </dl>`,
    pie: puedeAnular(g) ? html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>${g.tipo === 'venta' ? html`<button type="button" class="btn btn-g" id="o-pago">Cambiar pago</button>` : ''}<button type="button" class="btn btn-r" id="o-anular">Anular operación</button>` : html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>`
  });
  const cp = $('#o-pago', d.el);
  if (cp) cp.addEventListener('click', () => {
    const actual = g.pago || 'efectivo';
    let pago = '';
    const s = dialogo({
      titulo: 'Cambiar forma de pago',
      cuerpo: html`<p class="t-peq" style="margin:0 0 12px">Ahora: <b>${PAGOS[actual] || actual}</b>. La venta conserva su día y hora; el cambio queda anotado en el historial.</p>
        <div class="campo"><span class="lbl">Forma de pago correcta</span><div class="opciones g4" id="cp-pagos">${Object.keys(PAGOS).filter((k) => k !== actual).map((k) => html`<button type="button" class="opcion" data-pago="${k}" aria-pressed="false" style="padding:0 6px">${PAGOS[k]}</button>`)}</div></div>`,
      pie: html`<button type="button" class="btn btn-g" data-cerrar>Volver</button><button type="button" class="btn btn-p" id="cp-ok" disabled>Guardar</button>`
    });
    const ok = $('#cp-ok', s.el);
    $('#cp-pagos', s.el).addEventListener('click', (e) => {
      const b = e.target.closest('[data-pago]'); if (!b) return;
      pago = b.dataset.pago; ok.disabled = false;
      s.el.querySelectorAll('#cp-pagos [data-pago]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    ok.addEventListener('click', async () => {
      if (!pago) return;
      ok.disabled = true;
      try { await op({ op: 'venta.pago', grupo, pago }); s.cerrar(); d.cerrar(); toast('Forma de pago corregida: ' + PAGOS[pago] + '.'); S.hist.rev = null; if (S.tab === 'historial') cargarHistorial(true); } catch (e) { ok.disabled = false; toast(e.message, { tipo: 'error' }); }
    });
  });
  const an = $('#o-anular', d.el);
  if (an) an.addEventListener('click', async () => {
    const motivo = await confirmar({ titulo: 'Anular operación', texto: 'El inventario vuelve a como estaba antes. La operación queda en el historial marcada como anulada.', ok: 'Anular', cancelar: 'Volver', peligro: true, campo: { etiqueta: 'Motivo', min: 3, error: 'Escribe el motivo de la anulación.' } });
    if (!motivo) return;
    try { await op({ op: 'mov.anular', grupo, motivo }); d.cerrar(); toast('Operación anulada.'); S.hist.rev = null; if (S.tab === 'historial') cargarHistorial(true); } catch (e) { toast(e.message, { tipo: 'error' }); }
  });
}

/* ───────── producto: detalle y formularios ───────── */
function abrirProducto(id) {
  const p = S.idx[id];
  if (!p) return;
  const med = p.cat === 'base' ? medidaDe(p.medida) : null, tono = p.cat === 'base' ? tonoDe(p.tono) : null;
  const esLocal = S.rol === 'local';
  const cam = S.camino[p.id] || 0;
  const tile = (et, v, mn, loc) => { const nv = loc ? nivel(p, loc) : 'ok'; return html`<div class="kpi"><span class="t-sec">${et}</span><span class="num-g cifras" style="color:${nv === 'agotado' ? 'var(--bad)' : nv === 'bajo' ? 'var(--warn)' : 'inherit'}">${num(v)}</span><small>${loc ? (nv === 'agotado' ? 'Agotado' : nv === 'bajo' ? 'Stock bajo' : mn > 0 ? 'Mínimo ' + num(mn) : 'Sin mínimo') : 'Sin confirmar'}</small></div>`; };
  const pie = S.rol === 'dueno' ? html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>` : !p.activo ? (esLocal ? html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button><button type="button" class="btn btn-p" id="pd-reactivar">Reactivar producto</button>` : html`<button type="button" class="btn btn-g" data-cerrar>Cerrar</button>`)
    : esLocal ? html`<button type="button" class="btn btn-g" id="pd-editar">${ico('editar')}Editar</button><button type="button" class="btn btn-g" id="pd-entrada">${ico('entrada')}Entrada</button><button type="button" class="btn btn-p" id="pd-enviar">${ico('camion')}Enviar a tienda</button>`
    : html`<button type="button" class="btn btn-g" id="pd-pedir">${ico('pedido')}Pedir al almacén</button><button type="button" class="btn btn-p" id="pd-vender">${ico('recibo')}Vender</button>`;
  const d = dialogo({
    titulo: p.nombre,
    clase: 'ancho',
    cuerpo: html`<div class="fila" style="gap:14px;margin-bottom:16px"><span class="prod-ico" style="width:68px;height:68px;border-radius:14px">${iconoProd(p, 52)}</span>
        <div class="grow"><div class="t-peq">${CATS[p.cat].replace(/s$/, '')}${med ? ' · ' + med.nombre + ' ' + med.dims : ''}${tono ? ' · ' + tono.nombre : ''}</div><div class="num-g" style="margin-top:6px">${p.precio ? dinero(p.precio) : 'Sin precio'}</div></div>${p.activo ? '' : html`<span class="pill">Archivado</span>`}</div>
      <div class="grid-kpi" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:16px">${tile('Almacén', p.stock_local, p.min_local, 'local')}${tile('Tienda', p.stock_tienda, p.min_tienda, 'tienda')}${tile('En camino', cam, 0, null)}</div>
      <dl class="kv" style="margin-bottom:18px"><dt>Unidad</dt><dd>${p.unidad}</dd>${esLocal || S.rol === 'dueno' ? html`<dt>Costo</dt><dd>${p.costo ? dinero(p.costo) : '—'}</dd>${p.costo && p.precio ? html`<dt>Margen</dt><dd>${Math.round((1 - p.costo / p.precio) * 100)}%</dd>` : ''}` : ''}<dt>Mínimos</dt><dd>Almacén ${num(p.min_local)} · Tienda ${num(p.min_tienda)}</dd></dl>
      <h3 class="t-sec" style="margin-bottom:8px">Últimos movimientos</h3>
      <div class="card flat"><ul class="lista" id="pd-movs"><li class="item t-peq">Cargando…</li></ul></div>`,
    pie
  });
  llamar('GET', '/movs', null, { prods: p.id, limite: 8 }).then((r) => {
    const ul = $('#pd-movs', d.el);
    if (!ul || !r.json.ok) return;
    const ops = agrupar(r.json.items);
    poner(ul, ops.length ? ops.map((g) => { const m = g.lineas.find((x) => x.prod === p.id) || g.lineas[0]; const t = TIPOS[g.tipo] || {}; return html`<li class="item" style="min-height:48px"><span class="ico-c ${g.anulado ? '' : t.c}" style="width:34px;height:34px">${ico(t.ic || 'info')}</span><div class="grow"><div class="item-t ${g.anulado ? 'tachado' : ''}" style="font-size:15px">${tituloOp(g)}</div><div class="item-s">${hace(g.ts)} · ${ROLES[g.rol].corto}</div></div><b class="cifras" style="font:700 17px var(--f-etiqueta);color:${m.delta < 0 ? 'var(--bad)' : 'var(--ok)'}">${m.delta > 0 ? '+' : '−'}${num(Math.abs(m.delta))}</b></li>`; })
      : html`<li class="item t-peq">Sin movimientos todavía.</li>`);
  }).catch(() => { const ul = $('#pd-movs', d.el); if (ul) poner(ul, html`<li class="item t-peq">No se pudo cargar el historial.</li>`); });
  const ir = (sel, fn) => { const b = $(sel, d.el); if (b) b.addEventListener('click', () => { d.cerrar(); fn(); }); };
  ir('#pd-editar', () => formProducto(p));
  ir('#pd-entrada', () => abrirForma('entrada', { inicial: [{ id: p.id, cant: 1 }] }));
  ir('#pd-enviar', () => { if (p.stock_local < 1) toast('No hay existencias en el almacén para enviar.', { tipo: 'error' }); else abrirForma('envio', { inicial: [{ id: p.id, cant: 1 }] }); });
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
  const sel = (id, lista, actual, vacio) => html`<select class="inp" id="${id}">${vacio ? html`<option value="">${vacio}</option>` : ''}${lista.map((x) => html`<option value="${x.id}" ${x.id === actual ? raw('selected') : ''}>${x.nombre}${x.dims ? ' · ' + x.dims : ''}</option>`)}</select>`;
  const cat0 = nuevo ? 'base' : p.cat;
  const d = dialogo({
    titulo: nuevo ? 'Nuevo producto' : 'Editar producto',
    clase: 'ancho',
    cuerpo: html`
      ${nuevo ? html`<label class="campo"><span class="lbl">Categoría</span><select class="inp" id="pf-cat">${Object.keys(CATS).map((k) => html`<option value="${k}" ${k === cat0 ? raw('selected') : ''}>${CATS[k].replace(/s$/, '')}</option>`)}</select></label>` : ''}
      <div class="grid2" id="pf-base" ${cat0 === 'base' ? '' : raw('hidden')}>
        <label class="campo"><span class="lbl">Medida</span>${sel('pf-medida', e.medidas, p ? p.medida : '', 'Sin medida')}</label>
        <label class="campo"><span class="lbl">Tono</span>${sel('pf-tono', e.tonos, p ? p.tono : '', 'Sin tono')}</label>
      </div>
      <label class="campo"><span class="lbl">Nombre</span><input class="inp" id="pf-nombre" maxlength="80" value="${p ? p.nombre : ''}" autocomplete="off" placeholder="Ej. Base Queen · Gris"></label>
      <div class="grid2">
        <label class="campo"><span class="lbl">Precio de venta ($)</span><input class="inp" id="pf-precio" inputmode="decimal" value="${p && p.precio ? p.precio : ''}" placeholder="0"></label>
        <label class="campo"><span class="lbl">Costo ($)</span><input class="inp" id="pf-costo" inputmode="decimal" value="${p && p.costo ? p.costo : ''}" placeholder="0"></label>
        <label class="campo"><span class="lbl">Unidad</span><input class="inp" id="pf-unidad" maxlength="12" value="${p ? p.unidad : 'pza'}" placeholder="pza, hoja, m…"></label>
        <span></span>
        <label class="campo"><span class="lbl">Mínimo en almacén</span><input class="inp" id="pf-minl" inputmode="numeric" value="${p ? p.min_local : 2}"></label>
        <label class="campo"><span class="lbl">Mínimo en tienda</span><input class="inp" id="pf-mint" inputmode="numeric" value="${p ? p.min_tienda : 1}"></label>
        ${nuevo ? html`<label class="campo"><span class="lbl">Existencias en almacén</span><input class="inp" id="pf-sl" inputmode="numeric" value="0"></label><label class="campo"><span class="lbl">Existencias en tienda</span><input class="inp" id="pf-st" inputmode="numeric" value="0"></label>` : ''}
      </div>
      <p class="ayuda" style="margin-top:-6px">Te avisamos cuando las existencias bajen del mínimo. Pon 0 si no quieres alertas.</p>
      ${!nuevo ? html`<div class="aviso warn" style="margin-top:14px">${ico('info')}<span>Para cambiar las existencias usa un <b>conteo físico</b>, así queda registrado. ${p.activo ? 'Para dejar de usar este producto, déjalo en cero y archívalo.' : ''}</span></div>` : ''}
      <p class="err" id="pf-err" hidden></p>`,
    pie: html`${!nuevo && p.activo ? html`<button type="button" class="btn btn-g" id="pf-archivar" style="flex:0 1 auto">${ico('archivo')}Archivar</button>` : ''}<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="pf-ok">${nuevo ? 'Crear producto' : 'Guardar cambios'}</button>`
  });
  const $d = (s) => $(s, d.el);
  const sugerir = () => {
    const cat = nuevo ? $d('#pf-cat').value : p.cat;
    if (cat !== 'base') return;
    const m = e.medidas.find((x) => x.id === $d('#pf-medida').value), t = e.tonos.find((x) => x.id === $d('#pf-tono').value);
    if (!nombreManual && (m || t)) $d('#pf-nombre').value = m && t ? 'Base ' + m.nombre + ' · ' + t.nombre : 'Base ' + (m ? m.nombre : t.nombre);
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
    const ok = await confirmar({ titulo: 'Archivar producto', texto: p.nombre + ' dejará de aparecer en las listas. Sigue en el historial y puedes reactivarlo cuando quieras.', ok: 'Archivar', cancelar: 'Volver' });
    if (!ok) return;
    try { await op({ op: 'producto.archivar', id: p.id, activo: false }); d.cerrar(); toast('Producto archivado.'); } catch (er) { err.hidden = false; err.textContent = er.message; }
  });
}

function formVariantes() {
  const e = S.est, cid = nuevoCid();
  const existentes = new Set(e.productos.map((p) => norm(p.nombre)));
  const nombreDe = (m, t) => 'Base ' + m.nombre + ' · ' + t.nombre;
  const d = dialogo({
    titulo: 'Crear bases por medida y tono',
    clase: 'ancho',
    cuerpo: html`<p class="t-peq" style="margin-bottom:14px">Marca las medidas y los tonos que fabricas. Se crea una base por cada combinación, con el precio de la medida. Las que ya existen se omiten.</p>
      <div class="campo"><span class="lbl">Medidas</span>${e.medidas.map((m) => html`<div class="check-fila" style="margin-bottom:6px"><input type="checkbox" id="vm-${m.id}" data-med="${m.id}" checked><label for="vm-${m.id}">${m.nombre}<small>${m.dims}${m.precio ? ' · ' + dinero(m.precio) : ' · sin precio'}</small></label></div>`)}</div>
      <div class="campo"><span class="lbl">Tonos</span><div class="grid2">${e.tonos.map((t) => html`<div class="check-fila" style="margin-bottom:0"><input type="checkbox" id="vt-${t.id}" data-ton="${t.id}" checked><label for="vt-${t.id}"><span class="mini-sw" style="background:${hexOk(t.hex)}"></span>${t.nombre}</label></div>`)}</div></div>
      <div class="grid2"><label class="campo"><span class="lbl">Mínimo en almacén</span><input class="inp" id="vr-minl" inputmode="numeric" value="2"></label><label class="campo"><span class="lbl">Mínimo en tienda</span><input class="inp" id="vr-mint" inputmode="numeric" value="1"></label></div>
      <div class="aviso" id="vr-res">${ico('info')}<span></span></div>
      <p class="err" id="vr-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="vr-ok">Crear bases</button>`
  });
  const marcados = (attr) => $$('[' + attr + ']:checked', d.el).map((x) => x.getAttribute(attr));
  const calc = () => {
    const ms = e.medidas.filter((m) => marcados('data-med').includes(m.id)), ts = e.tonos.filter((t) => marcados('data-ton').includes(t.id));
    let nuevas = 0, ya = 0;
    ms.forEach((m) => ts.forEach((t) => { if (existentes.has(norm(nombreDe(m, t)))) ya++; else nuevas++; }));
    $('#vr-res span', d.el).textContent = nuevas ? 'Se crearán ' + plural(nuevas, 'base', 'bases') + (ya ? ' (' + plural(ya, 'ya existe', 'ya existen') + ').' : '.') : 'Todas esas combinaciones ya existen.';
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

/* ───────── ajustes del negocio ───────── */
function formNegocio() {
  const n = S.est.negocio;
  const d = dialogo({
    titulo: 'Datos del negocio',
    cuerpo: html`<label class="campo"><span class="lbl">Nombre del negocio</span><input class="inp" id="n-nombre" maxlength="60" value="${n.nombre}"></label>
      <label class="campo"><span class="lbl">WhatsApp del almacén</span><input class="inp" id="n-tl" inputmode="tel" value="${n.telLocal}" placeholder="523111234567"><span class="ayuda">Con la clave del país (52). La tienda lo usa para avisarte de sus pedidos.</span></label>
      <label class="campo"><span class="lbl">WhatsApp de la tienda</span><input class="inp" id="n-tt" inputmode="tel" value="${n.telTienda}" placeholder="523111234567"><span class="ayuda">El almacén lo usa para avisar de sus envíos.</span></label>
      <h3 class="t-sec" style="margin:18px 0 8px">Envíos y descuento (por venta)</h3>
      <label class="campo"><span class="lbl">Envío dentro de Tepic</span><input class="inp" id="n-et" inputmode="decimal" value="${n.envioTepic}"></label>
      <label class="campo"><span class="lbl">Envío a Xalisco y La Cantera</span><input class="inp" id="n-ef" inputmode="decimal" value="${n.envioFuera}"></label>
      <label class="campo"><span class="lbl">Descuento por base si recogen en tienda</span><input class="inp" id="n-dr" inputmode="decimal" value="${n.descRecoge}"><span class="ayuda">El vendedor siempre puede cambiar el precio de cada base al vender.</span></label>
      <p class="err" id="n-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="n-ok">Guardar</button>`
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
    cuerpo: html`<p class="t-peq" style="margin-bottom:14px">El precio de cada medida se usa al crear bases nuevas. Los nombres de productos que ya existen no cambian.</p>
      <div id="md-filas"></div>
      <button type="button" class="btn btn-g btn-s" id="md-add">${ico('plus')}Agregar medida</button>
      <label class="check-fila" style="margin-top:16px"><input type="checkbox" id="md-aplicar" checked><span style="flex:1;line-height:1.3">Aplicar los precios cambiados a las bases que ya existen<small>Solo afecta las bases de las medidas cuyo precio modificaste.</small></span></label>
      <p class="err" id="md-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="md-ok">Guardar</button>`
  });
  const cont = $('#md-filas', d.el);
  const pintar = () => poner(cont, filas.map((m, i) => html`<div class="fila-edit" data-i="${i}"><input class="inp" data-k="nombre" value="${m.nombre}" maxlength="30" placeholder="Nombre" aria-label="Nombre de la medida"><input class="inp" data-k="dims" value="${m.dims}" maxlength="24" placeholder="1.50 × 2.00 m" aria-label="Dimensiones"><input class="inp" data-k="precio" inputmode="decimal" value="${m.precio || ''}" placeholder="Precio $" aria-label="Precio"><button type="button" class="icon-btn" data-quitar aria-label="Quitar ${m.nombre}" ${enUso(m.id) ? raw('disabled title="Hay productos con esta medida"') : ''}>${ico('basura')}</button></div>`));
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
    cuerpo: html`<p class="t-peq" style="margin-bottom:14px">Los tonos aparecen como un círculo de color en cada base.</p><div id="tn-filas"></div>
      <button type="button" class="btn btn-g btn-s" id="tn-add">${ico('plus')}Agregar tono</button><p class="err" id="tn-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="tn-ok">Guardar</button>`
  });
  const cont = $('#tn-filas', d.el);
  const pintar = () => poner(cont, filas.map((t, i) => html`<div class="fila-edit tono" data-i="${i}"><input type="color" data-k="hex" value="${hexOk(t.hex).toLowerCase()}" aria-label="Color de ${t.nombre}"><input class="inp" data-k="nombre" value="${t.nombre}" maxlength="24" placeholder="Nombre del tono" aria-label="Nombre del tono"><button type="button" class="icon-btn" data-quitar aria-label="Quitar ${t.nombre}" ${enUso(t.id) ? raw('disabled title="Hay productos con este tono"') : ''}>${ico('basura')}</button></div>`));
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

function formPinDueno() {
  const d = dialogo({
    titulo: 'PIN del dueño',
    cuerpo: html`<p class="t-peq" style="margin-bottom:14px">El dueño entra con su propio PIN y solo puede consultar: resumen, inventario, historial y gastos. No puede cambiar nada. Escribe tu PIN para confirmar y el PIN que usará el dueño.</p>
      <label class="campo"><span class="lbl">Tu PIN (almacén)</span><input class="inp pin" id="pd-act" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <label class="campo"><span class="lbl">PIN del dueño (6 a 8 números)</span><input class="inp pin" id="pd-nvo" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <label class="campo"><span class="lbl">Repite el PIN del dueño</span><input class="inp pin" id="pd-rep" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <p class="err" id="pd-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="pd-ok">Guardar PIN</button>`
  });
  const btn = $('#pd-ok', d.el), err = $('#pd-err', d.el);
  const enviar = () => guardando(btn, err, async () => {
    const nvo = $('#pd-nvo', d.el).value;
    if (nvo !== $('#pd-rep', d.el).value) throw new ErrorApi({ mensaje: 'Los dos PIN nuevos no coinciden.' });
    await op({ op: 'pin.dueno', pinActual: $('#pd-act', d.el).value, pinNuevo: nvo });
    d.cerrar();
    S.hayDueno = true;
    toast('Listo: el dueño ya puede entrar con su PIN.');
  });
  btn.addEventListener('click', enviar);
  d.el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') enviar(); });
}
function formPin(reiniciarTienda) {
  const d = dialogo({
    titulo: reiniciarTienda ? 'Nuevo PIN para el vendedor' : 'Cambiar mi PIN',
    cuerpo: html`<p class="t-peq" style="margin-bottom:14px">${reiniciarTienda ? 'Escribe tu PIN para confirmar y el PIN nuevo que usará el vendedor de la tienda. Su sesión actual se cerrará.' : 'Al cambiarlo se cierra tu sesión en los demás equipos.'}</p>
      <label class="campo"><span class="lbl">${reiniciarTienda ? 'Tu PIN (almacén)' : 'PIN actual'}</span><input class="inp pin" id="pn-act" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <label class="campo"><span class="lbl">PIN nuevo (6 a 8 números)</span><input class="inp pin" id="pn-nvo" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <label class="campo"><span class="lbl">Repite el PIN nuevo</span><input class="inp pin" id="pn-rep" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <p class="err" id="pn-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="pn-ok">Guardar PIN</button>`
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

/* ───────── exportar ───────── */
const csvCelda = (v) => { let s = v == null ? '' : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita que Excel ejecute fórmulas escritas por otro usuario
   return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const aCsv = (filas) => '﻿' + filas.map((f) => f.map(csvCelda).join(',')).join('\r\n');
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
  const e = S.est, loc = S.rol !== 'tienda';
  const cab = ['Producto', 'Categoría', 'Medida', 'Tono', 'Unidad', 'Precio', ...(loc ? ['Costo'] : []), 'Existencias almacén', 'Existencias tienda', 'En camino', 'Mínimo almacén', 'Mínimo tienda', 'Activo'];
  const filas = e.productos.slice().sort(ordenProductos).map((p) => { const m = medidaDe(p.medida), t = tonoDe(p.tono); return [p.nombre, CATS[p.cat].replace(/s$/, ''), m ? m.nombre : '', t ? t.nombre : '', p.unidad, p.precio, ...(loc ? [p.costo] : []), p.stock_local, p.stock_tienda, S.camino[p.id] || 0, p.min_local, p.min_tienda, p.activo ? 'Sí' : 'No']; });
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
    const cab = ['Fecha', 'Operación', 'Producto', 'Lugar', 'Cantidad', 'Precio', 'Responsable', 'Motivo', 'Nota', 'Cliente', 'Pago', 'Entrega', 'Envío', 'Anulada', 'Folio'];
    const filas = movs.map((m) => [fechaISO(m.ts), (TIPOS[m.tipo] ? TIPOS[m.tipo].t : m.tipo === 'anulacion' ? 'Anulación' : m.tipo), nombreProd(m.prod), m.loc === 'local' ? 'Almacén' : 'Tienda', m.delta, m.precio == null ? '' : m.precio, ROLES[m.rol].corto, MOTIVOS[m.motivo] || '', m.nota, m.cliente, PAGOS[m.pago] || '', ENTREGA_T[m.motivo] || '', m.envio || '', m.anulado ? 'Sí' : '', m.grupo]);
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

/* ───────── MÁS ───────── */
VISTAS.mas = {
  armar: () => html`<div class="pila" data-vista="mas" id="v-mas"></div>`,
  actualizar() {
    const cont = $('#v-mas');
    if (!cont) return;
    const e = S.est, local = S.rol === 'local', tema = store.get(CLAVE_TEMA) || 'auto';
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const fila = (ic, t, s, act) => html`<li><button type="button" class="item" data-act="${act}"><span class="ico-c">${ico(ic)}</span><div class="grow"><div class="item-t">${t}</div>${s ? html`<div class="item-s">${s}</div>` : ''}</div>${ico('der', 'der')}</button></li>`;
    poner(cont, html`
      <div class="cabecera"><div><h1 class="t-pant">Más</h1><p class="t-peq" style="margin-top:8px">${e.negocio.nombre} · ${ROLES[S.rol].nombre}</p></div></div>
      ${S.modo === 'local' ? html`<div class="aviso warn">${ico('alerta')}<div><b>Los datos están solo en este equipo.</b> La otra persona (almacén o vendedor) no los verá. Para compartir el inventario entre los dos hay que publicar la app con su servidor (mira el archivo README).</div></div>` : ''}
      <section class="sec-mas"><span class="t-sec">Mi cuenta</span><div class="card flat"><ul class="lista">
        ${fila('candado', 'Cambiar mi PIN', 'Cierra tu sesión en los demás equipos', 'pin-propio')}
        ${local ? fila('tienda', 'Reiniciar el PIN del vendedor', 'Si el vendedor lo olvidó', 'pin-tienda') : ''}
        ${local ? fila('usuario', 'PIN del dueño', e.dueno ? 'Cambiar el PIN con el que entra el dueño' : 'Crea el acceso del dueño (solo consulta)', 'pin-dueno') : ''}
        ${local ? fila('candado', 'Código de recuperación', 'Genera uno nuevo si perdiste el anterior', 'codigo-nuevo') : ''}
        ${local && S.modo !== 'local' ? fila('basura', 'Dejar todo en cero', 'Borra movimientos y existencias para empezar limpio', 'reiniciar') : ''}
        ${fila('x', 'Cerrar sesión', '', 'salir')}
      </ul></div></section>
      ${local ? html`<section class="sec-mas"><span class="t-sec">Negocio y catálogo</span><div class="card flat"><ul class="lista">
        ${fila('tienda', 'Datos del negocio y WhatsApp', e.negocio.nombre, 'negocio')}
        ${fila('cubo', 'Medidas y precios', plural(e.medidas.length, 'medida', 'medidas'), 'medidas')}
        ${fila('capas', 'Tonos', plural(e.tonos.length, 'tono', 'tonos'), 'tonos')}
      </ul></div></section>` : ''}
      <section class="sec-mas"><span class="t-sec">Datos</span><div class="card flat"><ul class="lista">
        ${local ? fila('tabla', 'Resumen del negocio', 'Producción, ventas, gastos y egresos', 'resumen') : ''}
        ${local || S.rol === 'dueno' ? fila('check', 'Revisar cuentas', 'Comprueba que el efectivo y los cobros cuadren y que no haya errores', 'cuentas') : ''}
        ${fila('reloj', 'Pedidos de clientes', 'Agenda de entregas: apuntar, programar y ver por calendario', 'agenda')}
        ${fila('salida', 'Gastos', S.rol === 'dueno' ? 'Salidas de dinero por día, semana y mes' : 'Salidas de dinero: registrar y ver por día, semana y mes', 'gastos')}
        ${fila('bajar', 'Exportar inventario', 'Hoja de cálculo (CSV) con las existencias de hoy', 'exportar-inv')}
        ${fila('bajar', 'Exportar movimientos', 'Todo el historial en CSV', 'exportar-movs')}
        ${local ? fila('bajar', 'Respaldo completo', 'Archivo JSON con productos y movimientos', 'respaldo') : ''}
      </ul></div></section>
      <section class="sec-mas"><span class="t-sec">Apariencia</span><div class="card"><div class="opciones">${[['auto', 'Automática'], ['claro', 'Clara'], ['oscuro', 'Oscura']].map(([k, t]) => html`<button type="button" class="opcion" data-act="tema" data-v="${k}" aria-pressed="${String(tema === k)}">${t}</button>`)}</div></div></section>
      ${!standalone ? html`<section class="sec-mas"><span class="t-sec">Instalar</span><div class="card">
        ${S.instalar ? html`<div class="sep"><span>Ábrela como una app, sin la barra del navegador.</span><button type="button" class="btn btn-p" data-act="instalar">Instalar app</button></div>`
          : ios ? html`<div class="fila" style="align-items:flex-start"><span class="ico-c info">${ico('info')}</span><span>En el iPhone o iPad toca <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>.</span></div>`
          : html`<span class="t-peq">Desde el menú del navegador elige “Instalar app” o “Agregar a pantalla de inicio” para abrirla como una app.</span>`}</div></section>` : ''}
      ${S.modo === 'local' ? html`<section class="sec-mas"><span class="t-sec">Este equipo</span><div class="card flat"><ul class="lista">${fila('basura', S.demo ? 'Salir de la demostración' : 'Borrar los datos de este equipo', S.demo ? 'Elimina los datos de ejemplo y vuelve al inicio' : 'Empezar desde cero. No se puede deshacer', S.demo ? 'salir-demo' : 'borrar-local')}</ul></div></section>` : ''}
      <p class="pie-app">Inventario Bases Box · versión ${Core.VERSION} · ${S.modo === 'local' ? 'datos en este equipo' : 'datos en la nube'}</p>`);
  }
};

/* ───────── acciones de los botones ───────── */
const A = {
  ir: (b) => irA(b.dataset.tabIr),
  sync: async () => { await sincronizar(true); toast(S.enLinea ? 'Datos actualizados.' : 'Sin conexión por ahora.', { tipo: S.enLinea ? undefined : 'error' }); },
  salir: () => salir(),
  'ver-bajos': () => irA('inventario', { bajo: true }),
  prod: (b) => abrirProducto(b.dataset.id),
  vender: (b) => { const p = S.idx[b.dataset.id]; if (p) abrirForma('venta', { inicial: [{ id: p.id, cant: 1, precio: p.precio ? String(p.precio) : '' }] }); },
  ventas: () => abrirVentas(),
  'prod-nuevo': () => formProducto(),
  agregar: () => {
    const d = dialogo({
      titulo: 'Agregar',
      cuerpo: html`<button type="button" class="agregar-op" id="ag-prod"><span class="ico-c acc">${ico('plus')}</span><span><b>Producto nuevo</b><span class="s">Una base, material o accesorio con su precio y existencias.</span></span></button>
        <button type="button" class="agregar-op" id="ag-gasto"><span class="ico-c warn">${ico('salida')}</span><span><b>Registrar gasto</b><span class="s">Salida de dinero: material, sueldos, renta, gasolina…</span></span></button>
        <button type="button" class="agregar-op" id="ag-bases"><span class="ico-c acc">${ico('capas')}</span><span><b>Crear bases (medida y tono)</b><span class="s">Genera varias bases de una vez: elige medidas y colores.</span></span></button>`,
      enfocar: false
    });
    $('#ag-prod', d.el).addEventListener('click', () => { d.cerrar(); formProducto(); });
    $('#ag-bases', d.el).addEventListener('click', () => { d.cerrar(); formVariantes(); });
    $('#ag-gasto', d.el).addEventListener('click', () => { d.cerrar(); formGasto(); });
  },
  variantes: () => formVariantes(),
  'filtro-cat': (b) => { S.filtro.cat = b.dataset.cat; VISTAS.inventario.actualizar(); },
  'filtro-bajo': () => { S.filtro.bajo = !S.filtro.bajo; VISTAS.inventario.actualizar(); },
  'filtro-arch': () => { S.filtro.archivados = !S.filtro.archivados; VISTAS.inventario.actualizar(); },
  forma: (b) => (b.dataset.tipo === 'recibir' ? recibirYa() : b.dataset.tipo === 'reporte' ? abrirReporteDia() : b.dataset.tipo === 'gasto' ? formGasto() : b.dataset.tipo === 'agenda' ? abrirAgenda() : abrirForma(b.dataset.tipo)),
  'reporte-dia': () => abrirReporteDia(),
  gastos: () => abrirGastos(),
  agenda: () => abrirAgenda(),
  cuentas: () => abrirCuentas(),
  'pedido-cliente-nuevo': () => formPedidoCliente(null, sumaK(hoyK(), 1)),
  'pdf-semana': (b) => descargarPdfSemanal(Number(b.dataset.sem) || 0, b),
  'venta-nueva': () => abrirForma('venta'),
  resumen: () => abrirResumen(),
  'pin-dueno': () => formPinDueno(),
  'gasto-nuevo': () => formGasto(),
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
    const ok = await confirmar({ titulo: 'Salir de la demostración', texto: 'Se borran los datos de ejemplo de este equipo y vuelves al inicio.', ok: 'Salir y borrar', cancelar: 'Volver', peligro: true });
    if (ok) reiniciarLocal();
  },
  'borrar-local': async () => {
    const t = await confirmar({ titulo: 'Borrar datos de este equipo', texto: 'Se borran productos, movimientos y PIN de este equipo. No se puede deshacer. Haz antes un respaldo si lo necesitas.', ok: 'Borrar todo', cancelar: 'Volver', peligro: true, campo: { etiqueta: 'Escribe BORRAR para confirmar', min: 6, error: 'Escribe la palabra BORRAR.', ayuda: 'BORRAR' } });
    if (t && t.trim().toUpperCase() === 'BORRAR') reiniciarLocal();
    else if (t) toast('No se borró nada: la palabra no coincide.', { tipo: 'error' });
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
    titulo: 'Código de recuperación',
    cuerpo: html`<div id="cn-cont"><p class="t-peq" style="margin-bottom:14px">El código sirve para crear un PIN nuevo si lo olvidas. Al generar uno nuevo, el anterior deja de servir. Escribe tu PIN para confirmar.</p>
      <label class="campo"><span class="lbl">Tu PIN (almacén)</span><input class="inp pin" id="cn-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label><p class="err" id="cn-err" hidden></p></div>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="cn-ok">Generar código</button>`
  });
  const btn = $('#cn-ok', d.el), err = $('#cn-err', d.el);
  const enviar = () => guardando(btn, err, async () => {
    const r = await op({ op: 'recup.nueva', pinActual: $('#cn-pin', d.el).value });
    poner($('#cn-cont', d.el), vistaCodigo(r.codigo));
    poner(d.pie, html`<button type="button" class="btn btn-p" data-cerrar>Listo, ya lo guardé</button>`);
    enlazarCopiar(d.el, r.codigo);
  });
  btn.addEventListener('click', enviar);
  d.el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && $('#cn-pin', d.el)) enviar(); });
}
function formReiniciar() {
  const d = dialogo({
    titulo: 'Dejar todo en cero',
    cuerpo: html`<div class="aviso warn" style="margin-bottom:14px">${ico('alerta')}<span class="grow">Esto <b>borra todos los movimientos, envíos, pedidos y existencias</b>. Se conservan los productos, los precios, los PIN y los datos del negocio. No se puede deshacer.</span></div>
      <button type="button" class="btn btn-g btn-b" id="rz-resp" style="margin-bottom:14px">Descargar respaldo antes</button>
      <label class="campo"><span class="lbl">Tu PIN (almacén)</span><input class="inp pin" id="rz-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <label class="campo"><span class="lbl">Escribe BORRAR TODO para confirmar</span><input class="inp" id="rz-frase" autocomplete="off" autocapitalize="characters" maxlength="20"></label>
      <p class="err" id="rz-err" hidden></p>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-r" id="rz-ok">Dejar en cero</button>`
  });
  $('#rz-resp', d.el).addEventListener('click', (ev) => respaldoCompleto(ev.currentTarget));
  const btn = $('#rz-ok', d.el), err = $('#rz-err', d.el);
  btn.addEventListener('click', () => guardando(btn, err, async () => {
    await op({ op: 'sistema.reiniciar', pinActual: $('#rz-pin', d.el).value, confirmacion: $('#rz-frase', d.el).value });
    S.hist.rev = null;
    d.cerrar();
    toast('Listo: todo quedó en cero.');
  }));
}
const vistaCodigo = (codigo) => html`<p class="t-peq" style="margin-bottom:12px">Guárdalo en un lugar seguro (una foto, tu gestor de contraseñas o un papel). Solo se muestra ahora.</p><span class="codigo" id="codigo-v">${codigo}</span><div style="margin-top:12px"><button type="button" class="btn btn-g btn-b" id="cod-copiar">${ico('copiar')}Copiar código</button></div>`;
function enlazarCopiar(raiz, codigo) {
  const b = $('#cod-copiar', raiz);
  if (!b) return;
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(codigo); toast('Código copiado.'); } catch (e) {
      const r = document.createRange(); r.selectNodeContents($('#codigo-v', raiz)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Selecciónalo y cópialo.');
    }
  });
}

/* ───────── sesión ───────── */
function salir(msg) {
  $$('dialog.sheet').forEach((d) => d.close());
  S.token = ''; S.est = null; S.rol = ''; S.idx = {}; S.avisoAgenda = false; S.cuentas = null; S.avisoCuentas = false;
  store.del(CLAVE_SESION); sesionTmp.del(CLAVE_SESION); store.del(CLAVE_CACHE);
  pantallaLogin(msg);
}

/* ───────── pantallas de acceso ───────── */
const cabeceraMarca = () => html`<div class="marca-g"><span class="logo"><img src="logo.png" alt="" width="84" height="84"></span><h1>Bases Bo<b>x</b></h1><span class="sub">Tepic · Inventario</span><div class="tonos-fila" aria-hidden="true">${Core.TONOS_BASE.map((t) => html`<i style="background:${t.hex}"></i>`)}</div></div>`;
const pie = () => html`<p class="pie-app" style="margin-top:0">Versión ${Core.VERSION} · ${S.modo === 'local' ? 'Los datos viven en este equipo' : 'Datos en la nube'}</p>`;
function pinError(p) {
  if (!/^\d{6,8}$/.test(p)) return 'El PIN debe tener de 6 a 8 números.';
  if (/^(\d)\1+$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p)) return 'Ese PIN es muy fácil de adivinar. Elige otro.';
  return '';
}

function pantallaLogin(msg) {
  let rol = S.modo === 'local' && S.demo ? null : store.get(CLAVE_ROL);
  if (!ROLES[rol] || (rol === 'dueno' && !S.hayDueno && !S.demo)) rol = null;
  const render = () => {
    poner($('#raiz'), html`<div class="acceso"><div class="acceso-in">
      ${cabeceraMarca()}
      ${msg ? html`<div class="aviso warn">${ico('info')}<span>${msg}</span></div>` : ''}
      ${S.demo ? html`<div class="aviso">${ico('info')}<span><b>Demostración.</b> PIN del almacén: <b>1111</b> · vendedor: <b>2222</b> · dueño: <b>3333</b>.</span></div>` : ''}
      ${!rol ? html`<div class="pila"><h2 class="t-sec" style="text-align:center">¿Quién entra?</h2>${Object.keys(ROLES).filter((k) => k !== 'dueno' || S.hayDueno || S.demo).map((k) => html`<button type="button" class="rol-btn" data-rol="${k}"><span class="ico-c acc" style="width:48px;height:48px">${ico(ROLES[k].ic, 'g')}</span><span><b>${ROLES[k].nombre}</b><span>${ROLES[k].desc}</span></span></button>`)}</div>`
        : html`<form class="card pila" id="lg-form" novalidate>
          <div class="fila"><span class="ico-c acc">${ico(ROLES[rol].ic)}</span><div class="grow"><div class="item-t">${ROLES[rol].nombre}</div></div><button type="button" class="btn btn-g btn-s" id="lg-cambiar">Cambiar</button></div>
          <label class="campo" style="margin:0"><span class="lbl">Tu PIN</span><input class="inp pin" id="lg-pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8" autofocus></label>
          <label class="check-fila" style="margin:0"><input type="checkbox" id="lg-rec" ${S.recordar ? raw('checked') : ''}><label for="lg-rec" style="font-size:15px">Mantener la sesión en este equipo</label></label>
          <p class="err" id="lg-err" hidden></p>
          <button type="submit" class="btn btn-p btn-b" id="lg-ok">Entrar</button>
          <button type="button" class="btn btn-g btn-s btn-b" id="lg-olvide">Olvidé mi PIN</button></form>`}
      ${pie()}
    </div></div>`);
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
    titulo: 'Olvidé mi PIN',
    cuerpo: html`<div id="ol-cont"><p class="t-peq" style="margin-bottom:14px">Escribe el código de recuperación que te dieron al configurar la app y elige un PIN nuevo.</p>
      <label class="campo"><span class="lbl">Código de recuperación</span><input class="inp" id="ol-cod" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX" maxlength="12" style="text-transform:uppercase;letter-spacing:.12em"></label>
      <label class="campo"><span class="lbl">¿De quién es el PIN?</span><select class="inp" id="ol-rol">${Object.keys(ROLES).map((k) => html`<option value="${k}" ${k === rolInicial ? raw('selected') : ''}>${ROLES[k].nombre}</option>`)}</select></label>
      <label class="campo"><span class="lbl">PIN nuevo (6 a 8 números)</span><input class="inp pin" id="ol-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <label class="campo"><span class="lbl">Repite el PIN nuevo</span><input class="inp pin" id="ol-pin2" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></label>
      <p class="err" id="ol-err" hidden></p></div>`,
    pie: html`<button type="button" class="btn btn-g" data-cerrar>Cancelar</button><button type="button" class="btn btn-p" id="ol-ok">Cambiar PIN</button>`,
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
    poner($('#ol-cont', d.el), html`<div class="aviso" style="margin-bottom:14px">${ico('check')}<span>Listo, tu PIN nuevo ya funciona. El código anterior dejó de servir; guarda este.</span></div>${vistaCodigo(codigoNuevo)}`);
    poner(d.pie, html`<button type="button" class="btn btn-p" data-cerrar>Entrar</button>`);
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
  const puntos = () => html`<div class="pasos" aria-label="Paso ${paso} de 3">${[1, 2, 3].map((n) => html`<i class="${n <= paso ? 'on' : ''}"></i>`)}</div>`;
  const campoPin = (id, et, v) => html`<label class="campo"><span class="lbl">${et}</span><input class="inp pin" id="${id}" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8" value="${v}"></label>`;

  function cuerpo() {
    if (paso === 0) {
      return html`<div class="pila"><div class="aviso warn">${ico('alerta')}<span>Esta copia funciona <b>sin servidor</b>: los datos se guardan solo en este equipo. Sirve para probar. Para que los dos usuarios compartan el inventario hay que publicar la app con su servidor (README).</span></div>
        <button type="button" class="rol-btn" id="su-empezar"><span class="ico-c acc" style="width:48px;height:48px">${ico('cubo', 'g')}</span><span><b>Configurar mi inventario</b><span>Empieza con tu negocio, tus PIN y el catálogo.</span></span></button>
        <button type="button" class="rol-btn" id="su-demo"><span class="ico-c info" style="width:48px;height:48px">${ico('reloj', 'g')}</span><span><b>Ver una demostración</b><span>Datos de ejemplo de un mes: ventas, envíos y alertas.</span></span></button></div>`;
    }
    if (paso === 1) {
      return html`${puntos()}<h2 class="t-sec" style="text-align:center">Tu negocio</h2>
        ${pideClave ? html`<label class="campo"><span class="lbl">Clave de instalación</span><input class="inp" id="su-clave" maxlength="20" value="${D.clave}" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX" style="text-transform:uppercase;letter-spacing:.08em"><span class="ayuda">La imprimió el comando de publicación. Solo se pide en esta primera configuración.</span></label>` : ''}
        <label class="campo"><span class="lbl">Nombre del negocio</span><input class="inp" id="su-nombre" maxlength="60" value="${D.nombre}" autocomplete="off"></label>`;
    }
    if (paso === 2) {
      return html`${puntos()}<h2 class="t-sec" style="text-align:center">Un PIN para cada usuario</h2><p class="t-peq" style="text-align:center">De 6 a 8 números. Cada quien entra con el suyo y puede cambiarlo después.</p>
        <div class="card" style="padding:14px 14px 2px"><div class="item-t" style="margin-bottom:8px">${ico('fabrica')} Almacén</div>${campoPin('su-pl', 'PIN', D.pinL)}${campoPin('su-pl2', 'Repite el PIN', D.pinL2)}</div>
        <div class="card" style="padding:14px 14px 2px"><div class="item-t" style="margin-bottom:8px">${ico('tienda')} Vendedor tienda</div>${campoPin('su-pt', 'PIN', D.pinT)}${campoPin('su-pt2', 'Repite el PIN', D.pinT2)}</div>`;
    }
    if (paso === 3) {
      return html`${puntos()}<h2 class="t-sec" style="text-align:center">Catálogo inicial</h2><p class="t-peq" style="text-align:center">Todo se puede cambiar o archivar después.</p>
        <div class="check-fila"><input type="checkbox" id="su-bases" ${D.bases ? raw('checked') : ''}><label for="su-bases">Bases por medida y tono<small>${nM} medidas × ${nT} tonos = ${plural(nM * nT, 'base', 'bases')} para empezar. Los precios los pones tú después.</small></label></div>
        <div class="check-fila"><input type="checkbox" id="su-extras" ${D.extras ? raw('checked') : ''}><label for="su-extras">Materiales y accesorios comunes<small>${Core.EXTRAS_BASE.map((x) => x.nombre).join(', ')}.</small></label></div>`;
    }
    return html`<div class="pila"><div class="aviso">${ico('check')}<span><b>¡Listo!</b> Tu inventario está configurado y entraste como Almacén.</span></div>
      <h2 class="t-sec">Código de recuperación</h2>${vistaCodigo(codigo)}
      <label class="check-fila" style="margin:0"><input type="checkbox" id="su-guardado"><label for="su-guardado">Ya guardé mi código en un lugar seguro</label></label></div>`;
  }

  function pintarPaso() {
    const ultimo = paso === 4;
    poner($('#raiz'), html`<div class="acceso"><div class="acceso-in">${cabeceraMarca()}
      ${paso === 0 ? cuerpo() : html`<form class="card pila" id="su-form" novalidate>${cuerpo()}<p class="err" id="su-err" hidden></p>
        <div class="fila w" style="justify-content:flex-end;gap:10px">${paso > 1 && !ultimo ? html`<button type="button" class="btn btn-g" id="su-atras" style="flex:1">Atrás</button>` : paso === 1 && local ? html`<button type="button" class="btn btn-g" id="su-atras" style="flex:1">Atrás</button>` : ''}
        <button type="submit" class="btn btn-p" id="su-ok" style="flex:2">${ultimo ? 'Entrar a mi inventario' : paso === 3 ? 'Crear mi inventario' : 'Siguiente'}</button></div></form>`}
      ${pie()}</div></div>`);
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
          if (!$('#su-guardado').checked) throw new ErrorApi({ mensaje: 'Marca la casilla cuando hayas guardado tu código.' });
          await cargarEstado();
          irA('inicio', { forzar: true });
          return;
        }
        leer();
        if (paso === 1) {
          if (pideClave && !D.clave.trim()) throw new ErrorApi({ mensaje: 'Escribe la clave de instalación.' });
          if (!D.nombre.trim()) throw new ErrorApi({ mensaje: 'Escribe el nombre del negocio.' });
          paso = 2; pintarPaso(); return;
        }
        if (paso === 2) {
          const e1 = pinError(D.pinL), e2 = pinError(D.pinT);
          if (e1) throw new ErrorApi({ mensaje: 'PIN del almacén: ' + e1 });
          if (e2) throw new ErrorApi({ mensaje: 'PIN del vendedor: ' + e2 });
          if (D.pinL !== D.pinL2) throw new ErrorApi({ mensaje: 'Los dos PIN del almacén no coinciden.' });
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
  poner($('#raiz'), html`<div class="acceso"><div class="acceso-in">${cabeceraMarca()}<div class="card pila"><h2 class="t-sec">${titulo}</h2><p>${texto}</p><div class="pila">${botones.map((b, i) => html`<button type="button" class="btn ${i ? 'btn-g' : 'btn-p'} btn-b" data-i="${i}">${b[0]}</button>`)}</div></div></div></div>`);
  $$('[data-i]').forEach((el) => el.addEventListener('click', () => botones[+el.dataset.i][1]()));
}

/* ───────── arranque ───────── */
// ¿Hay servidor? Una respuesta que no es de nuestra API (hosting estático) o un bloqueo inicial = modo local.
// Si ya sabíamos que este equipo usa el servidor, un fallo de red es “sin internet”, nunca “sin servidor”.
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
    pantallaMensaje('Sin conexión', 'Esta es la primera vez que abres la app en este equipo y no hay internet. Conéctate y vuelve a intentarlo.', [['Reintentar', () => location.reload()]]);
    return;
  }
  if (modo === 'sin_db') {
    S.modo = 'servidor';
    pantallaMensaje('Falta conectar la base de datos', 'El servidor de la app está en línea pero no encuentra su base de datos D1 (el enlace debe llamarse “DB”). Revisa el README o usa la app solo en este equipo mientras lo resuelves.', [['Reintentar', () => location.reload()], ['Usar solo en este equipo', () => { S.modo = 'local'; iniciarLocal(); }]]);
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
      if (await cargarEstado()) irA(tabDeHash(), { forzar: true }); // si no, cargarEstado ya mostró el acceso (sesión vencida)
      return;
    } catch (e) {
      if (e instanceof ErrorRed) {
        try {
          const c = JSON.parse(store.get(CLAVE_CACHE) || 'null');
          if (c && c.est && c.est.rol === ses.rol) {
            aplicarEstado(c.est);
            irA(tabDeHash(), { forzar: true });
            toast('Sin conexión. Estás viendo la última copia (' + hace(c.ts) + ').', { tipo: 'error', ms: 8000 });
            return;
          }
        } catch (e2) { /* sin copia guardada */ }
        return pantallaMensaje('Sin conexión', 'No pude cargar el inventario. Revisa tu internet e inténtalo de nuevo.', [['Reintentar', () => location.reload()]]);
      }
      if (e instanceof ErrorApi && e.code === 'no_configurado') return pantallaSetup();
      console.error(e);
      S.token = '';
    }
  }
  let ping;
  try { ping = await llamar('GET', '/ping'); } catch (e) {
    return pantallaMensaje('Sin conexión', 'No pude hablar con el servidor. Revisa tu internet e inténtalo de nuevo.', [['Reintentar', () => location.reload()]]);
  }
  if (!ping.json.ok) return pantallaMensaje('Algo falló', ping.json.error ? ping.json.error.mensaje : 'No se pudo iniciar la app.', [['Reintentar', () => location.reload()]]);
  if (!ping.json.configurado) return pantallaSetup(ping.json);
  S.hayDueno = !!ping.json.dueno;
  pantallaLogin();
}

/* ───────── eventos globales ───────── */
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
  pantallaMensaje('Algo falló', 'No se pudo iniciar la app. Recarga la página.', [['Recargar', () => location.reload()]]);
});
})();
