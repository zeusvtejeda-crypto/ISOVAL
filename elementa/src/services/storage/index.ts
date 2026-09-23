import { LocalStorageRepository } from './local-storage';
import type { ProgressRepository } from './types';

export { PROGRESS_STORAGE_KEY, THEME_STORAGE_KEY } from './keys';
export { getLocalStorage, LocalStorageRepository } from './local-storage';
export { MemoryRepository } from './memory';
export type { ProgressRepository } from './types';
export { parseProgressJson, parseProgressState } from './validate';

/**
 * Repositorio activo de la app. Es el ÚNICO punto a cambiar para migrar a Supabase/Firebase:
 * crea una clase que implemente `ProgressRepository` y asígnala aquí.
 */
export const progressRepository: ProgressRepository = new LocalStorageRepository();
