/* TuBarbería · service worker (raíz del sitio)
 *
 * Lo registran app/main.js (scope = raíz) y la página pública (index.html). Estrategias:
 *   · Navegación a /app/…          → red primero (con tiempo límite) y, sin red, el shell cacheado.
 *   · Fuentes del sitio (fonts/)    → caché primero (precacheadas; inmutables según _headers).
 *   · Estáticos del mismo origen    → stale-while-revalidate (JS, CSS, íconos, imágenes, página pública).
 *   · /api/*                        → siempre red; nunca se cachea (no se intercepta).
 *   · Otros orígenes                → no se interceptan (las fuentes ya no vienen de Google Fonts).
 *
 * Para publicar cambios del shell sube VERSION: se vuelve a precachear y se borran las cachés viejas.
 * La versión nueva espera hasta que la página mande {type:'SKIP_WAITING'} (o se cierren las pestañas).
 */
const VERSION = '2026.09.24-demo';
const SHELL_CACHE = 'tb-shell-' + VERSION; // al activar se borra cualquier otra caché (también la vieja 'tb-fonts-v1')
const BASE = new URL('./', self.location).pathname; // '/' (o '/sub/' si el sitio vive en una subcarpeta)
const APP = BASE + 'app/';
const NAV_TIMEOUT = 4000; // ms antes de servir el shell cacheado si la red está lenta

// Lista explícita (relativa a la raíz del sitio). Si falta algún archivo, el resto se precachea igual
// (Promise.allSettled); lo que no esté aquí se guarda solo la primera vez que se pide (stale-while-revalidate).
// Al agregar vistas o módulos nuevos, súmalos aquí para que funcionen sin conexión desde el primer día.
const PRECACHE = [
  // Shell
  'app/',
  'app/index.html',
  'app/app.css',
  'app/main.js',
  'app/manifest.webmanifest',
  // Tipografías del sitio (panel y página pública): fonts/fonts.css y sus archivos
  'fonts/fonts.css',
  'fonts/big-shoulders-display-latin.woff2',
  'fonts/ibm-plex-sans-latin.woff2',
  'fonts/ibm-plex-mono-500-latin.woff2',
  // Librerías del panel
  'app/lib/api.js',
  'app/lib/appointment-sheet.js',
  'app/lib/charts.js',
  'app/lib/fmt.js',
  'app/lib/html.js',
  'app/lib/icons.js',
  'app/lib/notif-panel.js',
  'app/lib/payment-sheet.js',
  'app/lib/period.js',
  'app/lib/pickers.js',
  'app/lib/qr.js',
  'app/lib/router.js',
  'app/lib/state.js',
  'app/lib/timefield.js',
  'app/lib/ui.js',
  'app/lib/whatsapp.js',
  // Vistas (una por ruta de main.js)
  'app/views/agenda.js',
  'app/views/availability.js',
  'app/views/booking-link.js',
  'app/views/cash.js',
  'app/views/client-detail.js',
  'app/views/clients.js',
  'app/views/commissions.js',
  'app/views/dashboard.js',
  'app/views/demo.js',
  'app/views/guide.js',
  'app/views/install.js',
  'app/views/login.js',
  'app/views/messages.js',
  'app/views/my-appointments.js',
  'app/views/notifications.js',
  'app/views/platform.js',
  'app/views/profile.js',
  'app/views/register.js',
  'app/views/reports.js',
  'app/views/services.js',
  'app/views/settings.js',
  'app/views/signup.js',
  'app/views/team.js',
  // Núcleo que la demo ejecuta dentro del navegador (app/lib/api.js → core/router.js y su árbol)
  'core/crypto.js',
  'core/db.js',
  'core/permissions.js',
  'core/router.js',
  'core/schema.js',
  'core/seed-demo.js',
  'core/session.js',
  'core/util.js',
  'core/api/admin.js',
  'core/api/appointments.js',
  'core/api/auth.js',
  'core/api/automation.js',
  'core/api/availability.js',
  'core/api/cash.js',
  'core/api/clients.js',
  'core/api/commissions.js',
  'core/api/importer.js',
  'core/api/messages.js',
  'core/api/my.js',
  'core/api/notifications.js',
  'core/api/payments.js',
  'core/api/public.js',
  'core/api/reports.js',
  'core/api/services.js',
  'core/api/setup.js',
  'core/api/shop.js',
  'core/api/staff.js',
  'core/domain/appointments.js',
  'core/domain/clients.js',
  'core/domain/email.js',
  'core/domain/events.js',
  'core/domain/messages.js',
  'core/domain/notify.js',
  'core/domain/settings.js',
  'core/domain/slots.js',
  'core/domain/views.js',
  // Íconos
  'app/icons/icon.svg',
  'app/icons/icon-192.png',
  'app/icons/icon-512.png',
  'app/icons/maskable-512.png',
  'app/icons/apple-touch-icon.png',
  'app/icons/favicon-32.png',
  'app/icons/shortcut-agenda.png',
  'app/icons/shortcut-new.png',
  'app/icons/shortcut-cash.png'
];

// ── Ciclo de vida ──────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(PRECACHE.map(async (path) => {
      const url = BASE + path;
      const res = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
      if (!res.ok) throw new Error(res.status + ' ' + url);
      await cache.put(url, await clean(res));
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE];
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  else if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) event.ports[0].postMessage({ version: VERSION });
});

// ── Enrutado de peticiones ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const p = url.pathname;
    if (p === BASE + 'api' || p.startsWith(BASE + 'api/')) return; // API: siempre red, jamás caché
    if (p === BASE + 'sw.js') return;
    if (req.mode === 'navigate') {
      if (p === BASE + 'app' || p.startsWith(APP)) { event.respondWith(appNavigation(event, url)); return; }
      event.respondWith(staleWhileRevalidate(event, navKey(url), true)); // página pública, /panel/, etc.
      return;
    }
    if (p.startsWith(BASE + 'fonts/')) { event.respondWith(cacheFirst(event, req)); return; }
    event.respondWith(staleWhileRevalidate(event, req, false));
  }
});

// Navegación dentro de /app/: red primero; si tarda más de NAV_TIMEOUT o no hay red → shell cacheado.
async function appNavigation(event, url) {
  const p = url.pathname;
  const exact = p === BASE + 'app' || p === APP || p === APP + 'index.html';
  // Rutas sin extensión bajo /app/ usan el shell como respaldo sin conexión, pero lo que devuelva la red
  // para ellas NO se guarda como shell (Pages sin 404.html responde el index público con 200).
  const spaLike = exact || !/\.[a-z0-9]+$/i.test(p);
  const key = exact ? APP : navKey(url);
  const cache = await caches.open(SHELL_CACHE);
  const opts = { ignoreSearch: true, ignoreVary: true };
  const fromCache = async () => (await cache.match(key, opts))
    || (spaLike ? (await cache.match(APP, opts)) || (await cache.match(APP + 'index.html', opts)) : null);

  const network = fetch(event.request).then((res) => {
    if (cacheable(res)) event.waitUntil(putClean(cache, key, res.clone()));
    return res;
  });
  event.waitUntil(network.catch(() => {}));

  return new Promise((resolve) => {
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(async () => { const hit = await fromCache(); if (hit) finish(hit); }, NAV_TIMEOUT);
    network.then(
      async (res) => {
        if (res.status >= 500) { const hit = await fromCache(); if (hit) return finish(hit); }
        finish(res);
      },
      async () => { finish((await fromCache()) || offlinePage()); }
    );
  });
}

// Responde con la copia guardada (si hay) y la actualiza en segundo plano.
async function staleWhileRevalidate(event, key, isNavigation) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(key, { ignoreSearch: isNavigation, ignoreVary: true });
  const network = fetch(event.request).then((res) => {
    if (cacheable(res)) event.waitUntil(putClean(cache, key, res.clone()));
    return res;
  });
  if (hit) {
    event.waitUntil(network.catch(() => {}));
    return hit;
  }
  try {
    return await network;
  } catch (e) {
    if (isNavigation) return offlinePage();
    throw e;
  }
}

// Fuentes del sitio: no cambian sin cambiar de VERSION (el precache las vuelve a bajar con cache:'reload'), así que
// la copia guardada se sirve sin ir a la red. Sin copia (p. ej. se borró la caché) → red, y se guarda.
async function cacheFirst(event, req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheable(res)) event.waitUntil(putClean(cache, req.url, res.clone()));
  return res;
}

// ── Utilidades ─────────────────────────────────────────────────────────────
const navKey = (url) => url.origin + url.pathname; // el HTML es estático: la query no cambia el documento
const cacheable = (res) => !!res && res.ok && res.type === 'basic';
async function putClean(cache, key, res) {
  try { await cache.put(key, await clean(res)); } catch (e) { /* cuota llena o respuesta no clonable */ }
}
// Una respuesta que vino de una redirección no puede servirse a una navegación: se copia sin esa marca.
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
function offlinePage() {
  const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>' +
    '<meta name="theme-color" content="#15130F"/><title>Sin conexión · TuBarbería</title>' +
    '<style>html{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;' +
    'background:#F5F3EE;color:#15130F;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;text-align:center}' +
    '@media (prefers-color-scheme:dark){body{background:#0F0E0B;color:#F2EDE3}p{color:#BDB5A5!important}}' +
    '.m{width:64px;height:64px;border-radius:18px;background:#15130F;display:grid;place-items:center;margin:0 auto 18px}' +
    'h1{font-size:22px;margin:0 0 6px}p{margin:0 0 20px;color:#5B554A;max-width:340px}' +
    'button{min-height:44px;padding:0 20px;border:0;border-radius:12px;background:#D9B25A;color:#15130F;font:600 15px/1 inherit;cursor:pointer}</style></head>' +
    '<body><main><div class="m"><svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v2.5a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z" fill="#D9B25A"/>' +
    '<path d="M7 21h10v-2.5a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3z" fill="#D9B25A"/><path d="M9 8.5 15 15.5M15 8.5 9 15.5" stroke="#D9B25A" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg></div>' +
    '<h1>Sin conexión</h1><p>No pudimos abrir esta página. Revisa tu internet e intenta de nuevo.</p>' +
    '<button type="button" onclick="location.reload()">Reintentar</button></main></body></html>';
  return new Response(html, { status: 503, statusText: 'Offline', headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
