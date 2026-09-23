'use client';

import { useId, type ReactNode } from 'react';
import { ArrowLeft, RotateCcw, Target } from 'lucide-react';
import { Confetti } from '@/components/gamification';
import { ReviewList, SummaryAchievements } from '@/components/quiz';
import { Button, ButtonLink, StatTile, cn, type Tone } from '@/components/ui';
import type { SessionSummaryData } from '@/types';
import { GAME_TONES, type GameTone } from './tones';

export interface GameStat {
  icon: string;
  label: string;
  value: ReactNode;
  tone: Tone;
}

export interface GameRecordInfo {
  /** Valor logrado en esta partida. */
  value: number;
  /** Récord antes de la partida. */
  previous: number;
  isNew: boolean;
  /** Formato con unidad: 37 → "37 aciertos". */
  format: (n: number) => string;
}

export interface GameResultsProps {
  /** Nombre del modo (antetítulo). */
  mode: string;
  emoji: string;
  title: string;
  message?: ReactNode;
  tone: GameTone;
  /** Marcador grande. */
  score: ReactNode;
  scoreLabel: string;
  record?: GameRecordInfo;
  stats: readonly GameStat[];
  summary: SessionSummaryData;
  /** Confeti al mostrar los resultados. */
  celebrate?: boolean;
  onRestart: () => void;
  restartLabel?: string;
  backHref?: string;
  backLabel?: string;
  /** Contenido propio del modo entre el récord y las métricas. */
  children?: ReactNode;
}

function RecordCard({ record }: { record: GameRecordInfo }) {
  const { value, previous, isNew, format } = record;
  if (isNew) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-3xl border-2 border-xp/40 bg-xp-soft p-4 animate-bounce-in">
        <span aria-hidden className="text-4xl leading-none animate-wiggle">
          🏆
        </span>
        <div className="min-w-0">
          <p className="text-lg font-black text-xp">¡Nuevo récord!</p>
          <p className="font-bold">
            {previous > 0 ? `Superaste tu marca de ${format(previous)}.` : 'Tu primera marca en este modo.'}
          </p>
        </div>
      </div>
    );
  }
  if (previous <= 0) return null;
  const missing = previous - value + 1;
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-border bg-surface p-4 shadow-card">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-xp-soft text-2xl leading-none">
        🏆
      </span>
      <div className="min-w-0">
        <p className="font-black">Tu récord: {format(previous)}</p>
        <p className="text-sm font-semibold text-muted">
          {value === previous
            ? '¡Igualaste tu récord! Uno más y es tuyo.'
            : `Te ${missing === 1 ? 'faltó 1' : `faltaron ${missing}`} para superarlo.`}
        </p>
      </div>
    </div>
  );
}

/** Resultados de una partida: marcador, récord, métricas, logros, errores y acciones. */
export function GameResults({
  mode,
  emoji,
  title,
  message,
  tone,
  score,
  scoreLabel,
  record,
  stats,
  summary,
  celebrate = false,
  onRestart,
  restartLabel = 'Jugar de nuevo',
  backHref = '/jugar',
  backLabel = 'Volver',
  children,
}: GameResultsProps) {
  const titleId = useId();
  const t = GAME_TONES[tone];
  const { toReview } = summary;

  return (
    <section aria-labelledby={titleId} className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-4 animate-fade-in">
      {celebrate && <Confetti pieces={130} />}

      <header className="pt-2 text-center">
        <span aria-hidden className="inline-block text-6xl leading-none animate-bounce-in sm:text-7xl">
          {emoji}
        </span>
        <p className="mt-3 text-sm font-black tracking-wide text-brand uppercase">{mode}</p>
        <h1 id={titleId} className="mt-1 text-3xl font-black sm:text-4xl">
          {title}
        </h1>
        {message && <p className="mt-1.5 font-semibold text-muted sm:text-lg">{message}</p>}
      </header>

      <div className={cn('relative isolate overflow-hidden rounded-3xl border p-5 text-center shadow-card', t.hero)}>
        <span aria-hidden className={cn('absolute -top-16 -right-12 -z-10 size-40 rounded-full opacity-30 blur-3xl', t.glowA)} />
        <p className="text-6xl leading-none font-black tabular animate-bounce-in sm:text-7xl">{score}</p>
        <p className="mt-2 font-extrabold text-fg/80">{scoreLabel}</p>
      </div>

      {record && <RecordCard record={record} />}
      {children}

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <StatTile key={s.label} icon={s.icon} tone={s.tone} label={s.label} value={s.value} />
        ))}
      </div>

      <SummaryAchievements ids={summary.unlockedAchievements} />
      <ReviewList atomicNumbers={toReview} />

      <div className="mt-2 flex flex-col gap-2.5">
        <Button size="lg" block leftIcon={<RotateCcw aria-hidden />} onClick={onRestart}>
          {restartLabel}
        </Button>
        {toReview.length > 0 && (
          <ButtonLink
            href={`/practicar?elements=${toReview.join(',')}`}
            variant="secondary"
            size="lg"
            block
            leftIcon={<Target aria-hidden />}
          >
            Practicar mis errores
          </ButtonLink>
        )}
        <ButtonLink href={backHref} variant="ghost" size="lg" block leftIcon={<ArrowLeft aria-hidden />}>
          {backLabel}
        </ButtonLink>
      </div>
    </section>
  );
}
