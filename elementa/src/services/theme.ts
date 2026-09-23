import type { ThemePreference } from '@/types';
import { getLocalStorage } from './storage/local-storage';
import { THEME_STORAGE_KEY } from './storage/keys';

export type ResolvedTheme = 'light' | 'dark';

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

/** Preferencia guardada en `localStorage['elementa:theme']` ('system' si no hay). */
export function readStoredTheme(): ThemePreference {
  try {
    const v = getLocalStorage()?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredTheme(theme: ThemePreference): void {
  try {
    getLocalStorage()?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Almacenamiento bloqueado: el tema sigue aplicándose en esta sesión.
  }
}

export function systemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia(DARK_MEDIA_QUERY).matches;
  } catch {
    return false;
  }
}

export function resolveTheme(theme: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (theme === 'system') return systemDark ? 'dark' : 'light';
  return theme;
}

/** Aplica la clase `dark` en `<html>` y el `color-scheme` nativo. */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

/**
 * Script para `<head>` (antes del primer pintado) que aplica el tema guardado y evita el destello.
 * Uso en layout.tsx: `<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />`
 * junto con `suppressHydrationWarning` en `<html>`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||((t!=='light')&&window.matchMedia('${DARK_MEDIA_QUERY}').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
