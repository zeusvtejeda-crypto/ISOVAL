import { useSyncExternalStore } from 'react';

/** La app abierta como aplicación instalada (no como pestaña del navegador). */
const STANDALONE_QUERY = '(display-mode: standalone), (display-mode: window-controls-overlay)';

interface NavigatorWithStandalone extends Navigator {
  /** Safari en iOS: `true` al abrir la web desde la pantalla de inicio. */
  standalone?: boolean;
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** `true` si la app se está ejecutando instalada. Solo en el navegador. */
export function isStandaloneDisplay(): boolean {
  return window.matchMedia(STANDALONE_QUERY).matches || (navigator as NavigatorWithStandalone).standalone === true;
}

const getServerSnapshot = () => false;

/** ¿Se está usando Elementa como app instalada? `false` en el servidor y durante la hidratación. */
export function useIsStandalone(): boolean {
  return useSyncExternalStore(subscribe, isStandaloneDisplay, getServerSnapshot);
}
