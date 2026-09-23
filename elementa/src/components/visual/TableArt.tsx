import { cn } from '@/components/ui';
import { ELEMENTS } from '@/data/elements';
import { getGridPosition } from '@/utils/table-layout';

const GRID_STYLE = {
  gridTemplateColumns: 'repeat(18, minmax(0, 1fr))',
  gridTemplateRows: 'repeat(7, auto) 0.4rem repeat(2, auto)',
} as const;

/** Casilla objetivo (Oxígeno) marcada con el pin. */
const TARGET = 8;

const CELLS = ELEMENTS.map((el) => ({ z: el.atomicNumber, category: el.category, ...getGridPosition(el) }));

function cellClass(z: number, category: string): string {
  if (z === TARGET) return 'bg-brand [--pulse-color:var(--color-brand)] animate-pulse-ring';
  if (category === 'noble-gas') return 'bg-cat-noble-gas/75';
  if (category === 'alkali-metal') return 'bg-cat-alkali-metal/60';
  return 'bg-border/90';
}

/** Ilustración decorativa: la tabla con una familia marcada y un pin sobre la casilla buscada. */
export function TableArt({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('grid gap-[2px] sm:gap-[3px]', className)} style={GRID_STYLE}>
      {CELLS.map(({ z, category, col, row }) => (
        <span
          key={z}
          className={cn('relative aspect-square rounded-[22%]', cellClass(z, category))}
          style={{ gridColumn: col, gridRow: row }}
        >
          {z === TARGET && (
            <span className="absolute bottom-[70%] left-1/2 -translate-x-1/2 text-base leading-none drop-shadow-sm animate-float sm:text-2xl">
              📍
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
