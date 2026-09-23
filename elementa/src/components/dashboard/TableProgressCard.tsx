'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, cn } from '@/components/ui';
import { CATEGORIES } from '@/data/categories';
import { ELEMENTS, TOTAL_ELEMENTS } from '@/data/elements';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import type { ChemicalElement } from '@/types';
import { MASTERED_THRESHOLD, computeMastery } from '@/utils/mastery';
import { getGridPosition } from '@/utils/table-layout';

type CellStatus = 'none' | 'learned' | 'mastered';

interface Cell {
  el: ChemicalElement;
  col: number;
  row: number;
}

/** Posiciones fijas de las 118 casillas (filas 1–7, separador en la 8, bloque f en 9–10). */
const CELLS: readonly Cell[] = ELEMENTS.map((el) => ({ el, ...getGridPosition(el) }));

const GRID_STYLE = {
  gridTemplateColumns: 'repeat(18, minmax(0, 1fr))',
  gridTemplateRows: 'repeat(7, auto) 0.45rem repeat(2, auto)',
} as const;

function cellClass(el: ChemicalElement, status: CellStatus): string {
  if (status === 'mastered') return CATEGORIES[el.category].solidClass;
  if (status === 'learned') return cn('border', CATEGORIES[el.category].tileClass);
  return 'bg-border/80';
}

function LegendSwatch({ className }: { className: string }) {
  return <span aria-hidden className={cn('inline-block size-3.5 shrink-0 rounded-[4px]', className)} />;
}

/**
 * Mini tabla periódica que se "enciende" a medida que aprendes: casilla suave = aprendido,
 * casilla sólida = dominado. Toda la tabla es un enlace a `/tabla`.
 */
export function TableProgressCard({ className }: { className?: string }) {
  const { state } = useProgress();
  const now = useNow();

  const statuses = useMemo(() => {
    const out: Record<number, CellStatus> = {};
    for (const { el } of CELLS) {
      const p = state.elements[el.atomicNumber];
      if (p && computeMastery(p, now) >= MASTERED_THRESHOLD) out[el.atomicNumber] = 'mastered';
      else if (p?.learned) out[el.atomicNumber] = 'learned';
      else out[el.atomicNumber] = 'none';
    }
    return out;
  }, [state, now]);

  const counts = useMemo(() => {
    const c = { none: 0, learned: 0, mastered: 0 };
    for (const s of Object.values(statuses)) c[s]++;
    return c;
  }, [statuses]);
  const lit = counts.learned + counts.mastered;

  return (
    <Card as="section" aria-labelledby="table-progress-title" className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="table-progress-title" className="text-lg leading-tight font-black">
            Tu tabla periódica
          </h2>
          <p className="mt-0.5 text-sm font-semibold text-muted">Cada elemento que aprendes se enciende.</p>
        </div>
        <p className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-sm font-black text-brand tabular">
          {Math.round((lit / TOTAL_ELEMENTS) * 100)}%
        </p>
      </div>

      <Link
        href="/tabla"
        aria-label={`Abrir la tabla periódica. Has aprendido ${lit} de ${TOTAL_ELEMENTS} elementos y dominas ${counts.mastered}.`}
        className="group block rounded-2xl p-1 transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] motion-reduce:hover:scale-100"
      >
        <div aria-hidden className="grid gap-[2px] sm:gap-[3px]" style={GRID_STYLE}>
          {CELLS.map(({ el, col, row }) => (
            <span
              key={el.atomicNumber}
              className={cn(
                'aspect-square rounded-[22%] transition-colors duration-500',
                cellClass(el, statuses[el.atomicNumber] ?? 'none'),
              )}
              style={{ gridColumn: col, gridRow: row }}
            />
          ))}
        </div>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-muted">
          <li className="inline-flex items-center gap-1.5">
            <LegendSwatch className="bg-border" />
            Sin aprender <span className="font-black text-fg tabular">{counts.none}</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <LegendSwatch className="border border-brand bg-brand-soft" />
            Aprendidos <span className="font-black text-fg tabular">{lit}</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <LegendSwatch className="bg-brand" />
            Dominados <span className="font-black text-fg tabular">{counts.mastered}</span>
          </li>
        </ul>
        <Link
          href="/tabla"
          className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-extrabold text-brand hover:bg-brand-soft"
        >
          Explorar la tabla
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </Card>
  );
}
