'use client';

import { useId, useState } from 'react';
import { BookOpen, ChevronDown, Dumbbell, Target } from 'lucide-react';
import { MasteryBar } from '@/components/gamification';
import { ElementTile } from '@/components/periodic/ElementTile';
import { Button, ButtonLink, cn } from '@/components/ui';
import { getElement } from '@/data/elements';
import { formatPercent, pluralize } from '@/utils/format';
import { TIER_META, masteryTier } from '@/utils/mastery';
import type { HardElement } from './mistakes-data';

/** Filas visibles antes de «Ver todos». */
const INITIAL_ROWS = 5;

const RANK_STYLES = ['bg-danger text-on-danger', 'bg-streak text-bg', 'bg-warning text-on-warning'] as const;

function HardElementRow({ item, rank }: { item: HardElement; rank: number }) {
  const el = getElement(item.atomicNumber);
  const meta = TIER_META[masteryTier(item.mastery)];
  const answers = item.correct + item.incorrect;

  return (
    <li className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-3.5 shadow-card animate-slide-up sm:p-4">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <ElementTile element={el} size="xs" decorative />
          <span
            aria-hidden
            className={cn(
              'absolute -top-2 -left-2 grid size-6 place-items-center rounded-full border-2 border-surface text-xs font-black tabular',
              RANK_STYLES[rank - 1] ?? 'bg-surface-2 text-fg',
            )}
          >
            {rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 truncate text-lg leading-tight font-black">
              {el.name}
              <span className="ml-1.5 text-sm font-extrabold text-muted">{el.symbol}</span>
            </h3>
            <p className={cn('shrink-0 text-sm font-black tabular', meta.textClass)}>
              <span aria-hidden>{meta.emoji} </span>
              {item.mastery}%<span className="sr-only"> de dominio ({meta.label})</span>
            </p>
          </div>
          <MasteryBar value={item.mastery} showValue={false} size="sm" className="mt-2" />
          <p className="mt-1.5 text-xs font-bold text-muted">
            <span className="text-danger">
              {item.incorrect} {pluralize(item.incorrect, 'fallo', 'fallos')}
            </span>
            {' · '}
            {formatPercent(item.correct / answers)} de aciertos en {answers}{' '}
            {pluralize(answers, 'respuesta', 'respuestas')}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <ButtonLink
          href={`/practicar?elements=${el.atomicNumber}`}
          variant="secondary"
          size="sm"
          className="flex-1"
          leftIcon={<Target aria-hidden />}
          aria-label={`Practicar ${el.name}`}
        >
          Practicar
        </ButtonLink>
        <ButtonLink
          href={`/tabla?e=${el.atomicNumber}`}
          variant="ghost"
          size="sm"
          className="flex-1"
          leftIcon={<BookOpen aria-hidden />}
          aria-label={`Ver ficha de ${el.name}`}
        >
          Ver ficha
        </ButtonLink>
      </div>
    </li>
  );
}

export interface HardElementsProps {
  items: readonly HardElement[];
}

/** "Tus elementos más difíciles": ranking por dominio con accesos a practicar y a la ficha. */
export function HardElements({ items }: HardElementsProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const shown = expanded ? items : items.slice(0, INITIAL_ROWS);

  return (
    <section aria-labelledby="hard-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 id="hard-title" className="text-xl font-black sm:text-2xl">
            Tus elementos más difíciles
          </h2>
          <p className="text-sm font-semibold text-muted">Los que has fallado y aún no dominas.</p>
        </div>
        {items.length > 0 && (
          <ButtonLink
            href="/practicar?focus=dificiles"
            size="md"
            leftIcon={<Dumbbell aria-hidden />}
            className="w-full sm:w-auto"
          >
            Practicar elementos difíciles
          </ButtonLink>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-3xl bg-success-soft p-4 font-bold text-fg">
          <span aria-hidden>🌟 </span>
          ¡Nada pendiente! Ya dominas todo lo que has fallado.
        </p>
      ) : (
        <>
          <ol id={listId} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {shown.map((item, i) => (
              <HardElementRow key={item.atomicNumber} item={item} rank={i + 1} />
            ))}
          </ol>
          {items.length > INITIAL_ROWS && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => setExpanded((v) => !v)}
              rightIcon={<ChevronDown aria-hidden className={cn('transition-transform', expanded && 'rotate-180')} />}
              className="self-center"
            >
              {expanded ? 'Ver menos' : `Ver todos (${items.length})`}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
