'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, cn } from '@/components/ui';
import { ELEMENTS, TOTAL_ELEMENTS } from '@/data/elements';
import { TIER_TEXTURE } from '@/components/periodic/mastery-cues';
import type { MasteryTier, ProgressState } from '@/types';
import { TIER_META, masteryTier } from '@/utils/mastery';
import { getGridPosition } from '@/utils/table-layout';
import { ChartTable, StackedBar, type StackedSegment } from './charts';
import { DISTRIBUTION_ORDER, hasAnswers, masteryDistribution, type DistributionKey } from './stats-data';

interface TierStyle {
  emoji: string;
  label: string;
  /** Relleno SVG (barra apilada): el mismo color que las casillas. */
  fill: string;
  /** Fondo HTML (mini tabla y leyenda). */
  bg: string;
  /**
   * Señal que no depende del color: rayado en «Necesita práctica» (igual que en la tabla,
   * `TIER_TEXTURE`). Vacío en el resto.
   */
  texture: string;
}

const tierStyle = (tier: MasteryTier, fill: string): TierStyle => ({
  emoji: TIER_META[tier].emoji,
  label: TIER_META[tier].label,
  fill,
  bg: TIER_META[tier].barClass,
  texture: TIER_TEXTURE[tier],
});

const STYLES: Record<DistributionKey, TierStyle> = {
  mastered: tierStyle('mastered', 'fill-tier-mastered'),
  almost: tierStyle('almost', 'fill-tier-almost'),
  learning: tierStyle('learning', 'fill-tier-learning'),
  practice: tierStyle('practice', 'fill-tier-practice'),
  unseen: { emoji: '⚪', label: 'Sin empezar', fill: 'fill-border-strong', bg: 'bg-border-strong/70', texture: '' },
};

const CELLS = ELEMENTS.map((el) => ({ z: el.atomicNumber, symbol: el.symbol, ...getGridPosition(el) }));

const GRID_STYLE = {
  gridTemplateColumns: 'repeat(18, minmax(0, 1fr))',
  gridTemplateRows: 'repeat(7, auto) 0.45rem repeat(2, auto)',
} as const;

export interface MasteryOverviewProps {
  state: ProgressState;
  mastery: Readonly<Record<number, number>>;
}

/**
 * Dominio de la tabla: barra apilada 🟢 🟡 🟠 🔴 ⚪ con el recuento en cada tramo, leyenda con
 * nombre y emoji de cada nivel y mini tabla coloreada por dominio. «Necesita práctica» va rayado
 * (barra, leyenda y casillas) para no depender solo del color.
 */
export function MasteryOverview({ state, mastery }: MasteryOverviewProps) {
  const dist = masteryDistribution(state, mastery);
  const segments: StackedSegment[] = DISTRIBUTION_ORDER.map((key) => ({
    key,
    label: STYLES[key].label,
    value: dist[key],
    fillClass: STYLES[key].fill,
    hatched: key === 'practice',
  }));
  const describe = DISTRIBUTION_ORDER.map((k) => `${STYLES[k].label}: ${dist[k]}`).join(', ');

  const tierOf = (z: number): DistributionKey => (hasAnswers(state, z) ? masteryTier(mastery[z] ?? 0) : 'unseen');

  return (
    <Card as="section" aria-labelledby="mastery-overview-title" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="mastery-overview-title" className="text-lg leading-tight font-black">
            <span aria-hidden className="mr-1.5">
              🧪
            </span>
            Dominio de la tabla
          </h3>
          <p className="mt-0.5 text-sm font-semibold text-muted">
            {dist.mastered} de {TOTAL_ELEMENTS} dominados · {TOTAL_ELEMENTS - dist.unseen} empezados
          </p>
        </div>
      </div>

      <div className="relative">
        <StackedBar segments={segments} showValues ariaLabel={`Elementos por nivel de dominio. ${describe}.`} />
        <ChartTable
          caption="Elementos por nivel de dominio"
          headers={['Nivel', 'Elementos']}
          rows={DISTRIBUTION_ORDER.map((k) => [STYLES[k].label, String(dist[k])] as const)}
        />
      </div>

      <ul aria-hidden className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
        {DISTRIBUTION_ORDER.map((k) => (
          <li key={k} className="flex min-w-0 items-center gap-2">
            <span className={cn('size-3.5 shrink-0 rounded-[4px]', STYLES[k].bg, STYLES[k].texture)} />
            <span className="min-w-0 text-sm leading-tight font-bold text-muted">
              <span className="mr-1">{STYLES[k].emoji}</span>
              {STYLES[k].label}
            </span>
            <span className="ml-auto shrink-0 text-sm font-black tabular lg:ml-0">{dist[k]}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/tabla"
        aria-label={`Abrir la tabla periódica. ${describe}.`}
        className="group mt-1 block rounded-2xl border border-border p-2.5 transition-[transform,border-color] duration-200 hover:border-border-strong active:scale-[0.99] sm:p-3.5"
      >
        <div aria-hidden className="mx-auto grid max-w-2xl gap-[2px] sm:gap-[3px]" style={GRID_STYLE}>
          {CELLS.map(({ z, symbol, col, row }) => {
            const tier = tierOf(z);
            return (
              <span
                key={z}
                title={tier === 'unseen' ? `${symbol} · ${STYLES.unseen.label}` : `${symbol} · ${mastery[z] ?? 0}% · ${STYLES[tier].label}`}
                className={cn('aspect-square rounded-[22%] transition-colors duration-500', STYLES[tier].bg, STYLES[tier].texture)}
                style={{ gridColumn: col, gridRow: row }}
              />
            );
          })}
        </div>
        <span className="mt-2.5 flex items-center justify-end gap-1 text-sm font-extrabold text-brand">
          Ver la tabla
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </Card>
  );
}
