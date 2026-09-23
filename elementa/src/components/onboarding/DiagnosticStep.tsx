'use client';

import { useRef, useState } from 'react';
import { QuizScreen } from '@/components/quiz';
import { Button, Modal } from '@/components/ui';
import { useQuizSession } from '@/hooks/useQuizSession';
import type { AnsweredQuestion, ExperienceLevel } from '@/types';
import { buildDiagnostic } from './diagnostic';

export interface DiagnosticStepProps {
  experience: ExperienceLevel;
  /** Repite el diagnóstico (ya tenía progreso): saltarlo no cambia su nivel. */
  repeating?: boolean;
  /** Salir (✕): volver al paso anterior. */
  onExit: () => void;
  /** Saltar el diagnóstico (empieza en el nivel 1). */
  onSkip: () => void;
  /** Diagnóstico terminado: respuestas para calcular el nivel inicial. */
  onComplete: (answered: AnsweredQuestion[]) => void;
}

function SkipBar({ onSkip, repeating }: { onSkip: () => void; repeating: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 pt-1">
      <p className="text-sm font-extrabold text-muted">
        <span aria-hidden>🧪 </span>Diagnóstico inicial
      </p>
      <Button variant="ghost" size="sm" className="-mr-2" onClick={() => setConfirming(true)}>
        Saltar diagnóstico
      </Button>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title="¿Saltar el diagnóstico?"
        description={
          repeating
            ? 'Conservarás tu nivel y tu XP actuales.'
            : 'Empezarás desde el nivel 1 y aprenderás los elementos paso a paso.'
        }
        initialFocusRef={stayRef}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button ref={stayRef} block className="sm:flex-1" onClick={() => setConfirming(false)}>
              Seguir con el diagnóstico
            </Button>
            <Button
              variant="ghost"
              block
              className="sm:flex-1"
              onClick={() => {
                setConfirming(false);
                onSkip();
              }}
            >
              Saltar
            </Button>
          </div>
        }
      />
    </div>
  );
}

const DIAGNOSTIC_EXIT_COPY = {
  description: 'Tus respuestas del diagnóstico no se guardarán. Podrás volver a empezarlo cuando quieras.',
  stayLabel: 'Seguir con el diagnóstico',
};

/**
 * Paso 3: diagnóstico de 10 preguntas adaptado a la experiencia elegida. No registra nada por sí
 * mismo (`record: false`): las respuestas se entregan a `completeOnboarding` al terminar.
 */
export function DiagnosticStep({ experience, repeating = false, onExit, onSkip, onComplete }: DiagnosticStepProps) {
  const session = useQuizSession({
    mode: 'diagnostic',
    title: 'Diagnóstico',
    record: false,
    questions: () => buildDiagnostic(experience),
    onFinish: ({ answered }) => {
      onComplete(answered);
    },
  });

  return (
    <QuizScreen
      session={session}
      onExit={onExit}
      exitCopy={DIAGNOSTIC_EXIT_COPY}
      renderTop={() => <SkipBar onSkip={onSkip} repeating={repeating} />}
    />
  );
}
