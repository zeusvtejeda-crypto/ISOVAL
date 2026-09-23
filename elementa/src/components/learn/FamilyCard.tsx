import { Sprout, Table2, Target } from 'lucide-react';
import { MasteryBar } from '@/components/gamification';
import { Badge, ButtonLink, cn } from '@/components/ui';
import type { FamilyGroup } from '@/data/blocks';
import { CATEGORIES } from '@/data/categories';
import type { ProgressState } from '@/types';
import { pluralize } from '@/utils/format';
import { SMALL_ICON, STATUS_META } from './BlockCard';
import type { GroupProgress } from './group-progress';
import { MiniTileStrip } from './MiniTileStrip';

export interface FamilyCardProps {
  family: FamilyGroup;
  progress: GroupProgress;
  state: ProgressState;
  mastery: Readonly<Record<number, number>>;
}

/** Tarjeta de una familia química: emoji, explicación, casillas por dominio, % de dominio y acciones. */
export function FamilyCard({ family, progress, state, mastery }: FamilyCardProps) {
  const category = CATEGORIES[family.category];
  const done = progress.status === 'done';
  const headingId = `family-${family.id}`;
  const n = family.atomicNumbers.length;

  return (
    <article aria-labelledby={headingId} className="flex h-full flex-col gap-3.5 rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn('grid size-12 shrink-0 place-items-center rounded-2xl border-2 text-2xl', category.tileClass)}
        >
          {family.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-lg leading-tight font-black">
            {family.title}
          </h3>
          <p className="text-sm font-bold text-muted">
            {n} {pluralize(n, 'elemento', 'elementos')}
          </p>
        </div>
        {progress.status !== 'new' && (
          <Badge tone={STATUS_META[progress.status].tone} size="md">
            {STATUS_META[progress.status].label}
          </Badge>
        )}
      </header>

      <p className="text-sm leading-relaxed font-semibold">{family.blurb}</p>

      <MiniTileStrip atomicNumbers={family.atomicNumbers} state={state} mastery={mastery} max={18} />

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-bold">
          <span>Dominio</span>
          <span className="text-muted">
            <span className="font-black text-fg tabular">
              {progress.learned}/{progress.total}
            </span>{' '}
            {pluralize(progress.learned, 'aprendido', 'aprendidos')}
          </span>
        </div>
        <MasteryBar value={progress.avgMastery} size="sm" />
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        {!done && (
          <ButtonLink
            href={`/aprende?family=${family.id}`}
            size="sm"
            block
            leftIcon={<Sprout aria-hidden />}
            className="col-span-2"
          >
            Aprender
          </ButtonLink>
        )}
        <ButtonLink
          href={`/practicar?family=${family.id}`}
          variant={done ? 'primary' : 'secondary'}
          size="sm"
          block
          leftIcon={<Target aria-hidden className={SMALL_ICON} />}
        >
          Practicar
        </ButtonLink>
        <ButtonLink href={`/tabla?family=${family.id}`} variant="secondary" size="sm" block leftIcon={<Table2 aria-hidden className={SMALL_ICON} />}>
          Ver tabla
        </ButtonLink>
      </div>
    </article>
  );
}
