/**
 * Registro del service worker (`public/sw.js`) desde el navegador.
 *
 * El SW se registra como `/sw.js?v=<build>`: al cambiar la compilación cambia la URL del script, el navegador
 * instala la versión nueva y esta vuelve a precachear la app con cachés propias (ver next.config.ts).
 */

const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION;

export const SERVICE_WORKER_URL = BUILD_VERSION ? `/sw.js?v=${encodeURIComponent(BUILD_VERSION)}` : '/sw.js';

/** Prefijo de las cachés que crea `public/sw.js`. */
const CACHE_PREFIX = 'elementa-';

/** Cada cuánto, como mucho, se busca una versión nueva del SW al volver a la app. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export interface ServiceWorkerCallbacks {
  /** Una versión nueva tomó el control de una página que ya estaba controlada por otra. */
  onUpdateActivated?: () => void;
}

/** Pide a un SW en espera que se active ya (solo si hay otro controlando: en la primera instalación no hace falta). */
function activateWaiting(registration: ServiceWorkerRegistration): void {
  if (registration.waiting && navigator.serviceWorker.controller) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Registra el SW cuando la página termina de cargar (para no competir con sus recursos)
 * y vigila las actualizaciones. Devuelve la función de limpieza.
 */
export function registerServiceWorker({ onUpdateActivated }: ServiceWorkerCallbacks = {}): () => void {
  const container = navigator.serviceWorker;
  let disposed = false;
  let hadController = container.controller !== null;
  let registration: ServiceWorkerRegistration | null = null;
  let lastUpdateCheck = Date.now();

  const handleControllerChange = () => {
    if (hadController) onUpdateActivated?.();
    hadController = true;
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible' || !registration) return;
    const now = Date.now();
    if (now - lastUpdateCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastUpdateCheck = now;
    registration.update().catch(() => undefined);
  };

  const register = async () => {
    try {
      const current = await container.register(SERVICE_WORKER_URL, { scope: '/', updateViaCache: 'none' });
      if (disposed) return;
      registration = current;
      activateWaiting(current);
      current.addEventListener('updatefound', () => {
        const worker = current.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') activateWaiting(current);
        });
      });
    } catch (error) {
      console.warn('[Elementa] No se pudo registrar el service worker:', error);
    }
  };

  const handleLoad = () => {
    void register();
  };

  container.addEventListener('controllerchange', handleControllerChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  if (document.readyState === 'complete') handleLoad();
  else window.addEventListener('load', handleLoad, { once: true });

  return () => {
    disposed = true;
    container.removeEventListener('controllerchange', handleControllerChange);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('load', handleLoad);
  };
}

/**
 * En desarrollo, elimina un SW de Elementa que haya quedado de una ejecución de producción en el mismo
 * origen (si no, serviría páginas y scripts antiguos desde la caché).
 */
export async function unregisterServiceWorkers(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const ours = registrations.filter((registration) =>
      [registration.active, registration.waiting, registration.installing].some(
        (worker) => worker !== null && new URL(worker.scriptURL).pathname === '/sw.js',
      ),
    );
    if (ours.length === 0) return;
    await Promise.all(ours.map((registration) => registration.unregister()));
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name)));
    }
    console.info('[Elementa] Service worker de producción eliminado en desarrollo. Recarga para ver los cambios.');
  } catch {
    // Sin permisos o API no disponible: nada que limpiar.
  }
}
