import { useEffect, useState } from "react";

/**
 * Suscripción a una media query.
 *
 * El estado inicial es `false` en vez de leer `matchMedia` durante el
 * render: así el primer pintado es idéntico en servidor y cliente y no
 * hay desajuste de hidratación. El valor real llega en el efecto.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Puntero fino y pantalla ancha: las dos condiciones para que valga la
 * pena ligar el desplazamiento horizontal al scroll vertical.
 */
export const useIsDesktopPointer = () =>
  useMediaQuery("(min-width: 1024px) and (pointer: fine)");
