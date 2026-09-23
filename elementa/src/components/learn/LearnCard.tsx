import type { ReactNode, Ref } from 'react';
import { ElementLocation } from '@/components/periodic/ElementLocation';
import { cn } from '@/components/ui';
import { CATEGORIES, PHASE_EMOJI } from '@/data/categories';
import type { ChemicalElement } from '@/types';
import { elementPhaseLabel, formatMass } from '@/utils/format';

export type LearnCardVariant = 'full' | 'quick';

export interface LearnCardProps {
  element: ChemicalElement;
  /** `full` (Aprende 5): todo, con ubicación y dato curioso · `quick` (Estudiar ahora): lo esencial. */
  variant?: LearnCardVariant;
  /** Encabezado con el nombre (recibe el foco al cambiar de elemento). */
  headingRef?: Ref<HTMLHeadingElement>;
  className?: string;
}

/** Casilla grande "26 · Fe · Hierro" con el color de la familia. */
function BigTile({ element }: { element: ChemicalElement }) {
  const category = CATEGORIES[element.category];
  return (
    <div
      aria-hidden
      className={cn(
        'relative grid size-36 shrink-0 place-items-center rounded-[2rem] border-[3px] shadow-float animate-bounce-in sm:size-40',
        category.tileClass,
      )}
    >
      <span className="absolute top-3 left-4 text-lg leading-none font-black tabular opacity-85">
        {element.atomicNumber}
      </span>
      <span className="-mt-1 text-6xl leading-none font-black tracking-tight sm:text-7xl">{element.symbol}</span>
      <span className="absolute inset-x-2 bottom-3.5 truncate text-center text-sm leading-none font-extrabold">
        {element.name}
      </span>
    </div>
  );
}

function positionText(el: ChemicalElement): string {
  return el.group === null ? `Bloque f · Periodo ${el.period}` : `Grupo ${el.group} · Periodo ${el.period}`;
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-2xl bg-surface-2 px-3.5 py-2.5', className)}>
      <dt className="text-xs font-extrabold text-muted">{label}</dt>
      <dd className="mt-0.5 text-base leading-snug font-black break-words tabular sm:text-lg">{children}</dd>
    </div>
  );
}

interface NoteProps {
  emoji: string;
  title: string;
  children: ReactNode;
  className: string;
}

function Note({ emoji, title, children, className }: NoteProps) {
  return (
    <section className={cn('rounded-2xl px-4 py-3.5', className)}>
      <h3 className="flex items-center gap-2 text-sm font-black">
        <span aria-hidden className="text-lg leading-none">
          {emoji}
        </span>
        {title}
      </h3>
      <p className="mt-1 leading-relaxed font-semibold">{children}</p>
    </section>
  );
}

/**
 * Tarjeta para conocer un elemento: casilla grande, datos clave, truco para recordarlo,
 * origen del símbolo y (en `full`) dato curioso y ubicación en una mini tabla.
 */
export function LearnCard({ element, variant = 'full', headingRef, className }: LearnCardProps) {
  const category = CATEGORIES[element.category];
  const full = variant === 'full';
  const memoryTip = element.memoryTip.trim();
  const etymology = element.etymology.trim();
  const funFact = element.funFact.trim();

  return (
    <article aria-labelledby={`learn-${element.atomicNumber}`} className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-5 text-center shadow-card sm:flex-row sm:gap-6 sm:text-left">
        <BigTile element={element} />
        <div className="min-w-0">
          <h2
            id={`learn-${element.atomicNumber}`}
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl leading-tight font-black break-words outline-none sm:text-4xl"
          >
            {element.name}
          </h2>
          <p className="mt-1 font-bold text-muted">
            Símbolo <span className="font-black text-fg">{element.symbol}</span> · N.º{' '}
            <span className="font-black text-fg tabular">{element.atomicNumber}</span>
          </p>
          <span
            className={cn(
              'mt-2.5 inline-flex min-h-8 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-extrabold',
              category.tileClass,
            )}
          >
            <span aria-hidden>{category.emoji}</span>
            {category.singular}
          </span>
          {full && element.description && (
            <p className="mt-3 text-sm leading-relaxed font-semibold text-muted sm:text-base">{element.description}</p>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Número atómico">{element.atomicNumber}</Fact>
        <Fact label="Masa atómica">{formatMass(element)} u</Fact>
        <Fact label="Posición">
          <span className="text-sm sm:text-base">{positionText(element)}</span>
        </Fact>
        <Fact label={element.phase === 'unknown' ? 'Estado' : 'Estado a 25 °C'}>
          <span className="inline-flex items-center gap-1 text-sm sm:text-base">
            <span aria-hidden>{PHASE_EMOJI[element.phase]}</span>
            {elementPhaseLabel(element)}
          </span>
        </Fact>
      </dl>

      {memoryTip && (
        <Note emoji="🧠" title="Truco" className="bg-brand-soft">
          {memoryTip}
        </Note>
      )}
      {etymology && (
        <Note emoji="📜" title={`¿Por qué ${element.symbol}?`} className="bg-surface-2">
          {etymology}
        </Note>
      )}
      {full && funFact && (
        <Note emoji="💡" title="Dato curioso" className="bg-xp-soft">
          {funFact}
        </Note>
      )}
      {full && <ElementLocation element={element} className="rounded-3xl border border-border bg-surface p-4 shadow-card" />}
    </article>
  );
}
