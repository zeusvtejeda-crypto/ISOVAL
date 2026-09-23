/**
 * Elementa · service worker (JavaScript plano, sin dependencias).
 *
 * Objetivo: que toda la app funcione sin conexión después de la primera visita.
 *
 * Versionado: el cliente lo registra como `/sw.js?v=<build>` (ver components/pwa/sw-client.ts), así que cada
 * despliegue instala un SW nuevo con cachés propias y el `activate` borra las anteriores. `REVISION` se sube a
 * mano solo cuando cambia la lógica de este archivo de forma incompatible con las cachés existentes.
 *
 * Estrategias:
 *   navegaciones            → red primero (máx. ~3,5 s) → página en caché → "/" en caché → "/offline"
 *   /_next/static/*         → caché primero (archivos inmutables con hash)
 *   RSC (RSC: 1 o ?_rsc=)   → red primero → caché
 *   resto same-origin GET   → stale-while-revalidate (iconos, manifiesto, fuentes…)
 *   no-GET / otro origen    → sin intervenir
 */

const REVISION = 'r1';
const BUILD = sanitizeVersion(new URL(self.location.href).searchParams.get('v'));
const PREFIX = 'elementa';

const CACHE = {
  pages: `${PREFIX}-pages-${REVISION}-${BUILD}`,
  static: `${PREFIX}-static-${REVISION}-${BUILD}`,
  rsc: `${PREFIX}-rsc-${REVISION}-${BUILD}`,
  assets: `${PREFIX}-assets-${REVISION}-${BUILD}`,
};

/** Todas las pantallas de la app (ARCHITECTURE.md) + la página sin conexión. */
const APP_ROUTES = [
  '/',
  '/bienvenida',
  '/estudiar',
  '/aprende',
  '/tabla',
  '/flashcards',
  '/preguntados',
  '/examen',
  '/contrarreloj',
  '/supervivencia',
  '/racha',
  '/visual',
  '/practicar',
  '/bloques',
  '/errores',
  '/estadisticas',
  '/logros',
  '/jugar',
  '/ajustes',
  '/offline',
];

/** Recursos de la carcasa que no son páginas. */
const SHELL_ASSETS = [
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-icon.png',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/shortcut-estudiar.png',
  '/icons/shortcut-tabla.png',
  '/icons/shortcut-contrarreloj.png',
  '/icons/shortcut-flashcards.png',
];

const SHELL_ASSET_SET = new Set(SHELL_ASSETS);

/** Rutas cuyo HTML enlaza con un `?hash` que cambia: se buscan también ignorando la query. */
const METADATA_ASSETS = new Set(['/manifest.webmanifest', '/icon.svg', '/apple-icon.png', '/favicon.ico']);

const NAVIGATION_TIMEOUT_MS = 3500;
const RSC_TIMEOUT_MS = 3500;
const MAX_RSC_ENTRIES = 150;
const MAX_ASSET_ENTRIES = 80;
/** Límite de seguridad para el precalentado de /_next/static (JS, CSS, fuentes). */
const MAX_WARM_URLS = 800;
const WARM_CONCURRENCY = 6;

// ---------------------------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cachedPages = await precacheShell();
      // Nunca activar una versión que no puede servir nada sin conexión (se reintentará en la próxima visita).
      if (cachedPages === 0) throw new Error('[Elementa SW] No se pudo guardar ninguna página.');
      try {
        await warmStaticAssets();
      } catch (error) {
        console.warn('[Elementa SW] Precalentado incompleto:', error);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const current = new Set(Object.values(CACHE));
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith(`${PREFIX}-`) && !current.has(name)).map((name) => caches.delete(name)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => undefined);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && typeof data === 'object' && data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Error conocido de Chrome DevTools: no se puede responder a estas peticiones desde el SW.
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return;
  if (url.pathname === '/sw.js' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event, url));
    return;
  }
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event, request));
    return;
  }
  if (isRscRequest(request, url)) {
    event.respondWith(handleRsc(event, request));
    return;
  }
  // Otras rutas internas de Next (salvo el optimizador de imágenes) van directas a la red.
  if (url.pathname.startsWith('/_next/') && !url.pathname.startsWith('/_next/image')) return;

  event.respondWith(staleWhileRevalidate(event, request, url));
});

// ---------------------------------------------------------------------------------------------
// Instalación: carcasa + precalentado
// ---------------------------------------------------------------------------------------------

/** Guarda cada ruta y recurso de la carcasa; tolera fallos individuales. Devuelve cuántas páginas guardó. */
async function precacheShell() {
  const [pages, assets] = await Promise.all([caches.open(CACHE.pages), caches.open(CACHE.assets)]);
  const [pageResults] = await Promise.all([
    Promise.all(APP_ROUTES.map((path) => precacheEntry(pages, 'pages', path, isPageResponse))),
    Promise.all(SHELL_ASSETS.map((path) => precacheEntry(assets, 'assets', path, isCacheable))),
  ]);
  return pageResults.filter(Boolean).length;
}

/**
 * Descarga `path` y lo guarda. Si la red falla, reutiliza la copia de una versión anterior
 * (así una actualización a medias no deja huecos sin conexión).
 */
async function precacheEntry(cache, kind, path, accept) {
  const key = toAbsolute(path);
  try {
    const response = await fetch(new Request(key, { cache: 'no-cache', credentials: 'same-origin' }));
    if (accept(response)) {
      await cache.put(key, await withoutRedirect(response));
      return true;
    }
  } catch {
    // Sin red: se intenta con la copia anterior.
  }
  const previous = await matchInOlderCaches(kind, key, { ignoreSearch: true, ignoreVary: true });
  if (previous) {
    await cache.put(key, previous);
    return true;
  }
  return false;
}

/**
 * Recorre el HTML guardado y descarga todos los /_next/static que referencia (scripts, CSS, fuentes),
 * y a su vez los que referencian esos CSS/JS (fuentes de @font-face, chunks cargados bajo demanda).
 */
async function warmStaticAssets() {
  const [pages, store] = await Promise.all([caches.open(CACHE.pages), caches.open(CACHE.static)]);
  const seen = new Set();
  let level = [];
  const enqueue = (target) => (url) => {
    if (seen.has(url) || seen.size >= MAX_WARM_URLS) return;
    seen.add(url);
    target.push(url);
  };

  for (const request of await pages.keys()) {
    const response = await pages.match(request);
    if (response) extractStaticUrls(await response.text(), request.url).forEach(enqueue(level));
  }

  while (level.length > 0) {
    const next = [];
    await runPool(level, WARM_CONCURRENCY, async (url) => {
      const response = await ensureStatic(store, url);
      if (response && isScannable(url)) extractStaticUrls(await response.text(), url).forEach(enqueue(next));
    });
    level = next;
  }
}

/** Devuelve el recurso estático desde la caché actual, una versión anterior o la red (y lo guarda). */
async function ensureStatic(store, url) {
  const cached = await store.match(url);
  if (cached) return cached;

  const previous = await matchInOlderCaches('static', url);
  if (previous) {
    await store.put(url, previous.clone());
    return previous;
  }

  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!isCacheable(response)) return null;
    await store.put(url, response.clone());
    return response;
  } catch {
    return null;
  }
}

const ABSOLUTE_STATIC_RE = /\/_next\/static\/[^"'`\s<>(){}$\\]+/g;
const RELATIVE_STATIC_RE = /["'](static\/(?:chunks|css|media)\/[^"'`\s<>(){}$\\]+)/g;
const CSS_URL_RE = /url\(\s*["']?([^"')]+?)["']?\s*\)/g;
const STATIC_FILE_RE = /\.(?:m?js|css|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico|json|wasm)(?:[?#]|$)/i;

/** Extrae las URL absolutas de /_next/static/* (mismo origen) que aparecen en un HTML, JS o CSS. */
function extractStaticUrls(text, baseUrl) {
  const found = new Set();
  const add = (raw, base) => {
    try {
      const url = new URL(raw.replace(/&amp;/g, '&'), base);
      url.hash = '';
      if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/') && STATIC_FILE_RE.test(url.pathname)) {
        found.add(url.href);
      }
    } catch {
      // URL mal formada: se ignora.
    }
  };

  for (const match of text.matchAll(ABSOLUTE_STATIC_RE)) add(match[0], self.location.origin);
  for (const match of text.matchAll(RELATIVE_STATIC_RE)) add(`/_next/${match[1]}`, self.location.origin);
  if (/\.css$/i.test(new URL(baseUrl).pathname)) {
    for (const match of text.matchAll(CSS_URL_RE)) {
      if (!match[1].startsWith('data:')) add(match[1], baseUrl);
    }
  }
  return found;
}

function isScannable(url) {
  return /\.(?:m?js|css)$/i.test(new URL(url).pathname);
}

/** Ejecuta `task` sobre `items` con, como mucho, `limit` tareas simultáneas. Los fallos no cortan el resto. */
async function runPool(items, limit, task) {
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const item = items[index++];
      try {
        await task(item);
      } catch {
        // Recurso individual fallido: se sigue con el resto.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// ---------------------------------------------------------------------------------------------
// Estrategias de fetch
// ---------------------------------------------------------------------------------------------

/**
 * Navegación: red primero con límite de tiempo. Si la red tarda o falla, la copia guardada de esa página.
 * Si no hay copia y la red falla del todo: "/" en caché → "/offline" en caché → página mínima en línea.
 * (Si solo tarda y no hay copia, se sigue esperando a la red: una ruta nueva no debe acabar en "/".)
 */
function handleNavigation(event, url) {
  const network = fetchNavigation(event).then((response) => {
    if (isPageResponse(response)) keepAlive(event, storePage(url, response.clone()));
    return response;
  });
  keepAlive(event, network);
  return networkFirst(network, () => matchPage(pageKey(url)), NAVIGATION_TIMEOUT_MS, offlinePageFallback);
}

/** Usa la respuesta de la precarga de navegación si el navegador la ofrece. */
async function fetchNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
  } catch {
    // La precarga falló: se intenta con un fetch normal.
  }
  return fetch(event.request);
}

async function storePage(url, response) {
  const cache = await caches.open(CACHE.pages);
  await cache.put(pageKey(url), response);
}

async function matchPage(key) {
  const cache = await caches.open(CACHE.pages);
  return (await cache.match(key, { ignoreSearch: true, ignoreVary: true })) || null;
}

async function offlinePageFallback() {
  return (await matchPage(toAbsolute('/'))) || (await matchPage(toAbsolute('/offline'))) || offlineResponse();
}

/** Carga útil RSC de Next (navegación del lado del cliente y prefetch). */
function handleRsc(event, request) {
  const network = fetch(request).then((response) => {
    if (isCacheable(response) && isFlightResponse(response)) {
      keepAlive(event, putAndTrim(CACHE.rsc, request, response.clone(), MAX_RSC_ENTRIES));
    }
    return response;
  });
  keepAlive(event, network);
  // Sin red ni copia: error de red → Next hace una navegación completa, que sí resolvemos desde la caché.
  return networkFirst(network, () => caches.open(CACHE.rsc).then((cache) => cache.match(request)), RSC_TIMEOUT_MS, () =>
    Response.error(),
  );
}

async function cacheFirst(event, request) {
  const cache = await caches.open(CACHE.static);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) keepAlive(event, cache.put(request, response.clone()));
  return response;
}

async function staleWhileRevalidate(event, request, url) {
  const cache = await caches.open(CACHE.assets);
  const cached =
    (await cache.match(request)) ||
    (METADATA_ASSETS.has(url.pathname) || url.pathname.startsWith('/icons/')
      ? await cache.match(request, { ignoreSearch: true })
      : undefined);

  const network = fetch(request).then((response) => {
    if (isCacheable(response)) keepAlive(event, putAndTrim(CACHE.assets, request, response.clone(), MAX_ASSET_ENTRIES));
    return response;
  });

  if (cached) {
    keepAlive(event, network);
    return cached;
  }
  return network;
}

/**
 * Red primero: espera a la red hasta `timeoutMs`; si tarda, falla o da 5xx, usa la copia exacta (`lookup`).
 * Sin copia, sigue esperando a la red; solo si al final falla, devuelve `fallback()`.
 */
async function networkFirst(network, lookup, timeoutMs, fallback) {
  let response = null;
  try {
    response = await withTimeout(network, timeoutMs);
  } catch {
    // Red caída o lenta.
  }
  if (response && response.status < 500) return response;

  const cached = await lookup();
  if (cached) return cached;
  if (response) return response;

  try {
    return await network;
  } catch {
    return fallback();
  }
}

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

function isRscRequest(request, url) {
  return request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');
}

function isCacheable(response) {
  return Boolean(response) && response.status === 200 && (response.type === 'basic' || response.type === 'default');
}

function isPageResponse(response) {
  return isCacheable(response) && (response.headers.get('content-type') || '').includes('text/html');
}

function isFlightResponse(response) {
  return (response.headers.get('content-type') || '').includes('text/x-component');
}

/** Las páginas se guardan sin query ni barra final: la query la interpreta el cliente. */
function pageKey(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return toAbsolute(path);
}

function toAbsolute(path) {
  return new URL(path, self.location.origin).href;
}

/** Una respuesta con `redirected` no puede responder a una navegación: se copia limpia. */
async function withoutRedirect(response) {
  if (!response.redirected) return response;
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/** Busca en las cachés de versiones anteriores del mismo tipo (nunca mezcla páginas con RSC). */
async function matchInOlderCaches(kind, request, options) {
  const names = (await caches.keys()).filter((name) => name.startsWith(`${PREFIX}-${kind}-`) && name !== CACHE[kind]);
  for (const name of names) {
    const cache = await caches.open(name);
    const match = await cache.match(request, options);
    if (match) return match;
  }
  return undefined;
}

/** Guarda y recorta la caché a `maxEntries` (las más antiguas primero; los recursos de la carcasa no se tocan). */
async function putAndTrim(cacheName, request, response, maxEntries) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  if (excess <= 0) return;
  const removable = keys.filter((key) => !SHELL_ASSET_SET.has(new URL(key.url).pathname));
  await Promise.all(removable.slice(0, excess).map((key) => cache.delete(key)));
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Mantiene vivo el SW hasta que termine `promise` (sin propagar errores). */
function keepAlive(event, promise) {
  const settled = Promise.resolve(promise).catch(() => undefined);
  try {
    event.waitUntil(settled);
  } catch {
    // El evento ya terminó: la tarea sigue en curso igualmente.
  }
}

function sanitizeVersion(value) {
  const clean = (value || '').replace(/[^\w.-]/g, '').slice(0, 40);
  return clean || 'dev';
}

/** Último recurso si ni siquiera "/offline" está en caché. */
function offlineResponse() {
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Sin conexión · Elementa</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f5fb; --fg: #17142b; --muted: #615c7a; --brand: #6841f0; --on-brand: #fff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0e0c18; --fg: #f2f0ff; --muted: #a6a0c4; --brand: #a58fff; --on-brand: #150b38; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px; background: var(--bg); color: var(--fg);
    font-family: ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; text-align: center; }
  main { max-width: 26rem; }
  h1 { margin: 16px 0 8px; font-size: 1.75rem; font-weight: 900; }
  p { margin: 0 0 24px; color: var(--muted); line-height: 1.5; }
  button { min-height: 48px; padding: 0 24px; border: 0; border-radius: 16px; background: var(--brand); color: var(--on-brand);
    font: inherit; font-weight: 800; font-size: 1rem; cursor: pointer; }
  button:focus-visible { outline: 3px solid var(--brand); outline-offset: 3px; }
  .icon { font-size: 3rem; }
</style>
</head>
<body>
<main>
  <div class="icon" aria-hidden="true">📡</div>
  <h1>Sin conexión</h1>
  <p>No pudimos cargar esta pantalla. Tu progreso está guardado en este dispositivo: vuelve a intentarlo cuando tengas internet.</p>
  <button type="button" onclick="location.reload()">Reintentar</button>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
