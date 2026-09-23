import type { ProgressState } from '@/types';
import { PROGRESS_STORAGE_KEY } from './keys';
import type { ProgressRepository } from './types';
import { parseProgressJson } from './validate';

/** Devuelve `window.localStorage` si existe y es accesible (modo privado, SSR…). */
export function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Repositorio sobre localStorage. Nunca lanza: los errores de acceso se tratan como "sin datos". */
export class LocalStorageRepository implements ProgressRepository {
  private readonly key: string;
  private readonly storage: () => Storage | null;

  constructor(key: string = PROGRESS_STORAGE_KEY, storage: () => Storage | null = getLocalStorage) {
    this.key = key;
    this.storage = storage;
  }

  async load(): Promise<ProgressState | null> {
    try {
      const raw = this.storage()?.getItem(this.key);
      return raw ? parseProgressJson(raw) : null;
    } catch {
      return null;
    }
  }

  async save(state: ProgressState): Promise<void> {
    try {
      this.storage()?.setItem(this.key, JSON.stringify(state));
    } catch {
      // Cuota llena o almacenamiento bloqueado: se conserva el estado en memoria.
    }
  }

  async clear(): Promise<void> {
    try {
      this.storage()?.removeItem(this.key);
    } catch {
      // Ignorado a propósito.
    }
  }

  /** Cambios hechos en otra pestaña del mismo navegador. */
  watch(onChange: (state: ProgressState | null) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = (e: StorageEvent) => {
      if (e.key !== this.key) return;
      onChange(e.newValue ? parseProgressJson(e.newValue) : null);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}
