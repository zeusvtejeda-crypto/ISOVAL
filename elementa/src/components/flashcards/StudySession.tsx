'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { isActivationTarget, useQuizKeys } from '@/components/quiz/use-quiz-keys';
import { Button, cn, useReducedMotion } from '@/components/ui';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import { useHaptics } from '@/hooks/useHaptics';
import { useProgress } from '@/hooks/useProgress';
import { useSound } from '@/hooks/useSound';
import type { FlashcardRating } from '@/types';
import { Flashcard } from './Flashcard';
import { getFlashcardMode } from './modes';
import { createQueue, requeue, type QueueCard } from './queue';
import { ratingFromKey } from './ratings';
import { RatingButtons } from './RatingButtons';
import {
  difficultCards,
  improvedCards,
  knownCount,
  ratingCounts,
  type FlashcardSessionResult,
  type ReviewRecord,
  type StudyDeck,
} from './session';
import { StudyHeader } from './StudyHeader';
import { useCardSwipe } from './use-card-swipe';

export interface StudySessionProps {
  deck: StudyDeck;
  onFinish: (result: FlashcardSessionResult) => void;
  /** Salir sin terminar (vuelve a la configuración). */
  onExit: () => void;
}

interface RunState {
  queue: readonly QueueCard[];
  index: number;
  flipped: boolean;
  /** La respuesta ya se vio al menos una vez (se muestran las calificaciones). */
  revealed: boolean;
  /** Calificación recién dada: la tarjeta hace su animación de salida. */
  leaving: FlashcardRating | null;
  reviews: ReviewRecord[];
  xp: number;
  masteryStart: Record<number, number>;
  masteryEnd: Record<number, number>;
  unlocked: string[];
}

/** Duración de la animación de salida de la tarjeta antes de pasar a la siguiente. */
const LEAVE_MS = 320;

const LEAVE_ANIMATION: Record<FlashcardRating, string> = {
  again: 'animate-shake',
  hard: 'animate-pop',
  good: 'animate-pop',
  easy: 'animate-pop',
};

const LEAVE_GLOW: Record<FlashcardRating, string> = {
  again: 'ring-4 ring-danger/50',
  hard: 'ring-4 ring-warning/50',
  good: 'ring-4 ring-success/50',
  easy: 'ring-4 ring-brand/50',
};

/** Sello que aparece al deslizar: «Lo sabía» (derecha) o «No lo sabía» (izquierda). */
function SwipeStamp({ progress }: { progress: number }) {
  if (progress === 0) return null;
  const right = progress > 0;
  return (
    <span
      aria-hidden
      style={{ opacity: Math.min(1, Math.abs(progress) * 1.15) }}
      className={cn(
        'pointer-events-none absolute top-5 z-10 rounded-2xl border-[3px] px-3 py-1.5 text-lg font-black uppercase shadow-card',
        right
          ? 'left-5 -rotate-12 border-success bg-success-soft text-success'
          : 'right-5 rotate-12 border-danger bg-danger-soft text-danger',
      )}
    >
      {right ? '✅ Lo sabía' : '❌ No lo sabía'}
    </span>
  );
}

function initialRun(deck: StudyDeck): RunState {
  return {
    queue: createQueue(deck.elements),
    index: 0,
    flipped: false,
    revealed: false,
    leaving: null,
    reviews: [],
    xp: 0,
    masteryStart: {},
    masteryEnd: {},
    unlocked: [],
  };
}

/**
 * Pantalla de estudio: una tarjeta cada vez; se gira (toque, Espacio o Enter), el usuario se
 * califica (1–4) y cada calificación se guarda con `rateFlashcard`. Las tarjetas «No lo sabía»
 * y «Casi» vuelven a salir más adelante. Al terminar llama a `completeSession` y entrega el resultado.
 */
export function StudySession({ deck, onFinish, onExit }: StudySessionProps) {
  const { rateFlashcard, completeSession } = useProgress();
  const sound = useSound();
  const haptics = useHaptics();
  const reducedMotion = useReducedMotion();
  const mode = getFlashcardMode(deck.modeId);

  const [run, setRun] = useState<RunState>(() => initialRun(deck));
  const card = run.queue[run.index];
  const element = card ? ELEMENTS_BY_NUMBER[card.atomicNumber] : undefined;

  const baseId = useId();
  const frontId = `${baseId}-front`;
  const answerId = `${baseId}-answer`;

  const startedAt = useRef(0);
  const shownAt = useRef(0);
  const responseMs = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const finished = useRef(false);
  const showButtonRef = useRef<HTMLButtonElement>(null);
  const ratingRef = useRef<HTMLDivElement>(null);

  // Inicio de la sesión y limpieza del temporizador de salida.
  useEffect(() => {
    startedAt.current = performance.now();
    return () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    };
  }, []);

  // Cada tarjeta nueva: empieza el cronómetro y, si el foco se perdió, vuelve a «Mostrar respuesta».
  const cardKey = card?.key ?? null;
  useEffect(() => {
    if (cardKey === null) return;
    shownAt.current = performance.now();
    responseMs.current = null;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (document.activeElement === document.body || document.activeElement === null) {
      showButtonRef.current?.focus({ preventScroll: true });
    }
  }, [cardKey]);

  // Al descubrir la respuesta, el foco pasa a las calificaciones (anuncia la respuesta).
  useEffect(() => {
    if (!run.revealed) return;
    if (document.activeElement === document.body || document.activeElement === null) {
      ratingRef.current?.focus({ preventScroll: true });
    }
  }, [run.revealed, cardKey]);

  const flip = () => {
    if (run.leaving) return;
    if (responseMs.current === null) {
      responseMs.current = Math.max(0, Math.round(performance.now() - shownAt.current));
    }
    setRun((r) => ({ ...r, flipped: !r.flipped, revealed: true }));
  };

  const finish = (state: RunState) => {
    if (finished.current) return;
    finished.current = true;
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt.current));
    const counts = ratingCounts(state.reviews);
    const session = completeSession({
      mode: 'flashcards',
      total: state.reviews.length,
      correct: knownCount(counts),
      durationMs,
    });
    onFinish({
      deck,
      reviews: state.reviews,
      counts,
      xpGained: state.xp + session.xpGained,
      durationMs,
      improved: improvedCards(state.reviews, state.masteryStart, state.masteryEnd),
      difficult: difficultCards(state.reviews),
      unlockedAchievements: Array.from(new Set([...state.unlocked, ...session.unlockedAchievements])),
    });
  };

  const advance = (state: RunState) => {
    leaveTimer.current = null;
    const nextIndex = state.index + 1;
    if (nextIndex >= state.queue.length) {
      finish(state);
      return;
    }
    setRun({ ...state, index: nextIndex, flipped: false, revealed: false, leaving: null });
  };

  const rate = (rating: FlashcardRating) => {
    if (!card || !run.revealed || run.leaving || finished.current) return;
    const ms = responseMs.current ?? Math.max(0, Math.round(performance.now() - shownAt.current));
    const z = card.atomicNumber;
    const outcome = rateFlashcard({ atomicNumber: z, skill: mode.skill, rating, responseMs: ms });

    if (rating === 'again') {
      sound.wrong();
      haptics.error();
    } else if (rating !== 'hard') {
      sound.correct();
      haptics.success();
    }

    const next: RunState = {
      ...run,
      queue: requeue(run.queue, run.index, rating),
      leaving: rating,
      reviews: [...run.reviews, { key: card.key, atomicNumber: z, rating, responseMs: ms, xp: outcome.xpGained }],
      xp: run.xp + outcome.xpGained,
      masteryStart: z in run.masteryStart ? run.masteryStart : { ...run.masteryStart, [z]: outcome.masteryBefore },
      masteryEnd: { ...run.masteryEnd, [z]: outcome.masteryAfter },
      unlocked: outcome.unlockedAchievements.length > 0 ? [...run.unlocked, ...outcome.unlockedAchievements] : run.unlocked,
    };
    setRun(next);
    if (reducedMotion) advance(next);
    else leaveTimer.current = window.setTimeout(() => advance(next), LEAVE_MS);
  };

  const swipe = useCardSwipe({
    cardKey,
    enabled: run.revealed && run.leaving === null,
    onSwipe: (direction) => rate(direction === 'right' ? 'good' : 'again'),
  });

  useQuizKeys((event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      // Un botón con foco se activa solo (evita girar dos veces).
      if (isActivationTarget(event.target)) return;
      flip();
      return true;
    }
    const rating = ratingFromKey(event.key);
    if (rating && run.revealed) {
      rate(rating);
      return true;
    }
  }, run.leaving === null);

  if (!card || !element) return null;

  const done = run.reviews.length;
  const total = run.queue.length;
  const remaining = total - done;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="sr-only">
        Flashcards: {mode.title} · {deck.title}
      </h1>
      <StudyHeader done={done} total={total} xp={run.xp} onExit={onExit} confirmExit={done > 0} />

      <div className="mt-2 flex items-center justify-between gap-3 text-sm font-bold text-muted">
        <p className="flex min-w-0 items-center gap-1.5 truncate">
          <span aria-hidden>{mode.emoji}</span>
          <span className="truncate">{mode.title}</span>
        </p>
        <p className="shrink-0 tabular" aria-live="polite">
          {remaining === 1 ? 'Última tarjeta' : `Quedan ${remaining}`}
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center py-4 sm:py-6 [@media(max-height:700px)]:py-2">
        <div key={card.key} className="relative" style={swipe.style} {...swipe.handlers}>
          <SwipeStamp progress={swipe.progress} />
          <div
            className={cn(
              'rounded-[2rem] transition-shadow duration-200',
              run.leaving ? `${LEAVE_ANIMATION[run.leaving]} ${LEAVE_GLOW[run.leaving]}` : 'animate-zoom-in',
            )}
          >
            <Flashcard
              element={element}
              mode={mode}
              flipped={run.flipped}
              onFlip={flip}
              repeat={card.pass > 0}
              frontId={frontId}
              answerId={answerId}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 flex min-h-[8.5rem] flex-col justify-end bg-bg/90 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:min-h-[8rem] sm:px-6 [@media(max-height:700px)]:min-h-0">
        {run.revealed ? (
          <>
            <RatingButtons
              key={card.key}
              groupRef={ratingRef}
              onRate={rate}
              selected={run.leaving}
              describedBy={answerId}
            />
            <p aria-hidden className="mt-2 hidden text-center text-xs font-bold text-muted pointer-coarse:[@media(min-height:701px)]:block">
              Desliza la tarjeta: → Lo sabía · ← No lo sabía
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Button
              ref={showButtonRef}
              size="lg"
              block
              leftIcon={<Eye aria-hidden />}
              onClick={flip}
              aria-describedby={frontId}
              aria-keyshortcuts="Space Enter"
            >
              Mostrar respuesta
            </Button>
            <p className="hidden text-xs font-bold text-muted sm:block">
              Pulsa <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 font-sans">Espacio</kbd> para girar y{' '}
              <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 font-sans">1</kbd>–
              <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 font-sans">4</kbd> para calificarte
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
