import type { ProgressState } from '@/types';

/**
 * Resultado de leer el progreso guardado. Distinguir los casos es lo que evita sobrescribir un
 * progreso real tras una lectura fallida:
 * - `ok`: estado validado y migrado.
 * - `empty`: no hay nada guardado (usuario nuevo): se puede crear y guardar un progreso nuevo.
 * - `corrupt`: había datos pero no se pueden leer. El repositorio ya guardó una copia de seguridad de
 *   `raw` antes de devolverlo, así que se puede empezar de cero y guardar.
 * - `error`: no se pudo leer (almacenamiento bloqueado, red…). NO se debe guardar nada hasta que una
 *   carga posterior funcione: lo guardado podría ser un progreso real.
 */
export type LoadResult =
  | { status: 'ok'; state: ProgressState }
  | { status: 'empty' }
  | { status: 'corrupt'; raw: string }
  | { status: 'error'; error: unknown };

/**
 * Contrato de persistencia del progreso. Hoy: localStorage. Mañana: Supabase/Firebase
 * (basta con otra implementación y cambiar la instancia exportada en `index.ts`).
 */
export interface ProgressRepository {
  /** Lee el progreso guardado. No debería lanzar (un rechazo se trata como `error`). */
  load(): Promise<LoadResult>;
  /** Guarda el estado completo. Lanza (rechaza) si no se pudo guardar: el store lo reintentará. */
  save(state: ProgressState): Promise<void>;
  clear(): Promise<void>;
  /**
   * Opcional: avisa cuando el estado cambia desde fuera (otra pestaña, otro dispositivo).
   * `null` si lo nuevo no es un progreso legible (se ignora). Devuelve la función para dejar de escuchar.
   */
  watch?(onChange: (state: ProgressState | null) => void): () => void;
}
