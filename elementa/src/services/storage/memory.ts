import type { ProgressState } from '@/types';
import type { LoadResult, ProgressRepository } from './types';

/** Repositorio en memoria (pruebas, entornos sin almacenamiento). Guarda copias profundas. */
export class MemoryRepository implements ProgressRepository {
  private data: string | null;

  constructor(initial: ProgressState | null = null) {
    this.data = initial ? JSON.stringify(initial) : null;
  }

  async load(): Promise<LoadResult> {
    return this.data ? { status: 'ok', state: JSON.parse(this.data) as ProgressState } : { status: 'empty' };
  }

  async save(state: ProgressState): Promise<void> {
    this.data = JSON.stringify(state);
  }

  async clear(): Promise<void> {
    this.data = null;
  }

  /** Último estado guardado (o `null`), sin pasar por `load`. Útil en pruebas. */
  peek(): ProgressState | null {
    return this.data ? (JSON.parse(this.data) as ProgressState) : null;
  }
}
