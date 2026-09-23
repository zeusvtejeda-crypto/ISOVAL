import type { ProgressState } from '@/types';
import type { ProgressRepository } from './types';

/** Repositorio en memoria (pruebas, entornos sin almacenamiento). Guarda copias profundas. */
export class MemoryRepository implements ProgressRepository {
  private data: string | null;

  constructor(initial: ProgressState | null = null) {
    this.data = initial ? JSON.stringify(initial) : null;
  }

  async load(): Promise<ProgressState | null> {
    return this.data ? (JSON.parse(this.data) as ProgressState) : null;
  }

  async save(state: ProgressState): Promise<void> {
    this.data = JSON.stringify(state);
  }

  async clear(): Promise<void> {
    this.data = null;
  }
}
