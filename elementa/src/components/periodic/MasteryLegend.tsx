'use client';

import { useMemo } from 'react';
import { Skeleton, cn } from '@/components/ui';
import { ELEMENTS } from '@/data/elements';
import { useMasteryMap } from '@/hooks/useMasteryMap';
import { useProgress } from '@/hooks/useProgress';
import type { MasteryTier } from '@/types';
import { masteryTier, TIER_META } from '@/utils/mastery';

const TIERS: MasteryTier[] = ['mastered', 'almost', 'learning', 'practice'];

/** Resumen del dominio de la tabla: cuántos elementos hay en cada nivel y cuántos sin practicar. */
export function MasteryLegend({ className }: { className?: string }) {
  const { state, ready } = useProgress();
  const mastery = useMasteryMap();

  const counts = useMemo(() => {
    const out: Record<MasteryTier | 'unseen', number> = { mastered: 0, almost: 0, learning: 0, practice: 0, unseen: 0 };
    for (const el of ELEMENTS) {
      const p = state.elements[el.atomicNumber];
      if (!p || p.correct + p.incorrect === 0) out.unseen += 1;
      else out[masteryTier(mastery[el.atomicNumber] ?? 0)] += 1;
    }
    return out;
  }, [state.elements, mastery]);

  if (!ready) return <Skeleton className={cn('h-9 w-full', className)} rounded="full" />;

  return (
    <ul aria-label="Dominio de la tabla" className={cn('flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold', className)}>
      {TIERS.map((tier) => (
        <li key={tier} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn('h-1.5 w-5 rounded-full', TIER_META[tier].barClass)} />
          <span>{TIER_META[tier].label}</span>
          <span className={cn('font-black tabular', TIER_META[tier].textClass)}>{counts[tier]}</span>
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5 text-muted">
        <span aria-hidden className="h-1.5 w-5 rounded-full bg-fg/15" />
        <span>Sin practicar</span>
        <span className="font-black tabular">{counts.unseen}</span>
      </li>
    </ul>
  );
}
