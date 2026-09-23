import { ArrowRight, Target } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import type { ProgressState } from '@/types';
import { pluralize } from '@/utils/format';
import type { BlockSuggestion, GroupProgress } from './group-progress';
import { MiniTileStrip } from './MiniTileStrip';

export interface NextBlockCardProps {
  suggestion: BlockSuggestion;
  progress: GroupProgress;
  state: ProgressState;
  mastery: Readonly<Record<number, number>>;
}

const COPY = {
  start: { eyebrow: 'Tu siguiente bloque', cta: 'Empezar bloque' },
  continue: { eyebrow: 'Sigue donde lo dejaste', cta: 'Continuar' },
  review: { eyebrow: '¡Completaste los 12 bloques! Refuerza', cta: 'Practicar' },
} as const;

/** Bloque sugerido para estudiar ahora (o el más flojo para repasar si ya están todos). */
export function NextBlockCard({ suggestion, progress, state, mastery }: NextBlockCardProps) {
  const { block, reason } = suggestion;
  const copy = COPY[reason];
  const review = reason === 'review';
  const left = progress.total - progress.learned;

  return (
    <section
      aria-labelledby="next-block-title"
      className="relative overflow-hidden rounded-3xl bg-brand-gradient p-5 text-on-brand shadow-card sm:p-6"
    >
      <span aria-hidden className="pointer-events-none absolute -top-6 -right-4 text-8xl opacity-15 animate-float">
        🧱
      </span>
      <p className="text-xs font-black tracking-wider uppercase opacity-90">{copy.eyebrow}</p>
      <h2 id="next-block-title" className="mt-1 text-2xl leading-tight font-black">
        {block.title} · Elementos {block.range}
      </h2>
      <p className="mt-0.5 font-bold opacity-90">
        {review
          ? `Dominio medio: ${progress.avgMastery}%`
          : left === progress.total
            ? `${progress.total} elementos por descubrir`
            : `Te ${pluralize(left, 'falta', 'faltan')} ${left} ${pluralize(left, 'elemento', 'elementos')}`}
      </p>

      <div className="mt-4 rounded-2xl bg-surface/95 p-2.5">
        <MiniTileStrip atomicNumbers={block.atomicNumbers} state={state} mastery={mastery} columns={10} />
      </div>

      <ButtonLink
        href={review ? `/practicar?block=${block.id}` : `/aprende?block=${block.id}`}
        variant="inverse"
        size="lg"
        block
        className="mt-4"
        leftIcon={review ? <Target aria-hidden /> : undefined}
        rightIcon={review ? undefined : <ArrowRight aria-hidden />}
      >
        {copy.cta}
      </ButtonLink>
    </section>
  );
}
