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
  /** `sm`: compacta (sin caja del emoji), para poner 4 en una fila. */
  size?: 'sm' | 'md';
  className?: string;
}

/** Métrica grande con conteo animado ("90%", "+220 XP"). */
export function ResultStat({ emoji, value, prefix = '', suffix = '', label, tone, size = 'md', className }: ResultStatProps) {
  const shown = useCountUp(value);
  const text = `${prefix}${formatNumber(value)}${suffix}`;
  if (size === 'sm') {
    return (
      <div className={cn('flex min-w-0 flex-col items-center rounded-2xl border border-border bg-surface px-1.5 py-2.5 text-center shadow-card', className)}>
        <p className={cn('text-xl leading-tight font-black whitespace-nowrap tabular', TONE_TEXT[tone])}>
          <span aria-hidden>
            {prefix}
            {formatNumber(shown)}
            {suffix && <span className="text-xs">{suffix}</span>}
          </span>
          <span className="sr-only">{text}</span>
        </p>
        <p className="mt-0.5 truncate text-xs font-bold text-muted">
          <span aria-hidden>{emoji} </span>
          {label}
        </p>
      </div>
    );
  }
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

/** "🔥 Racha de 6 días" o, si aún no hay racha, lo que falta para la meta de hoy. `compact`: más baja. */
export function StreakLine({ compact = false, className }: { compact?: boolean; className?: string }) {
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
    <div className={cn('flex items-center gap-3 bg-streak-soft', compact ? 'rounded-2xl px-3.5 py-2.5' : 'rounded-3xl p-4', className)}>
      <span aria-hidden className={cn('leading-none', compact ? 'text-2xl' : 'text-3xl', streak.current > 0 && 'animate-wiggle')}>
        🔥
      </span>
      <div className="min-w-0">
        <p className={cn('leading-tight font-black text-streak', compact ? 'text-base' : 'text-lg')}>{title}</p>
        <p className={cn('mt-0.5 font-semibold text-fg/80', compact ? 'text-xs' : 'text-sm')}>{detail}</p>
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

/** Una fila de una lista de resúmenes: título pequeño y contenido (p. ej. fichas en una sola fila). */
export function SummaryRow({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <section className="py-3 first:pt-0 last:pb-0">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-black">
        <span aria-hidden>{emoji}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
