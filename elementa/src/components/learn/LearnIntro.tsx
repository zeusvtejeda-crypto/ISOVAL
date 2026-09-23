import { ArrowRight, LayoutGrid } from 'lucide-react';
import { ElementTile } from '@/components/periodic';
import { Button, ButtonLink, ProgressBar, cn } from '@/components/ui';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ChemicalElement } from '@/types';
import { pluralize } from '@/utils/format';
import type { LearnSource } from './learn-source';
import { gridColsClass } from './text';

export interface LearnIntroProps {
  source: LearnSource;
  /** Los elementos que se van a aprender. */
  elements: readonly number[];
  /** Aprendidos del grupo (para bloques y familias). */
  learnedInPool: number;
  onStart: () => void;
}

const STEPS = [
  { emoji: '👀', title: 'Conoce', text: 'Uno por uno, con trucos para recordarlos.' },
  { emoji: '✅', title: 'Comprueba', text: '2 preguntas rápidas de cada uno.' },
  { emoji: '⚡', title: 'Gana XP', text: '+5 XP por elemento y más por acierto.' },
] as const;

/** Portada de «Aprende 5»: qué elementos vas a conocer, cómo funciona y «Empezar». */
export function LearnIntro({ source, elements, learnedInPool, onStart }: LearnIntroProps) {
  const list = elements.map((z) => ELEMENTS_BY_NUMBER[z]).filter((el): el is ChemicalElement => el !== undefined);
  const n = list.length;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 animate-fade-in">
      {source.invalid && (
        <p role="status" className="rounded-2xl bg-warning-soft px-4 py-3 text-sm font-bold">
          No encontramos ese bloque o familia: te mostramos los siguientes elementos de la tabla.
        </p>
      )}

      <section aria-labelledby="learn-intro-title" className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-extrabold">
          <span aria-hidden>{source.emoji}</span>
          {source.label}
        </span>
        <h2 id="learn-intro-title" className="mt-3 text-2xl leading-tight font-black sm:text-3xl">
          Aprende {n} {pluralize(n, 'elemento nuevo', 'elementos nuevos')} hoy
        </h2>
        <p className="mt-1 font-semibold text-muted">Hoy conocerás a:</p>

        <ul className={cn('mx-auto mt-3 grid gap-2', gridColsClass(n))} style={{ maxWidth: `${n * 5.5}rem` }}>
          {list.map((el, i) => (
            <li
              key={el.atomicNumber}
              className="flex min-w-0 flex-col items-center gap-1 animate-pop"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <ElementTile element={el} fluid decorative />
              <span className="sr-only text-center text-xs font-bold sm:not-sr-only sm:w-full sm:truncate">{el.name}</span>
            </li>
          ))}
        </ul>

        {source.kind !== 'all' && (
          <ProgressBar
            className="mt-5"
            value={source.pool.length > 0 ? learnedInPool / source.pool.length : 0}
            tone="success"
            label="Aprendidos en este grupo"
            showValue
            valueText={`${learnedInPool} / ${source.pool.length}`}
          />
        )}
      </section>

      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 sm:flex-col sm:items-start">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-xl shadow-card">
              {step.emoji}
            </span>
            <div className="min-w-0">
              <p className="font-black">
                <span className="sr-only">Paso {i + 1}: </span>
                {step.title}
              </p>
              <p className="text-sm font-semibold text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <Button size="lg" block rightIcon={<ArrowRight aria-hidden />} onClick={onStart}>
        Empezar
      </Button>
      <ButtonLink href="/bloques" variant="ghost" block leftIcon={<LayoutGrid aria-hidden />}>
        {source.kind === 'all' ? 'Elegir un bloque o familia' : 'Cambiar de bloque o familia'}
      </ButtonLink>
    </div>
  );
}
