/**
 * Todas las claves de localStorage de la app. Las que dependen del progreso viven aquí para que
 * reiniciar o importar el progreso las tenga en cuenta.
 */

/** Clave del progreso en localStorage (el sufijo es la versión del esquema). */
export const PROGRESS_STORAGE_KEY = 'elementa:progress:v1';

/**
 * Prefijo de las copias de seguridad de un progreso ilegible: `elementa:progress:corrupt:<ISO>`.
 * Se guardan antes de empezar de cero (máx. `MAX_CORRUPT_BACKUPS`, las más recientes).
 */
export const CORRUPT_BACKUP_PREFIX = 'elementa:progress:corrupt:';
export const MAX_CORRUPT_BACKUPS = 3;

/**
 * Preferencia de tema ('light' | 'dark' | 'system'), duplicada fuera del progreso para poder
 * aplicarla antes del primer pintado (script inline en `layout.tsx`).
 */
export const THEME_STORAGE_KEY = 'elementa:theme';

/**
 * Logros ya celebrados con confeti en `/logros`: `{ owner, ids }`, donde `owner` es el
 * `profile.createdAt` del progreso (al reiniciar o importar cambia y el conjunto deja de valer).
 */
export const CELEBRATED_ACHIEVEMENTS_KEY = 'elementa:logros:celebrated';

/** El usuario ocultó la sugerencia de instalar la PWA (preferencia del dispositivo, no del progreso). */
export const INSTALL_DISMISSED_KEY = 'elementa:install-dismissed';
