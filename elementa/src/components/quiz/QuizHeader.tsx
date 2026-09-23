'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { IconButton, ProgressBar, cn } from '@/components/ui';
import { ExitConfirm, type ExitConfirmProps } from './ExitConfirm';
import { LivesIndicator, StreakChip, TimeChip } from './QuizStats';

export interface QuizHeaderProps {
  /** Salir de la sesión (tras confirmar si `confirmExit`). */
  onExit: () => void;
  /** Pide confirmación antes de salir. Por defecto `true`. */
  confirmExit?: boolean;
  /** Preguntas respondidas (conjuntos fijos). */
  answered?: number;
  /** Total de preguntas; `null`/`undefined` en modos infinitos (sin barra de progreso). */
  total?: number | null;
  lives?: number | null;
  maxLives?: number | null;
  remainingMs?: number | null;
  timeLimitMs?: number | null;
  /** Racha de aciertos de la sesión. */
  streak?: number;
  /** Título (se muestra si no hay barra de progreso ni de tiempo). */
  title?: string;
  /** Textos del aviso de salida (por defecto los de `ExitConfirm`). */
  exitCopy?: Pick<ExitConfirmProps, 'description' | 'stayLabel'>;
  className?: string;
}

/** Cabecera del quiz: salir, progreso (o tiempo), vidas, cuenta atrás y racha. */
export function QuizHeader({
  onExit,
  confirmExit = true,
  answered = 0,
  total,
  lives,
  maxLives,
  remainingMs,
  timeLimitMs,
  streak = 0,
  title,
  exitCopy,
  className,
}: QuizHeaderProps) {
  const [confirming, setConfirming] = useState(false);
  const hasTotal = typeof total === 'number' && total > 0;
  const hasTime = typeof remainingMs === 'number';
  const timeRatio = hasTime && timeLimitMs ? remainingMs / timeLimitMs : null;

  const requestExit = () => {
    if (confirmExit) setConfirming(true);
    else onExit();
  };

  return (
    <header
      className={cn(
        'sticky top-safe z-30 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6',
        className,
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <IconButton label="Salir de la sesión" icon={<X />} onClick={requestExit} className="-ml-2" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasTotal ? (
            <>
              <ProgressBar
                value={answered / total}
                size="lg"
                ariaLabel={`Progreso: ${answered} de ${total} preguntas`}
              />
              <span className="shrink-0 text-sm font-black text-muted tabular">
                {answered}/{total}
              </span>
            </>
          ) : timeRatio !== null ? (
            <ProgressBar value={timeRatio} size="lg" tone={timeRatio <= 0.17 ? 'danger' : 'warning'} ariaLabel="Tiempo restante" />
          ) : (
            title && <p className="min-w-0 flex-1 truncate text-center font-black">{title}</p>
          )}
        </div>

        {typeof lives === 'number' && <LivesIndicator lives={lives} maxLives={maxLives ?? null} />}
        {hasTime && <TimeChip remainingMs={remainingMs} />}
        <StreakChip streak={streak} />
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
