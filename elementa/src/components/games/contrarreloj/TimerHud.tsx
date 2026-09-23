'use client';

import { useEffect } from 'react';
import { Badge, ProgressRing, cn } from '@/components/ui';
import type { QuizSession } from '@/hooks/useQuizSession';
import { useSound } from '@/hooks/useSound';
import { formatNumber, formatPercent } from '@/utils/format';
import { LOW_TIME_SECONDS, TIME_ATTACK_MS } from './time-attack';

export interface TimerHudProps {
  session: QuizSession;
  /** Récord antes de esta partida. */
  best: number;
}

/** Reloj grande (rojo en los últimos 10 s, con tic) y marcador de aciertos. */
export function TimerHud({ session, best }: TimerHudProps) {
  const sound = useSound();
  const remaining = session.remainingMs ?? 0;
  const limit = session.timeLimitMs ?? TIME_ATTACK_MS;
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const low = seconds <= LOW_TIME_SECONDS;
  const { correctCount } = session;
  const answeredCount = session.answered.length;
  const beatingRecord = best > 0 && correctCount > best;

  // Tic en cada segundo de los últimos 10.
  useEffect(() => {
    if (seconds > 0 && seconds <= LOW_TIME_SECONDS) sound.tick();
  }, [seconds, sound]);

  return (
    <section
      aria-label="Marcador"
      className={cn(
        'mt-1 flex items-center gap-3 rounded-3xl border px-3.5 py-3 transition-colors duration-300 sm:gap-5 sm:px-5',
        low ? 'border-danger/40 bg-danger-soft' : 'border-border bg-surface shadow-card',
      )}
    >
      <div role="timer" aria-label={`Quedan ${seconds} segundos`} className={cn(low && seconds > 0 && 'animate-pulse')}>
        <ProgressRing
          value={remaining / limit}
          size={84}
          stroke={9}
          tone={low ? 'danger' : 'accent'}
          trackClassName={low ? 'stroke-danger/15' : 'stroke-surface-2'}
        >
          <span aria-hidden className={cn('text-3xl font-black tabular', low ? 'text-danger' : 'text-fg')}>
            {seconds}
          </span>
          <span aria-hidden className={cn('mt-0.5 text-[0.65rem] font-black uppercase', low ? 'text-danger' : 'text-muted')}>
            seg
          </span>
        </ProgressRing>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-black tracking-[0.18em] text-muted uppercase">Aciertos</p>
        <p className="text-5xl leading-none font-black tabular sm:text-6xl">
          <span key={correctCount} className="inline-block animate-pop">
            {correctCount}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Badge tone={beatingRecord ? 'xp' : 'neutral'} size="md" icon={<span aria-hidden>🏆</span>}>
          <span className="sr-only">Récord: </span>
          {beatingRecord ? '¡Récord!' : formatNumber(best)}
        </Badge>
        <Badge tone="brand" size="md" icon={<span aria-hidden>🎯</span>}>
          <span className="sr-only">Precisión: </span>
          {answeredCount > 0 ? formatPercent(correctCount / answeredCount) : '—'}
        </Badge>
      </div>
    </section>
  );
}
