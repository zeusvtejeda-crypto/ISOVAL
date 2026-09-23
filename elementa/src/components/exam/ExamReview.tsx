'use client';

import { useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Button, cn, IconButton, SegmentedControl } from '@/components/ui';
import type { AnsweredQuestion } from '@/types';
import { QUESTION_TYPE_META } from '@/utils/questions';

export interface ExamReviewProps {
  answered: readonly AnsweredQuestion[];
  onBack: () => void;
}

type Filter = 'all' | 'wrong';

function ReviewItem({ entry, number }: { entry: AnsweredQuestion; number: number }) {
  const { question, correct, givenAnswer } = entry;
  return (
    <li
      className={cn(
        'rounded-3xl border-2 bg-surface p-4 shadow-card animate-fade-in',
        correct ? 'border-success/30' : 'border-danger/35',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-black tabular">
          {number}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-black tracking-wide text-muted uppercase">
          {QUESTION_TYPE_META[question.type].label}
        </span>
        <span
          aria-hidden
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4.5',
            correct ? 'bg-success text-on-success' : 'bg-danger text-on-danger',
          )}
        >
          {correct ? <Check strokeWidth={3.5} /> : <X strokeWidth={3.5} />}
        </span>
        <span className="sr-only">{correct ? 'Respuesta correcta' : 'Respuesta incorrecta'}</span>
      </div>

      <p className="mt-2.5 leading-snug font-extrabold">{question.prompt}</p>

      <dl className="mt-3 flex flex-col gap-1.5 text-sm">
        <div
          className={cn(
            'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-2xl px-3 py-2',
            correct ? 'bg-success-soft' : 'bg-danger-soft',
          )}
        >
          <dt className="font-bold text-muted">Tu respuesta</dt>
          <dd className={cn('ml-auto min-w-0 text-right font-black break-words', correct ? 'text-success' : 'text-danger')}>
            {givenAnswer} <span aria-hidden>{correct ? '✓' : '✗'}</span>
          </dd>
        </div>
        {!correct && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-2xl bg-success-soft px-3 py-2">
            <dt className="font-bold text-muted">Respuesta correcta</dt>
            <dd className="ml-auto min-w-0 text-right font-black break-words text-success">
              {question.correctAnswer} <span aria-hidden>✓</span>
            </dd>
          </div>
        )}
      </dl>

      {question.explanation && (
        <p className="mt-2.5 flex gap-2 text-sm font-semibold text-muted">
          <span aria-hidden>💡</span>
          <span>{question.explanation}</span>
        </p>
      )}
    </li>
  );
}

/** Revisión del examen: cada pregunta con tu respuesta, la correcta y la explicación. */
export function ExamReview({ answered, onBack }: ExamReviewProps) {
  const wrongCount = answered.filter((a) => !a.correct).length;
  const [filter, setFilter] = useState<Filter>(wrongCount > 0 ? 'wrong' : 'all');
  const items = answered
    .map((entry, i) => ({ entry, number: i + 1 }))
    .filter(({ entry }) => filter === 'all' || !entry.correct);

  return (
    <section aria-labelledby="exam-review-title" className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-4 animate-fade-in">
      <header className="flex items-start gap-3 pt-2">
        <IconButton label="Volver al resultado" icon={<ArrowLeft />} variant="soft" onClick={onBack} className="-ml-1 shrink-0" />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-xs font-black tracking-wider text-brand uppercase">Resultado</p>
          <h1 id="exam-review-title" className="text-2xl leading-tight font-black sm:text-3xl">
            Revisar respuestas
          </h1>
          <p className="mt-0.5 font-semibold text-muted">
            {answered.length - wrongCount} de {answered.length} correctas
          </p>
        </div>
      </header>

      <SegmentedControl<Filter>
        label="Qué respuestas ver"
        block
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `Todas (${answered.length})` },
          { value: 'wrong', label: `Errores (${wrongCount})`, disabled: wrongCount === 0 },
        ]}
      />

      <ol key={filter} className="flex flex-col gap-3" aria-label={filter === 'wrong' ? 'Respuestas incorrectas' : 'Todas las respuestas'}>
        {items.map(({ entry, number }) => (
          <ReviewItem key={entry.question.id} entry={entry} number={number} />
        ))}
      </ol>

      <Button variant="secondary" size="lg" block leftIcon={<ArrowLeft aria-hidden />} onClick={onBack}>
        Volver al resultado
      </Button>
    </section>
  );
}
