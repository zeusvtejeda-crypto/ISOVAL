'use client';

import { useEffect, useId, useRef } from 'react';
import { cn, useReducedMotion } from '@/components/ui';
import type { Question, QuestionOption } from '@/types';
import { revealAboveFeedback } from './feedback-reveal';
import { OptionButton, type OptionState } from './OptionButton';
import { QuestionPrompt, type QuestionPromptProps } from './QuestionPrompt';
import { optionIndexFromKey, useQuizKeys } from './use-quiz-keys';

export interface QuestionCardProps {
  question: Question;
  /** Opción elegida (se marca al corregir). */
  selectedId: string | null;
  /** Pregunta ya respondida: muestra la corrección y bloquea las opciones. */
  locked: boolean;
  onAnswer: (optionId: string) => void;
  /** Etiqueta del tipo de pregunta (ver `QuestionPrompt`). */
  showType?: QuestionPromptProps['showType'];
}

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Etiquetas que caben en media fila: símbolos, números y nombres de hasta 11 caracteres (el nombre
 * de 11 letras más ancho mide ~88 px a 15 px: cabe en una celda de la rejilla a 320 px de ancho).
 */
const SHORT_LABEL_MAX = 11;

function optionState(option: QuestionOption, selectedId: string | null, locked: boolean): OptionState {
  if (!locked) return option.id === selectedId ? 'selected' : 'idle';
  if (option.correct) return 'correct';
  if (option.id === selectedId) return 'incorrect';
  return 'disabled';
}

/** ¿Todas las opciones caben en una rejilla 2 × 2? */
export function hasShortOptions(options: readonly QuestionOption[]): boolean {
  return (
    options.length > 0 &&
    options.every((o) => o.label.length <= SHORT_LABEL_MAX && (o.sublabel?.length ?? 0) <= SHORT_LABEL_MAX)
  );
}

/**
 * Pregunta de opción múltiple: 1 columna en móvil, 2 × 2 en pantallas anchas (y en las bajas si las
 * etiquetas son cortas). Teclas 1–4 / A–D. Al corregir, la opción tocada y la correcta quedan a la
 * vista sobre el panel de feedback.
 */
export function QuestionCard({ question, selectedId, locked, onAnswer, showType }: QuestionCardProps) {
  const headingId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const options = question.options ?? [];
  const dense = hasShortOptions(options);

  useQuizKeys((event) => {
    const index = optionIndexFromKey(event.key);
    const option = index === null ? undefined : options[index];
    if (!option) return false;
    onAnswer(option.id);
    return true;
  }, !locked);

  // Tras corregir: la opción tocada y la correcta, por encima del panel de feedback.
  const selectedIndex = options.findIndex((o) => o.id === selectedId);
  const correctIndex = options.findIndex((o) => o.correct);
  useEffect(() => {
    if (!locked) return;
    const frame = window.requestAnimationFrame(() => {
      const buttons = groupRef.current?.querySelectorAll('button');
      revealAboveFeedback([buttons?.[selectedIndex], buttons?.[correctIndex]], !reducedMotion);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [locked, selectedIndex, correctIndex, reducedMotion]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 [@media(max-height:700px)]:gap-3">
      <QuestionPrompt question={question} headingId={headingId} showType={showType} />
      <div
        ref={groupRef}
        role="group"
        aria-labelledby={headingId}
        className={cn(
          'grid grid-cols-1 gap-3 sm:grid-cols-2 [@media(max-height:700px)]:gap-2',
          dense && '[@media(max-height:700px)]:grid-cols-2',
        )}
      >
        {options.map((option, i) => {
          const letter = LETTERS[i] ?? String(i + 1);
          return (
            <OptionButton
              key={option.id}
              letter={letter}
              label={option.label}
              sublabel={option.sublabel}
              state={optionState(option, selectedId, locked)}
              disabled={locked}
              shortcut={`${i + 1} ${letter}`}
              dense={dense}
              onClick={() => onAnswer(option.id)}
            />
          );
        })}
      </div>
      {!locked && (
        <p
          aria-hidden
          className="hidden text-center text-xs font-bold text-muted pointer-fine:[@media(min-height:701px)]:block"
        >
          Atajos: teclas 1–4 o A–D
        </p>
      )}
    </div>
  );
}
