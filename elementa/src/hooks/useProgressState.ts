'use client';

import { useSyncExternalStore } from 'react';
import { INITIAL_SYNC_STATE, progressStore, type SyncState } from '@/store/progress-store';
import type { ProgressState } from '@/types';

const serverReady = () => false;
const serverSync = () => INITIAL_SYNC_STATE;

/** Estado completo del progreso (estado por defecto en el servidor y hasta que carga). */
export function useProgressState(): ProgressState {
  return useSyncExternalStore(progressStore.subscribe, progressStore.getState, progressStore.getServerSnapshot);
}

/** `true` cuando el progreso guardado ya se cargó en el cliente. */
export function useProgressReady(): boolean {
  return useSyncExternalStore(progressStore.subscribe, progressStore.isReady, serverReady);
}

/** Estado de la persistencia: `{ status: 'saved'|'pending'|'error'; loadIssue: 'corrupt'|'error'|null }`. */
export function useSyncStatus(): SyncState {
  return useSyncExternalStore(progressStore.subscribeSync, progressStore.getSyncStatus, serverSync);
}
