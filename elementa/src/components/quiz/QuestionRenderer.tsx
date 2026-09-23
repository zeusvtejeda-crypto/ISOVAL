'use client';

import { memo } from 'react';
import type { QuizResponse } from '@/hooks/useQuizSession';
import type { Question } from '@/types';
import { QuestionCard } from './QuestionCard';
import { TableQuestion } from './TableQuestion';

export interface QuestionRendererProps {
  question: Question;
  /** Ya respondida: muestra la corrección. */
  locked: boolean;
  /** Respuesta dada (id de opción o casillas). */
  response: QuizResponse | null;
  onAnswer: (response: QuizResponse) => void;
}

/** Muestra la pregunta según su `kind`: opción múltiple o pregunta sobre la tabla. */
export const QuestionRenderer = memo(function QuestionRenderer({ question, locked, response, onAnswer }: QuestionRendererProps) {
  if (question.kind === 'multiple-choice') {
    return (
      <QuestionCard
        question={question}
        locked={locked}
        selectedId={typeof response === 'string' ? response : null}
        onAnswer={onAnswer}
      />
    );
  }
  return (
    <TableQuestion
      key={question.id}
      question={question}
      locked={locked}
      response={Array.isArray(response) ? response : null}
      onAnswer={onAnswer}
    />
  );
});
