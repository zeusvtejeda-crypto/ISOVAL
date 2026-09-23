'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

const getSnapshot = (): boolean => window.matchMedia(QUERY).matches;
/** En el servidor asumimos movimiento reducido: no se pinta nada animado antes de hidratar. */
const getServerSnapshot = (): boolean => true;

/** `true` si el usuario pidió reducir el movimiento (o durante el render del servidor). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
