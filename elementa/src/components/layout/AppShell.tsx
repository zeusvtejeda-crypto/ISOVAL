'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { applyResolvedTheme, readStoredTheme, resolveTheme, systemPrefersDark } from '@/services/theme';
import { BottomNav } from './BottomNav';
import { useChrome } from './ChromeContext';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

export interface AppShellProps {
  children: ReactNode;
  /** Fuerza el modo inmersivo (sin navegación). Por defecto lo decide `useChrome()` / `useImmersive()`. */
  immersive?: boolean;
}

/**
 * En desarrollo, React borra los atributos de <html> al remontar en modo estricto (incluida la clase
 * `dark` que puso el script inline). La reaplicamos antes de pintar; `useThemeSync` toma el relevo
 * cuando el progreso termina de cargar.
 */
function useReapplyStoredTheme() {
  useLayoutEffect(() => {
    applyResolvedTheme(resolveTheme(readStoredTheme(), systemPrefersDark()));
  }, []);
}

/**
 * Estructura de la app: TopBar + contenido + BottomNav en móvil; SideNav + contenido en escritorio (≥ lg).
 * En modo inmersivo oculta toda la navegación y centra el contenido (máx. 3xl) respetando las zonas seguras;
 * el contenedor es `flex flex-col`, así que una pantalla puede usar `flex-1` para ocupar el alto.
 */
export function AppShell({ children, immersive: forced }: AppShellProps) {
  const chrome = useChrome();
  const immersive = forced ?? chrome.immersive;
  useReapplyStoredTheme();

  return (
    <div className="flex min-h-dvh w-full" data-immersive={immersive ? '' : undefined}>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-[calc(env(safe-area-inset-top)+0.75rem)] focus:left-4 focus:z-[80] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-3 focus:font-extrabold focus:text-on-brand"
      >
        Saltar al contenido
      </a>

      {!immersive && <SideNav />}

      <div className="flex min-w-0 flex-1 flex-col">
        {!immersive && <TopBar />}
        <main
          id="contenido"
          tabIndex={-1}
          className={cn(
            'flex flex-1 flex-col px-safe outline-none',
            immersive ? 'pt-safe pb-safe' : 'pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12',
          )}
        >
          <div
            className={cn(
              'mx-auto w-full px-4 sm:px-6',
              immersive ? 'flex max-w-3xl flex-1 flex-col py-4 sm:py-6' : 'max-w-5xl pt-4 sm:pt-6 lg:px-10 lg:pt-10',
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {!immersive && <BottomNav />}
    </div>
  );
}
