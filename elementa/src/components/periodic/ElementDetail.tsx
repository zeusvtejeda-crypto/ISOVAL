'use client';

import { BookOpenCheck, Layers } from 'lucide-react';
import { ButtonLink, cn } from '@/components/ui';
import { CATEGORIES } from '@/data/categories';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ChemicalElement } from '@/types';
import { groupLabel } from '@/utils/format';
import { ElementFacts } from './ElementFacts';
import { ElementLocation } from './ElementLocation';
import { ElementMasteryPanel } from './ElementMasteryPanel';
import { ElementNotes } from './ElementNotes';
import { ElementPager } from './ElementPager';
import { ElementTile } from './ElementTile';

export interface ElementDetailProps {
  atomicNumber: number;
  /** Navegación anterior/siguiente. Sin él, se enlaza a `/tabla?e=<Z>`. */
  onNavigate?: (atomicNumber: number) => void;
  /** Muestra la navegación anterior/siguiente. Por defecto `true`. */
  showPager?: boolean;
  /** Etiqueta del nombre: `p` cuando el contenedor (p. ej. un modal) ya tiene el encabezado. */
  titleAs?: 'h1' | 'h2' | 'p';
  className?: string;
}

function Hero({ element, titleAs: Title }: { element: ChemicalElement; titleAs: 'h1' | 'h2' | 'p' }) {
  const category = CATEGORIES[element.category];
  const alt = element.altNames.filter(Boolean);
  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <ElementTile key={element.atomicNumber} element={element} size="lg" decorative className="animate-bounce-in" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-muted tabular">
          N.º atómico {element.atomicNumber} · {groupLabel(element)} · Periodo {element.period}
        </p>
        <Title className="mt-0.5 text-3xl leading-tight font-black break-words sm:text-4xl">{element.name}</Title>
        <p className="mt-0.5 font-bold text-muted">
          Símbolo <span className="font-black text-fg">{element.symbol}</span>
          {alt.length > 0 && <> · También: {alt.join(', ')}</>}
        </p>
        <span
          className={cn(
            'mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-extrabold',
            category.tileClass,
          )}
        >
          <span aria-hidden>{category.emoji}</span>
          {category.singular}
        </span>
      </div>
    </div>
  );
}

/**
 * Ficha completa de un elemento: casilla grande, datos, textos para aprender, dominio del usuario,
 * accesos a practicarlo y navegación al anterior/siguiente.
 */
export function ElementDetail({ atomicNumber, onNavigate, showPager = true, titleAs = 'h2', className }: ElementDetailProps) {
  const element = ELEMENTS_BY_NUMBER[atomicNumber];
  if (!element) return null;
  const z = element.atomicNumber;

  return (
    <article aria-label={`Ficha de ${element.name}`} className={cn('flex flex-col gap-5', className)}>
      <Hero element={element} titleAs={titleAs} />
      <ElementFacts element={element} />
      <ElementNotes element={element} />
      <ElementLocation element={element} />
      <ElementMasteryPanel atomicNumber={z} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <ButtonLink href={`/practicar?elements=${z}`} block leftIcon={<BookOpenCheck aria-hidden />}>
          Practicar este elemento
        </ButtonLink>
        <ButtonLink href={`/flashcards?elements=${z}`} variant="secondary" block leftIcon={<Layers aria-hidden />}>
          Flashcards
        </ButtonLink>
      </div>
      {showPager && <ElementPager atomicNumber={z} onNavigate={onNavigate} />}
    </article>
  );
}
