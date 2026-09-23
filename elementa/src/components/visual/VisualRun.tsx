'use client';

import { LayoutGrid } from 'lucide-react';
import { QuizScreen, SessionSummary } from '@/components/quiz';
import { Button } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { useQuizSession } from '@/hooks/useQuizSession';
import { buildVisualQuestions } from './build-visual';
import type { VisualMode } from './modes';

export interface VisualRunProps {
  mode: VisualMode;
  /** Volver al selector de retos. */
  onExit: () => void;
}

/**
 * Sesión de un reto visual. Las preguntas se generan en el cliente al empezar (y en cada «Repetir»)
 * con tu progreso actual. En móvil la tabla se desliza en horizontal o se ajusta a la pantalla
 * (en escritorio `TableQuestion` la muestra entera).
 */
export function VisualRun({ mode, onExit }: VisualRunProps) {
  const { state } = useProgress();
  const session = useQuizSession({
    mode: 'visual',
    title: mode.title,
    questions: () => buildVisualQuestions(mode, state, new Date()),
  });

  return (
    <div className="flex flex-1 flex-col">
      <QuizScreen
        session={session}
        onExit={onExit}
        renderSummary={(summary, s) => (
          <div className="flex flex-1 flex-col">
            <SessionSummary summary={summary} onRestart={s.restart} />
            <div className="mx-auto w-full max-w-xl">
              <Button variant="ghost" size="lg" block leftIcon={<LayoutGrid aria-hidden />} onClick={onExit}>
                Elegir otro reto visual
              </Button>
            </div>
          </div>
        )}
      />
    </div>
  );
}
