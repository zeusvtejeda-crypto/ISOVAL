'use client';

import { House, RotateCcw, Target } from 'lucide-react';
import { Confetti } from '@/components/gamification';
import { Button, ButtonLink } from '@/components/ui';
import { SummaryAchievements } from '@/components/quiz';
import type { SessionSummaryData } from '@/types';
import { ElementChips } from './ElementChips';
import { practiceElementsHref } from './learn-source';
import { ResultStat, StreakLine, SummarySection } from './SummaryParts';

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

/** Feedback final de «Estudiar ahora»: preguntas, aciertos, precisión, XP, racha y mejoras. */
export function StudySummary({ summary, learned, learnXp, onAnother }: StudySummaryProps) {
  const { total, correct, toReview, improved } = summary;
  const ratio = total > 0 ? correct / total : 0;
  const pct = Math.round(ratio * 100);
  const xp = summary.xpGained + learnXp;
  const celebrate = total >= 5 && ratio >= 0.8;

  return (
    <section aria-labelledby="study-summary-title" className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-4 animate-fade-in">
      {celebrate && <Confetti pieces={120} />}

      <header className="pt-2 text-center">
        <p className="text-sm font-black tracking-wide text-brand uppercase">Estudiar ahora</p>
        <h1 id="study-summary-title" className="mt-1 text-3xl font-black sm:text-4xl">
          Sesión completada <span aria-hidden>🎉</span>
        </h1>
        <p className="mt-1.5 font-semibold text-muted sm:text-lg">{cheer(ratio, total)}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResultStat emoji="📝" tone="brand" value={total} label={total === 1 ? 'pregunta' : 'preguntas'} />
        <ResultStat emoji="✅" tone="success" value={correct} label={correct === 1 ? 'correcta' : 'correctas'} />
        <ResultStat emoji="🎯" tone="accent" value={pct} suffix="%" label="precisión" />
        <ResultStat emoji="⚡" tone="xp" value={xp} prefix="+" suffix=" XP" label="experiencia" />
      </div>

      <StreakLine />
      <SummaryAchievements ids={summary.unlockedAchievements} />

      {improved.length > 0 && (
        <SummarySection emoji="📈" title="Hoy mejoraste">
          <ElementChips atomicNumbers={improved} showNames tone="success" max={8} label="Elementos que mejoraste" />
        </SummarySection>
      )}
      {learned.length > 0 && (
        <SummarySection emoji="🌱" title="Elementos nuevos">
          <ElementChips atomicNumbers={learned} showNames tone="brand" max={8} label="Elementos nuevos de hoy" />
        </SummarySection>
      )}
      {toReview.length > 0 && (
        <SummarySection emoji="🔁" title="Para repasar">
          <ElementChips atomicNumbers={toReview} showNames tone="danger" max={8} label="Elementos que fallaste" />
        </SummarySection>
      )}

      <div className="mt-2 flex flex-col gap-2.5">
        {toReview.length > 0 && (
          <ButtonLink href={practiceElementsHref(toReview)} size="lg" block leftIcon={<Target aria-hidden />}>
            Practicar mis errores
          </ButtonLink>
        )}
        <Button
          variant={toReview.length > 0 ? 'secondary' : 'primary'}
          size="lg"
          block
          leftIcon={<RotateCcw aria-hidden />}
          onClick={onAnother}
        >
          Otra sesión
        </Button>
        <ButtonLink href="/" variant="ghost" size="lg" block leftIcon={<House aria-hidden />}>
          Volver al inicio
        </ButtonLink>
      </div>
    </section>
  );
}
