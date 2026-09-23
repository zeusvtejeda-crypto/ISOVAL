import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ElementTile } from '@/components/periodic';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ChemicalElement } from '@/types';

const MAX_SHOWN = 8;

function resolve(atomicNumbers: readonly number[]): ChemicalElement[] {
  return atomicNumbers.map((z) => ELEMENTS_BY_NUMBER[z]).filter((el): el is ChemicalElement => el !== undefined);
}

function MoreNote({ hidden }: { hidden: number }) {
  if (hidden <= 0) return null;
  return <p className="mt-2 text-sm font-bold text-muted">y {hidden} más…</p>;
}

/** "Hoy mejoraste: Oxígeno, Carbono…" */
export function ImprovedList({ atomicNumbers }: { atomicNumbers: readonly number[] }) {
  const elements = resolve(atomicNumbers);
  if (elements.length === 0) return null;
  const shown = elements.slice(0, MAX_SHOWN);
  return (
    <section aria-labelledby="summary-improved" className="rounded-3xl border border-border bg-surface p-4 shadow-card">
      <h2 id="summary-improved" className="flex items-center gap-2 font-black">
        <span aria-hidden>📈</span> Hoy mejoraste
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {shown.map((el) => (
          <li
            key={el.atomicNumber}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border-2 border-success/30 bg-success-soft py-0.5 pr-3.5 pl-0.5 font-bold"
          >
            <ElementTile element={el} size="xs" decorative />
            {el.name}
          </li>
        ))}
      </ul>
      <MoreNote hidden={elements.length - shown.length} />
    </section>
  );
}

/** "Elementos que debes repasar: Fe — Hierro…" (cada uno abre su ficha). */
export function ReviewList({ atomicNumbers }: { atomicNumbers: readonly number[] }) {
  const elements = resolve(atomicNumbers);
  if (elements.length === 0) return null;
  const shown = elements.slice(0, MAX_SHOWN);
  return (
    <section aria-labelledby="summary-review" className="rounded-3xl border border-border bg-surface p-4 shadow-card">
      <h2 id="summary-review" className="flex items-center gap-2 font-black">
        <span aria-hidden>🔁</span> Elementos que debes repasar
      </h2>
      <ul className="mt-2 divide-y divide-border">
        {shown.map((el) => (
          <li key={el.atomicNumber}>
            <Link
              href={`/tabla?e=${el.atomicNumber}`}
              className="-mx-2 flex min-h-14 items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-surface-2"
            >
              <ElementTile element={el} size="xs" decorative />
              <span className="min-w-0 flex-1 truncate font-extrabold">
                {el.symbol} — {el.name}
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <MoreNote hidden={elements.length - shown.length} />
    </section>
  );
}
