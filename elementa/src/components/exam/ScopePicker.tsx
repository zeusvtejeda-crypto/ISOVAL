'use client';

import { Chip, SegmentedControl } from '@/components/ui';
import { FAMILY_GROUPS, STUDY_BLOCKS } from '@/data/blocks';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ElementCategory } from '@/types';
import { pluralize } from '@/utils/format';
import { DEFAULT_BLOCK_ID, DEFAULT_FAMILY_ID, scopePool, type ExamScope } from './presets';

export interface ScopePickerProps {
  scope: ExamScope;
  onChange: (scope: ExamScope) => void;
  /** Último bloque / familia elegidos (para volver a ellos al cambiar de pestaña). */
  lastBlock?: string;
  lastFamily?: ElementCategory;
}

type ScopeKind = ExamScope['kind'];

const KIND_OPTIONS = [
  { value: 'all' as const, label: 'Todos' },
  { value: 'block' as const, label: 'Un bloque' },
  { value: 'family' as const, label: 'Una familia' },
];

function preview(pool: readonly number[]): string {
  const symbols = pool.map((z) => ELEMENTS_BY_NUMBER[z]?.symbol).filter((s): s is string => Boolean(s));
  const shown = symbols.slice(0, 8).join(', ');
  return symbols.length > 8 ? `${shown}…` : shown;
}

/** Alcance del examen: todos los elementos, un bloque de 10 o una familia. */
export function ScopePicker({ scope, onChange, lastBlock = DEFAULT_BLOCK_ID, lastFamily = DEFAULT_FAMILY_ID }: ScopePickerProps) {
  const pool = scopePool(scope);

  const changeKind = (kind: ScopeKind) => {
    if (kind === 'all') onChange({ kind: 'all' });
    else if (kind === 'block') onChange({ kind: 'block', id: scope.kind === 'block' ? scope.id : lastBlock });
    else onChange({ kind: 'family', id: scope.kind === 'family' ? scope.id : lastFamily });
  };

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl label="Elementos del examen" options={KIND_OPTIONS} value={scope.kind} onChange={changeKind} block />

      {scope.kind === 'block' && (
        <div role="group" aria-label="Bloque" className="flex flex-wrap gap-2 animate-slide-down">
          {STUDY_BLOCKS.map((block) => (
            <Chip
              key={block.id}
              selected={block.id === scope.id}
              onClick={() => onChange({ kind: 'block', id: block.id })}
              aria-label={`${block.title}: elementos ${block.range}`}
              className="tabular"
            >
              {block.range}
            </Chip>
          ))}
        </div>
      )}

      {scope.kind === 'family' && (
        <div role="group" aria-label="Familia" className="flex flex-wrap gap-2 animate-slide-down">
          {FAMILY_GROUPS.map((family) => (
            <Chip
              key={family.id}
              selected={family.id === scope.id}
              onClick={() => onChange({ kind: 'family', id: family.id })}
              aria-label={`${family.title}: ${family.atomicNumbers.length} elementos`}
              icon={<span aria-hidden>{family.emoji}</span>}
            >
              {family.title}
              <span className="text-xs font-black text-muted tabular">{family.atomicNumbers.length}</span>
            </Chip>
          ))}
        </div>
      )}

      <p className="text-sm font-semibold text-muted" aria-live="polite">
        <span className="font-black text-fg tabular">
          {pool.length} {pluralize(pool.length, 'elemento', 'elementos')}
        </span>
        {scope.kind !== 'all' && <>: {preview(pool)}</>}
        {scope.kind === 'all' && ': toda la tabla periódica'}
      </p>
    </div>
  );
}
