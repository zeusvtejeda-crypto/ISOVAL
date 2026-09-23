'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/components/ui';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ChemicalElement } from '@/types';

export interface ElementPagerProps {
  atomicNumber: number;
  /** Sin él, los botones enlazan a `/tabla?e=<Z>`. */
  onNavigate?: (atomicNumber: number) => void;
  className?: string;
}

const ITEM =
  'pressable flex min-h-14 min-w-0 items-center gap-2 rounded-2xl border-2 border-border bg-surface px-3 py-2 [--press-shade:var(--color-border)] hover:bg-surface-2';

function PagerItem({
  element,
  direction,
  onNavigate,
}: {
  element: ChemicalElement;
  direction: 'prev' | 'next';
  onNavigate?: (atomicNumber: number) => void;
}) {
  const isPrev = direction === 'prev';
  const label = `${isPrev ? 'Anterior' : 'Siguiente'}: ${element.name} (${element.atomicNumber})`;
  const content = (
    <>
      {isPrev && <ChevronLeft aria-hidden className="size-5 shrink-0 text-muted" />}
      <span className={cn('min-w-0 flex-1', isPrev ? 'text-left' : 'text-right')}>
        <span className="block text-xs font-extrabold text-muted tabular">
          {element.atomicNumber} · {element.symbol}
        </span>
        <span className="block truncate font-black">{element.name}</span>
      </span>
      {!isPrev && <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />}
    </>
  );
  const className = cn(ITEM, !isPrev && 'col-start-2');

  if (onNavigate) {
    return (
      <button type="button" aria-label={label} onClick={() => onNavigate(element.atomicNumber)} className={className}>
        {content}
      </button>
    );
  }
  return (
    <Link href={`/tabla?e=${element.atomicNumber}`} scroll={false} aria-label={label} className={className}>
      {content}
    </Link>
  );
}

/** Navegación al elemento anterior y siguiente (por número atómico). */
export function ElementPager({ atomicNumber, onNavigate, className }: ElementPagerProps) {
  const prev = ELEMENTS_BY_NUMBER[atomicNumber - 1];
  const next = ELEMENTS_BY_NUMBER[atomicNumber + 1];
  return (
    <nav aria-label="Otros elementos" className={cn('grid grid-cols-2 gap-2', className)}>
      {prev && <PagerItem element={prev} direction="prev" onNavigate={onNavigate} />}
      {next && <PagerItem element={next} direction="next" onNavigate={onNavigate} />}
    </nav>
  );
}
