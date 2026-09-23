import { cn } from '@/components/ui';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ProgressState } from '@/types';
import { TIER_META } from '@/utils/mastery';
import { miniTileTone, type MiniTileTone } from './group-progress';

export const MINI_TILE_CLASS: Record<MiniTileTone, string> = {
  unseen: 'border-dashed border-border-strong bg-surface-2 text-muted',
  practice: 'border-danger/60 bg-danger-soft text-fg',
  learning: 'border-streak/60 bg-streak-soft text-fg',
  almost: 'border-warning/60 bg-warning-soft text-fg',
  mastered: 'border-success/70 bg-success-soft text-fg',
};

export interface MiniTileStripProps {
  atomicNumbers: readonly number[];
  state: ProgressState;
  mastery: Readonly<Record<number, number>>;
  /** Columnas fijas (10 para bloques); sin él, casillas en fila que se ajustan. */
  columns?: number;
  /** Máximo de casillas; el resto se resume en "+N". */
  max?: number;
  className?: string;
}

/** Tira de mini casillas coloreadas por dominio (decorativa: el resumen en texto va aparte). */
export function MiniTileStrip({ atomicNumbers, state, mastery, columns, max, className }: MiniTileStripProps) {
  const shown = max !== undefined ? atomicNumbers.slice(0, max) : atomicNumbers;
  const hidden = atomicNumbers.length - shown.length;
  return (
    <div
      aria-hidden
      className={cn(columns ? 'grid gap-1' : 'flex flex-wrap gap-1', className)}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {shown.map((z) => {
        const el = ELEMENTS_BY_NUMBER[z];
        if (!el) return null;
        const tone = miniTileTone(state.elements[z], mastery[z] ?? 0);
        return (
          <span
            key={z}
            title={`${el.name} · ${tone === 'unseen' ? 'Sin practicar' : TIER_META[tone].label}`}
            className={cn(
              'grid aspect-square place-items-center rounded-lg border-[1.5px] text-[0.6875rem] leading-none font-black sm:text-xs',
              columns ? 'w-full' : 'size-8',
              MINI_TILE_CLASS[tone],
            )}
          >
            {el.symbol}
          </span>
        );
      })}
      {hidden > 0 && (
        <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-surface-2 px-1.5 text-xs font-black text-muted tabular">
          +{hidden}
        </span>
      )}
    </div>
  );
}

const LEGEND: MiniTileTone[] = ['unseen', 'practice', 'learning', 'almost', 'mastered'];

/** Leyenda de colores de las mini casillas. */
export function MiniTileLegend({ className }: { className?: string }) {
  return (
    <ul aria-label="Colores por dominio" className={cn('flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs font-bold text-muted', className)}>
      {LEGEND.map((tone) => (
        <li key={tone} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn('size-3.5 rounded-[0.3rem] border-[1.5px]', MINI_TILE_CLASS[tone])} />
          {tone === 'unseen' ? 'Sin practicar' : TIER_META[tone].label}
        </li>
      ))}
    </ul>
  );
}
