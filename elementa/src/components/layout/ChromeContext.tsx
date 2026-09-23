'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * "Chrome" = la navegación de la app (TopBar, BottomNav, SideNav).
 * Las pantallas de enfoque (quiz a pantalla completa, onboarding) la ocultan con el modo inmersivo:
 *
 *   useImmersive();                       // mientras el componente esté montado
 *   useImmersive(status !== 'finished');  // condicional
 *   const { setImmersive } = useChrome(); // manual; se reinicia solo al cambiar de ruta
 */
export interface ChromeContextValue {
  immersive: boolean;
  setImmersive: (value: boolean) => void;
  /** Reserva el modo inmersivo; devuelve la función que lo libera. Usado por `useImmersive`. */
  acquireImmersive: () => () => void;
}

/** Rutas que siempre se muestran sin navegación. */
export const IMMERSIVE_ROUTES: readonly string[] = ['/bienvenida'];

const noop = () => {};
const FALLBACK: ChromeContextValue = { immersive: false, setImmersive: noop, acquireImmersive: () => noop };

const ChromeContext = createContext<ChromeContextValue | null>(null);

function isImmersiveRoute(pathname: string): boolean {
  return IMMERSIVE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function ChromeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [holds, setHolds] = useState(0);
  const [manual, setManual] = useState<{ path: string; value: boolean }>({ path: pathname, value: false });

  const setImmersive = useCallback((value: boolean) => setManual({ path: pathname, value }), [pathname]);

  const acquireImmersive = useCallback(() => {
    let released = false;
    setHolds((h) => h + 1);
    return () => {
      if (released) return;
      released = true;
      setHolds((h) => Math.max(0, h - 1));
    };
  }, []);

  const immersive = holds > 0 || (manual.value && manual.path === pathname) || isImmersiveRoute(pathname);

  const value = useMemo<ChromeContextValue>(
    () => ({ immersive, setImmersive, acquireImmersive }),
    [immersive, setImmersive, acquireImmersive],
  );

  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

/** Estado de la navegación. Fuera de `ChromeProvider` devuelve un valor inerte. */
export function useChrome(): ChromeContextValue {
  return useContext(ChromeContext) ?? FALLBACK;
}

/** Oculta la navegación mientras el componente esté montado y `active` sea `true`. */
export function useImmersive(active = true): void {
  const { acquireImmersive } = useChrome();
  useEffect(() => {
    if (!active) return;
    return acquireImmersive();
  }, [active, acquireImmersive]);
}
