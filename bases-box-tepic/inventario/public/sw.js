// Service worker: guarda la app para abrirla aunque no haya internet.
// Los datos (/api) nunca se guardan aquí: siempre van a la red.
const VERSION = 'bb-inv-v9';
const BASE = ['./', 'index.html', 'core.js', 'pdf.js', 'app.js', 'fonts.css', 'manifest.webmanifest', 'logo.png', 'logo-ticket.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'fonts/anton-400.woff2', 'fonts/barlow-400.woff2', 'fonts/barlow-500.woff2', 'fonts/barlow-600.woff2', 'fonts/barlow-700.woff2',
  'fonts/barlow-condensed-500.woff2', 'fonts/barlow-condensed-600.woff2', 'fonts/barlow-condensed-700.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero para que cada cambio de la app llegue en cuanto hay internet; sin red, la copia guardada.
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(r)
      .then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(r, copia)); }
        return res;
      })
      .catch(() => caches.match(r).then((m) => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

// Avisos al celular: cada venta de Rubén llega como notificación (el servidor la manda cifrada).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titulo: 'Bases Box Tepic', texto: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Bases Box Tepic', {
    body: d.texto || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'bb-' + Date.now(), data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ls) => {
    const abierta = ls.find((c) => 'focus' in c);
    return abierta ? abierta.focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  }));
});
