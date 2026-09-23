'use client';

import { useId, useMemo } from 'react';
import type { ChemicalElement } from '@/types';
import { isInFBlockRow } from '@/utils/table-layout';
import { PeriodicTable } from './PeriodicTable';
import { ALL_ATOMIC_NUMBERS } from './table-geometry';

function describe(el: ChemicalElement): string {
  if (isInFBlockRow(el)) {
    const row = el.atomicNumber >= 89 ? 'actínidos' : 'lantánidos';
    return `Periodo ${el.period}, en la fila de los ${row} (bloque f), bajo la tabla principal.`;
  }
  return `Periodo ${el.period}, grupo ${el.group}. Bloque ${el.block}.`;
}

/** Mini tabla con el elemento resaltado, para aprender dónde está. */
export function ElementLocation({ element, className }: { element: ChemicalElement; className?: string }) {
  const z = element.atomicNumber;
  const headingId = useId();
  const highlighted = useMemo(() => [z], [z]);
  const dimmed = useMemo(() => ALL_ATOMIC_NUMBERS.filter((n) => n !== z), [z]);

  return (
    <section aria-labelledby={headingId} className={className}>
      <h3 id={headingId} className="flex items-center gap-2 text-sm font-black">
        <span aria-hidden className="text-base">
          📍
        </span>
        Ubicación en la tabla
      </h3>
      <p className="mt-0.5 text-sm font-semibold text-muted">{describe(element)}</p>
      <div aria-hidden className="mt-2 rounded-2xl bg-surface-2 px-2 py-1 sm:px-3">
        <PeriodicTable
          compact
          bleed={false}
          highlighted={highlighted}
          dimmed={dimmed}
          label={`Ubicación de ${element.name}`}
        />
      </div>
    </section>
  );
}
