// Arranque del panel: sesión, barbería activa, shell por rol (sidebar / barra inferior), rutas y PWA.
import { api, getMode, setMode, health, on401, SITE_BASE, LS, resetDemo, demoCredentials } from './lib/api.js';
import { state, bus, loadMe, clearSession, selectShop, preferredShopId, canAny, role, isSuper, shop, refreshContext } from './lib/state.js';
import { defineRoutes, parseHash, match, navigate, startRouter } from './lib/router.js';
import { html, raw, esc, $, $$, on } from './lib/html.js';
import { icon } from './lib/icons.js';
import { toast, modal, confirmDialog, menu, avatar, emptyState, errorState, spinner } from './lib/ui.js';
import { ROLE } from './lib/fmt.js';

const V = (name) => () => import('./views/' + name + '.js');
const STAFF_ROLES = ['owner', 'superadmin', 'barber'];

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
    { path: '/clientes', label: () => (role() === 'barber' ? 'Mis clientes' : 'Clientes'), icon: 'users', perm: ['clients.read.all', 'clients.read.own'] },
    { path: '/mensajes', label: 'WhatsApp', icon: 'whatsapp', perm: 'messages.send' },
    { path: '/mis-citas', label: 'Mis citas', icon: 'calendar-check', roles: ['client'] },
    { href: bookingUrl, label: 'Reservar cita', icon: 'calendar-plus', roles: ['client'] },
    { path: '/notificaciones', label: 'Notificaciones', icon: 'bell', perm: 'notifications.read', count: true }
  ] },
  { group: 'Negocio', items: [
    { path: '/caja', label: 'Caja y pagos', icon: 'wallet', perm: 'cash.read' },
    { path: '/comisiones', label: () => (role() === 'barber' ? 'Mis ganancias' : 'Comisiones'), icon: 'percent', perm: ['commissions.read.all', 'commissions.read.own'] },
    { path: '/reportes', label: 'Reportes', icon: 'chart', perm: 'reports.read' }
  ] },
  { group: 'Configuración', items: [
    { path: '/equipo', label: 'Equipo', icon: 'scissors', perm: 'staff.manage' },
    { path: '/servicios', label: 'Servicios', icon: 'tag', perm: 'services.manage' },
    { path: '/horarios', label: () => (role() === 'barber' ? 'Mi horario' : 'Horarios'), icon: 'clock', perm: ['availability.manage.all', 'availability.manage.own'] },
    { path: '/enlace', label: 'Enlace y QR', icon: 'qr', perm: 'shop.update' },
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

async function boot() {
  state.mode = getMode();
  on401(() => {
    if (!state.user && !state.staff) return;
    clearSession();
    toast.info('Tu sesión terminó. Vuelve a entrar.');
    navigate('/login', { replace: true });
  });
  try {
    // Entrar directo a #/demo sin sesión de demo: no hace falta consultar al servidor (evita un 404 en hosting estático).
    if (getMode() !== 'demo' && parseHash().path === '/demo') throw Object.assign(new Error('skip'), { code: 'skip' });
    await loadMe();
  } catch (e) {
    clearSession();
    if (e.code === 'backend_unavailable' || e.code === 'backend_not_configured' || e.code === 'network') state.backendDown = e;
  }
  if (state.user || state.staff) await ensureShop();
  hideSplash();
  startRouter(route);
  bus.on('context', () => { renderShell(); route(); });
  // Refresco de la misma barbería (p. ej. tras guardar Ajustes): se reconstruye el shell conservando la vista,
  // su estado y el scroll.
  bus.on('context:refresh', repaintShell);
  setInterval(pollUnread, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollUnread(); });
}
async function ensureShop() {
  const id = preferredShopId();
  if (!id) return;
  try { await selectShop(id); } catch (e) { state.ctx = null; toast.error(e); }
}
function hideSplash() { const s = document.getElementById('splash'); if (s) { s.classList.add('out'); setTimeout(() => s.remove(), 400); } }

function homePath() {
  if (!state.user && !state.staff) return '/login';
  if (!state.ctx) return isSuper() ? '/plataforma' : '/perfil';
  return role() === 'client' ? '/mis-citas' : '/inicio';
}

async function route() {
  const { path, query } = parseHash();
  if (path === '/' || path === '') return navigate(homePath(), { replace: true });
  if (path === '/panel') return navigate(homePath(), { replace: true });
  const m = match(path);
  const authed = !!(state.user || state.staff);
  if (!m) return renderPage(null, { notFound: true });
  const r = m.route;
  if (r.public && !(r.shellIfAuthed && authed)) {
    if (authed && ['/login', '/registro', '/crear-barberia'].includes(path) && !query.next) return navigate(homePath(), { replace: true });
    return renderBare(r, m.params, query);
  }
  if (!r.public && !authed) return navigate('/login', { replace: true, query: { next: location.hash.slice(1) } });
  if (!r.public && !r.noShop && !state.ctx && !(r.path === '/perfil')) {
    if (isSuper()) return navigate('/plataforma', { replace: true });
    return renderPage(r, { noShop: true });
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

async function renderPage(r, opts) {
  const seq = ++renderSeq;
  if (!shellEl || !document.body.contains(shellEl)) renderShell();
  runCleanup();
  const page = $('#page');
  const key = r ? r.path : '404';
  highlightNav(r ? (r.nav || r.path) : '');
  closeSidebar();
  if (current.key !== location.hash.split('?')[0]) window.scrollTo(0, 0);
  current.key = location.hash.split('?')[0];
  if (opts.notFound || opts.forbidden || opts.noShop) {
    const cfg = opts.notFound ? { icon: 'help', title: 'Página no encontrada', text: 'El enlace que abriste no existe o cambió.', action: { label: 'Ir al inicio', href: '#' + homePath() } }
      : opts.forbidden ? { icon: 'lock', title: 'Sin acceso a esta sección', text: 'Tu rol no tiene permiso para ver esto. Si crees que es un error, pídele acceso al dueño.', action: { label: 'Ir al inicio', href: '#' + homePath() } }
      : { icon: 'store', title: 'Aún no perteneces a ninguna barbería', text: 'Pide al dueño que te agregue a su equipo, o crea tu propia barbería.', action: { label: 'Crear mi barbería', href: '#/crear-barberia' } };
    setTitle(cfg.title);
    page.innerHTML = '<div class="page">' + String(emptyState(cfg)) + '</div>';
    return;
  }
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
}
function setTitle(t) {
  document.title = t + ' · ' + (shop() ? shop().name : 'TuBarbería');
  const h = $('#tbTitle'); if (h) h.textContent = t;
}

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
}

// ── Shell ──
function renderShell() {
  const authed = !!(state.user || state.staff);
  if (!authed) return;
  const r = role();
  const name = (state.user && state.user.name) || (state.staff && state.staff.name) || '';
  const ctxs = state.contexts || [];
  const canSwitch = ctxs.length > 1 || isSuper();
  const groups = NAV.map((g) => ({ g, items: g.items.filter(visible) })).filter((x) => x.items.length);
  const navHtml = groups.map(({ g, items }) => (g.group ? '<div class="nav-group">' + esc(g.group) + '</div>' : '') + items.map((it) =>
    it.href ? '<a href="' + esc(it.href()) + '" target="_blank" rel="noopener">' + icon(it.icon) + '<span>' + esc(labelOf(it)) + '</span></a>'
      : '<a href="#' + it.path + '" data-path="' + it.path + '">' + icon(it.icon) + '<span>' + esc(labelOf(it)) + '</span>' + (it.count ? '<span class="count" data-unread hidden></span>' : '') + '</a>').join('')).join('');
  const sh = shop();
  const canCreate = canAny(['appointments.write.all', 'appointments.write.own']);
  const demoOn = getMode() === 'demo';

  root.innerHTML =
    (demoOn ? '<div class="demo-ribbon">' + icon('sparkles', 'ic-sm') + '<span>Demo con datos ficticios</span> · <button type="button" id="dmRole">Cambiar rol</button> · <button type="button" id="dmGuide">Guía</button> · <button type="button" id="dmExit">Salir</button></div>' : '') +
    '<div class="shell has-sidebar">' +
    '<aside class="sidebar" id="sidebar" aria-label="Menú principal">' +
      '<div class="sb-brand"><span class="logo-mark">' + icon('logo') + '</span><span class="brandname">Tu<b>Barbería</b></span></div>' +
      (sh ? '<button type="button" class="shop-switch" id="shopSwitch"' + (canSwitch ? '' : ' disabled') + '>' + avatar(sh.name, { src: sh.logo_url || '', color: sh.brand_color || '#15130F' }) +
        '<span class="grow"><span class="name truncate" style="display:block">' + esc(sh.name) + '</span><span class="role">' + esc(ROLE[r] || '') + '</span></span>' + (canSwitch ? icon('chevron-down', 'ic-sm') : '') + '</button>' : '') +
      '<nav class="nav">' + navHtml + '</nav>' +
      '<div class="sb-foot">' +
        (pwa.installed ? '' : '<a href="#/instalar">' + icon('download') + '<span>Instalar app</span></a>') +
        (demoOn ? '<a href="#/guia">' + icon('book') + '<span>Guía de la demo</span></a>' : '') +
        '<button type="button" id="themeBtn">' + icon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon') + '<span>Tema: ' + ({ auto: 'automático', light: 'claro', dark: 'oscuro' }[getTheme()]) + '</span></button>' +
        '<a href="#/perfil" class="sb-user">' + avatar(name, { size: 'sm' }) + '<span class="grow"><span class="name truncate" style="display:block">' + esc(name) + '</span><span class="role">' + esc(isSuper() && r !== 'superadmin' ? 'Superadmin' : (ROLE[r] || '')) + '</span></span></a>' +
        '<button type="button" id="logoutBtn">' + icon('logout') + '<span>Cerrar sesión</span></button>' +
      '</div>' +
    '</aside>' +
    '<div class="main">' +
      '<header class="topbar" id="topbar">' +
        '<button type="button" class="btn btn-ghost btn-icon" id="menuBtn" aria-label="Abrir menú" style="margin-left:-8px">' + icon('menu') + '</button>' +
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
  document.body.classList.add('has-shell');
  syncTopbar();
  wireShell();
  paintUnread(state.ctx ? state.ctx.unread : 0);
}
function bottomNavHtml(canCreate) {
  const r = role();
  const it = (path, label, ic) => '<a href="#' + path + '" data-path="' + path + '">' + icon(ic) + '<span>' + esc(label) + '</span></a>';
  if (r === 'client') return it('/mis-citas', 'Mis citas', 'calendar-check') +
    '<a href="' + esc(bookingUrl()) + '" target="_blank" rel="noopener">' + icon('calendar-plus') + '<span>Reservar</span></a>' +
    '<a href="#/notificaciones" data-path="/notificaciones" style="position:relative">' + icon('bell') + '<span>Avisos</span><span class="count-badge" data-unread hidden></span></a>' +
    it('/perfil', 'Perfil', 'user');
  if (!state.ctx) return it('/plataforma', 'Barberías', 'shield') + '<button type="button" data-more>' + icon('menu') + '<span>Más</span></button>';
  return it('/inicio', r === 'barber' ? 'Mi día' : 'Inicio', 'home') + it('/agenda', 'Agenda', 'calendar') +
    (canCreate ? '<button type="button" data-newappt aria-label="Nueva cita"><span class="fab">' + icon('plus') + '</span></button>' : '') +
    it('/clientes', r === 'barber' ? 'Clientes' : 'Clientes', 'users') +
    '<button type="button" data-more style="position:relative">' + icon('menu') + '<span>Más</span></button>';
}
// Los listeners delegados viven en #app (que nunca se reemplaza): se conectan UNA sola vez.
let shellWired = false;
function wireShell() {
  if (shellWired) return;
  shellWired = true;
  on(root, 'click', '#menuBtn', () => openSidebar());
  on(root, 'click', '#themeBtn', () => { const n = { auto: 'light', light: 'dark', dark: 'auto' }[getTheme()]; setTheme(n); repaintShell(); toast.info('Tema: ' + ({ auto: 'automático', light: 'claro', dark: 'oscuro' }[n])); });
  on(root, 'click', '#logoutBtn', logout);
  on(root, 'click', '#shopSwitch', () => openShopSwitcher());
  on(root, 'click', '#bellBtn', (e, el) => openBell(el));
  on(root, 'click', '#newApptTop,[data-newappt]', () => newAppointment());
  on(root, 'click', '.bottom-nav [data-more]', () => openMoreSheet());
  on(root, 'click', '#dmRole', () => openRoleSwitcher());
  on(root, 'click', '#dmGuide', () => navigate('/guia'));
  on(root, 'click', '#dmExit', () => exitDemo());
  on(root, 'click', '#sidebar a[href^="#"]', () => closeSidebar());
  window.addEventListener('scroll', () => { const t = $('#topbar'); if (t) t.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  const mq = window.matchMedia('(min-width:1024px)');
  mq.addEventListener('change', syncTopbar);
}
function syncTopbar() {
  const wide = window.matchMedia('(min-width:1024px)').matches;
  const b = $('#newApptTop'); if (b) b.style.display = wide ? '' : 'none';
  const mb = $('#menuBtn'); if (mb) mb.style.display = wide ? 'none' : '';
}
function currentNavPath() { const { path } = parseHash(); const m = match(path); return m ? (m.route.nav || m.route.path) : ''; }
function highlightNav(p) {
  $$('.nav a[data-path], .bottom-nav [data-path]').forEach((a) => { if (a.dataset.path === p) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
function openSidebar() {
  const sb = $('#sidebar'); if (!sb) return;
  sb.classList.add('open');
  const s = document.createElement('div'); s.className = 'scrim'; s.id = 'scrim'; s.onclick = closeSidebar; document.body.appendChild(s);
}
function closeSidebar() { const sb = $('#sidebar'); if (sb) sb.classList.remove('open'); const s = $('#scrim'); if (s) s.remove(); }

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

function openMoreSheet() {
  const primary = ['/inicio', '/agenda', '/clientes', '/mis-citas', '/perfil'];
  const items = NAV.flatMap((g) => g.items.filter(visible).filter((it) => !primary.includes(it.path) || !it.path).map((it) => ({ it, g: g.group })));
  const m = modal({
    title: 'Más opciones',
    body: '<div class="list" style="margin:0 -20px">' +
      items.map(({ it }) => it.href
        ? '<a class="list-item" href="' + esc(it.href()) + '" target="_blank" rel="noopener">' + icon(it.icon) + '<span class="title">' + esc(labelOf(it)) + '</span></a>'
        : '<a class="list-item" href="#' + it.path + '">' + icon(it.icon) + '<span class="title">' + esc(labelOf(it)) + '</span>' + (it.count ? '<span class="trail"><span class="badge err plain" data-unread hidden></span></span>' : '') + '</a>').join('') +
      ((state.contexts || []).length > 1 || isSuper() ? '<button type="button" class="list-item" data-switch>' + icon('store') + '<span class="title">Cambiar de barbería</span></button>' : '') +
      (pwa.installed ? '' : '<a class="list-item" href="#/instalar">' + icon('download') + '<span class="title">Instalar app</span></a>') +
      (getMode() === 'demo' ? '<a class="list-item" href="#/guia">' + icon('book') + '<span class="title">Guía de la demo</span></a>' : '') +
      '<a class="list-item" href="#/perfil">' + icon('user') + '<span class="title">Mi perfil</span></a>' +
      '<button type="button" class="list-item" data-theme-t>' + icon('moon') + '<span class="title">Tema: ' + ({ auto: 'automático', light: 'claro', dark: 'oscuro' }[getTheme()]) + '</span></button>' +
      '<button type="button" class="list-item" data-logout style="color:var(--err)">' + icon('logout') + '<span class="title">Cerrar sesión</span></button></div>'
  });
  paintUnread(lastUnread);
  m.body.addEventListener('click', (e) => {
    if (e.target.closest('a')) m.close();
    if (e.target.closest('[data-switch]')) { m.close(); openShopSwitcher(); }
    if (e.target.closest('[data-logout]')) { m.close(); logout(); }
    if (e.target.closest('[data-theme-t]')) { const n = { auto: 'light', light: 'dark', dark: 'auto' }[getTheme()]; setTheme(n); m.close(); repaintShell(); toast.info('Tema: ' + ({ auto: 'automático', light: 'claro', dark: 'oscuro' }[n])); }
  });
}

function openShopSwitcher() {
  const ctxs = state.contexts || [];
  const m = modal({
    title: 'Cambiar de barbería',
    body: '<div class="list" style="margin:0 -20px">' + ctxs.map((c) =>
      '<button type="button" class="list-item" data-shop="' + esc(c.shop_id) + '">' + avatar(c.shop_name) + '<span class="grow"><span class="title truncate" style="display:block">' + esc(c.shop_name) + '</span><span class="meta">' + esc(ROLE[c.role] || c.role) + '</span></span>' +
      (state.shopId === c.shop_id ? '<span class="trail">' + icon('check', 'brand-t') + '</span>' : '') + '</button>').join('') +
      (isSuper() ? '<a class="list-item" href="#/plataforma">' + icon('shield') + '<span class="title">Plataforma: todas las barberías</span></a>' : '') + '</div>'
  });
  m.body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-shop]');
    if (e.target.closest('a')) m.close();
    if (!b) return;
    m.close();
    try { await selectShop(b.dataset.shop); navigate(homePath(), { replace: true, force: true }); toast.success('Ahora ves ' + shop().name); }
    catch (err) { toast.error(err); }
  });
}
// El superadmin (o cualquier vista) puede entrar a una barbería por id.
export async function enterShop(id) {
  await selectShop(id);
  navigate(homePath(), { force: true });
}

async function logout() {
  const ok = await confirmDialog({ title: '¿Cerrar sesión?', message: 'Tendrás que volver a entrar con tu correo o PIN.', confirmText: 'Cerrar sesión', icon: 'logout' });
  if (!ok) return;
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
window.TB = { navigate, newAppointment, enterShop, demoLogin, setTheme, getTheme, pwa, refreshContext, renderShell: repaintShell, repaintShell, homePath };

boot();
