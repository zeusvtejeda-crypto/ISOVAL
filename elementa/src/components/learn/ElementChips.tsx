'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ElementTile } from '@/components/periodic/ElementTile';
import { cn } from '@/components/ui';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ChemicalElement } from '@/types';
import { fittingCount } from './chip-fit';

export type ChipTone = 'neutral' | 'success' | 'danger' | 'brand';

export interface ElementChipsProps {
  atomicNumbers: readonly number[];
  /** Muestra el nombre junto a la casilla; sin él solo se ven las casillas (y el nombre queda para lectores). */
  showNames?: boolean;
  tone?: ChipTone;
  /** Máximo de elementos visibles; el resto se resume en "+N". Se ignora con `singleRow`. */
  max?: number;
  /** Una sola fila: lo que no cabe se resume en un botón «+N» que despliega el resto. */
  singleRow?: boolean;
  /** Nombre accesible de la lista. */
  label: string;
  className?: string;
}

const TONES: Record<ChipTone, string> = {
  neutral: 'border-border bg-surface',
  success: 'border-success/30 bg-success-soft',
  danger: 'border-danger/30 bg-danger-soft',
  brand: 'border-brand/25 bg-brand-soft',
};

const MORE = 'inline-flex h-10 items-center rounded-[0.625rem] bg-surface-2 px-2.5 text-sm font-black text-muted tabular';

function resolve(atomicNumbers: readonly number[]): ChemicalElement[] {
  return atomicNumbers.map((z) => ELEMENTS_BY_NUMBER[z]).filter((el): el is ChemicalElement => el !== undefined);
}

interface ChipProps {
  element: ChemicalElement;
  showNames: boolean;
  tone: ChipTone;
  className?: string;
}

function Chip({ element: el, showNames, tone, className }: ChipProps) {
  if (showNames) {
    return (
      <li
        className={cn(
          'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border-2 py-0.5 pr-3 pl-0.5 text-sm font-bold',
          TONES[tone],
          className,
        )}
      >
        <ElementTile element={el} size="xs" decorative />
        {el.name}
      </li>
    );
  }
  return (
    <li className={cn('shrink-0', className)}>
      <ElementTile element={el} size="xs" decorative />
      <span className="sr-only">{el.name}</span>
    </li>
  );
}

type ChipRowProps = Required<Pick<ElementChipsProps, 'showNames' | 'tone' | 'label'>> & {
  elements: ChemicalElement[];
  className?: string;
};

/**
 * Fila única de fichas: mide cuántas caben (con una regla invisible que no ocupa sitio) y resume
 * el resto en «+N»; al pulsarlo se despliegan todas.
 */
function ChipRow({ elements, showNames, tone, label, className }: ChipRowProps) {
  const listId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState(elements.length);
  const [expanded, setExpanded] = useState(false);
  const count = elements.length;

  useLayoutEffect(() => {
    const row = rowRef.current;
    const ruler = rulerRef.current;
    if (!row || !ruler) return;
    const measure = () => {
      const items = Array.from(ruler.children) as HTMLElement[];
      const plus = items.pop();
      const gap = parseFloat(getComputedStyle(ruler).columnGap) || 0;
      setFit(fittingCount(items.map((item) => item.offsetWidth), plus?.offsetWidth ?? 0, gap, row.clientWidth));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // La regla cambia de ancho cuando carga la fuente; la fila, al girar la pantalla.
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(ruler);
    return () => observer.disconnect();
  }, [count]);

  const shown = expanded ? elements : elements.slice(0, fit);
  const hidden = count - shown.length;

  return (
    <div ref={rowRef} className={cn('relative', className)}>
      <ul id={listId} aria-label={label} className={cn('flex gap-1.5', expanded ? 'flex-wrap' : 'flex-nowrap')}>
        {shown.map((el) => (
          <Chip key={el.atomicNumber} element={el} showNames={showNames} tone={tone} className="animate-pop" />
        ))}
        {hidden > 0 && (
          <li className="shrink-0">
            <button
              type="button"
              aria-expanded={false}
              aria-controls={listId}
              onClick={() => setExpanded(true)}
              className={cn(MORE, 'min-h-11 transition-colors hover:bg-border')}
            >
              +{hidden}
              <span className="sr-only"> más: ver todos</span>
            </button>
          </li>
        )}
      </ul>
      {/* Regla invisible: todas las fichas en una línea, recortada para no ensanchar la página. */}
      <ul
        ref={rulerRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-0 top-0 flex flex-nowrap gap-1.5 overflow-hidden"
      >
        {elements.map((el) => (
          <Chip key={el.atomicNumber} element={el} showNames={showNames} tone={tone} />
        ))}
        <li className={cn(MORE, 'min-h-11 shrink-0')}>+{count}</li>
      </ul>
    </div>
  );
}

/** Fila de mini casillas de elementos (con o sin nombre). */
export function ElementChips({
  atomicNumbers,
  showNames = false,
  tone = 'neutral',
  max = 12,
  singleRow = false,
  label,
  className,
}: ElementChipsProps) {
  const elements = resolve(atomicNumbers);
  if (elements.length === 0) return null;
  if (singleRow) {
    return <ChipRow elements={elements} showNames={showNames} tone={tone} label={label} className={className} />;
  }
  const shown = elements.slice(0, max);
  const hidden = elements.length - shown.length;

  return (
    <ul aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {shown.map((el) => (
        <Chip key={el.atomicNumber} element={el} showNames={showNames} tone={tone} className="animate-pop" />
      ))}
      {hidden > 0 && <li className={MORE}>+{hidden}</li>}
    </ul>
  );
}
