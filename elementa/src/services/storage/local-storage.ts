import type { ProgressState } from '@/types';
import { CORRUPT_BACKUP_PREFIX, MAX_CORRUPT_BACKUPS, PROGRESS_STORAGE_KEY } from './keys';
import type { LoadResult, ProgressRepository } from './types';
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

/** Claves de `storage` que empiezan por `prefix`, en orden alfabético (las ISO quedan de más antigua a más reciente). */
function keysWithPrefix(storage: Storage, prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys.sort();
}

/**
 * Repositorio sobre localStorage.
 * - `load` nunca lanza: distingue vacío, ilegible (con copia de seguridad) y error de acceso.
 * - `save` lanza si no se puede escribir (cuota llena, almacenamiento bloqueado) para que el store reintente.
 */
export class LocalStorageRepository implements ProgressRepository {
  private readonly key: string;
  private readonly storage: () => Storage | null;
  private readonly now: () => Date;

  constructor(
    key: string = PROGRESS_STORAGE_KEY,
    storage: () => Storage | null = getLocalStorage,
    now: () => Date = () => new Date(),
  ) {
    this.key = key;
    this.storage = storage;
    this.now = now;
  }

  /** Prefijo de las copias de seguridad de esta clave. */
  get backupPrefix(): string {
    return this.key === PROGRESS_STORAGE_KEY ? CORRUPT_BACKUP_PREFIX : `${this.key}:corrupt:`;
  }

  async load(): Promise<LoadResult> {
    let raw: string | null;
    const storage = this.storage();
    try {
      if (!storage) throw new Error('localStorage no está disponible');
      raw = storage.getItem(this.key);
    } catch (error) {
      return { status: 'error', error };
    }
    if (raw === null || raw.trim() === '') return { status: 'empty' };

    const state = parseProgressJson(raw);
    if (state) return { status: 'ok', state };

    // Ilegible: primero la copia de seguridad. Si no se puede hacer, es un error (nada debe sobrescribirlo).
    try {
      this.backup(storage, raw);
    } catch (error) {
      return { status: 'error', error };
    }
    return { status: 'corrupt', raw };
  }

  async save(state: ProgressState): Promise<void> {
    const storage = this.storage();
    if (!storage) throw new Error('localStorage no está disponible');
    storage.setItem(this.key, JSON.stringify(state));
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

  /**
   * Copia `raw` a `<prefijo><ISO>` y deja solo las `MAX_CORRUPT_BACKUPS` más recientes. Si no cabe,
   * libera las copias antiguas y lo intenta una vez más; si aun así falla, lanza.
   */
  private backup(storage: Storage, raw: string): void {
    const prefix = this.backupPrefix;
    const key = `${prefix}${this.now().toISOString()}`;
    const prune = (keep: number) => {
      const keys = keysWithPrefix(storage, prefix).filter((k) => k !== key);
      for (const old of keys.slice(0, Math.max(0, keys.length - keep))) storage.removeItem(old);
    };
    try {
      storage.setItem(key, raw);
    } catch {
      prune(0);
      storage.setItem(key, raw);
    }
    prune(MAX_CORRUPT_BACKUPS - 1);
  }
}
