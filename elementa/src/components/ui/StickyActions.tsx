import type { ReactNode } from 'react';
import { cn } from './cn';

export interface StickyActionsProps {
  children: ReactNode;
  className?: string;
}

/**
 * Barra de acciones fija al pie de una pantalla (p. ej. «Empezar»), justo encima de la BottomNav
 * (`--bottom-nav-h`; 0 en escritorio y en modo inmersivo). Fondo opaco con borde superior: el
 * contenido que pasa por debajo nunca se ve entre la barra y la navegación. Sangra hasta los bordes
 * del contenedor de AppShell (`-mx-4 sm:-mx-6 lg:-mx-10`). Añade margen superior con `className`.
 */
export function StickyActions({ children, className }: StickyActionsProps) {
  return (
    <div
      className={cn(
        'sticky bottom-(--bottom-nav-h) z-20 -mx-4 border-t border-border bg-bg px-4 pt-3 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10',
        'shadow-[0_-10px_24px_-18px_rgb(23_20_43/0.35)] dark:shadow-[0_-10px_24px_-18px_rgb(0_0_0/0.8)]',
        // Sin BottomNav debajo, la barra respeta ella misma la zona segura inferior.
        'pb-[calc(0.75rem+max(0px,env(safe-area-inset-bottom)_-_var(--bottom-nav-h)))] lg:pt-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
