import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MasteryBar } from '@/components/gamification';
import { ButtonLink, Card } from '@/components/ui';
import type { FamilyStat } from './stats-data';

const MEDALS = ['🥇', '🥈', '🥉'] as const;

export interface BestFamiliesProps {
  families: readonly FamilyStat[];
}

/** "Tus mejores familias": las 3 con mayor dominio medio. */
export function BestFamilies({ families }: BestFamiliesProps) {
  return (
    <Card as="section" aria-labelledby="best-families-title" className="flex flex-col gap-3">
      <div>
        <h3 id="best-families-title" className="text-lg leading-tight font-black">
          <span aria-hidden className="mr-1.5">
            🏅
          </span>
          Tus mejores familias
        </h3>
        <p className="mt-0.5 text-sm font-semibold text-muted">Dominio medio de todos sus elementos.</p>
      </div>

      {families.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-surface-2 p-4">
          <p className="font-bold">
            <span aria-hidden>🧬 </span>
            Practica una familia y aquí verás tus puntos fuertes.
          </p>
          <ButtonLink href="/bloques" size="sm" variant="secondary">
            Aprender por familias
          </ButtonLink>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {families.map((f, i) => (
            <li key={f.group.id}>
              <Link
                href={`/practicar?family=${f.group.id}`}
                aria-label={`${i + 1}. ${f.group.title}: dominio medio ${f.average}%, ${f.mastered} de ${f.total} dominados. Practicar esta familia.`}
                className="group flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-surface-2 active:scale-[0.99]"
              >
                <span aria-hidden className="text-2xl leading-none">
                  {MEDALS[i] ?? '🏅'}
                </span>
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl">
                  {f.group.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 leading-tight font-black">{f.group.title}</span>
                    <span className="shrink-0 text-xs font-bold text-muted tabular">
                      {f.mastered}/{f.total}
                    </span>
                  </span>
                  <MasteryBar value={f.average} size="sm" className="mt-1.5" />
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
