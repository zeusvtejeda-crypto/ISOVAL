'use client';

import { QuizScreen } from '@/components/quiz';
import { useProgress } from '@/hooks/useProgress';
import { useQuizSession } from '@/hooks/useQuizSession';
import { buildExam, type ExamSpec } from './build-exam';
import { ExamResults } from './ExamResults';

export interface ExamRunInfo {
  /** Cambia en cada examen (se usa como `key`). */
  id: number;
  spec: ExamSpec;
  /** Mejor % y nº de exámenes antes de empezar (para detectar un récord). */
  previousBest: number;
  previousExams: number;
}

export interface ExamRunProps {
  run: ExamRunInfo;
  /** Salir o empezar otro: vuelve al selector. */
  onExit: () => void;
}

/**
 * Examen en curso. Las preguntas se generan en el cliente al empezar (función de `questions`);
 * `useQuizSession` registra cada respuesta y, al terminar, `completeSession` con `isExam`
 * (+50 XP, +100 si es perfecto, récord de mejor examen).
 */
export function ExamRun({ run, onExit }: ExamRunProps) {
  const { state } = useProgress();
  const session = useQuizSession({
    mode: 'exam',
    title: run.spec.title,
    questions: () => buildExam(run.spec, state, new Date()),
  });

  return (
    <QuizScreen
      session={session}
      onExit={onExit}
      renderSummary={(summary, s) => (
        <ExamResults
          summary={summary}
          answered={s.answered}
          previousBest={run.previousBest}
          previousExams={run.previousExams}
          onNewExam={onExit}
        />
      )}
    />
  );
}
