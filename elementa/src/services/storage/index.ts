import { LocalStorageRepository } from './local-storage';
import type { ProgressRepository } from './types';

export {
  CELEBRATED_ACHIEVEMENTS_KEY,
  CORRUPT_BACKUP_PREFIX,
  INSTALL_DISMISSED_KEY,
  MAX_CORRUPT_BACKUPS,
  PROGRESS_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from './keys';
export { getLocalStorage, LocalStorageRepository } from './local-storage';
export { MemoryRepository } from './memory';
export type { LoadResult, ProgressRepository } from './types';
export { parseProgressJson, parseProgressState } from './validate';

/**
 * Repositorio activo de la app. Es el ÚNICO punto a cambiar para migrar a Supabase/Firebase:
 * crea una clase que implemente `ProgressRepository` y asígnala aquí.
 */
export const progressRepository: ProgressRepository = new LocalStorageRepository();
