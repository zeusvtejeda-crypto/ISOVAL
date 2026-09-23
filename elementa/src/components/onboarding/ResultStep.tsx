'use client';

import { ArrowRight } from 'lucide-react';
import { Confetti, LevelEmblem } from '@/components/gamification';
import { ElementTile } from '@/components/periodic/ElementTile';
import { goalMinutes } from '@/components/settings/goal-options';
import { ButtonLink, ProgressRing, cn } from '@/components/ui';
import { getElement } from '@/data/elements';
import type { AnsweredQuestion } from '@/types';
import { formatPercent } from '@/utils/format';
import { levelEmoji, levelTitle } from '@/utils/levels';
import { splitByResult } from './diagnostic';
import { STEP_TITLE_ID, StepHeader } from './StepHeader';

export interface OnboardingResult {
  /** Nivel que devolvió `completeOnboarding`. */
  level: number;
  answered: AnsweredQuestion[];
  skipped: boolean;
}

export interface ResultStepProps {
  result: OnboardingResult;
  name: string;
  dailyGoal: number;
  /** Ya había hecho la bienvenida (repite el diagnóstico). */
  repeated: boolean;
}

function message(result: OnboardingResult, correct: number, total: number, repeated: boolean): string {
  if (result.skipped) {
    return repeated
      ? 'Tu progreso sigue intacto. ¡A seguir aprendiendo!'
      : '¡Sin problema! Empiezas desde cero y aprenderás paso a paso.';
  }
  const ratio = total > 0 ? correct / total : 0;
  if (ratio >= 0.8) return '¡Impresionante! Ya sabes mucho de la tabla periódica.';
  if (ratio >= 0.5) return '¡Muy bien! Tienes una buena base para avanzar rápido.';
  return '¡Buen comienzo! Empezaremos por lo esencial.';
}

function ElementChips({ atomicNumbers, tone }: { atomicNumbers: readonly number[]; tone: 'success' | 'neutral' }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {atomicNumbers.map((z) => {
        const el = getElement(z);
        return (
          <li
            key={z}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-2xl border-2 py-0.5 pr-3.5 pl-0.5 font-bold animate-pop',
              tone === 'success' ? 'border-success/30 bg-success-soft' : 'border-border bg-surface-2',
            )}
          >
            <ElementTile element={el} size="xs" decorative />
            {el.name}
          </li>
        );
      })}
    </ul>
  );
}

/** Paso 4: puntuación, nivel inicial, elementos que ya conoce y «Ir a mi tablero». */
export function ResultStep({ result, name, dailyGoal, repeated }: ResultStepProps) {
  const { level, answered, skipped } = result;
  const total = answered.length;
  const correct = answered.filter((a) => a.correct).length;
  const ratio = total > 0 ? correct / total : 0;
  const { known, toLearn } = splitByResult(answered);
  const cleanName = name.trim();

  return (
    <section aria-labelledby={STEP_TITLE_ID} className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-4">
      {!skipped && <Confetti pieces={ratio >= 0.5 ? 140 : 80} />}
      <StepHeader step={4} />

      <header className="flex flex-col items-center pt-2 text-center">
        <LevelEmblem level={level} size="xl" className="animate-bounce-in" />
        <p className="mt-5 text-sm font-black tracking-wider text-brand uppercase">
          {cleanName ? `¡Listo, ${cleanName}!` : '¡Todo listo!'} · {repeated ? 'Tu nivel' : 'Tu nivel inicial'}
        </p>
        <h1 id={STEP_TITLE_ID} tabIndex={-1} className="mt-1 text-3xl leading-tight font-black outline-none sm:text-4xl">
          Nivel {level} — {levelTitle(level)} <span aria-hidden>{levelEmoji(level)}</span>
        </h1>
        <p className="mt-2 font-semibold text-muted sm:text-lg">{message(result, correct, total, repeated)}</p>
      </header>

      {!skipped && total > 0 && (
        <div className="flex items-center justify-center gap-5 rounded-3xl border border-border bg-surface p-5 shadow-card">
          <ProgressRing
            value={ratio}
            size={96}
            stroke={10}
            tone={ratio >= 0.8 ? 'success' : ratio >= 0.5 ? 'brand' : 'warning'}
            label={`Aciertos del diagnóstico: ${formatPercent(ratio)}`}
          >
            <span className="text-xl font-black tabular">{formatPercent(ratio)}</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-4xl leading-none font-black tabular animate-bounce-in">
              {correct}
              <span className="text-2xl text-muted"> / {total}</span>
            </p>
            <p className="mt-1.5 font-bold text-muted">{correct === 1 ? 'respuesta correcta' : 'respuestas correctas'}</p>
          </div>
        </div>
      )}

      {!skipped && (
        <section aria-labelledby="result-known" className="rounded-3xl border border-border bg-surface p-4 shadow-card">
          <h2 id="result-known" className="flex items-center gap-2 font-black">
            <span aria-hidden>🧠</span> Elementos que ya conoces
          </h2>
          {known.length > 0 ? (
            <ElementChips atomicNumbers={known} tone="success" />
          ) : (
            <p className="mt-1.5 text-sm font-semibold text-muted">
              Todavía ninguno, ¡y está perfecto! Los aprenderás uno a uno.
            </p>
          )}
          {toLearn.length > 0 && (
            <>
              <h3 className="mt-4 flex items-center gap-2 text-sm font-black text-muted">
                <span aria-hidden>🌱</span> Los dominarás pronto
              </h3>
              <ElementChips atomicNumbers={toLearn} tone="neutral" />
            </>
          )}
        </section>
      )}

      <p className="flex items-center justify-center gap-2 rounded-2xl bg-streak-soft px-4 py-3 text-center text-sm font-extrabold text-streak">
        <span aria-hidden>🔥</span>
        Tu meta: {dailyGoal} preguntas al día (unos {goalMinutes(dailyGoal)} min)
      </p>

      <ButtonLink href="/" size="lg" block rightIcon={<ArrowRight aria-hidden />}>
        Ir a mi tablero
      </ButtonLink>
    </section>
  );
}
