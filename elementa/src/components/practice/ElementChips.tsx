'use client';

import { useState } from 'react';
import { ElementTile } from '@/components/periodic';
import { cn } from '@/components/ui';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import { useMasteryMap } from '@/hooks/useMasteryMap';
import { useProgress } from '@/hooks/useProgress';
import type { ChemicalElement } from '@/types';
import { masteryTier, TIER_META } from '@/utils/mastery';

export interface ElementChipsProps {
  elements: readonly number[];
  /** Cuántos se ven antes de «Ver todos». */
  initial?: number;
}

/** Pastillas "K — Potasio" con la casilla del elemento y un punto con su nivel de dominio. */
export function ElementChips({ elements, initial = 12 }: ElementChipsProps) {
  const [expanded, setExpanded] = useState(false);
  const { state } = useProgress();
  const mastery = useMasteryMap();
  const list = elements.map((z) => ELEMENTS_BY_NUMBER[z]).filter((el): el is ChemicalElement => el !== undefined);
  const shown = expanded ? list : list.slice(0, initial);
  const hidden = list.length - shown.length;

  return (
    <ul className="flex flex-wrap gap-2">
      {shown.map((el, i) => {
        const p = state.elements[el.atomicNumber];
        const attempted = p !== undefined && p.correct + p.incorrect > 0;
        const tier = TIER_META[masteryTier(mastery[el.atomicNumber] ?? 0)];
        return (
          <li
            key={el.atomicNumber}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border-2 border-border bg-surface py-0.5 pr-3 pl-0.5 font-bold animate-pop"
            style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
          >
            <ElementTile element={el} size="xs" decorative />
            <span>
              {el.symbol} — {el.name}
            </span>
            {attempted && (
              <>
                <span aria-hidden title={tier.label} className={cn('size-2.5 shrink-0 rounded-full', tier.barClass)} />
                <span className="sr-only">({tier.label})</span>
              </>
            )}
          </li>
        );
      })}
      {hidden > 0 && (
        <li className="inline-flex">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex min-h-11 items-center rounded-2xl border-2 border-dashed border-border-strong px-3.5 font-black text-brand transition-colors hover:bg-brand-soft"
          >
            Ver {hidden} más
          </button>
        </li>
      )}
    </ul>
  );
}
