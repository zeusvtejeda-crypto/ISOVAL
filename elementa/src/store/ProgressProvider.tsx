'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useProgressReady } from '@/hooks/useProgressState';
import { useThemeSync } from '@/hooks/useTheme';
import { progressStore } from './progress-store';

interface ProgressContextValue {
  /** `true` cuando el progreso guardado ya se cargó. */
  ready: boolean;
}

const ProgressContext = createContext<ProgressContextValue>({ ready: false });

/**
 * Carga el progreso guardado al montar (en el cliente), mantiene el tema sincronizado y expone
 * `ready`. Envolver toda la app con él en `layout.tsx`.
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const ready = useProgressReady();
  useThemeSync();

  useEffect(() => {
    void progressStore.hydrate();
  }, []);

  const value = useMemo(() => ({ ready }), [ready]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

/** `{ ready }` del proveedor más cercano. */
export function useProgressContext(): ProgressContextValue {
  return useContext(ProgressContext);
}

export default ProgressProvider;
