'use client';

import { useId, useMemo } from 'react';
import { Play } from 'lucide-react';
import { examCapacity } from '@/components/exam/build-exam';
import { estimatedMinutes } from '@/components/exam/presets';
import { TOPIC_META, topicsOfTypes } from '@/components/exam/topics';
import { PageHeader } from '@/components/layout';
import { Badge, Button, SegmentedControl } from '@/components/ui';
import { pluralize } from '@/utils/format';
import { ElementChips } from './ElementChips';
import type { PracticeTarget } from './target';

export interface PracticeIntroProps {
  target: PracticeTarget;
  /** Nº pedido en la URL (`?n=`): se añade a las opciones si no está. */
  suggestedCount: number;
  count: number;
  onCountChange: (count: number) => void;
  onStart: () => void;
}

const BASE_COUNTS = [5, 10, 20];

/** Preguntas reales de la sesión: no más de las distintas que admiten los elementos y tipos. */
export function practiceQuestionCount(target: PracticeTarget, count: number): number {
  return Math.min(count, examCapacity(target.elements, target.types));
}

/** Presentación de la práctica: qué elementos, cuántas preguntas y de qué temas; «Empezar». */
export function PracticeIntro({ target, suggestedCount, count, onCountChange, onStart }: PracticeIntroProps) {
  const listTitleId = useId();
  const countTitleId = useId();
  const total = target.elements.length;
  const questions = useMemo(() => practiceQuestionCount(target, count), [target, count]);
  const topics = topicsOfTypes(target.types);
  const options = Array.from(new Set([...BASE_COUNTS, suggestedCount]))
    .sort((a, b) => a - b)
    .map((n) => ({ value: n, label: `${n}`, ariaLabel: `${n} preguntas` }));

  return (
    <>
      <PageHeader back backLabel="Volver" eyebrow={`${target.emoji} Práctica`} title={target.title} subtitle={target.description} />

      <div className="flex flex-col gap-6">
        <section
          aria-labelledby={listTitleId}
          className="rounded-3xl border border-border bg-surface p-4 shadow-card animate-slide-up sm:p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id={listTitleId} className="text-lg font-black sm:text-xl">
              Vas a practicar
            </h2>
            <Badge tone="brand" size="md">
              {total} {pluralize(total, 'elemento', 'elementos')}
            </Badge>
          </div>
          <ElementChips elements={target.elements} />
          {topics.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-black tracking-wider text-muted uppercase">Preguntas de</p>
              <ul className="flex flex-wrap gap-1.5">
                {topics.map((topic) => (
                  <li key={topic}>
                    <Badge tone="neutral" size="md" icon={<span aria-hidden>{TOPIC_META[topic].emoji}</span>}>
                      {TOPIC_META[topic].label}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby={countTitleId} className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={countTitleId} className="text-lg font-black sm:text-xl">
            ¿Cuántas preguntas?
          </h2>
          <SegmentedControl label="Número de preguntas" options={options} value={count} onChange={onCountChange} />
          {questions < count && (
            <p className="w-full text-sm font-semibold text-muted">
              Con estos elementos caben {questions} {pluralize(questions, 'pregunta distinta', 'preguntas distintas')}.
            </p>
          )}
        </section>

        <p className="flex items-start gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-bold text-brand">
          <span aria-hidden>💡</span>
          <span>Los que más te cuestan salen más veces. ¡Cada acierto sube su dominio!</span>
        </p>
      </div>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 bg-linear-to-t from-bg via-bg/95 to-bg/0 px-4 pt-6 pb-2 sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-10 lg:px-10 lg:pb-6">
        <Button size="lg" block disabled={questions === 0} onClick={onStart} leftIcon={<Play aria-hidden />}>
          Empezar · {questions} {pluralize(questions, 'pregunta', 'preguntas')}
        </Button>
        <p className="mt-2 text-center text-sm font-bold text-muted" aria-live="polite">
          ≈ {estimatedMinutes(questions)} min · +XP por cada acierto
        </p>
      </div>
    </>
  );
}
