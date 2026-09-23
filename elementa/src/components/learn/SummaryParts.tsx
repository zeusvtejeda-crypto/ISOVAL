'use client';

import type { ReactNode } from 'react';
import { cn, type Tone, TONE_SOFT, TONE_TEXT } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { formatNumber, pluralize } from '@/utils/format';
import { useCountUp } from './use-count-up';

export interface ResultStatProps {
  emoji: string;
  value: number;
  /** Prefijo/sufijo del número: "+" o "%". */
  prefix?: string;
  suffix?: string;
  label: string;
  tone: Tone;
  className?: string;
}

/** Métrica grande con conteo animado ("90%", "+220 XP"). */
export function ResultStat({ emoji, value, prefix = '', suffix = '', label, tone, className }: ResultStatProps) {
  const shown = useCountUp(value);
  const text = `${prefix}${formatNumber(value)}${suffix}`;
  return (
    <div className={cn('flex min-w-0 flex-col items-center gap-1 rounded-3xl border border-border bg-surface px-2 py-4 text-center shadow-card', className)}>
      <span aria-hidden className={cn('grid size-10 place-items-center rounded-2xl text-xl leading-none', TONE_SOFT[tone])}>
        {emoji}
      </span>
      <p className={cn('text-2xl leading-tight font-black tabular', TONE_TEXT[tone])}>
        <span aria-hidden>
          {prefix}
          {formatNumber(shown)}
          {suffix && <span className="text-base">{suffix}</span>}
        </span>
        <span className="sr-only">{text}</span>
      </p>
      <p className="text-sm font-bold text-muted">{label}</p>
    </div>
  );
}

/** "🔥 Racha de 6 días" o, si aún no hay racha, lo que falta para la meta de hoy. */
export function StreakLine({ className }: { className?: string }) {
  const { streak, today, ready } = useProgress();
  if (!ready) return null;
  const remaining = Math.max(0, today.goal - today.questions);

  let title: ReactNode;
  let detail: string;
  if (streak.current > 0) {
    title = `Racha de ${streak.current} ${pluralize(streak.current, 'día', 'días')}`;
    detail = streak.todayMet
      ? '¡Meta de hoy cumplida! Vuelve mañana para mantenerla.'
      : `Te ${pluralize(remaining, 'falta', 'faltan')} ${remaining} ${pluralize(remaining, 'pregunta', 'preguntas')} para la meta de hoy.`;
  } else {
    title = 'Empieza tu racha';
    detail =
      remaining > 0
        ? `Responde ${remaining} ${pluralize(remaining, 'pregunta', 'preguntas')} más hoy para cumplir tu meta.`
        : 'Cumple tu meta diaria para empezar una racha.';
  }

  return (
    <div className={cn('flex items-center gap-3 rounded-3xl bg-streak-soft p-4', className)}>
      <span aria-hidden className={cn('text-3xl leading-none', streak.current > 0 && 'animate-wiggle')}>
        🔥
      </span>
      <div className="min-w-0">
        <p className="text-lg leading-tight font-black text-streak">{title}</p>
        <p className="mt-0.5 text-sm font-semibold text-fg/80">{detail}</p>
      </div>
    </div>
  );
}

/** Bloque con título e icono para listas de elementos en los resúmenes. */
export function SummarySection({ emoji, title, children, className }: { emoji: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-3xl border border-border bg-surface p-4 shadow-card', className)}>
      <h2 className="mb-3 flex items-center gap-2 font-black">
        <span aria-hidden>{emoji}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
