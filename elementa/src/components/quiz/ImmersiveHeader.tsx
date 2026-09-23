'use client';

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton, cn } from '@/components/ui';
import { ExitConfirm, type ExitConfirmProps } from './ExitConfirm';

export interface ImmersiveHeaderProps {
  /** Salir (tras confirmar si `confirmExit`). */
  onExit: () => void;
  /** Pide confirmación antes de salir. Por defecto `true`. */
  confirmExit?: boolean;
  /** Nombre accesible del botón de salir. Por defecto "Salir de la sesión". */
  exitLabel?: string;
  /** Textos del aviso de salida (por defecto los de `ExitConfirm`). */
  exitCopy?: Pick<ExitConfirmProps, 'description' | 'stayLabel'>;
  /** Centro: progreso, tiempo, título o el marcador compacto de un modo. */
  center?: ReactNode;
  /** Derecha: vidas, racha, contador… */
  right?: ReactNode;
  className?: string;
}

/**
 * Cabecera fija de las pantallas inmersivas (quiz, juegos, lecciones, flashcards): botón de salir
 * con confirmación opcional + contenido propio. En pantallas bajas (≤ 700 px de alto) es más fina.
 */
export function ImmersiveHeader({
  onExit,
  confirmExit = true,
  exitLabel = 'Salir de la sesión',
  exitCopy,
  center,
  right,
  className,
}: ImmersiveHeaderProps) {
  const [confirming, setConfirming] = useState(false);

  const requestExit = () => {
    if (confirmExit) setConfirming(true);
    else onExit();
  };

  return (
    <header
      // `revealAboveFeedback` lo busca para no dejar nada escondido bajo la cabecera.
      data-immersive-header=""
      className={cn(
        'sticky top-safe z-30 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 [@media(max-height:700px)]:py-1',
        className,
      )}
    >
      <div className="flex min-h-11 items-center gap-2 sm:gap-3">
        <IconButton label={exitLabel} icon={<X />} onClick={requestExit} className="-ml-2" />
        <div className="flex min-w-0 flex-1 items-center gap-2">{center}</div>
        {right}
      </div>

      <ExitConfirm
        open={confirming}
        {...exitCopy}
        onStay={() => setConfirming(false)}
        onLeave={() => {
          setConfirming(false);
          onExit();
        }}
      />
    </header>
  );
}
