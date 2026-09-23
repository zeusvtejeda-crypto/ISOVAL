'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY } from '@/services/storage/keys';
import {
  applyResolvedTheme,
  DARK_MEDIA_QUERY,
  readStoredTheme,
  resolveTheme,
  systemPrefersDark,
  writeStoredTheme,
  type ResolvedTheme,
} from '@/services/theme';
import { progressStore } from '@/store/progress-store';
import type { ThemePreference } from '@/types';
import { useProgressReady, useProgressState } from './useProgressState';

// ---------- Preferencia del sistema ----------

function subscribeSystem(onChange: () => void): () => void {
  try {
    const mql = window.matchMedia(DARK_MEDIA_QUERY);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  } catch {
    return () => {};
  }
}

const serverFalse = () => false;

function useSystemDark(): boolean {
  return useSyncExternalStore(subscribeSystem, systemPrefersDark, serverFalse);
}

// ---------- Tema guardado fuera del progreso (antes de cargar) ----------

const storedListeners = new Set<() => void>();

function subscribeStored(onChange: () => void): () => void {
  storedListeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    storedListeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

const serverSystem = (): ThemePreference => 'system';

export interface UseThemeResult {
  /** Preferencia elegida: 'light' | 'dark' | 'system'. */
  theme: ThemePreference;
  /** Tema efectivo tras resolver 'system'. */
  resolvedTheme: ResolvedTheme;
  setTheme(theme: ThemePreference): void;
}

/** Tema de la app: lo guarda en los ajustes y en `localStorage['elementa:theme']`, y aplica `.dark` en `<html>`. */
export function useTheme(): UseThemeResult {
  const ready = useProgressReady();
  const settingsTheme = useProgressState().settings.theme;
  const storedTheme = useSyncExternalStore(subscribeStored, readStoredTheme, serverSystem);
  const systemDark = useSystemDark();
  const theme = ready ? settingsTheme : storedTheme;

  const setTheme = useCallback((next: ThemePreference) => {
    writeStoredTheme(next);
    applyResolvedTheme(resolveTheme(next, systemPrefersDark()));
    progressStore.updateSettings({ theme: next });
    for (const l of Array.from(storedListeners)) l();
  }, []);

  return { theme, resolvedTheme: resolveTheme(theme, systemDark), setTheme };
}

/**
 * Mantiene `<html class="dark">` sincronizado con los ajustes y con el sistema (modo 'system').
 * Se usa una sola vez, dentro de `ProgressProvider`.
 */
export function useThemeSync(): void {
  const ready = useProgressReady();
  const theme = useProgressState().settings.theme;
  const systemDark = useSystemDark();

  useEffect(() => {
    if (!ready) return;
    applyResolvedTheme(resolveTheme(theme, systemDark));
    writeStoredTheme(theme);
  }, [ready, theme, systemDark]);
}
