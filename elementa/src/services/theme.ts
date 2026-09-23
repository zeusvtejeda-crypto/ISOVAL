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

/** Color de la barra del sistema (`theme-color`) por tema: el `--color-bg` de globals.css. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f6f5fb', dark: '#0e0c18' };

/** Marca del `<meta name="theme-color">` propio (sin `media`), que sigue al tema elegido en la app. */
const THEME_META_ATTR = 'data-app-theme-color';

/**
 * Crea o actualiza el `<meta name="theme-color">` sin `media` y lo coloca delante de los de `layout.tsx`
 * (que dependen de `prefers-color-scheme`): el navegador usa el primero que encaja, así que la barra
 * del sistema sigue al tema de la app y no solo al del dispositivo.
 */
function upsertThemeColor(color: string): void {
  const head = document.head;
  if (!head) return;
  let meta = head.querySelector<HTMLMetaElement>(`meta[${THEME_META_ATTR}]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.setAttribute(THEME_META_ATTR, '');
  }
  meta.content = color;
  const first = head.querySelector('meta[name="theme-color"]');
  if (first !== meta) head.insertBefore(meta, first);
}

/** Aplica la clase `dark` en `<html>`, el `color-scheme` nativo y el color de la barra del sistema. */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  upsertThemeColor(THEME_COLORS[resolved]);
}

/**
 * Script para `<head>` (antes del primer pintado) que aplica el tema guardado (clase, `color-scheme` y
 * `theme-color`) y evita el destello. Uso en layout.tsx:
 * `<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />` con `suppressHydrationWarning` en `<html>`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||((t!=='light')&&window.matchMedia('${DARK_MEDIA_QUERY}').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';var h=document.head,m=document.createElement('meta');m.name='theme-color';m.setAttribute('${THEME_META_ATTR}','');m.content=d?'${THEME_COLORS.dark}':'${THEME_COLORS.light}';h.insertBefore(m,h.querySelector('meta[name="theme-color"]'));}catch(e){}})();`;
