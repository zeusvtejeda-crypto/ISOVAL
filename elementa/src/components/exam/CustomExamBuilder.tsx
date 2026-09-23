'use client';

import { useId, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, cn, SegmentedControl } from '@/components/ui';
import type { ElementCategory } from '@/types';
import { pluralize } from '@/utils/format';
import { typesForTopics } from '@/utils/questions';
import { examCapacity } from './build-exam';
import {
  CUSTOM_COUNTS,
  DEFAULT_BLOCK_ID,
  DEFAULT_FAMILY_ID,
  estimatedMinutes,
  scopeLabel,
  scopePool,
  type CustomCount,
  type CustomExamConfig,
  type ExamScope,
} from './presets';
import { ScopePicker } from './ScopePicker';
import { TopicPicker } from './TopicPicker';
import { EXAM_TOPICS } from './topics';

export interface CustomExamBuilderProps {
  config: CustomExamConfig;
  onChange: (config: CustomExamConfig) => void;
  onStart: () => void;
}

const COUNT_OPTIONS = CUSTOM_COUNTS.map((n) => ({ value: n, label: `${n}`, ariaLabel: `${n} preguntas` }));

/** Preguntas que tendrá el examen con esta configuración (0 si no hay temas). */
export function customQuestionCount(config: CustomExamConfig): { count: number; capacity: number } {
  if (config.topics.length === 0) return { count: 0, capacity: 0 };
  const capacity = examCapacity(scopePool(config.scope), typesForTopics(config.topics));
  return { count: Math.min(config.count, capacity), capacity };
}

/** Examen personalizado: temas (al menos uno), elementos y número de preguntas. */
export function CustomExamBuilder({ config, onChange, onStart }: CustomExamBuilderProps) {
  const topicsTitleId = useId();
  const scopeTitleId = useId();
  const countTitleId = useId();
  const errorId = useId();
  const [lastBlock, setLastBlock] = useState(config.scope.kind === 'block' ? config.scope.id : DEFAULT_BLOCK_ID);
  const [lastFamily, setLastFamily] = useState<ElementCategory>(
    config.scope.kind === 'family' ? config.scope.id : DEFAULT_FAMILY_ID,
  );

  const { count, capacity } = useMemo(() => customQuestionCount(config), [config]);
  const noTopics = config.topics.length === 0;
  const allTopics = config.topics.length === EXAM_TOPICS.length;

  const setScope = (scope: ExamScope) => {
    if (scope.kind === 'block') setLastBlock(scope.id);
    if (scope.kind === 'family') setLastFamily(scope.id);
    onChange({ ...config, scope });
  };

  const toggleAll = () => onChange({ ...config, topics: allTopics ? [] : EXAM_TOPICS.map((t) => t.id) });

  const topicsText = `${config.topics.length} ${pluralize(config.topics.length, 'tema', 'temas')}`;

  return (
    <>
      <PageHeader
        back="/examen"
        backLabel="Volver a los exámenes"
        eyebrow="Examen personalizado"
        title="Arma tu examen"
        subtitle="Elige qué quieres evaluar y cuántas preguntas."
      />

      <div className="flex flex-col gap-7">
        <section aria-labelledby={topicsTitleId}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={topicsTitleId} className="text-lg font-black sm:text-xl">
              ¿Qué temas?
            </h2>
            <Button variant="ghost" size="sm" onClick={toggleAll} className="-mr-2 text-brand">
              {allTopics ? 'Quitar todos' : 'Marcar todos'}
            </Button>
          </div>
          <TopicPicker
            selected={config.topics}
            onChange={(topics) => onChange({ ...config, topics })}
            errorId={errorId}
            invalid={noTopics}
          />
          <p
            id={errorId}
            role="alert"
            className={cn(
              'mt-2 flex items-center gap-2 text-sm font-bold text-danger',
              noTopics ? 'animate-shake' : 'sr-only',
            )}
          >
            {noTopics && (
              <>
                <span aria-hidden>☝️</span> Elige al menos un tema.
              </>
            )}
          </p>
        </section>

        <section aria-labelledby={scopeTitleId}>
          <h2 id={scopeTitleId} className="mb-3 text-lg font-black sm:text-xl">
            ¿Qué elementos?
          </h2>
          <ScopePicker scope={config.scope} onChange={setScope} lastBlock={lastBlock} lastFamily={lastFamily} />
        </section>

        <section aria-labelledby={countTitleId} className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={countTitleId} className="text-lg font-black sm:text-xl">
            ¿Cuántas preguntas?
          </h2>
          <SegmentedControl
            label="Número de preguntas"
            options={COUNT_OPTIONS}
            value={config.count}
            onChange={(n: CustomCount) => onChange({ ...config, count: n })}
          />
          {!noTopics && capacity > 0 && capacity < config.count && (
            <p className="w-full text-sm font-semibold text-muted">
              Con esta selección caben {capacity} {pluralize(capacity, 'pregunta distinta', 'preguntas distintas')}: harás{' '}
              {capacity === 1 ? 'esa' : 'todas'}.
            </p>
          )}
        </section>
      </div>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 bg-linear-to-t from-bg via-bg/95 to-bg/0 px-4 pt-6 pb-2 sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-10 lg:px-10 lg:pb-6">
        <Button size="lg" block disabled={count === 0} onClick={onStart} leftIcon={<Play aria-hidden />}>
          {count === 0 ? 'Elige al menos un tema' : `Empezar · ${count} ${pluralize(count, 'pregunta', 'preguntas')}`}
        </Button>
        <p className="mt-2 truncate text-center text-sm font-bold text-muted" aria-live="polite">
          {noTopics
            ? 'Marca los temas que quieres evaluar.'
            : `${topicsText} · ${scopeLabel(config.scope)} · ≈ ${estimatedMinutes(count)} min`}
        </p>
      </div>
    </>
  );
}
