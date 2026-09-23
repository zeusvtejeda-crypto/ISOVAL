'use client';

import { QuizScreen } from '@/components/quiz/QuizScreen';
import { SessionSummary } from '@/components/quiz/SessionSummary';
import { useProgress } from '@/hooks/useProgress';
import { useQuizSession } from '@/hooks/useQuizSession';
import type { QuestionType } from '@/types';
import { buildPracticeQuestions } from './build-practice';

export interface PracticePlan {
  /** Cambia en cada sesión (se usa como `key`). */
  id: number;
  title: string;
  /** Elementos congelados al empezar (no cambian aunque cambie tu progreso durante la sesión). */
  elements: number[];
  types: QuestionType[];
  count: number;
  /** Errores, difíciles o repasos: los más prioritarios salen varias veces (`PracticeSpec.focused`). */
  focused: boolean;
}

export interface PracticeRunProps {
  plan: PracticePlan;
  onExit: () => void;
  /** «Practicar mis errores» del resumen: nueva sesión solo con esos elementos. */
  onPracticeElements: (atomicNumbers: number[]) => void;
}

/**
 * Sesión de práctica restringida a `plan.elements`. «Repetir» genera preguntas nuevas con tu
 * progreso actualizado (los que fallaste salen más).
 */
export function PracticeRun({ plan, onExit, onPracticeElements }: PracticeRunProps) {
  const { state } = useProgress();
  const session = useQuizSession({
    mode: 'practice',
    title: plan.title,
    questions: () =>
      buildPracticeQuestions(
        { elements: plan.elements, count: plan.count, types: plan.types, focused: plan.focused },
        state,
        new Date(),
      ),
  });

  return (
    <QuizScreen
      session={session}
      onExit={onExit}
      renderSummary={(summary, s) => (
        <SessionSummary summary={summary} onRestart={s.restart} onPracticeMistakes={onPracticeElements} />
      )}
    />
  );
}
