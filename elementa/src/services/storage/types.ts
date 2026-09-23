import type { ProgressState } from '@/types';

/**
 * Contrato de persistencia del progreso. Hoy: localStorage. Mañana: Supabase/Firebase
 * (basta con otra implementación y cambiar la instancia exportada en `index.ts`).
 */
export interface ProgressRepository {
  /** Estado guardado (validado y migrado) o `null` si no hay nada o está corrupto. */
  load(): Promise<ProgressState | null>;
  save(state: ProgressState): Promise<void>;
  clear(): Promise<void>;
  /**
   * Opcional: avisa cuando el estado cambia desde fuera (otra pestaña, otro dispositivo).
   * Devuelve la función para dejar de escuchar.
   */
  watch?(onChange: (state: ProgressState | null) => void): () => void;
}
