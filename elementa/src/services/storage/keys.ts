/** Clave del progreso en localStorage (el sufijo es la versión del esquema). */
export const PROGRESS_STORAGE_KEY = 'elementa:progress:v1';

/**
 * Preferencia de tema ('light' | 'dark' | 'system'), duplicada fuera del progreso para poder
 * aplicarla antes del primer pintado (script inline en `layout.tsx`).
 */
export const THEME_STORAGE_KEY = 'elementa:theme';
