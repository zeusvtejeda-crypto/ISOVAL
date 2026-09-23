'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { Confetti } from '@/components/gamification';
import { useImmersive } from '@/components/layout';
import { FeedbackPanel, isActivationTarget, LivesIndicator, QuestionCard, useQuizKeys } from '@/components/quiz';
import { Button, ProgressBar, cn, useReducedMotion } from '@/components/ui';
import { useSound } from '@/hooks/useSound';
import { GameHeader } from '../shared/GameHeader';
import { GameKeyframes } from '../shared/GameKeyframes';
import { BadgeRow } from './BadgeRow';
import { TRIVIA_CATEGORIES, TRIVIA_CATEGORY_BY_ID, type TriviaCategory } from './categories';
import { PreguntadosResults } from './PreguntadosResults';
import { RouletteWheel } from './RouletteWheel';
import {
  CROWN_XP,
  TRIVIA_MAX_MISTAKES,
  TRIVIA_SPINS,
  useTriviaGame,
  type TriviaGame,
} from './use-trivia-game';
import { wheelTickTimes } from './wheel-math';

function CategoryPill({ category, className }: { category: TriviaCategory; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-full px-4 text-base font-black shadow-card',
        category.solid,
        className,
      )}
    >
      <span aria-hidden>{category.emoji}</span>
      {category.label}
    </span>
  );
}

function WheelStage({ game, spinRef }: { game: TriviaGame; spinRef: RefObject<HTMLButtonElement | null> }) {
  const { phase } = game;
  const landed = phase === 'landed' && game.category ? TRIVIA_CATEGORY_BY_ID[game.category] : null;
  const missing = TRIVIA_CATEGORIES.length - game.badges.length;
  const spinNumber = phase === 'spin' ? game.spins + 1 : game.spins;

  let title = '¡Gira la ruleta!';
  if (phase === 'spinning') title = 'Girando…';
  if (landed) title = `¡${landed.label}!`;

  return (
    <section aria-labelledby="trivia-wheel-title" className="flex flex-1 flex-col items-center justify-center gap-5 py-4 sm:gap-6">
      <div className="text-center">
        <p className="text-sm font-black tracking-wide text-muted uppercase tabular">
          Giro {spinNumber} de {TRIVIA_SPINS}
        </p>
        <h2 id="trivia-wheel-title" className="mt-1 text-3xl font-black sm:text-4xl">
          <span key={title} className="inline-block animate-pop">
            {title}
          </span>
        </h2>
        <p className="mt-1 font-semibold text-muted">
          {missing > 0
            ? `Te ${missing === 1 ? 'falta 1 insignia' : `faltan ${missing} insignias`} para la 👑 Corona química.`
            : '¡Tienes las 6 insignias!'}
        </p>
      </div>

      <div className="relative w-[min(78vw,21rem)] pt-3">
        <RouletteWheel
          rotation={game.rotation}
          spinning={phase === 'spinning'}
          spinMs={game.spinMs}
          landed={landed?.id ?? null}
        />
        {landed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[-0.5rem] flex justify-center">
            <CategoryPill category={landed} className="h-12 px-5 text-lg shadow-float animate-bounce-in" />
          </div>
        )}
      </div>

      <span className={cn('inline-flex rounded-2xl', phase === 'spin' && 'animate-pulse-ring')}>
        <Button ref={spinRef} size="lg" onClick={game.spin} disabled={phase !== 'spin'} className="min-w-56">
          <span aria-hidden>🎡</span>
          {phase === 'spin' ? '¡Girar!' : phase === 'spinning' ? 'Girando…' : '¡A responder!'}
        </Button>
      </span>

      <p role="status" className="sr-only">
        {landed ? `La ruleta cayó en ${landed.label}.` : ''}
      </p>
    </section>
  );
}

/** Tras responder: la píldora de categoría anuncia la insignia (o la corona) sin mover la pregunta. */
function QuestionPill({ game, category }: { game: TriviaGame; category: TriviaCategory }) {
  if (game.phase !== 'feedback' || !game.newBadge) return <CategoryPill category={category} />;
  if (game.crown) {
    return (
      <p
        role="status"
        className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-xp-glow bg-xp-soft px-4 font-black text-xp shadow-card animate-bounce-in"
      >
        <span aria-hidden>👑</span>
        ¡Corona química! +{CROWN_XP} XP
      </p>
    );
  }
  return (
    <p
      role="status"
      className={cn('inline-flex h-10 items-center gap-2 rounded-full px-4 font-black shadow-card animate-bounce-in', category.solid)}
    >
      <span aria-hidden>🏅</span>
      ¡Insignia de {category.label}! {game.badges.length}/{TRIVIA_CATEGORIES.length}
    </p>
  );
}

/** Partida de Preguntados: ruleta, pregunta de la categoría, insignias y corona. */
export function PreguntadosPlay({ onExit }: { onExit: () => void }) {
  useImmersive();
  const game = useTriviaGame();
  const sound = useSound();
  const reducedMotion = useReducedMotion();
  const spinRef = useRef<HTMLButtonElement>(null);
  const { phase } = game;

  // Cada fase principal empieza arriba.
  useEffect(() => {
    if (phase === 'spin' || phase === 'question' || phase === 'finished') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [phase]);

  // De vuelta a la ruleta: foco en «¡Girar!» (Enter para girar).
  useEffect(() => {
    if (phase === 'spin') spinRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // «Clics» de la ruleta mientras gira.
  useEffect(() => {
    if (phase !== 'spinning' || reducedMotion) return;
    const ids = wheelTickTimes(game.spinMs).map((t) => window.setTimeout(() => sound.tick(), t));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [phase, reducedMotion, game.spinMs, sound]);

  // Enter o espacio también giran la ruleta (si el foco no está en otro botón).
  useQuizKeys((event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return false;
    if (isActivationTarget(event.target)) return false;
    game.spin();
    return true;
  }, phase === 'spin');

  if (phase === 'finished' && game.summary) {
    return <PreguntadosResults game={game} summary={game.summary} />;
  }

  const onWheel = phase === 'spin' || phase === 'spinning' || phase === 'landed';
  const question = game.question;
  const category = game.category ? TRIVIA_CATEGORY_BY_ID[game.category] : null;
  const last = phase === 'feedback' ? game.answered[game.answered.length - 1] : null;

  return (
    <div className="flex flex-1 flex-col">
      <GameKeyframes />
      <h1 className="sr-only">Preguntados</h1>
      <GameHeader
        onExit={onExit}
        confirmExit={game.answered.length > 0}
        center={
          <>
            <ProgressBar
              value={game.answered.length / TRIVIA_SPINS}
              size="lg"
              tone="xp"
              ariaLabel={`Giros: ${game.answered.length} de ${TRIVIA_SPINS}`}
            />
            <span className="shrink-0 text-sm font-black text-muted tabular">
              {game.answered.length}/{TRIVIA_SPINS}
            </span>
          </>
        }
        right={<LivesIndicator lives={TRIVIA_MAX_MISTAKES - game.mistakes} maxLives={TRIVIA_MAX_MISTAKES} />}
      />

      <BadgeRow badges={game.badges} fresh={game.newBadge} className="mt-2" />

      {onWheel || !question || !category ? (
        <WheelStage game={game} spinRef={spinRef} />
      ) : (
        <div key={question.id} className="flex flex-1 flex-col gap-4 pt-5 pb-6 animate-slide-up sm:pt-6">
          <div className="flex justify-center">
            <QuestionPill game={game} category={category} />
          </div>
          <QuestionCard
            question={question}
            selectedId={game.response}
            locked={phase !== 'question'}
            onAnswer={game.answer}
          />
        </div>
      )}

      {phase === 'feedback' && game.crown && <Confetti origin="center" pieces={170} />}

      {last && (
        <FeedbackPanel
          key={game.answered.length}
          correct={last.correct}
          xpGained={game.lastOutcome ? game.lastOutcome.xpGained : null}
          correctAnswer={last.question.correctAnswer}
          explanation={last.question.explanation}
          onContinue={game.next}
          continueLabel={game.willFinish ? 'Ver resultados' : 'Siguiente giro'}
        />
      )}
    </div>
  );
}
