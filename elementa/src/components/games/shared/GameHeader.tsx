'use client';

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ExitConfirm } from '@/components/quiz';
import { IconButton, cn } from '@/components/ui';

export interface GameHeaderProps {
  /** Salir de la partida (tras confirmar si `confirmExit`). */
  onExit: () => void;
  confirmExit: boolean;
  /** Centro: título, barra de tiempo, progreso… */
  center?: ReactNode;
  /** Derecha: vidas, récord… */
  right?: ReactNode;
  className?: string;
}

/** Cabecera fija de los juegos: salir (con confirmación) + contenido propio de cada modo. */
export function GameHeader({ onExit, confirmExit, center, right, className }: GameHeaderProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <header
      className={cn('sticky top-safe z-30 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6', className)}
    >
      <div className="flex min-h-11 items-center gap-2 sm:gap-3">
        <IconButton
          label="Salir de la partida"
          icon={<X />}
          onClick={() => (confirmExit ? setConfirming(true) : onExit())}
          className="-ml-2"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">{center}</div>
        {right}
      </div>
      <ExitConfirm
        open={confirming}
        onStay={() => setConfirming(false)}
        onLeave={() => {
          setConfirming(false);
          onExit();
        }}
      />
    </header>
  );
}

/** Título centrado para la cabecera. */
export function GameHeaderTitle({ children }: { children: ReactNode }) {
  return <p className="min-w-0 flex-1 truncate text-center font-black">{children}</p>;
}
