import { ElementTile } from '@/components/periodic';
import { cn } from '@/components/ui';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ChemicalElement } from '@/types';

export type ChipTone = 'neutral' | 'success' | 'danger' | 'brand';

export interface ElementChipsProps {
  atomicNumbers: readonly number[];
  /** Muestra el nombre junto a la casilla; sin él solo se ven las casillas (y el nombre queda para lectores). */
  showNames?: boolean;
  tone?: ChipTone;
  /** Máximo de elementos visibles; el resto se resume en "+N". */
  max?: number;
  /** Nombre accesible de la lista. */
  label: string;
  className?: string;
}

const TONES: Record<ChipTone, string> = {
  neutral: 'border-border bg-surface',
  success: 'border-success/30 bg-success-soft',
  danger: 'border-danger/30 bg-danger-soft',
  brand: 'border-brand/25 bg-brand-soft',
};

function resolve(atomicNumbers: readonly number[]): ChemicalElement[] {
  return atomicNumbers.map((z) => ELEMENTS_BY_NUMBER[z]).filter((el): el is ChemicalElement => el !== undefined);
}

/** Fila de mini casillas de elementos (con o sin nombre). */
export function ElementChips({ atomicNumbers, showNames = false, tone = 'neutral', max = 12, label, className }: ElementChipsProps) {
  const elements = resolve(atomicNumbers);
  if (elements.length === 0) return null;
  const shown = elements.slice(0, max);
  const hidden = elements.length - shown.length;

  return (
    <ul aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {shown.map((el) =>
        showNames ? (
          <li
            key={el.atomicNumber}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-2xl border-2 py-0.5 pr-3 pl-0.5 text-sm font-bold animate-pop',
              TONES[tone],
            )}
          >
            <ElementTile element={el} size="xs" decorative />
            {el.name}
          </li>
        ) : (
          <li key={el.atomicNumber} className="animate-pop">
            <ElementTile element={el} size="xs" decorative />
            <span className="sr-only">{el.name}</span>
          </li>
        ),
      )}
      {hidden > 0 && (
        <li className="inline-flex h-10 items-center rounded-[0.625rem] bg-surface-2 px-2.5 text-sm font-black text-muted tabular">
          +{hidden}
        </li>
      )}
    </ul>
  );
}
