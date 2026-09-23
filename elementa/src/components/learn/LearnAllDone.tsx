'use client';

import { House, Layers, LayoutGrid, Target } from 'lucide-react';
import { Confetti } from '@/components/gamification';
import { ButtonLink } from '@/components/ui';
import { flashcardsHref, practiceHref, type LearnSource } from './learn-source';

function title(source: LearnSource): string {
  if (source.kind === 'block') return `¡Ya aprendiste todo el ${source.label.split(' · ')[0]}!`;
  if (source.kind === 'family') return `¡Ya aprendiste los ${source.label.toLowerCase()}!`;
  return '¡Ya aprendiste los 118 elementos!';
}

/** Todos los elementos del grupo ya están aprendidos: celebrar y proponer práctica. */
export function LearnAllDone({ source }: { source: LearnSource }) {
  return (
    <section aria-labelledby="learn-done-title" className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-6 text-center animate-fade-in">
      <Confetti pieces={90} />
      <div
        aria-hidden
        className="grid size-24 place-items-center rounded-[2rem] bg-success-soft text-5xl shadow-card animate-bounce-in"
      >
        🏆
      </div>
      <div>
        <h2 id="learn-done-title" className="text-2xl leading-tight font-black sm:text-3xl">
          {title(source)}
        </h2>
        <p className="mt-2 font-semibold text-muted sm:text-lg">
          No quedan elementos nuevos aquí. Ahora toca reforzarlos para dominarlos 💪
        </p>
      </div>

      <div className="mt-2 flex w-full flex-col gap-2.5">
        <ButtonLink href={practiceHref(source)} size="lg" block leftIcon={<Target aria-hidden />}>
          Practicar
        </ButtonLink>
        <ButtonLink href={flashcardsHref(source.pool)} variant="secondary" size="lg" block leftIcon={<Layers aria-hidden />}>
          Repasar con flashcards
        </ButtonLink>
        {source.kind !== 'all' ? (
          <ButtonLink href="/bloques" variant="ghost" size="lg" block leftIcon={<LayoutGrid aria-hidden />}>
            Elegir otro bloque o familia
          </ButtonLink>
        ) : (
          <ButtonLink href="/" variant="ghost" size="lg" block leftIcon={<House aria-hidden />}>
            Volver al inicio
          </ButtonLink>
        )}
      </div>
    </section>
  );
}
