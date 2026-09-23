'use client';

import { House, RotateCcw, Target } from 'lucide-react';
import { Confetti } from '@/components/gamification';
import { Button, ButtonLink } from '@/components/ui';
import { SummaryAchievements } from '@/components/quiz';
import type { SessionSummaryData } from '@/types';
import { ElementChips } from './ElementChips';
import { practiceElementsHref } from './learn-source';
import { ResultStat, StreakLine, SummaryRow } from './SummaryParts';

export interface StudySummaryProps {
  summary: SessionSummaryData;
  /** Elementos nuevos presentados en la sesión. */
  learned: readonly number[];
  /** XP ganada al aprenderlos (se suma a la de las preguntas). */
  learnXp: number;
  onAnother: () => void;
}

function cheer(ratio: number, total: number): string {
  if (total === 0) return 'Esta vez no respondiste preguntas. ¡Vuelve a intentarlo!';
  if (ratio === 1) return '¡Perfecto! No fallaste ni una.';
  if (ratio >= 0.8) return '¡Excelente trabajo!';
  if (ratio >= 0.6) return '¡Muy bien! Vas por buen camino.';
  return 'Cada error es una pista: repásalos y verás cómo mejoras.';
}

/**
 * Feedback final de «Estudiar ahora»: preguntas, aciertos, precisión, XP, racha y mejoras. Compacto
 * (cada lista de elementos en una fila con «+N») y con las acciones principales fijas al pie.
 */
export function StudySummary({ summary, learned, learnXp, onAnother }: StudySummaryProps) {
  const { total, correct, toReview } = summary;
  // Un elemento que hay que repasar no «mejoró» hoy, aunque otro productor del resumen lo incluya.
  const improved = summary.improved.filter((z) => !toReview.includes(z));
  const ratio = total > 0 ? correct / total : 0;
  const pct = Math.round(ratio * 100);
  const xp = summary.xpGained + learnXp;
  const celebrate = total >= 5 && ratio >= 0.8;
  const hasLists = improved.length > 0 || learned.length > 0 || toReview.length > 0;

  return (
    <section aria-labelledby="study-summary-title" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 animate-fade-in">
      {celebrate && <Confetti pieces={120} />}

      <header className="text-center">
        <p className="text-sm font-black tracking-wide text-brand uppercase">Estudiar ahora</p>
        <h1 id="study-summary-title" className="mt-0.5 text-3xl font-black sm:text-4xl">
          Sesión completada <span aria-hidden>🎉</span>
        </h1>
        <p className="mt-1 font-semibold text-muted sm:text-lg">{cheer(ratio, total)}</p>
      </header>

      <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-4">
        <ResultStat size="sm" emoji="📝" tone="brand" value={total} label={total === 1 ? 'pregunta' : 'preguntas'} />
        <ResultStat size="sm" emoji="✅" tone="success" value={correct} label={correct === 1 ? 'correcta' : 'correctas'} />
        <ResultStat size="sm" emoji="🎯" tone="accent" value={pct} suffix="%" label="precisión" />
        <ResultStat size="sm" emoji="⚡" tone="xp" value={xp} prefix="+" suffix=" XP" label="experiencia" />
      </div>

      <StreakLine compact />
      <SummaryAchievements ids={summary.unlockedAchievements} />

      {hasLists && (
        <div className="divide-y divide-border rounded-3xl border border-border bg-surface p-4 shadow-card">
          {improved.length > 0 && (
            <SummaryRow emoji="📈" title="Hoy mejoraste">
              <ElementChips atomicNumbers={improved} showNames tone="success" singleRow label="Elementos que mejoraste" />
            </SummaryRow>
          )}
          {learned.length > 0 && (
            <SummaryRow emoji="🌱" title="Elementos nuevos">
              <ElementChips atomicNumbers={learned} showNames tone="brand" singleRow label="Elementos nuevos de hoy" />
            </SummaryRow>
          )}
          {toReview.length > 0 && (
            <SummaryRow emoji="🔁" title="Para repasar">
              <ElementChips atomicNumbers={toReview} showNames tone="danger" singleRow label="Elementos que fallaste" />
            </SummaryRow>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {toReview.length > 0 && (
          <Button variant="secondary" size="lg" block leftIcon={<RotateCcw aria-hidden />} onClick={onAnother}>
            Otra sesión
          </Button>
        )}
        <ButtonLink href="/" variant="ghost" size="lg" block leftIcon={<House aria-hidden />}>
          Volver al inicio
        </ButtonLink>
      </div>

      {/* La acción principal, siempre a mano: fija al pie de la pantalla. */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-auto border-t border-border bg-bg/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6">
        {toReview.length > 0 ? (
          <ButtonLink href={practiceElementsHref(toReview)} size="lg" block leftIcon={<Target aria-hidden />}>
            Practicar mis errores
          </ButtonLink>
        ) : (
          <Button size="lg" block leftIcon={<RotateCcw aria-hidden />} onClick={onAnother}>
            Otra sesión
          </Button>
        )}
      </div>
    </section>
  );
}
