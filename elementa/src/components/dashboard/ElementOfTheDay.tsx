import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ElementTile } from '@/components/periodic';
import { cn } from '@/components/ui';
import { CATEGORIES } from '@/data/categories';
import { getElement } from '@/data/elements';
import { elementOfTheDay } from './element-of-the-day';
import { LINK_CARD } from './styles';

export interface ElementOfTheDayProps {
  /** Día (`YYYY-MM-DD`) que determina el elemento. */
  dayKey: string;
  className?: string;
}

/** Tarjeta «Elemento del día»: el mismo para todos ese día; abre su ficha en la tabla. */
export function ElementOfTheDay({ dayKey, className }: ElementOfTheDayProps) {
  const element = getElement(elementOfTheDay(dayKey));
  const category = CATEGORIES[element.category];

  return (
    <section aria-labelledby="element-of-day-title" className={className}>
      <Link
        href={`/tabla?e=${element.atomicNumber}`}
        className={cn(LINK_CARD, 'flex h-full items-center gap-4 overflow-hidden p-4 sm:p-5')}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-brand/10 blur-2xl"
        />
        <span className="relative shrink-0 transition-transform duration-300 ease-spring group-hover:scale-105 group-hover:-rotate-6">
          <ElementTile element={element} size="md" decorative className="shadow-card" />
        </span>
        <div className="relative min-w-0 flex-1">
          <h2 id="element-of-day-title" className="text-xs font-black tracking-wider text-brand uppercase">
            <span aria-hidden>✨ </span>Elemento del día
          </h2>
          <p className="mt-0.5 text-xl leading-tight font-black">
            {element.name} <span className="text-muted">({element.symbol})</span>
          </p>
          <p className={cn('mt-0.5 text-sm font-extrabold', category.textClass)}>
            <span aria-hidden>{category.emoji} </span>
            {category.singular}
          </p>
          <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-muted">{element.funFact}</p>
        </div>
        <ChevronRight
          aria-hidden
          className="relative size-5 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </Link>
    </section>
  );
}
