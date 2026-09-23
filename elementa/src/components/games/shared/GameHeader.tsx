'use client';

import type { ReactNode } from 'react';
import { ImmersiveHeader, type ImmersiveHeaderProps } from '@/components/quiz';
import { cn } from '@/components/ui';

export interface GameHeaderProps extends ImmersiveHeaderProps {
  /**
   * Marcador del modo en una sola fila para pantallas bajas (≤ 700 px de alto): ahí sustituye a
   * `center` y `right`, y el marcador grande (`renderTop`) se oculta.
   */
  compact?: ReactNode;
}

/** Cabecera fija de los juegos: salir (con confirmación) + contenido propio de cada modo. */
export function GameHeader({ center, right, compact, exitLabel = 'Salir de la partida', ...rest }: GameHeaderProps) {
  if (!compact) return <ImmersiveHeader exitLabel={exitLabel} center={center} right={right} {...rest} />;
  return (
    <ImmersiveHeader
      exitLabel={exitLabel}
      {...rest}
      center={
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2 [@media(max-height:700px)]:hidden">{center}</div>
          <div className="hidden min-w-0 flex-1 items-center gap-2 [@media(max-height:700px)]:flex">{compact}</div>
        </>
      }
      right={right && <div className="flex shrink-0 items-center gap-2 [@media(max-height:700px)]:hidden">{right}</div>}
    />
  );
}

/** Título centrado para la cabecera. */
export function GameHeaderTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('min-w-0 flex-1 truncate text-center font-black', className)}>{children}</p>;
}
