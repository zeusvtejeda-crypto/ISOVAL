'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { ExitConfirm } from '@/components/quiz';
import { IconButton, ProgressBar, cn } from '@/components/ui';
import { formatNumber } from '@/utils/format';

export interface StudyHeaderProps {
  /** Tarjetas ya calificadas. */
  done: number;
  /** Total de la cola (crece cuando una tarjeta vuelve a salir). */
  total: number;
  /** XP ganada en la sesión. */
  xp: number;
  onExit: () => void;
  /** Pide confirmación antes de salir. */
  confirmExit: boolean;
}

/** Cabecera fija del estudio: salir, progreso "x / total" y XP de la sesión. */
export function StudyHeader({ done, total, xp, onExit, confirmExit }: StudyHeaderProps) {
  const [confirming, setConfirming] = useState(false);

  const requestExit = () => {
    if (confirmExit) setConfirming(true);
    else onExit();
  };

  return (
    <header className="sticky top-safe z-30 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <IconButton label="Salir de las flashcards" icon={<X />} onClick={requestExit} className="-ml-2" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ProgressBar
            value={total > 0 ? done / total : 0}
            size="lg"
            ariaLabel={`Progreso: ${done} de ${total} tarjetas`}
          />
          <span className="shrink-0 text-sm font-black text-muted tabular">
            {done}/{total}
          </span>
        </div>
        <span
          role="img"
          aria-label={`XP de la sesión: ${xp}`}
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-black tabular sm:text-base',
            xp > 0 ? 'bg-xp-soft text-xp' : 'bg-surface-2 text-muted',
          )}
        >
          <span key={xp} aria-hidden className={cn('inline-block', xp > 0 && 'animate-bounce-in')}>
            ⚡
          </span>
          <span aria-hidden>{formatNumber(xp)}</span>
        </span>
      </div>

      <ExitConfirm
        open={confirming}
        description="Las tarjetas que ya calificaste cuentan para tu progreso, pero no verás el resumen final."
        stayLabel="Seguir estudiando"
        onStay={() => setConfirming(false)}
        onLeave={() => {
          setConfirming(false);
          onExit();
        }}
      />
    </header>
  );
}
