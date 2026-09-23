'use client';

import { InstallPrompt } from '@/components/pwa';
import { Skeleton } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';

/**
 * Instalar la app. Cuando el navegador no permite instalarla, `InstallPrompt` muestra el
 * `fallback`: explicamos cómo hacerlo para que la sección nunca quede vacía.
 */
export function InstallSetting() {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div aria-hidden className="flex items-center gap-3">
        <Skeleton className="size-11" rounded="2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <InstallPrompt
      variant="compact"
      fallback={
        <p className="text-sm font-semibold text-muted">
          Abre Elementa en Chrome, Edge o Safari y usa «Instalar app» o «Añadir a pantalla de inicio» para tenerla
          como una app, también sin conexión.
        </p>
      }
    />
  );
}
