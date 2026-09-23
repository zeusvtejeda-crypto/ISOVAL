import { Layers, Sprout, Target } from 'lucide-react';
import { Badge, ButtonLink, ProgressBar, cn } from '@/components/ui';
import type { StudyBlock } from '@/data/blocks';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ProgressState } from '@/types';
import { pluralize } from '@/utils/format';
import type { GroupProgress, GroupStatus } from './group-progress';
import { flashcardsHref } from './learn-source';
import { MiniTileStrip } from './MiniTileStrip';

export interface BlockCardProps {
  block: StudyBlock;
  progress: GroupProgress;
  state: ProgressState;
  mastery: Readonly<Record<number, number>>;
  /** Es el bloque sugerido. */
  suggested?: boolean;
}

/** En pantallas muy estrechas (< 360 px) los botones de dos columnas van sin icono para que quepa el texto. */
export const SMALL_ICON = 'hidden min-[360px]:block';

export const STATUS_META: Record<GroupStatus, { label: string; tone: 'neutral' | 'brand' | 'success' }> = {
  new: { label: 'Nuevo', tone: 'neutral' },
  progress: { label: 'En progreso', tone: 'brand' },
  done: { label: 'Completado ✅', tone: 'success' },
};

/** "H → Ne". */
function span(block: StudyBlock): string {
  const first = ELEMENTS_BY_NUMBER[block.from]?.symbol ?? '';
  const last = ELEMENTS_BY_NUMBER[block.to]?.symbol ?? '';
  return `${first} → ${last}`;
}

/** Tarjeta de un bloque de 10: mini casillas por dominio, progreso, estado y acciones. */
export function BlockCard({ block, progress, state, mastery, suggested = false }: BlockCardProps) {
  const status = STATUS_META[progress.status];
  const done = progress.status === 'done';
  const headingId = `block-${block.id}`;

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        'flex h-full flex-col gap-3.5 rounded-3xl border bg-surface p-4 shadow-card sm:p-5',
        suggested ? 'border-brand/50 ring-2 ring-brand/25' : 'border-border',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-lg leading-tight font-black">
            {block.title} <span className="text-muted">·</span> Elementos {block.range}
          </h3>
          <p className="text-sm font-bold text-muted">{span(block)}</p>
        </div>
        <Badge tone={status.tone} size="md" className={cn(done && 'animate-pop')}>
          {status.label}
        </Badge>
      </header>

      <MiniTileStrip atomicNumbers={block.atomicNumbers} state={state} mastery={mastery} columns={10} />

      <div>
        <ProgressBar
          value={progress.total > 0 ? progress.learned / progress.total : 0}
          tone={done ? 'success' : 'brand'}
          size="sm"
          ariaLabel={`${block.title}: ${progress.learned} de ${progress.total} aprendidos`}
        />
        <p className="mt-1.5 flex flex-wrap gap-x-3 text-sm font-bold text-muted">
          <span>
            <span className="font-black text-fg tabular">
              {progress.learned}/{progress.total}
            </span>{' '}
            {pluralize(progress.learned, 'aprendido', 'aprendidos')}
          </span>
          <span>
            <span className="font-black text-success tabular">{progress.mastered}</span>{' '}
            {pluralize(progress.mastered, 'dominado', 'dominados')}
          </span>
        </p>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        {!done && (
          <ButtonLink
            href={`/aprende?block=${block.id}`}
            size="sm"
            block
            leftIcon={<Sprout aria-hidden />}
            className="col-span-2"
          >
            Aprender
          </ButtonLink>
        )}
        <ButtonLink
          href={`/practicar?block=${block.id}`}
          variant={done ? 'primary' : 'secondary'}
          size="sm"
          block
          leftIcon={<Target aria-hidden className={SMALL_ICON} />}
        >
          Practicar
        </ButtonLink>
        <ButtonLink href={flashcardsHref(block.atomicNumbers)} variant="secondary" size="sm" block leftIcon={<Layers aria-hidden className={SMALL_ICON} />}>
          Flashcards
        </ButtonLink>
      </div>
    </article>
  );
}
