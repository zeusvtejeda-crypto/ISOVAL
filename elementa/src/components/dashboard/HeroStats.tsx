'use client';

import { useMemo, type ReactNode } from 'react';
import { LevelBar } from '@/components/gamification';
import { Card, ProgressBar, TONE_SOFT, cn, type Tone } from '@/components/ui';
import { TOTAL_ELEMENTS } from '@/data/elements';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import { formatNumber, formatPercent, pluralize } from '@/utils/format';
import { countLearned, countMastered } from '@/utils/mastery';

interface MiniStatProps {
  emoji: string;
  tone: Tone;
  label: string;
  value: ReactNode;
}

/**
 * Métrica compacta dentro de la tarjeta principal (término = etiqueta, definición = valor). Nada se
 * corta con «…»: la etiqueta pasa a dos líneas y el valor («12 días») puede partirse en pantallas estrechas.
 */
function MiniStat({ emoji, tone, label, value }: MiniStatProps) {
  return (
    <div className="flex min-w-0 flex-col-reverse justify-center gap-0.5 rounded-2xl bg-surface-2 p-3">
      <dt className="line-clamp-2 text-xs leading-tight font-bold text-muted sm:text-sm">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn('grid size-8 shrink-0 place-items-center rounded-xl text-base leading-none', TONE_SOFT[tone])}
        >
          {emoji}
        </span>
        <span className="min-w-0 text-xl leading-tight font-black break-words tabular sm:text-2xl">{value}</span>
      </dd>
    </div>
  );
}

/** Nivel, elementos aprendidos y métricas clave (racha, XP, precisión, dominados). */
export function HeroStats({ className }: { className?: string }) {
  const { state, level, streak } = useProgress();
  const now = useNow();
  const mastered = useMemo(() => countMastered(state, now), [state, now]);
  const learned = countLearned(state);
  const { totalQuestions, totalCorrect } = state.stats;
  const accuracy = totalQuestions > 0 ? formatPercent(totalCorrect / totalQuestions) : '—';
  const days = streak.current;

  return (
    <Card as="section" aria-labelledby="hero-stats-title" className={cn('flex flex-col gap-4', className)}>
      <h2 id="hero-stats-title" className="sr-only">
        Tu progreso
      </h2>
      <LevelBar level={level} />

      <div className="rounded-2xl border border-border p-3.5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-extrabold">
            <span aria-hidden className="mr-1.5">
              ⚛️
            </span>
            Elementos aprendidos
          </p>
          <p className="shrink-0 font-black tabular">
            {learned}
            <span className="text-muted"> / {TOTAL_ELEMENTS}</span>
          </p>
        </div>
        <ProgressBar
          value={learned / TOTAL_ELEMENTS}
          tone="brand"
          size="md"
          ariaLabel={`Elementos aprendidos: ${learned} de ${TOTAL_ELEMENTS}`}
          valueText={`${learned} de ${TOTAL_ELEMENTS}`}
        />
      </div>

      {/* En escritorio la tarjeta se estira hasta la altura de la columna vecina: las métricas la llenan. */}
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:flex-1 lg:auto-rows-fr lg:grid-cols-2">
        <MiniStat
          emoji="🔥"
          tone="streak"
          label="Racha actual"
          value={
            <>
              {days}
              <span className="ml-1 text-sm font-extrabold text-muted">{pluralize(days, 'día', 'días')}</span>
            </>
          }
        />
        <MiniStat emoji="⚡" tone="xp" label="XP total" value={formatNumber(state.xp)} />
        <MiniStat emoji="🎯" tone="success" label="Precisión general" value={accuracy} />
        <MiniStat
          emoji="🏅"
          tone="accent"
          label="Dominados"
          value={
            <>
              {mastered}
              <span className="text-sm font-extrabold text-muted"> / {TOTAL_ELEMENTS}</span>
            </>
          }
        />
      </dl>
    </Card>
  );
}
