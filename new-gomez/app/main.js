// Arranque del panel: sesión, barbería activa, shell por rol (sidebar / barra inferior), rutas y PWA.
import { api, getMode, setMode, health, on401, SITE_BASE, LS, resetDemo, demoCredentials } from './lib/api.js';
import { state, bus, loadMe, clearSession, selectShop, preferredShopId, canAny, role, isSuper, shop, refreshContext } from './lib/state.js';
import { defineRoutes, parseHash, match, navigate, startRouter } from './lib/router.js';
import { html, raw, esc, $, $$, on } from './lib/html.js';
import { icon } from './lib/icons.js';
import { toast, modal, confirmDialog, menu, avatar, emptyState, errorState, spinner, closeAllModals } from './lib/ui.js';
import { ROLE, shopMark } from './lib/fmt.js';

const V = (name) => () => import('./views/' + name + '.js');
const STAFF_ROLES = ['owner', 'superadmin', 'barber'];
// Navegación lateral (barra completa ≥1024, riel en tablet) o barra inferior (teléfono). Mismas consultas que app.css.
const SIDE_Q = '(min-width:1024px), (min-width:720px) and (min-height:600px)';

defineRoutes([
  { path: '/login', view: V('login'), public: true, title: 'Iniciar sesión' },
  { path: '/demo', view: V('demo'), public: true, title: 'Demo' },
  { path: '/registro', view: V('register'), public: true, title: 'Crear cuenta' },
  { path: '/crear-barberia', view: V('signup'), public: true, title: 'Crea tu barbería' },
  { path: '/instalar', view: V('install'), public: true, shellIfAuthed: true, title: 'Instalar app' },
  { path: '/guia', view: V('guide'), public: true, shellIfAuthed: true, title: 'Guía de la demo' },
  { path: '/inicio', view: V('dashboard'), roles: STAFF_ROLES, title: 'Inicio' },
  { path: '/agenda', view: V('agenda'), perm: ['appointments.read.all', 'appointments.read.own'], title: 'Agenda' },
  { path: '/clientes', view: V('clients'), perm: ['clients.read.all', 'clients.read.own'], title: 'Clientes' },
  { path: '/clientes/:id', view: V('client-detail'), perm: ['clients.read.all', 'clients.read.own'], title: 'Cliente', nav: '/clientes' },
  { path: '/mensajes', view: V('messages'), perm: 'messages.send', title: 'WhatsApp' },
  { path: '/notificaciones', view: V('notifications'), perm: 'notifications.read', title: 'Notificaciones' },
  { path: '/caja', view: V('cash'), perm: 'cash.read', title: 'Caja y pagos' },
  { path: '/comisiones', view: V('commissions'), perm: ['commissions.read.all', 'commissions.read.own'], title: 'Comisiones' },
  { path: '/reportes', view: V('reports'), perm: 'reports.read', title: 'Reportes' },
  { path: '/equipo', view: V('team'), perm: 'staff.manage', title: 'Equipo' },
  { path: '/servicios', view: V('services'), perm: 'services.manage', title: 'Servicios' },
  { path: '/horarios', view: V('availability'), perm: ['availability.manage.all', 'availability.manage.own'], title: 'Horarios' },
  { path: '/enlace', view: V('booking-link'), perm: 'shop.update', title: 'Enlace de reservas y QR' },
  { path: '/ajustes', view: V('settings'), perm: 'settings.manage', title: 'Ajustes' },
  { path: '/perfil', view: V('profile'), auth: true, title: 'Mi perfil' },
  { path: '/mis-citas', view: V('my-appointments'), roles: ['client'], title: 'Mis citas' },
  { path: '/plataforma', view: V('platform'), superOnly: true, noShop: true, title: 'Plataforma' }
]);

// ── Navegación por rol ──
const bookingUrl = () => (shop() ? SITE_BASE + '?b=' + encodeURIComponent(shop().slug) : SITE_BASE);
const NAV = [
  { group: '', items: [
    { path: '/inicio', label: () => (role() === 'barber' ? 'Mi día' : 'Inicio'), icon: 'home', roles: STAFF_ROLES },
    { path: '/agenda', label: 'Agenda', icon: 'calendar', perm: ['appointments.read.all', 'appointments.read.own'] },
    { path: '/clientes', label: () => (role() === 'barber' ? 'Mis clientes' : 'Clientes'), short: 'Clientes', icon: 'users', perm: ['clients.read.all', 'clients.read.own'] },
    { path: '/mensajes', label: 'WhatsApp', icon: 'whatsapp', perm: 'messages.send' },
    { path: '/mis-citas', label: 'Mis citas', icon: 'calendar-check', roles: ['client'] },
    // Enlaces con href (página pública): misma pestaña en la barra lateral, «Más» y la barra inferior; con _blank la
    // app instalada (PWA) mandaría al cliente al navegador.
    { href: bookingUrl, label: 'Reservar cita', short: 'Reservar', icon: 'calendar-plus', roles: ['client'] },
    { path: '/notificaciones', label: 'Notificaciones', short: 'Avisos', icon: 'bell', perm: 'notifications.read', count: true }
  ] },
  { group: 'Negocio', items: [
    { path: '/caja', label: 'Caja y pagos', short: 'Caja', icon: 'wallet', perm: 'cash.read' },
    { path: '/comisiones', label: () => (role() === 'barber' ? 'Mis ganancias' : 'Comisiones'), short: () => (role() === 'barber' ? 'Ganancias' : 'Comisiones'), icon: 'percent', perm: ['commissions.read.all', 'commissions.read.own'] },
    { path: '/reportes', label: 'Reportes', icon: 'chart', perm: 'reports.read' }
  ] },
  { group: 'Configuración', items: [
    { path: '/equipo', label: 'Equipo', icon: 'scissors', perm: 'staff.manage' },
    { path: '/servicios', label: 'Servicios', icon: 'tag', perm: 'services.manage' },
    { path: '/horarios', label: () => (role() === 'barber' ? 'Mi horario' : 'Horarios'), short: () => (role() === 'barber' ? 'Horario' : 'Horarios'), icon: 'clock', perm: ['availability.manage.all', 'availability.manage.own'] },
    { path: '/enlace', label: 'Enlace y QR', short: 'Enlace', icon: 'qr', perm: 'shop.update' },
    { path: '/ajustes', label: 'Ajustes', icon: 'settings', perm: 'settings.manage' }
  ] },
  { group: 'Plataforma', items: [{ path: '/plataforma', label: 'Barberías', icon: 'shield', superOnly: true }] }
];
function visible(it) {
  if (it.superOnly) return isSuper();
  if (!state.ctx) return false;
  if (it.roles && !it.roles.includes(role())) return false;
  if (it.perm && !canAny([].concat(it.perm))) return false;
  return true;
}
const labelOf = (it) => (typeof it.label === 'function' ? it.label() : it.label);
const shortOf = (it) => (typeof it.short === 'function' ? it.short() : it.short) || labelOf(it);
// Etiqueta completa (barra lateral) y corta (riel de tablet); CSS muestra una u otra.
const navLabel = (it) => '<span class="nl">' + esc(labelOf(it)) + '</span><span class="ns">' + esc(shortOf(it)) + '</span>';

// ── Tema ──
function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
  const dark = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0F0E0B' : '#F5F3EE');
}
export function setTheme(t) { LS.set('tb:theme', t); applyTheme(t); }
export const getTheme = () => LS.get('tb:theme') || 'auto';
applyTheme(getTheme());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getTheme()));

// ── PWA: service worker, instalación y estado de conexión ──
export const pwa = { prompt: null, installed: window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true };
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pwa.prompt = e; bus.emit('pwa:installable', e); });
window.addEventListener('appinstalled', () => { pwa.prompt = null; pwa.installed = true; toast.success('¡App instalada! Ábrela desde tu pantalla de inicio.'); bus.emit('pwa:installed'); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(SITE_BASE + 'sw.js', { scope: SITE_BASE });
      // Nueva versión lista → se ofrece actualizar sin esperar a cerrar todas las pestañas.
      const offer = (w) => { if (!w || !navigator.serviceWorker.controller) return; toast.info('Hay una versión nueva de la app.', { duration: 15000, action: { label: 'Actualizar', onClick: () => w.postMessage({ type: 'SKIP_WAITING' }) } }); };
      if (reg.waiting) offer(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
      let reloaded = false;
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded || !hadController) return; reloaded = true; location.reload(); });
      setInterval(() => reg.update().catch(() => {}), 30 * 60000);
    } catch (e) { /* sin SW: la app funciona igual */ }
  });
}
function offlineBar() {
  let bar = $('.offline-bar');
  if (navigator.onLine === false) {
    if (!bar) { bar = document.createElement('div'); bar.className = 'offline-bar'; bar.textContent = 'Sin conexión — mostraremos los cambios cuando vuelva el internet'; document.body.appendChild(bar); }
  } else if (bar) { bar.remove(); if (state.ctx) toast.success('Conexión restablecida'); }
}
window.addEventListener('online', offlineBar);
window.addEventListener('offline', offlineBar);
if (navigator.onLine === false) window.addEventListener('DOMContentLoaded', offlineBar);

// ── Arranque ──
const root = document.getElementById('app');
let current = { cleanup: null, key: '' };
let shellEl = null;
let netError = null;   // no se pudo comprobar la sesión por falta de red (la cookie puede seguir siendo válida)
let shopError = null;  // /api/context rechazó la barbería por suspendida: { kind: 'suspended', name, role }

async function boot() {
  state.mode = getMode();
  on401(() => {
    if (!state.user && !state.staff) return;
    clearSession();
    toast.info('Tu sesión terminó. Vuelve a entrar.');
    navigate('/login', { replace: true });
  });
  await checkSession();
  hideSplash();
  startRouter(route);
  bus.on('context', () => { renderShell(); route(); });
  // Refresco de la misma barbería (p. ej. tras guardar Ajustes): se reconstruye el shell conservando la vista,
  // su estado y el scroll.
  bus.on('context:refresh', repaintShell);
  setInterval(pollUnread, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollUnread(); });
  window.addEventListener('online', () => { if (netError) retrySession(); });
}
async function checkSession() {
  netError = null;
  try {
    // Entrar directo a #/demo sin sesión de demo: no hace falta consultar al servidor (evita un 404 en hosting estático).
    // Entrar directo a la demo (o registrarse en una barbería de la demo) no necesita al servidor.
    const h0 = parseHash();
    const demoEntry = h0.path === '/demo' || (h0.path === '/registro' && /^demo(-norte)?$/.test(h0.query.b || ''));
    if (getMode() !== 'demo' && demoEntry) throw Object.assign(new Error('skip'), { code: 'skip' });
    await loadMe();
  } catch (e) {
    clearSession();
    // Sin red no es lo mismo que sin sesión: no se manda al login (la cookie puede seguir sirviendo).
    if (e.code === 'network') netError = e;
    if (e.code === 'backend_unavailable' || e.code === 'backend_not_configured' || e.code === 'network') state.backendDown = e;
  }
  if (state.user || state.staff) await ensureShop();
}
async function retrySession(btn) {
  if (btn) btn.setAttribute('aria-busy', 'true');
  await checkSession();
  if (btn && btn.isConnected) btn.removeAttribute('aria-busy');
  if (netError) { if (btn) toast.error(netError); return; }
  shellEl = null;
  if (!state.ctx) route(); // con barbería, selectShop ya emitió 'context' (shell + ruta)
}
// 403 con código propio (core/router.js → resolveShop): no se depende del texto del mensaje.
const isSuspendedError = (e) => !!e && e.status === 403 && e.code === 'shop_suspended';
// Barbería activa al entrar. Si la preferida está suspendida se prueba con las demás del usuario; si ninguna
// sirve, renderSuspended lo explica (en lugar de «aún no perteneces a ninguna barbería» o «Sin acceso»).
async function ensureShop() {
  shopError = null;
  const id = preferredShopId();
  if (!id) return;
  const ids = [id].concat((state.contexts || []).map((c) => c.shop_id).filter((x) => x !== id));
  for (const sid of ids) {
    try {
      await selectShop(sid);
      if (shopError) toast.info('«' + shopError.name + '» está suspendida. Te mostramos ' + shop().name + '.');
      shopError = null;
      return;
    } catch (e) {
      state.ctx = null;
      if (!isSuspendedError(e)) { toast.error(e); return; }
      if (!shopError) { const c = (state.contexts || []).find((x) => x.shop_id === sid); shopError = { kind: 'suspended', name: c ? c.shop_name : '', role: c ? c.role : '' }; }
    }
  }
}
// Con sesión, sin superadmin y sin barbería activa porque las suyas están suspendidas → { name, role, count }
// (count: cuántas barberías distintas suyas están suspendidas). Si no, null.
function suspendedInfo() {
  if (state.ctx || isSuper() || !(state.user || state.staff)) return null;
  const ctxs = state.contexts || [];
  const count = Math.max(1, new Set(ctxs.filter((c) => c.shop_status === 'suspended').map((c) => c.shop_id)).size);
  if (shopError && shopError.kind === 'suspended') return Object.assign({}, shopError, { count });
  if (ctxs.length && ctxs.every((c) => c.shop_status === 'suspended')) return { kind: 'suspended', name: ctxs[0].shop_name, role: ctxs[0].role, count };
  return null;
}
function hideSplash() { const s = document.getElementById('splash'); if (s) { s.classList.add('out'); setTimeout(() => s.remove(), 400); } }

function homePath() {
  if (!state.user && !state.staff) return netError ? '/inicio' : '/login';
  if (!state.ctx) {
    if (isSuper()) return '/plataforma';
    const sus = suspendedInfo(); // su pantalla sale en cualquier ruta; la de su rol sirve al reactivarse
    return sus ? (sus.role === 'client' ? '/mis-citas' : '/inicio') : '/perfil';
  }
  return role() === 'client' ? '/mis-citas' : '/inicio';
}

// ── Historial y modales ──
// Cada entrada del historial lleva un índice (tbi) para distinguir «Atrás» de una navegación nueva. Con un modal
// abierto, Atrás (navegador o botón de Android) cierra primero el modal y la pantalla se queda donde estaba;
// cualquier otra navegación cierra los modales para que no queden encima de otra pantalla.
let histIdx = 0;
// El router y algunas vistas reemplazan la entrada actual con estado null (filtros en la URL): conserva su índice.
const nativeReplaceState = history.replaceState.bind(history);
history.replaceState = function (st, title, url) {
  const cur = history.state;
  if ((st == null || (typeof st === 'object' && !('tbi' in st))) && cur && typeof cur.tbi === 'number') st = Object.assign({}, st, { tbi: cur.tbi });
  return nativeReplaceState(st, title, url);
};
function stampHistory() {
  const s = history.state;
  if (s && typeof s.tbi === 'number') { histIdx = s.tbi; return; }
  histIdx += 1;
  try { history.replaceState(Object.assign({}, s, { tbi: histIdx }), ''); } catch (e) { /* */ }
}
const openOverlays = () => $$('.overlay').filter((o) => !o.classList.contains('closing'));
function backClosesModal(e) {
  const open = openOverlays();
  const s = history.state;
  if (!open.length || !e.oldURL || !(s && typeof s.tbi === 'number' && s.tbi < histIdx)) return false;
  try { history.pushState({ tbi: histIdx }, '', e.oldURL); } catch (x) { return false; }
  const x = open[open.length - 1].querySelector('.modal-head [data-close]');
  if (x) x.click(); // mismo camino que la X: respeta «¿descartar cambios?»
  return true;
}

async function route(e) {
  const { path, query } = parseHash();
  if (path === '/' || path === '') return navigate(homePath(), { replace: true });
  if (path === '/panel') return navigate(homePath(), { replace: true });
  if (e && e.type === 'hashchange' && backClosesModal(e)) return;
  $$('.menu').forEach((m) => m.remove());
  if (openOverlays().length) closeAllModals();
  stampHistory();
  const m = match(path);
  const authed = !!(state.user || state.staff);
  if (authed) netError = null;
  // Solo barberías suspendidas: pantalla propia, sin navegación del panel (ni «Sin acceso» ni «no encontrada»).
  const sus = authed ? suspendedInfo() : null;
  if (!m) return sus ? renderSuspended(sus) : renderPage(null, { notFound: true });
  const r = m.route;
  if (r.public && !(r.shellIfAuthed && authed && !sus)) {
    if (authed && ['/login', '/registro', '/crear-barberia'].includes(path) && !query.next) return navigate(homePath(), { replace: true });
    return renderBare(r, m.params, query);
  }
  if (!r.public && !authed) {
    if (netError) return renderOffline();
    return navigate('/login', { replace: true, query: { next: location.hash.slice(1) } });
  }
  if (sus) return renderSuspended(sus);
  if (!r.public && !state.ctx && r.path !== '/perfil') {
    if (isSuper()) { if (!r.noShop) return navigate('/plataforma', { replace: true }); }
    else return renderPage(r, r.noShop ? { forbidden: true } : { noShop: true });
  }
  if (!allowed(r)) return renderPage(r, { forbidden: true });
  return renderPage(r, { params: m.params, query });
}
function allowed(r) {
  if (r.superOnly) return isSuper();
  if (r.roles && !r.roles.includes(role())) return false;
  if (r.perm && !canAny([].concat(r.perm))) return false;
  return true;
}

async function loadView(r) {
  try { return (await r.view()).default; }
  catch (e) { console.error(e); return { title: r.title, render: (el) => { el.innerHTML = String(errorState({ message: 'Esta sección aún no está disponible.' })); } }; }
}
function runCleanup() { if (typeof current.cleanup === 'function') { try { current.cleanup(); } catch (e) { /* */ } } current.cleanup = null; }

let renderSeq = 0; // cada render nuevo invalida a los anteriores que sigan cargando
async function renderBare(r, params, query) {
  const seq = ++renderSeq;
  runCleanup();
  shellEl = null;
  document.body.classList.remove('has-shell');
  root.innerHTML = '<div id="bare">' + String(spinner()) + '</div>';
  const view = await loadView(r);
  const el = $('#bare');
  if (!el || seq !== renderSeq) return;
  document.title = (view.title || r.title || '') + ' · TuBarbería';
  const cleanup = await view.render(el, { params, query, navigate, bare: true });
  if (seq !== renderSeq) { if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { /* */ } } return; }
  current.cleanup = cleanup;
}
// Recarga sin internet con una sesión que quizá sigue viva: se explica y se reintenta solo al volver la red.
function renderOffline() {
  ++renderSeq;
  runCleanup();
  shellEl = null;
  current.key = '';
  document.body.classList.remove('has-shell');
  document.title = 'Sin conexión · TuBarbería';
  root.innerHTML = '<div id="bare"><div class="page" style="min-height:100vh;min-height:100dvh;display:grid;place-items:center">' + String(emptyState({
    icon: 'alert', title: 'Sin conexión',
    text: 'No pudimos comprobar tu sesión porque no hay internet. No la cerramos: en cuanto vuelva la conexión sigues donde estabas.',
    action: { label: 'Reintentar', id: 'offRetry', icon: 'refresh' }
  })) + '</div></div>';
  const b = $('#offRetry');
  if (b) b.addEventListener('click', () => retrySession(b));
}

// Todas sus barberías suspendidas (y no es superadmin): una pantalla propia, sin barra lateral ni inferior. Dice qué
// pasa y con quién hablar, y deja reintentar (tras hablar con soporte) o cerrar sesión. En la demo conserva su cinta.
function renderSuspended(info) {
  ++renderSeq;
  runCleanup();
  shellEl = null;
  current.key = '';
  document.body.classList.remove('has-shell');
  wireShell(); // la cinta de la demo usa los listeners delegados del shell
  const many = info.count > 1;
  const client = info.role === 'client';
  const title = many ? 'Tus barberías están suspendidas' : 'Tu barbería está suspendida';
  const it = many ? 'reactivarlas' : 'reactivarla';
  const lead = client
    ? 'Por ahora no ' + (many ? 'reciben' : 'recibe') + ' reservas ni cambios en línea.'
    : '<b>Contacta a soporte de TuBarbería</b> para ' + it + '.';
  const text = client
    ? 'Si ya tienes una cita, comunícate directamente con la barbería. Para cualquier duda, contacta a soporte de TuBarbería.'
    : 'Mientras ' + (many ? 'estén suspendidas' : 'esté suspendida') + ' no puedes ver la agenda, los clientes ni la caja, y ' + (many ? 'sus páginas no reciben' : 'su página no recibe') + ' reservas. Tus datos se conservan.';
  const name = (state.user && state.user.name) || (state.staff && state.staff.name) || '';
  const sub = [state.user ? state.user.email : '', ROLE[info.role] || ''].filter(Boolean).join(' · ');
  document.title = title + ' · TuBarbería';
  root.innerHTML = '<div class="blocked-wrap">' + demoRibbon() +
    '<main class="blocked" aria-labelledby="susTitle"><div class="blocked-card">' +
      '<div class="blocked-brand"><span class="logo-mark">' + icon('logo') + '</span><span class="brandname">Tu<b>Barbería</b></span></div>' +
      '<div class="art">' + icon('ban') + '</div>' +
      (info.name && !many ? '<p class="eyebrow">' + esc(info.name) + '</p>' : '') +
      '<h1 id="susTitle">' + esc(title) + '</h1>' +
      '<p class="lead">' + lead + '</p>' +
      '<p>' + esc(text) + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="susRetry">' + icon('refresh') + 'Reintentar</button>' +
      '<button type="button" class="btn btn-secondary" id="susLogout">' + icon('logout') + 'Cerrar sesión</button></div>' +
      '<div class="who">' + avatar(name, { size: 'sm' }) + '<span class="grow"><span class="name truncate">' + esc(name) + '</span>' + (sub ? '<span class="sub truncate">' + esc(sub) + '</span>' : '') + '</span></div>' +
    '</div></main></div>';
  const retry = $('#susRetry');
  retry.addEventListener('click', async () => {
    retry.setAttribute('aria-busy', 'true');
    await checkSession(); // contextos frescos (shop_status) y otra vez la barbería
    if (state.ctx) return navigate(homePath(), { replace: true, force: true }); // reactivada: a su inicio por rol
    if (!retry.isConnected) return;
    retry.removeAttribute('aria-busy');
    if (netError) toast.error(netError);
    else if (suspendedInfo()) toast.info(many ? 'Siguen suspendidas.' : 'Sigue suspendida.', { duration: 6000 });
    else route();
  });
  $('#susLogout').addEventListener('click', (e) => logout({ ask: false, btn: e.currentTarget }));
}

function blockedState(r, opts) {
  if (opts.notFound) return { icon: 'help', title: 'Página no encontrada', text: 'El enlace que abriste no existe o cambió.', action: { label: 'Ir al inicio', href: '#' + homePath() } };
  if (opts.forbidden && role() === 'client') return { icon: 'lock', title: 'Esta sección es para el equipo', text: 'Aquí entran el dueño y los barberos de la barbería. Tus citas, cambios y cancelaciones están en Mis citas.', action: { label: 'Ir a Mis citas', href: '#/mis-citas', icon: 'calendar-check' } };
  if (opts.forbidden) return { icon: 'lock', title: 'Sin acceso a esta sección', text: 'Tu rol no tiene permiso para ver esto. Si crees que es un error, pídele acceso al dueño.', action: { label: 'Ir al inicio', href: '#' + homePath() } };
  return { icon: 'store', title: 'Aún no perteneces a ninguna barbería', text: 'Pide al dueño que te agregue a su equipo, o crea tu propia barbería.', action: { label: 'Crear mi barbería', href: '#/crear-barberia' } };
}

async function renderPage(r, opts) {
  const seq = ++renderSeq;
  if (!shellEl || !document.body.contains(shellEl)) renderShell();
  runCleanup();
  const page = $('#page');
  highlightNav(r ? (r.nav || r.path) : '');
  if (current.key !== location.hash.split('?')[0]) window.scrollTo(0, 0);
  current.key = location.hash.split('?')[0];
  if (opts.notFound || opts.forbidden || opts.noShop) {
    const cfg = blockedState(r, opts);
    page.innerHTML = '<div class="page">' + String(emptyState(cfg)) + '</div>';
    // La barra dice dónde estás (la sección); el estado ya lleva su propio título grande.
    setTitle(cfg.title, r && !(r.superOnly && !isSuper()) ? r.title : '');
    watchLargeTitle(true);
    return;
  }
  // Mientras carga, el título de la barra no aparece y desaparece (si la vista trae su h2, se queda oculto).
  const tb = $('#topbar'); if (tb) { tb.classList.add('large-title'); tb.classList.remove('title-in'); }
  page.innerHTML = '<div class="page">' + String(spinner()) + '</div>';
  const view = await loadView(r);
  if (seq !== renderSeq) return; // el usuario ya navegó a otra parte
  const title = typeof view.title === 'function' ? view.title() : (view.title || r.title);
  setTitle(title);
  const el = document.createElement('div');
  el.className = 'page';
  page.innerHTML = '';
  page.appendChild(el);
  try {
    const cleanup = await view.render(el, { params: opts.params || {}, query: opts.query || {}, navigate });
    if (seq !== renderSeq) { if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { /* */ } } return; }
    current.cleanup = cleanup;
  } catch (e) { console.error(e); if (seq === renderSeq) el.innerHTML = String(errorState(e)); }
  if (seq === renderSeq) watchLargeTitle(true);
}
// document.title lleva el título completo; la barra superior, el nombre de la sección (bar) si se indica.
function setTitle(t, bar) {
  document.title = t + ' · ' + (shop() ? shop().name : 'TuBarbería');
  const h = $('#tbTitle'); if (h) h.textContent = bar === undefined ? t : bar;
}

// ── Título grande (patrón iOS) ──
// Si la vista abre con un h2 en .page-head, ese es el título: el de la barra se oculta y aparece solo cuando el h2
// pasa por debajo de la barra al desplazarse. Sin h2 visible (p. ej. Agenda), la barra muestra el título siempre.
let titleIO = null, titleEl = null, titleRaf = 0;
function watchLargeTitle(force) {
  titleRaf = 0;
  const tb = $('#topbar'), page = $('#page');
  if (!tb || !page) return;
  const h = $$('.page-head h2', page).find((x) => !x.classList.contains('sr')) || null;
  if (h === titleEl && titleIO && !force) return;
  if (titleIO) { titleIO.disconnect(); titleIO = null; }
  titleEl = h;
  if (!h || typeof IntersectionObserver !== 'function') { tb.classList.remove('large-title', 'title-in'); return; }
  tb.classList.add('large-title');
  titleIO = new IntersectionObserver((entries) => {
    const bar = $('#topbar');
    if (bar) bar.classList.toggle('title-in', !entries[entries.length - 1].isIntersecting);
  }, { rootMargin: -tb.offsetHeight + 'px 0px 0px 0px' });
  titleIO.observe(h);
}
// Las vistas pintan su encabezado cuando quieren (y algunas lo reemplazan): se vuelve a buscar tras cada cambio.
new MutationObserver(() => { if (!titleRaf && shellEl) titleRaf = requestAnimationFrame(() => watchLargeTitle(false)); })
  .observe(root, { childList: true, subtree: true });

// Reconstruye el shell conservando la vista actual (su DOM, estado y scroll).
function repaintShell() {
  const page = $('#page');
  const view = page && page.firstElementChild;
  const y = window.scrollY;
  const title = $('#tbTitle') ? $('#tbTitle').textContent : '';
  renderShell();
  const np = $('#page');
  if (np && view) { np.innerHTML = ''; np.appendChild(view); }
  const t = $('#tbTitle'); if (t) t.textContent = title;
  highlightNav(currentNavPath());
  window.scrollTo(0, y);
  watchLargeTitle(true);
}

// ── Shell ──
// Avatar de la barbería: su logo o su monograma (el mismo que ve el cliente en la página pública).
function shopAvatar(name, o) {
  o = o || {};
  if (o.src) return String(avatar(name, o));
  return '<span class="avatar' + (o.size ? ' ' + o.size : '') + '" style="--c:' + esc(o.color || '#15130F') + '" aria-hidden="true">' + esc(shopMark(name)) + '</span>';
}
const myColor = () => (state.ctx && state.ctx.staff && state.ctx.staff.color) || undefined;
const demoRibbon = () => (getMode() === 'demo' ? '<div class="demo-ribbon">' + icon('sparkles', 'ic-sm') + '<span>Demo con datos ficticios</span> · <button type="button" id="dmRole">Cambiar rol</button> · <button type="button" id="dmGuide">Guía</button> · <button type="button" id="dmExit">Salir</button></div>' : '');
const themeLabel = () => 'Tema: ' + ({ auto: 'automático', light: 'claro', dark: 'oscuro' }[getTheme()]);
function renderShell() {
  const authed = !!(state.user || state.staff);
  if (!authed) return;
  const r = role();
  const name = (state.user && state.user.name) || (state.staff && state.staff.name) || '';
  const ctxs = state.contexts || [];
  const canSwitch = ctxs.length > 1 || isSuper();
  const groups = NAV.map((g) => ({ g, items: g.items.filter(visible) })).filter((x) => x.items.length);
  const navHtml = groups.map(({ g, items }) => (g.group ? '<div class="nav-group">' + esc(g.group) + '</div>' : '') + items.map((it) =>
    it.href ? '<a href="' + esc(it.href()) + '">' + icon(it.icon) + navLabel(it) + '</a>'
      : '<a href="#' + it.path + '" data-path="' + it.path + '">' + icon(it.icon) + navLabel(it) + (it.count ? '<span class="count" data-unread hidden></span>' : '') + '</a>').join('')).join('');
  const sh = shop();
  const canCreate = canAny(['appointments.write.all', 'appointments.write.own']);
  const demoOn = getMode() === 'demo';
  const roleName = isSuper() && r !== 'superadmin' ? 'Superadmin' : (ROLE[r] || '');

  root.innerHTML =
    demoRibbon() +
    '<div class="shell has-sidebar">' +
    '<aside class="sidebar" id="sidebar" aria-label="Menú principal">' +
      '<div class="sb-brand"><span class="logo-mark">' + icon('logo') + '</span><span class="brandname">Tu<b>Barbería</b></span></div>' +
      (sh ? '<button type="button" class="shop-switch" id="shopSwitch" title="' + esc(sh.name) + '"' + (canSwitch ? '' : ' disabled') + '>' + shopAvatar(sh.name, { src: sh.logo_url || '', color: sh.brand_color || '#15130F' }) +
        '<span class="grow"><span class="name truncate" style="display:block">' + esc(sh.name) + '</span><span class="role">' + esc(ROLE[r] || '') + '</span></span>' + (canSwitch ? icon('chevron-down', 'ic-sm') : '') + '</button>' : '') +
      '<nav class="nav">' + navHtml + '</nav>' +
      '<div class="sb-foot">' +
        (pwa.installed ? '' : '<a href="#/instalar" title="Instalar app">' + icon('download') + '<span>Instalar app</span></a>') +
        (demoOn ? '<a href="#/guia" title="Guía de la demo">' + icon('book') + '<span>Guía de la demo</span></a>' : '') +
        '<button type="button" id="themeBtn" title="' + esc(themeLabel()) + '">' + icon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon') + '<span>' + esc(themeLabel()) + '</span></button>' +
        '<a href="#/perfil" class="sb-user" title="' + esc(name) + '">' + avatar(name, { size: 'sm', color: myColor() }) + '<span class="grow"><span class="name truncate" style="display:block">' + esc(name) + '</span><span class="role">' + esc(roleName) + '</span></span></a>' +
        '<button type="button" id="logoutBtn" title="Cerrar sesión">' + icon('logout') + '<span>Cerrar sesión</span></button>' +
      '</div>' +
    '</aside>' +
    '<div class="main">' +
      '<header class="topbar" id="topbar">' +
        '<h1 id="tbTitle"></h1>' +
        '<div class="tb-actions">' +
          (canCreate ? '<button type="button" class="btn btn-primary btn-sm" id="newApptTop" style="display:none">' + icon('plus') + 'Nueva cita</button>' : '') +
          (canAny(['notifications.read']) ? '<button type="button" class="btn btn-ghost btn-icon" id="bellBtn" aria-label="Notificaciones">' + icon('bell') + '<span class="count-badge" data-unread hidden></span></button>' : '') +
        '</div>' +
      '</header>' +
      '<main id="page" tabindex="-1"></main>' +
    '</div>' +
    '<nav class="bottom-nav" aria-label="Navegación">' + bottomNavHtml(canCreate) + '</nav>' +
    '</div>';
  shellEl = root.querySelector('.shell');
  titleEl = null;
  document.body.classList.add('has-shell');
  syncTopbar();
  wireShell();
  paintUnread(state.ctx ? state.ctx.unread : 0);
}
// Barra inferior (teléfono): 3–5 destinos por rol. Lo que no tiene pestaña propia vive en «Más», que se marca
// como activa en esas pantallas (highlightNav).
function bottomNavHtml(canCreate) {
  const r = role();
  const it = (path, label, ic, attrs) => '<a href="#' + path + '" data-path="' + path.split('?')[0] + '"' + (attrs || '') + '>' + icon(ic) + '<span>' + esc(label) + '</span></a>';
  const more = '<button type="button" data-more aria-haspopup="dialog">' + icon('menu') + '<span>Más</span></button>';
  const profile = it('/perfil', 'Perfil', 'user', ' data-also="/instalar /guia"');
  if (r === 'client') return it('/mis-citas', 'Mis citas', 'calendar-check') +
    // La página pública se abre en la misma ventana (en la app instalada no salta al navegador).
    '<a href="' + esc(bookingUrl()) + '">' + icon('calendar-plus') + '<span>Reservar</span></a>' +
    (canAny(['notifications.read']) ? '<a href="#/notificaciones" data-path="/notificaciones">' + icon('bell') + '<span>Avisos</span><span class="count-badge" data-unread hidden></span></a>' : '') +
    profile;
  if (!state.ctx) {
    if (isSuper()) return it('/plataforma', 'Barberías', 'shield') + it('/plataforma?tab=usuarios', 'Usuarios', 'users', ' data-q="tab=usuarios"') + profile + more;
    // Sin barbería activa todavía (las suspendidas tienen su propia pantalla, sin barra): su estado, el perfil y «Más».
    return it('/inicio', 'Inicio', 'home') + profile + more;
  }
  return it('/inicio', r === 'barber' ? 'Mi día' : 'Inicio', 'home') + it('/agenda', 'Agenda', 'calendar') +
    (canCreate ? '<button type="button" data-newappt aria-label="Nueva cita"><span class="fab">' + icon('plus') + '</span></button>' : '') +
    it('/clientes', 'Clientes', 'users') + more;
}
// Los listeners delegados viven en #app (que nunca se reemplaza): se conectan UNA sola vez.
let shellWired = false;
function wireShell() {
  if (shellWired) return;
  shellWired = true;
  on(root, 'click', '#themeBtn', () => { const n = { auto: 'light', light: 'dark', dark: 'auto' }[getTheme()]; setTheme(n); repaintShell(); toast.info(themeLabel()); });
  on(root, 'click', '#logoutBtn', () => logout());
  on(root, 'click', '#shopSwitch', () => openShopSwitcher());
  on(root, 'click', '#bellBtn', (e, el) => openBell(el));
  on(root, 'click', '#newApptTop,[data-newappt]', () => newAppointment());
  on(root, 'click', '.bottom-nav [data-more]', () => openMoreSheet());
  on(root, 'click', '#dmRole', () => openRoleSwitcher());
  on(root, 'click', '#dmGuide', () => navigate('/guia'));
  on(root, 'click', '#dmExit', () => exitDemo());
  // Pestañas internas que cambian la URL sin navegar (p. ej. Plataforma → Usuarios): se vuelve a marcar la barra.
  on(root, 'click', '#page [role="tab"]', () => setTimeout(() => highlightNav(currentNavPath()), 0));
  window.addEventListener('scroll', () => { const t = $('#topbar'); if (t) t.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  window.matchMedia(SIDE_Q).addEventListener('change', () => { syncTopbar(); watchLargeTitle(true); });
}
// Con barra lateral o riel no hay barra inferior: «Nueva cita» pasa a la barra superior.
function syncTopbar() {
  const b = $('#newApptTop'); if (b) b.style.display = window.matchMedia(SIDE_Q).matches ? '' : 'none';
}
function currentNavPath() { const { path } = parseHash(); const m = match(path); return m ? (m.route.nav || m.route.path) : ''; }
function highlightNav(p) {
  const q = parseHash().query;
  const qOk = (a) => !a.dataset.q || Array.from(new URLSearchParams(a.dataset.q)).every(([k, v]) => q[k] === v);
  [$$('.nav a[data-path]'), $$('.bottom-nav [data-path]')].forEach((items) => {
    let hits = items.filter((a) => a.dataset.path === p && qOk(a));
    if (hits.some((a) => a.dataset.q)) hits = hits.filter((a) => a.dataset.q);
    if (!hits.length && p) hits = items.filter((a) => (a.dataset.also || '').split(' ').includes(p));
    items.forEach((a) => { if (hits.includes(a)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  });
  const more = $('.bottom-nav [data-more]');
  if (more) { if (p && !$('.bottom-nav [data-path][aria-current="page"]')) more.setAttribute('aria-current', 'page'); else more.removeAttribute('aria-current'); }
}

async function newAppointment(prefill) {
  try { const m = await import('./lib/appointment-sheet.js'); m.openNewAppointment(prefill || {}); }
  catch (e) { toast.error('No se pudo abrir el formulario de cita.'); console.error(e); }
}
async function openBell(el) {
  if (window.matchMedia('(min-width:720px)').matches) {
    try { const m = await import('./lib/notif-panel.js'); return m.openNotificationsPanel(el); } catch (e) { /* cae a la página */ }
  }
  navigate('/notificaciones');
}

// «Más» (teléfono): la barbería activa arriba, luego las secciones sin pestaña propia y la cuenta.
function openMoreSheet() {
  const inBar = $$('.bottom-nav [data-path]').map((a) => a.dataset.path);
  const here = currentNavPath();
  const items = NAV.flatMap((g) => g.items.filter(visible).filter((it) => !it.path || !inBar.includes(it.path)));
  const sh = shop();
  const canSwitch = (state.contexts || []).length > 1 || isSuper();
  const cur = (path) => (path === here ? ' aria-current="page"' : '');
  const shopRow = !sh ? '' : (canSwitch ? '<button type="button" class="list-item" data-switch>' : '<div class="list-item">') +
    shopAvatar(sh.name, { src: sh.logo_url || '', color: sh.brand_color || '#15130F' }) +
    '<span class="grow"><span class="title truncate" style="display:block">' + esc(sh.name) + '</span><span class="meta">' + esc(ROLE[role()] || '') + (canSwitch ? ' · Cambiar de barbería' : '') + '</span></span>' +
    (canSwitch ? icon('chevron-right', 'ic-sm') + '</button>' : '</div>');
  const m = modal({
    title: 'Más opciones',
    body: '<div class="list" style="margin:0 -20px">' + shopRow +
      items.map((it) => it.href
        ? '<a class="list-item" href="' + esc(it.href()) + '">' + icon(it.icon) + '<span class="title">' + esc(labelOf(it)) + '</span></a>'
        : '<a class="list-item" href="#' + it.path + '"' + cur(it.path) + '>' + icon(it.icon) + '<span class="title">' + esc(labelOf(it)) + '</span>' + (it.count ? '<span class="trail"><span class="badge err plain" data-unread hidden></span></span>' : '') + '</a>').join('') +
      (!sh && canSwitch ? '<button type="button" class="list-item" data-switch>' + icon('store') + '<span class="title">Cambiar de barbería</span></button>' : '') +
      (pwa.installed ? '' : '<a class="list-item" href="#/instalar"' + cur('/instalar') + '>' + icon('download') + '<span class="title">Instalar app</span></a>') +
      (getMode() === 'demo' ? '<a class="list-item" href="#/guia"' + cur('/guia') + '>' + icon('book') + '<span class="title">Guía de la demo</span></a>' : '') +
      (inBar.includes('/perfil') ? '' : '<a class="list-item" href="#/perfil"' + cur('/perfil') + '>' + icon('user') + '<span class="title">Mi perfil</span></a>') +
      '<button type="button" class="list-item" data-theme-t>' + icon('moon') + '<span class="title">' + esc(themeLabel()) + '</span></button>' +
      '<button type="button" class="list-item" data-logout style="color:var(--err)">' + icon('logout') + '<span class="title">Cerrar sesión</span></button></div>'
  });
  paintUnread(lastUnread);
  m.body.addEventListener('click', (e) => {
    if (e.target.closest('a')) m.close();
    if (e.target.closest('[data-switch]')) { m.close(); openShopSwitcher(); }
    if (e.target.closest('[data-logout]')) { m.close(); logout(); }
    if (e.target.closest('[data-theme-t]')) { const n = { auto: 'light', light: 'dark', dark: 'auto' }[getTheme()]; setTheme(n); m.close(); repaintShell(); toast.info(themeLabel()); }
  });
}

function openShopSwitcher() {
  const ctxs = state.contexts || [];
  const m = modal({
    title: 'Cambiar de barbería',
    body: '<div class="list" style="margin:0 -20px">' + ctxs.map((c) =>
      '<button type="button" class="list-item" data-shop="' + esc(c.shop_id) + '">' + shopAvatar(c.shop_name, { src: c.shop_logo || '', color: (shop() && shop().id === c.shop_id && shop().brand_color) || '#15130F' }) +
      '<span class="grow"><span class="title truncate" style="display:block">' + esc(c.shop_name) + '</span><span class="meta">' + esc(ROLE[c.role] || c.role) + (c.shop_status === 'suspended' ? ' · Suspendida' : '') + '</span></span>' +
      (state.shopId === c.shop_id && state.ctx ? '<span class="trail">' + icon('check', 'brand-t') + '</span>' : '') + '</button>').join('') +
      (isSuper() ? '<a class="list-item" href="#/plataforma">' + icon('shield') + '<span class="title">Plataforma: todas las barberías</span></a>' : '') + '</div>'
  });
  m.body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-shop]');
    if (e.target.closest('a')) m.close();
    if (!b) return;
    m.close();
    try { await selectShop(b.dataset.shop); shopError = null; navigate(homePath(), { replace: true, force: true }); toast.success('Ahora ves ' + shop().name); }
    catch (err) { toast.error(err); }
  });
}
// El superadmin (o cualquier vista) puede entrar a una barbería por id.
export async function enterShop(id) {
  await selectShop(id);
  navigate(homePath(), { force: true });
}

// o.ask:false → sin confirmar (p. ej. desde la pantalla de barbería suspendida, donde es la salida esperada).
async function logout(o) {
  o = o || {};
  if (o.ask !== false && !(await confirmDialog({ title: '¿Cerrar sesión?', message: 'Tendrás que volver a entrar con tu correo o PIN.', confirmText: 'Cerrar sesión', icon: 'logout' }))) return;
  if (o.btn) o.btn.setAttribute('aria-busy', 'true');
  try { await api.post('/auth/logout'); } catch (e) { /* igual se limpia */ }
  clearSession();
  shellEl = null;
  toast.success('Sesión cerrada');
  navigate('/login', { replace: true });
}

// ── Demo: cambio de rol en un toque, reinicio y salida ──
export async function demoLogin(roleKey, opts) {
  const creds = await demoCredentials();
  const c = creds[roleKey];
  if (!c) throw new Error('Rol de demo desconocido');
  setMode('demo');
  state.mode = 'demo';
  try { await api.post('/auth/logout'); } catch (e) { /* */ }
  clearSession();
  await api.post('/auth/login', { email: c.email, password: c.password });
  await loadMe();
  await ensureShop();
  shellEl = null;
  navigate((opts && opts.path) || homePath(), { replace: true, force: true });
}
function openRoleSwitcher() {
  const roles = [
    ['owner', 'Dueño', 'Ve todo el negocio: agenda, ingresos, caja, reportes y configuración.', 'crown'],
    ['barber', 'Barbero', 'Su día, sus citas, sus clientes y sus ganancias.', 'scissors'],
    ['client', 'Cliente', 'Sus citas: reservar, cancelar o reagendar.', 'user'],
    ['superadmin', 'Superadmin', 'La plataforma: todas las barberías, alta y suspensión.', 'shield']
  ];
  const m = modal({
    title: 'Ver la demo como…', subtitle: 'Cambia de rol para mostrar cada experiencia.',
    body: '<div class="list" style="margin:0 -20px">' + roles.map(([k, t, d, ic]) =>
      '<button type="button" class="list-item" data-role="' + k + '"><span class="avatar" style="--c:var(--ink);color:var(--brand)">' + icon(ic, 'ic-sm') + '</span><span class="grow"><span class="title">' + t + '</span><span class="meta" style="display:block">' + d + '</span></span>' + icon('chevron-right', 'ic-sm') + '</button>').join('') +
      '</div><div class="hr"></div><button type="button" class="btn btn-ghost btn-block" data-reset>' + icon('refresh') + 'Reiniciar datos de la demo</button>'
  });
  m.body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-role]');
    if (b) { b.setAttribute('aria-busy', 'true'); try { await demoLogin(b.dataset.role); m.close(); toast.success('Ahora estás como ' + b.querySelector('.title').textContent); } catch (err) { toast.error(err); b.removeAttribute('aria-busy'); } }
    if (e.target.closest('[data-reset]')) {
      m.close();
      if (!(await confirmDialog({ title: '¿Reiniciar la demo?', message: 'Se borran los cambios que hiciste y se cargan datos ficticios nuevos.', confirmText: 'Reiniciar', danger: true, icon: 'refresh' }))) return;
      await resetDemo();
      await demoLogin('owner');
      toast.success('Demo reiniciada');
    }
  });
}
async function exitDemo() {
  if (!(await confirmDialog({ title: '¿Salir de la demo?', message: 'Volverás a la pantalla de acceso. Los datos de la demo se quedan en este dispositivo.', confirmText: 'Salir', icon: 'logout' }))) return;
  try { await api.post('/auth/logout'); } catch (e) { /* */ }
  setMode('server');
  state.mode = 'server';
  clearSession();
  shellEl = null;
  navigate('/login', { replace: true });
}

// ── Notificaciones sin leer ──
let lastUnread = 0;
function paintUnread(n) {
  lastUnread = n || 0;
  $$('[data-unread]').forEach((b) => { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; });
  if ('setAppBadge' in navigator) { try { n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch (e) { /* */ } }
}
async function pollUnread() {
  if (document.hidden || !state.ctx || !canAny(['notifications.read'])) return;
  try { const r = await api.get('/notifications', { limit: 1 }); paintUnread(r.unread); } catch (e) { /* silencioso */ }
}
// Otra pestaña de la demo (p. ej. la página pública) guardó cambios: las vistas se refrescan.
window.addEventListener('tb:demo-sync', () => { bus.emit('appointments:changed', { source: 'sync' }); pollUnread(); });
bus.on('notifications:changed', (n) => { if (typeof n === 'number') paintUnread(n); else pollUnread(); });

// API global mínima para vistas que la necesiten sin importar main.js (evita ciclos).
window.TB = { navigate, newAppointment, enterShop, demoLogin, setTheme, getTheme, pwa, refreshContext, renderShell: repaintShell, repaintShell, homePath, ensureShop, openShopSwitcher };

boot();
