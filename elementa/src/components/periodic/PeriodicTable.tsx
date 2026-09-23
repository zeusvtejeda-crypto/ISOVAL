'use client';

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { cn, useReducedMotion } from '@/components/ui';
import { ELEMENTS } from '@/data/elements';
import { useMasteryMap } from '@/hooks/useMasteryMap';
import type { ElementCategory } from '@/types';
import { ElementTile, type TileStatus } from './ElementTile';
import { FBlockPlaceholders, TableAxes } from './TableAxes';
import { isTableKey, keyTarget, TILE_PLACEMENT } from './table-geometry';

export interface PeriodicTableProps {
  /** Al tocar una casilla. Sin él, la tabla es solo de lectura. */
  onSelect?: (atomicNumber: number) => void;
  /** Casillas seleccionadas (selección múltiple: se exponen con `aria-pressed`). */
  selected?: readonly number[];
  /** Casillas resaltadas (anillo + zoom). La primera se desplaza a la vista en móvil. */
  highlighted?: readonly number[];
  dimmed?: readonly number[];
  /** Casillas marcadas como correctas (verde). */
  correct?: readonly number[];
  /** Casillas marcadas como incorrectas (rojo). */
  incorrect?: readonly number[];
  /**
   * Qué casillas se pueden tocar: `true` (por defecto) todas, `false` ninguna o una lista
   * (el resto se atenúa).
   */
  selectable?: boolean | readonly number[];
  /** Barra de dominio en cada casilla. */
  showMastery?: boolean;
  /** Oculta los números de grupo y de periodo. */
  hideLabels?: boolean;
  /** "Ajustar a pantalla": la tabla cabe en el ancho disponible (casillas pequeñas, solo símbolo). */
  compact?: boolean;
  /** Resalta una familia y atenúa el resto. */
  filterCategory?: ElementCategory | null;
  /** Casillas sin texto (preguntas de ubicación). Las correctas/incorrectas se revelan. */
  blind?: boolean;
  /** Sin colores de familia. */
  neutral?: boolean;
  /** Nombre accesible del conjunto. */
  label?: string;
  /** En móvil, el área de desplazamiento llega a los bordes de la pantalla. Por defecto `true`. */
  bleed?: boolean;
  className?: string;
}

type NumberSet = ReadonlySet<number> | null;

function toSet(list: readonly number[] | undefined): NumberSet {
  return list && list.length > 0 ? new Set(list) : null;
}

const GRID_COLUMNS = {
  scroll: {
    axes: 'grid-cols-[1.25rem_repeat(18,minmax(2.75rem,1fr))] pointer-fine:grid-cols-[1.25rem_repeat(18,minmax(2.25rem,1fr))]',
    bare: 'grid-cols-[repeat(18,minmax(2.75rem,1fr))] pointer-fine:grid-cols-[repeat(18,minmax(2.25rem,1fr))]',
  },
  compact: {
    axes: 'grid-cols-[0.75rem_repeat(18,minmax(0,1fr))]',
    bare: 'grid-cols-[repeat(18,minmax(0,1fr))]',
  },
} as const;

const GRID_ROWS = {
  axes: 'grid-rows-[auto_repeat(7,auto)_0.625rem_repeat(2,auto)]',
  bare: 'grid-rows-[repeat(7,auto)_0.625rem_repeat(2,auto)]',
} as const;

/**
 * Tabla periódica en una rejilla CSS de 18 × 10 (la fila 8 separa el bloque f).
 * En móvil se desplaza en horizontal con casillas ≥ 44 px; `compact` la ajusta al ancho.
 * Teclado: flechas para moverse entre casillas (un solo punto de tabulación), Inicio/Fin por fila.
 */
export const PeriodicTable = memo(function PeriodicTable({
  onSelect,
  selected,
  highlighted,
  dimmed,
  correct,
  incorrect,
  selectable = true,
  showMastery = false,
  hideLabels = false,
  compact = false,
  filterCategory = null,
  blind = false,
  neutral = false,
  label = 'Tabla periódica',
  bleed = true,
  className,
}: PeriodicTableProps) {
  const masteryMap = useMasteryMap();
  const reducedMotion = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [activeZ, setActiveZ] = useState<number | null>(null);

  // Callback estable para no volver a renderizar las 118 casillas cuando cambia `onSelect`.
  const onSelectRef = useRef(onSelect);
  useLayoutEffect(() => {
    onSelectRef.current = onSelect;
  });
  const handleSelect = useCallback((z: number) => onSelectRef.current?.(z), []);

  const sets = useMemo(
    () => ({
      selected: toSet(selected),
      highlighted: toSet(highlighted),
      dimmed: toSet(dimmed),
      correct: toSet(correct),
      incorrect: toSet(incorrect),
    }),
    [selected, highlighted, dimmed, correct, incorrect],
  );
  const selectableSet = useMemo(
    () => (typeof selectable === 'object' ? new Set(selectable) : null),
    [selectable],
  );

  const interactive = onSelect !== undefined && selectable !== false;
  const canSelect = useCallback(
    (z: number) => interactive && (selectableSet === null || selectableSet.has(z)),
    [interactive, selectableSet],
  );

  const statusOf = (z: number, category: ElementCategory): TileStatus => {
    if (sets.correct?.has(z)) return 'correct';
    if (sets.incorrect?.has(z)) return 'incorrect';
    if (sets.selected?.has(z)) return 'selected';
    if (sets.highlighted?.has(z)) return 'highlight';
    if (sets.dimmed?.has(z)) return 'dimmed';
    if (filterCategory && category !== filterCategory) return 'dimmed';
    if (selectableSet && !selectableSet.has(z)) return 'dimmed';
    return 'default';
  };

  const firstSelectable = interactive ? (ELEMENTS.find((el) => canSelect(el.atomicNumber))?.atomicNumber ?? null) : null;
  const tabStop = activeZ !== null && canSelect(activeZ) ? activeZ : firstSelectable;

  // Lleva a la vista (solo en horizontal) la primera casilla resaltada o correcta.
  const scrollTarget = highlighted?.[0] ?? correct?.[0] ?? null;
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (compact || scrollTarget === null || !scroller) return;
    const tile = scroller.querySelector<HTMLElement>(`[data-z="${scrollTarget}"]`);
    if (!tile) return;
    const view = scroller.getBoundingClientRect();
    const rect = tile.getBoundingClientRect();
    if (rect.left >= view.left && rect.right <= view.right) return;
    const delta = rect.left - view.left - (view.width - rect.width) / 2;
    scroller.scrollBy({ left: delta, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [scrollTarget, compact, reducedMotion]);

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const z = Number(target.dataset.z);
    if (z > 0) setActiveZ(z);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !isTableKey(event.key)) return;
    const z = Number(target.dataset.z);
    if (!(z > 0)) return;
    event.preventDefault();
    const next = keyTarget(z, event.key, canSelect);
    if (next === null) return;
    gridRef.current?.querySelector<HTMLElement>(`[data-z="${next}"]`)?.focus();
  };

  const axes = !hideLabels;
  const placement = axes ? TILE_PLACEMENT.axes : TILE_PLACEMENT.bare;
  const layout = compact ? GRID_COLUMNS.compact : GRID_COLUMNS.scroll;

  return (
    <div
      ref={scrollerRef}
      className={cn(
        'relative scroll-contained overflow-x-auto py-2 [scrollbar-width:thin]',
        bleed ? '-mx-4 px-4 sm:mx-0 sm:px-1' : 'px-1',
        className,
      )}
    >
      <div
        ref={gridRef}
        role="group"
        aria-label={label}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        className={cn(
          'grid',
          layout[axes ? 'axes' : 'bare'],
          axes ? GRID_ROWS.axes : GRID_ROWS.bare,
          compact ? 'w-full gap-0.5 sm:gap-1' : 'w-max min-w-full gap-1',
        )}
      >
        {axes && <TableAxes compact={compact} />}
        <FBlockPlaceholders axes={axes} filterCategory={filterCategory} />
        {ELEMENTS.map((el) => {
          const z = el.atomicNumber;
          const status = statusOf(z, el.category);
          const clickable = canSelect(z);
          const revealed = status === 'correct' || status === 'incorrect';
          return (
            <ElementTile
              key={z}
              element={el}
              fluid
              status={status}
              showMastery={showMastery}
              mastery={showMastery ? (masteryMap[z] ?? 0) : 0}
              onClick={clickable ? handleSelect : undefined}
              pressed={clickable && selected !== undefined ? (sets.selected?.has(z) ?? false) : undefined}
              tabIndex={clickable ? (z === tabStop ? 0 : -1) : undefined}
              blind={blind && !revealed}
              neutral={neutral && !revealed}
              style={placement[z]}
            />
          );
        })}
      </div>
    </div>
  );
});
