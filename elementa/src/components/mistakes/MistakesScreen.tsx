'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { ButtonLink, EmptyState, StatTile } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import { formatNumber } from '@/utils/format';
import { HardElements } from './HardElements';
import { MistakeHistory } from './MistakeHistory';
import { MistakesSkeleton } from './MistakesSkeleton';
import { hardElements, mistakeGroups } from './mistakes-data';

/** /errores: tus elementos más difíciles y las preguntas que fallaste, para convertirlas en aciertos. */
export function MistakesScreen() {
  const { state, ready, clearMistakes } = useProgress();
  const now = useNow();
  const hard = useMemo(() => hardElements(state, now), [state, now]);
  const withMistakes = useMemo(() => mistakeGroups(state.mistakes).length, [state.mistakes]);

  if (!ready) return <MistakesSkeleton />;

  const header = (
    <PageHeader
      back
      eyebrow="Tu progreso"
      title="Mis errores"
      subtitle="Cada fallo es una pista de lo que te falta. ¡Conviértelos en aciertos!"
    />
  );

  if (hard.length === 0 && state.mistakes.length === 0) {
    const started = state.stats.totalQuestions > 0;
    return (
      <>
        {header}
        <EmptyState
          icon="🎯"
          title={started ? '¡Sin errores a la vista!' : 'Aún no hay errores'}
          description={
            started
              ? 'No tienes preguntas falladas ni elementos difíciles. ¡Sigue así!'
              : 'Cuando falles una pregunta aparecerá aquí, con la respuesta correcta, para que la repases.'
          }
          action={
            <ButtonLink href="/estudiar" size="lg" leftIcon={<Sparkles aria-hidden />}>
              {started ? 'Seguir estudiando' : 'Empezar a estudiar'}
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon="💪" tone="danger" label="Elementos difíciles" value={formatNumber(hard.length)} />
          <StatTile
            icon="📝"
            tone="brand"
            label="Preguntas falladas"
            value={formatNumber(state.mistakes.length)}
            hint={withMistakes > 0 ? `En ${withMistakes} ${withMistakes === 1 ? 'elemento' : 'elementos'}` : undefined}
          />
        </div>
        <HardElements items={hard} />
        <MistakeHistory mistakes={state.mistakes} now={now} onClear={clearMistakes} />
      </div>
    </>
  );
}
