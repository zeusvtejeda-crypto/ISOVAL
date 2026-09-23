import { memo, type CSSProperties } from 'react';
import { cn } from '@/components/ui';
import { CATEGORIES } from '@/data/categories';
import type { ElementCategory } from '@/types';
import { F_BLOCK_PLACEHOLDERS } from '@/utils/table-layout';
import { PLACEHOLDER_PLACEMENT } from './table-geometry';

const GROUPS = Array.from({ length: 18 }, (_, i) => i + 1);
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

interface AxesProps {
  compact: boolean;
}

/** Números de grupo (1–18) sobre las columnas y números de periodo (1–7) a la izquierda. */
export const TableAxes = memo(function TableAxes({ compact }: AxesProps) {
  const text = compact ? 'text-[0.5625rem] sm:text-[0.6875rem]' : 'text-[0.6875rem] sm:text-xs';
  return (
    <>
      {GROUPS.map((g) => (
        <span
          key={`g${g}`}
          aria-hidden
          style={{ gridColumn: g + 1, gridRow: 1 }}
          className={cn('self-end pb-0.5 text-center leading-none font-extrabold text-muted tabular', text)}
        >
          {g}
        </span>
      ))}
      {PERIODS.map((p) => (
        <span
          key={`p${p}`}
          aria-hidden
          style={{ gridColumn: 1, gridRow: p + 1 }}
          className={cn('self-center pr-0.5 text-center leading-none font-extrabold text-muted tabular', text)}
        >
          {p}
        </span>
      ))}
      {!compact && (
        <>
          <FRowLabel category="lanthanide" row={10} />
          <FRowLabel category="actinide" row={11} />
        </>
      )}
    </>
  );
});

function FRowLabel({ category, row }: { category: ElementCategory; row: number }) {
  const meta = CATEGORIES[category];
  return (
    <span
      aria-hidden
      style={{ gridColumn: '1 / span 3', gridRow: row }}
      className={cn('self-center truncate pr-1.5 text-right text-[0.6875rem] leading-tight font-extrabold', meta.textClass)}
    >
      {meta.label}
    </span>
  );
}

interface PlaceholdersProps {
  axes: boolean;
  /** Familia filtrada: resalta su marcador y atenúa el otro. */
  filterCategory?: ElementCategory | null;
}

/** Marcadores "57–71" y "89–103" en el hueco del grupo 3 de los periodos 6 y 7. */
export const FBlockPlaceholders = memo(function FBlockPlaceholders({ axes, filterCategory }: PlaceholdersProps) {
  const placement = axes ? PLACEHOLDER_PLACEMENT.axes : PLACEHOLDER_PLACEMENT.bare;
  return (
    <>
      <Placeholder
        category="lanthanide"
        label={F_BLOCK_PLACEHOLDERS.lanthanides.label}
        style={placement.lanthanides}
        dimmed={Boolean(filterCategory) && filterCategory !== 'lanthanide'}
      />
      <Placeholder
        category="actinide"
        label={F_BLOCK_PLACEHOLDERS.actinides.label}
        style={placement.actinides}
        dimmed={Boolean(filterCategory) && filterCategory !== 'actinide'}
      />
    </>
  );
});

interface PlaceholderProps {
  category: 'lanthanide' | 'actinide';
  label: string;
  style: CSSProperties;
  dimmed: boolean;
}

/** El texto mezcla el color de la familia con `fg` (más oscuro en claro, más claro en oscuro): ≥ 6:1. */
const PLACEHOLDER_COLORS: Record<PlaceholderProps['category'], string> = {
  lanthanide:
    'border-cat-lanthanide bg-cat-lanthanide-soft/60 text-[color-mix(in_oklab,var(--color-cat-lanthanide)_70%,var(--color-fg))]',
  actinide:
    'border-cat-actinide bg-cat-actinide-soft/60 text-[color-mix(in_oklab,var(--color-cat-actinide)_70%,var(--color-fg))]',
};

function Placeholder({ category, label, style, dimmed }: PlaceholderProps) {
  const meta = CATEGORIES[category];
  const [from, to] = label.split('–');
  return (
    <div
      role="img"
      aria-label={`${meta.label}: elementos del ${from} al ${to}, en la fila inferior`}
      style={style}
      className={cn(
        // Contenido en posición absoluta, como en ElementTile: un hijo en flujo con tamaños en `cqw`
        // dentro de una rejilla `w-max` + `1fr` hace fallar el renderizado de Chromium (≥ ~1190 px).
        '@container relative block aspect-square w-full overflow-hidden rounded-[14%] border-[1.5px] border-dashed transition-opacity',
        PLACEHOLDER_COLORS[category],
        dimmed && 'opacity-30',
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 hidden items-center justify-center text-center text-[length:max(10px,21cqw)] leading-tight font-black tabular @min-[2.5rem]:flex"
      >
        <span>
          {from}
          <br />
          {to}
        </span>
      </span>
    </div>
  );
}
