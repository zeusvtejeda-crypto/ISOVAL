'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Chip, cn } from '@/components/ui';
import { FAMILY_GROUPS, STUDY_BLOCKS } from '@/data/blocks';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ElementCategory } from '@/types';
import { pluralize } from '@/utils/format';
import type { DeckKind, DeckSelection } from './deck';

export interface DeckPickerProps {
  selection: DeckSelection;
  onChange: (selection: DeckSelection) => void;
  /** Elementos de `?elements=` (añade la opción «Tu selección»). */
  custom: readonly number[] | null;
  /** Repasos pendientes (para la pista del repaso inteligente). */
  dueCount: number;
  /** Elementos débiles («Mis errores»); 0 = opción desactivada. */
  weakCount: number;
  /** Bloque que se elige al tocar «Por bloque». */
  defaultBlock: string;
  defaultFamily: ElementCategory;
  labelledBy: string;
}

interface OptionProps {
  emoji: string;
  title: string;
  description: ReactNode;
  selected: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  onSelect: () => void;
}

function DeckOption({ emoji, title, description, selected, disabled = false, badge, onSelect }: OptionProps) {
  return (
    <li className="flex">
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          'flex min-h-16 w-full items-center gap-3 rounded-3xl border-2 p-3 text-left',
          'transition-[background-color,border-color,transform,box-shadow] duration-150 enabled:active:scale-[0.98]',
          'disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent',
          selected
            ? 'border-brand bg-brand-soft shadow-glow'
            : 'border-border bg-surface enabled:hover:border-border-strong enabled:hover:bg-surface-2',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-2xl text-2xl',
            selected ? 'bg-surface' : 'bg-surface-2',
            disabled && 'opacity-60 grayscale',
          )}
        >
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block font-black', selected && 'text-brand', disabled && 'text-muted')}>{title}</span>
          <span className="block text-sm leading-snug font-semibold text-muted">{description}</span>
        </span>
        {badge}
        {selected && (
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-on-brand animate-pop [&_svg]:size-4"
          >
            <Check strokeWidth={3} />
          </span>
        )}
      </button>
    </li>
  );
}

function symbolsPreview(elements: readonly number[]): string {
  const symbols = elements.map((z) => ELEMENTS_BY_NUMBER[z]?.symbol).filter((s): s is string => Boolean(s));
  const shown = symbols.slice(0, 6).join(', ');
  return symbols.length > 6 ? `${shown}…` : shown;
}

/** Elige el mazo: repaso inteligente, todos, un bloque, una familia, mis errores o la selección de la URL. */
export function DeckPicker({
  selection,
  onChange,
  custom,
  dueCount,
  weakCount,
  defaultBlock,
  defaultFamily,
  labelledBy,
}: DeckPickerProps) {
  const is = (kind: DeckKind) => selection.kind === kind;
  const blockId = selection.kind === 'block' ? selection.id : defaultBlock;
  const familyId = selection.kind === 'family' ? selection.id : defaultFamily;

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-col gap-3">
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {custom && custom.length > 0 && (
          <DeckOption
            emoji="✨"
            title="Tu selección"
            description={`${custom.length} ${pluralize(custom.length, 'elemento', 'elementos')}: ${symbolsPreview(custom)}`}
            selected={is('custom')}
            onSelect={() => onChange({ kind: 'custom', elements: custom })}
          />
        )}
        <DeckOption
          emoji="🧠"
          title="Repaso inteligente"
          description={
            dueCount > 0
              ? `${dueCount} ${pluralize(dueCount, 'repaso pendiente', 'repasos pendientes')} + difíciles + nuevos`
              : 'Difíciles y nuevos, a tu medida'
          }
          badge={
            dueCount > 0 ? (
              <span aria-hidden className="shrink-0 rounded-full bg-streak-soft px-2 py-0.5 text-xs font-black text-streak tabular">
                {dueCount}
              </span>
            ) : undefined
          }
          selected={is('smart')}
          onSelect={() => onChange({ kind: 'smart' })}
        />
        <DeckOption
          emoji="🌍"
          title="Todos"
          description="Al azar entre los 118 elementos"
          selected={is('all')}
          onSelect={() => onChange({ kind: 'all' })}
        />
        <DeckOption
          emoji="📦"
          title="Por bloque"
          description="De 10 en 10: 1–10, 11–20…"
          selected={is('block')}
          onSelect={() => onChange({ kind: 'block', id: blockId })}
        />
        <DeckOption
          emoji="🧪"
          title="Por familia"
          description="Gases nobles, halógenos, metales…"
          selected={is('family')}
          onSelect={() => onChange({ kind: 'family', id: familyId })}
        />
        <DeckOption
          emoji="🎯"
          title="Mis errores"
          description={
            weakCount > 0
              ? `${weakCount} ${pluralize(weakCount, 'elemento', 'elementos')} por reforzar`
              : 'Aún no tienes errores. ¡Juega un poco y vuelve!'
          }
          disabled={weakCount === 0}
          selected={is('mistakes')}
          onSelect={() => onChange({ kind: 'mistakes' })}
        />
      </ul>

      {selection.kind === 'block' && (
        <div role="group" aria-label="Bloque" className="flex flex-wrap gap-2 animate-slide-down">
          {STUDY_BLOCKS.map((block) => (
            <Chip
              key={block.id}
              selected={block.id === blockId}
              onClick={() => onChange({ kind: 'block', id: block.id })}
              aria-label={`${block.title}: elementos ${block.range}`}
              className="tabular"
            >
              {block.range}
            </Chip>
          ))}
        </div>
      )}

      {selection.kind === 'family' && (
        <div role="group" aria-label="Familia" className="flex flex-wrap gap-2 animate-slide-down">
          {FAMILY_GROUPS.map((family) => (
            <Chip
              key={family.id}
              selected={family.id === familyId}
              onClick={() => onChange({ kind: 'family', id: family.id })}
              aria-label={`${family.title}: ${family.atomicNumbers.length} elementos`}
              icon={<span aria-hidden>{family.emoji}</span>}
            >
              {family.title}
              <span className="text-xs font-black opacity-70 tabular">{family.atomicNumbers.length}</span>
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
