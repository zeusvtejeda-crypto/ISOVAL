'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { startInstallPromptCapture } from './install-prompt-store';
import { registerServiceWorker, unregisterServiceWorkers } from './sw-client';

/**
 * Registra `public/sw.js` (solo en producción y si el navegador lo admite) y empieza a capturar
 * `beforeinstallprompt` para <InstallPrompt />. No renderiza nada.
 *
 * Actualizaciones: el SW nuevo se activa solo (skipWaiting + clients.claim). Para no interrumpir nunca
 * una partida en curso, la página no se recarga en ese momento: lo hace una sola vez en la siguiente
 * navegación, cuando ya no hay nada que perder.
 */
export function ServiceWorkerRegister(): null {
  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  const reloadOnNavigation = useRef(false);

  useEffect(() => {
    startInstallPromptCapture();
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      void unregisterServiceWorkers();
      return;
    }
    return registerServiceWorker({
      onUpdateActivated: () => {
        reloadOnNavigation.current = true;
      },
    });
  }, []);

  useEffect(() => {
    if (pathname === lastPathname.current) return;
    lastPathname.current = pathname;
    if (!reloadOnNavigation.current) return;
    reloadOnNavigation.current = false;
    window.location.reload();
  }, [pathname]);

  return null;
}
