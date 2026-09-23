import { useSyncExternalStore } from 'react';

/**
 * Cómo se instala la app en este navegador cuando no hay `beforeinstallprompt`:
 * - `ios`: Safari (y demás navegadores) en iPhone/iPad → Compartir → Añadir a pantalla de inicio.
 * - `mac-safari`: Safari 17+ en macOS → Archivo → Añadir al Dock.
 * - `other`: sin instrucciones manuales (Chromium usa el diálogo nativo).
 */
export type InstallPlatform = 'ios' | 'mac-safari' | 'other';

/** Navegadores integrados en otras apps: no permiten añadir la web a la pantalla de inicio. */
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|Twitter|Line\/|TikTok|Snapchat/;

export function detectInstallPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform {
  if (IN_APP_BROWSER.test(userAgent)) return 'other';
  // iPadOS 13+ se presenta como Mac, pero con pantalla táctil.
  const isIPadOS = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(userAgent) || isIPadOS) return 'ios';

  const isSafari = /Safari\//.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Firefox|SamsungBrowser/.test(userAgent);
  if (/Macintosh/.test(userAgent) && isSafari) {
    const version = /Version\/(\d+)/.exec(userAgent);
    if (version && Number(version[1]) >= 17) return 'mac-safari';
  }
  return 'other';
}

const noopSubscribe = () => () => {};
const getSnapshot = (): InstallPlatform => detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
const getServerSnapshot = (): InstallPlatform => 'other';

/** Plataforma de instalación del navegador actual (`other` en el servidor y durante la hidratación). */
export function useInstallPlatform(): InstallPlatform {
  return useSyncExternalStore(noopSubscribe, getSnapshot, getServerSnapshot);
}
