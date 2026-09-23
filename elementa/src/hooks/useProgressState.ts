'use client';

import { useSyncExternalStore } from 'react';
import { progressStore } from '@/store/progress-store';
import type { ProgressState } from '@/types';

const serverReady = () => false;

/** Estado completo del progreso (estado por defecto en el servidor y hasta que carga). */
export function useProgressState(): ProgressState {
  return useSyncExternalStore(progressStore.subscribe, progressStore.getState, progressStore.getServerSnapshot);
}

/** `true` cuando el progreso guardado ya se cargó en el cliente. */
export function useProgressReady(): boolean {
  return useSyncExternalStore(progressStore.subscribe, progressStore.isReady, serverReady);
}
