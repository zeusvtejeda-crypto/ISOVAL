import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getSnapshot = (): boolean | null => navigator.onLine;
const getServerSnapshot = (): boolean | null => null;

/**
 * Estado de la conexión según el navegador: `true`/`false`, o `null` en el servidor y durante la hidratación.
 * Ojo: `true` solo indica que hay red, no que el servidor responda.
 */
export function useOnlineStatus(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
