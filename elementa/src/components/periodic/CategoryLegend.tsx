'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { cn, useReducedMotion } from '@/components/ui';
import { CATEGORIES, CATEGORY_ORDER } from '@/data/categories';
import { ELEMENTS } from '@/data/elements';
import type { ElementCategory } from '@/types';

export interface CategoryLegendProps {
  /** Familia activa (resaltada). */
  active?: ElementCategory | null;
  /** Con él, cada familia es un botón conmutador (filtrar/resaltar). */
  onToggle?: (category: ElementCategory) => void;
  /** Muestra cuántos elementos tiene cada familia. Por defecto `true`. */
  showCounts?: boolean;
  /** `scroll`: una fila deslizable en móvil (por defecto) · `wrap`: varias líneas. */
  layout?: 'scroll' | 'wrap';
  className?: string;
}

const COUNTS: Record<ElementCategory, number> = CATEGORY_ORDER.reduce(
  (acc, cat) => ({ ...acc, [cat]: ELEMENTS.filter((el) => el.category === cat).length }),
  {} as Record<ElementCategory, number>,
);

/** Leyenda de familias con su color. Con `onToggle` sirve de filtro. */
export function CategoryLegend({ active = null, onToggle, showCounts = true, layout = 'scroll', className }: CategoryLegendProps) {
  const interactive = onToggle !== undefined;
  const rowRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // En móvil la fila se desliza: lleva a la vista la familia activa (p. ej. `/tabla?family=noble-gas`).
  const revealActive = useEffectEvent((category: ElementCategory) => {
    const row = rowRef.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    row.querySelector<HTMLElement>(`[data-category="${category}"]`)?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
  });
  useEffect(() => {
    if (active) revealActive(active);
  }, [active]);

  return (
    <div
      ref={rowRef}
      role={interactive ? 'group' : 'list'}
      aria-label="Familias de elementos"
      className={cn(
        'flex gap-2',
        layout === 'scroll'
          ? 'relative -mx-4 scroll-contained overflow-x-auto no-scrollbar px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0'
          : 'flex-wrap',
        className,
      )}
    >
      {CATEGORY_ORDER.map((cat) => {
        const meta = CATEGORIES[cat];
        const isActive = active === cat;
        const inner = (
          <>
            <span aria-hidden className={cn('size-3 shrink-0 rounded-full ring-2 ring-surface', meta.solidClass)} />
            <span>{meta.label}</span>
            {showCounts && (
              <span className="text-xs font-extrabold text-muted tabular">
                <span className="sr-only">: </span>
                {COUNTS[cat]}
              </span>
            )}
          </>
        );
        const base =
          'inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-2 px-3.5 text-sm font-bold';

        if (!interactive) {
          return (
            <span key={cat} role="listitem" data-category={cat} className={cn(base, 'border-border bg-surface')}>
              {inner}
            </span>
          );
        }
        return (
          <button
            key={cat}
            type="button"
            data-category={cat}
            aria-pressed={isActive}
            onClick={() => onToggle(cat)}
            className={cn(
              base,
              'select-none transition-[background-color,border-color,scale] duration-150 active:scale-[0.96]',
              isActive ? meta.tileClass : 'border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2',
            )}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
