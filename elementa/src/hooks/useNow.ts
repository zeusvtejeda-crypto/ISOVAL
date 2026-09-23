'use client';

import { useSyncExternalStore } from 'react';

/**
 * Reloj compartido que se actualiza cada minuto (y al volver a la pestaña). En el servidor y
 * durante la hidratación devuelve la fecha 0, así el render es determinista.
 */

const TICK_MS = 60_000;
const EPOCH = new Date(0);

let current = new Date();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick(): void {
  current = new Date();
  for (const l of Array.from(listeners)) l();
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') tick();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    current = new Date();
    timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer !== null) clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => EPOCH;

/** Fecha actual (precisión de ~1 minuto) segura para usar durante el render. */
export function useNow(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
