'use client';

import { useId } from 'react';
import type { Question, QuestionOption } from '@/types';
import { OptionButton, type OptionState } from './OptionButton';
import { QuestionPrompt } from './QuestionPrompt';
import { optionIndexFromKey, useQuizKeys } from './use-quiz-keys';

export interface QuestionCardProps {
  question: Question;
  /** Opción elegida (se marca al corregir). */
  selectedId: string | null;
  /** Pregunta ya respondida: muestra la corrección y bloquea las opciones. */
  locked: boolean;
  onAnswer: (optionId: string) => void;
}

const LETTERS = ['A', 'B', 'C', 'D'] as const;

function optionState(option: QuestionOption, selectedId: string | null, locked: boolean): OptionState {
  if (!locked) return option.id === selectedId ? 'selected' : 'idle';
  if (option.correct) return 'correct';
  if (option.id === selectedId) return 'incorrect';
  return 'disabled';
}

/** Pregunta de opción múltiple: 1 columna en móvil, 2 × 2 en pantallas anchas. Teclas 1–4 / A–D. */
export function QuestionCard({ question, selectedId, locked, onAnswer }: QuestionCardProps) {
  const headingId = useId();
  const options = question.options ?? [];

  useQuizKeys((event) => {
    const index = optionIndexFromKey(event.key);
    const option = index === null ? undefined : options[index];
    if (!option) return false;
    onAnswer(option.id);
    return true;
  }, !locked);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <QuestionPrompt question={question} headingId={headingId} />
      <div role="group" aria-labelledby={headingId} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              onClick={() => onAnswer(option.id)}
            />
          );
        })}
      </div>
      {!locked && (
        <p aria-hidden className="hidden text-center text-xs font-bold text-muted pointer-fine:block">
          Atajos: teclas 1–4 o A–D
        </p>
      )}
    </div>
  );
}
