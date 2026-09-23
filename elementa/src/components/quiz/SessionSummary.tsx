'use client';

import { House, RotateCcw, Target } from 'lucide-react';
import { Confetti } from '@/components/gamification';
import { Button, ButtonLink, cn } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import type { SessionSummaryData } from '@/types';
import { formatNumber, pluralize } from '@/utils/format';
import { SummaryAchievements } from './SummaryAchievements';
import { ImprovedList, ReviewList } from './SummaryElements';
import { SummaryScore } from './SummaryScore';

export interface SessionSummaryProps {
  summary: SessionSummaryData;
  /** Botón «Repetir». Sin él no se muestra. */
  onRestart?: () => void;
  /** Destino de «Volver al inicio». Por defecto "/". */
  homeHref?: string;
  className?: string;
}

function cheer(correct: number, total: number): string {
  if (total === 0) return 'Esta vez no respondiste ninguna pregunta. ¡Inténtalo de nuevo!';
  const ratio = correct / total;
  if (ratio === 1) return '¡Perfecto! No fallaste ni una.';
  if (ratio >= 0.8) return '¡Excelente trabajo!';
  if (ratio >= 0.6) return '¡Muy bien! Vas por buen camino.';
  if (ratio >= 0.4) return 'Buen intento: repasa tus errores y vuelve a probar.';
  return 'Cada error es una oportunidad para aprender. ¡Sigue practicando!';
}

function StreakBanner({ days, todayMet }: { days: number; todayMet: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-streak-soft p-4">
      <span aria-hidden className="text-3xl animate-wiggle">
        🔥
      </span>
      <div className="min-w-0">
        <p className="text-lg font-black text-streak">
          Racha de {days} {pluralize(days, 'día', 'días')}
        </p>
        <p className="text-sm font-semibold text-fg/80">
          {todayMet ? '¡Meta de hoy cumplida! Vuelve mañana para mantenerla.' : 'Completa tu meta diaria para mantenerla.'}
        </p>
      </div>
    </div>
  );
}

function RecordBanner({ label, value }: { label: string; value: number }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-3xl border-2 border-xp/40 bg-xp-soft p-4 animate-bounce-in">
      <span aria-hidden className="text-3xl">
        🏆
      </span>
      <div className="min-w-0">
        <p className="text-lg font-black text-xp">¡Nuevo récord!</p>
        <p className="font-bold">
          {label}: <span className="font-black tabular">{formatNumber(value)}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Pantalla de resultados de una sesión: marcador, XP, racha, récord, logros, elementos mejorados,
 * elementos a repasar y acciones (practicar errores, repetir, volver al inicio).
 */
export function SessionSummary({ summary, onRestart, homeHref = '/', className }: SessionSummaryProps) {
  const { streak, ready } = useProgress();
  const { correct, total, toReview } = summary;
  const celebrate = total >= 5 && correct / total >= 0.8;

  return (
    <section
      aria-labelledby="session-summary-title"
      className={cn('mx-auto flex w-full max-w-xl flex-col gap-4 pb-4 animate-fade-in', className)}
    >
      {celebrate && <Confetti pieces={110} />}

      <header className="pt-2 text-center">
        {summary.title && <p className="text-sm font-black tracking-wide text-brand uppercase">{summary.title}</p>}
        <h1 id="session-summary-title" className="mt-1 text-3xl font-black sm:text-4xl">
          Sesión completada <span aria-hidden>🎉</span>
        </h1>
        <p className="mt-1.5 font-semibold text-muted sm:text-lg">{cheer(correct, total)}</p>
      </header>

      <SummaryScore correct={correct} total={total} xpGained={summary.xpGained} durationMs={summary.durationMs} />

      {summary.newRecord && <RecordBanner label={summary.newRecord.label} value={summary.newRecord.value} />}
      {ready && streak.current > 0 && <StreakBanner days={streak.current} todayMet={streak.todayMet} />}
      <SummaryAchievements ids={summary.unlockedAchievements} />
      <ImprovedList atomicNumbers={summary.improved} />
      <ReviewList atomicNumbers={toReview} />

      <div className="mt-2 flex flex-col gap-2.5">
        {toReview.length > 0 && (
          <ButtonLink
            href={`/practicar?elements=${toReview.join(',')}`}
            size="lg"
            block
            leftIcon={<Target aria-hidden />}
          >
            Practicar mis errores
          </ButtonLink>
        )}
        {onRestart && (
          <Button
            variant={toReview.length > 0 ? 'secondary' : 'primary'}
            size="lg"
            block
            leftIcon={<RotateCcw aria-hidden />}
            onClick={onRestart}
          >
            Repetir
          </Button>
        )}
        <ButtonLink href={homeHref} variant="ghost" size="lg" block leftIcon={<House aria-hidden />}>
          Volver al inicio
        </ButtonLink>
      </div>
    </section>
  );
}
