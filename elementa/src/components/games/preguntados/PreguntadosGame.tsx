'use client';

import { cn } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { GameFlow } from '../shared/GameFlow';
import { GameIntro } from '../shared/GameIntro';
import { TRIVIA_CATEGORIES } from './categories';
import { PreguntadosPlay } from './PreguntadosPlay';
import { RouletteWheel } from './RouletteWheel';
import { CROWN_XP, TRIVIA_MAX_MISTAKES, TRIVIA_SPINS } from './use-trivia-game';

function CategoryGuide() {
  return (
    <section aria-labelledby="trivia-categories">
      <h2 id="trivia-categories" className="text-xl font-black">
        Las 6 categorías
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {TRIVIA_CATEGORIES.map((cat, i) => (
          <li
            key={cat.id}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface p-3 text-center shadow-card animate-slide-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span aria-hidden className={cn('grid size-11 shrink-0 place-items-center rounded-full text-2xl leading-none', cat.solid)}>
              {cat.emoji}
            </span>
            <span className="block leading-tight font-black">{cat.label}</span>
            <span className="block text-xs leading-snug font-semibold text-muted">{cat.hint}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreguntadosIntro({ onPlay }: { onPlay: () => void }) {
  const { ready } = useProgress();
  return (
    <GameIntro
      title="Preguntados"
      emoji="🎡"
      tone="xp"
      tagline="Gira la ruleta y conquista las 6 categorías."
      ready={ready}
      onPlay={onPlay}
      visual={
        <div className="mx-auto w-48 pt-3 sm:w-56">
          <RouletteWheel rotation={-30} idle />
        </div>
      }
      rules={[
        { icon: '🎡', title: 'Gira la ruleta', text: 'Ella elige la categoría de tu pregunta.' },
        { icon: '🏅', title: 'Acierta y gana su insignia', text: 'Una insignia por cada categoría.' },
        { icon: '👑', title: 'Reúne las 6 insignias', text: `Gana la Corona química: +${CROWN_XP} XP.` },
        {
          icon: '❤️',
          title: `${TRIVIA_SPINS} giros, ${TRIVIA_MAX_MISTAKES} errores`,
          text: 'La partida acaba con lo que llegue primero.',
        },
      ]}
    >
      <CategoryGuide />
    </GameIntro>
  );
}

/** «/preguntados»: trivia con ruleta de categorías, insignias y corona. */
export function PreguntadosGame() {
  return (
    <GameFlow
      renderIntro={(play) => <PreguntadosIntro onPlay={play} />}
      renderPlay={(exit) => <PreguntadosPlay onExit={exit} />}
    />
  );
}
