'use client';

import { ImmersiveHeader } from '@/components/quiz/ImmersiveHeader';
import { ProgressBar, cn } from '@/components/ui';
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

const EXIT_COPY = {
  description: 'Las tarjetas que ya calificaste cuentan para tu progreso, pero no verás el resumen final.',
  stayLabel: 'Seguir estudiando',
};

/** Cabecera fija del estudio (la de las pantallas inmersivas): salir, progreso "x / total" y XP de la sesión. */
export function StudyHeader({ done, total, xp, onExit, confirmExit }: StudyHeaderProps) {
  return (
    <ImmersiveHeader
      onExit={onExit}
      confirmExit={confirmExit}
      exitLabel="Salir de las flashcards"
      exitCopy={EXIT_COPY}
      center={
        <>
          <ProgressBar
            value={total > 0 ? done / total : 0}
            size="lg"
            ariaLabel={`Progreso: ${done} de ${total} tarjetas`}
          />
          <span className="shrink-0 text-sm font-black text-muted tabular">
            {done}/{total}
          </span>
        </>
      }
      right={
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
      }
    />
  );
}
