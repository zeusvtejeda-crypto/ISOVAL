'use client';

import { ArrowRight, House, Layers, LayoutGrid, Target } from 'lucide-react';
import { Confetti } from '@/components/gamification';
import { ElementTile } from '@/components/periodic';
import { SummaryAchievements } from '@/components/quiz';
import { Button, ButtonLink, cn } from '@/components/ui';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ChemicalElement, SessionSummaryData } from '@/types';
import { pluralize } from '@/utils/format';
import { ElementChips } from './ElementChips';
import { flashcardsHref, practiceElementsHref } from './learn-source';
import { ResultStat, StreakLine, SummarySection } from './SummaryParts';
import { gridColsClass, joinNames } from './text';

export interface LearnCompleteProps {
  summary: SessionSummaryData;
  /** Los elementos aprendidos en esta lección. */
  elements: readonly number[];
  /** XP por aprenderlos (se suma a la de las preguntas). */
  learnXp: number;
  /** Elementos que quedan por aprender en el grupo. */
  remaining: number;
  onMore: () => void;
}

/** Celebración final de «Aprende 5»: los elementos aprendidos, XP, comprobación y siguientes pasos. */
export function LearnComplete({ summary, elements, learnXp, remaining, onMore }: LearnCompleteProps) {
  const list = elements.map((z) => ELEMENTS_BY_NUMBER[z]).filter((el): el is ChemicalElement => el !== undefined);
  const n = list.length;
  const xp = summary.xpGained + learnXp;
  const pct = summary.total > 0 ? Math.round((summary.correct / summary.total) * 100) : 0;

  return (
    <section aria-labelledby="learn-complete-title" className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-4 animate-fade-in">
      <Confetti pieces={140} />

      <header className="pt-2 text-center">
        <p aria-hidden className="text-6xl leading-none animate-bounce-in">
          🎉
        </p>
        <h1 id="learn-complete-title" className="mt-3 text-3xl leading-tight font-black sm:text-4xl">
          Aprendiste {n} {pluralize(n, 'elemento nuevo', 'elementos nuevos')}
        </h1>
        <p className="mt-1.5 font-semibold text-muted sm:text-lg">
          {pct >= 80 ? '¡Y los recuerdas genial!' : 'Buen comienzo: repásalos pronto para fijarlos.'}
        </p>
      </header>

      <div className="rounded-3xl border border-border bg-surface p-3 shadow-card sm:p-4">
        <ul
          aria-label="Elementos aprendidos"
          className={cn('mx-auto grid gap-2 sm:gap-3', gridColsClass(n))}
          style={{ maxWidth: `${n * 6}rem` }}
        >
          {list.map((el, i) => (
            <li
              key={el.atomicNumber}
              className="flex min-w-0 flex-col items-center gap-1 animate-bounce-in"
              style={{ animationDelay: `${150 + i * 90}ms` }}
            >
              <ElementTile element={el} fluid decorative />
              <span className="sr-only">{el.name}</span>
            </li>
          ))}
        </ul>
        <p aria-hidden className="mt-3 text-center text-sm font-bold text-muted sm:hidden">
          {joinNames(list.map((el) => el.name))}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ResultStat emoji="⚡" tone="xp" value={xp} prefix="+" suffix=" XP" label="experiencia" />
        <ResultStat
          emoji="✅"
          tone="success"
          value={pct}
          suffix="%"
          label={`${summary.correct} de ${summary.total} correctas`}
        />
      </div>

      <StreakLine />
      <SummaryAchievements ids={summary.unlockedAchievements} />

      {summary.toReview.length > 0 && (
        <SummarySection emoji="🔁" title="Dales otro repaso">
          <ElementChips atomicNumbers={summary.toReview} showNames tone="danger" label="Elementos que fallaste" />
        </SummarySection>
      )}

      <div className="mt-2 flex flex-col gap-2.5">
        {remaining > 0 ? (
          <Button size="lg" block rightIcon={<ArrowRight aria-hidden />} onClick={onMore}>
            Aprender {Math.min(5, remaining)} más
          </Button>
        ) : (
          <ButtonLink href="/bloques" size="lg" block leftIcon={<LayoutGrid aria-hidden />}>
            Elegir otro bloque
          </ButtonLink>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <ButtonLink href={practiceElementsHref(elements)} variant="secondary" block leftIcon={<Target aria-hidden />}>
            Practicar
          </ButtonLink>
          <ButtonLink href={flashcardsHref(elements)} variant="secondary" block leftIcon={<Layers aria-hidden />}>
            Flashcards
          </ButtonLink>
        </div>
        <ButtonLink href="/" variant="ghost" size="lg" block leftIcon={<House aria-hidden />}>
          Volver al inicio
        </ButtonLink>
      </div>
    </section>
  );
}
