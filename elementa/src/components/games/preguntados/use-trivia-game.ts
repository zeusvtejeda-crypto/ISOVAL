'use client';

import { useEffect, useRef, useState } from 'react';
import { buildSessionSummary, EMPTY_TALLY, tallyAnswer, type SessionTally } from '@/components/quiz/session-tally';
import { useAnswerRecorder } from '@/components/quiz/use-answer-recorder';
import { useReducedMotion } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { useSound } from '@/hooks/useSound';
import type { AnswerOutcome, AnsweredQuestion, Question, SessionSummaryData } from '@/types';
import { generateAdaptiveQuestion } from '@/utils/questions';
import { weightedSample } from '@/utils/random';
import { TRIVIA_CATEGORIES, TRIVIA_CATEGORY_BY_ID, categoryOfType, type TriviaCategoryId } from './categories';
import { WHEEL_TURNS, wheelTarget } from './wheel-math';

/** Giros por partida. */
export const TRIVIA_SPINS = 12;
/** Errores que terminan la partida. */
export const TRIVIA_MAX_MISTAKES = 3;
/** Bonus por reunir las 6 insignias. */
export const CROWN_XP = 50;

const SPIN_MS = 2400;
const REDUCED_SPIN_MS = 250;
const LANDED_MS = 900;
/** Elementos recientes que no se repiten. */
const RECENT_AVOID = 8;
/** Peso de las categorías sin insignia frente a las ya conseguidas (la ruleta «ayuda» un poco). */
const MISSING_WEIGHT = 3;

export type TriviaPhase = 'spin' | 'spinning' | 'landed' | 'question' | 'feedback' | 'finished';
export type TriviaEndReason = 'crown' | 'mistakes' | 'spins';

export interface TriviaState {
  phase: TriviaPhase;
  /** Giros hechos (incluido el actual). */
  spins: number;
  rotation: number;
  category: TriviaCategoryId | null;
  question: Question | null;
  response: string | null;
  answered: AnsweredQuestion[];
  correctCount: number;
  mistakes: number;
  badges: TriviaCategoryId[];
  /** Insignia ganada con la última respuesta. */
  newBadge: TriviaCategoryId | null;
  /** Corona química conseguida (termina la partida). */
  crown: boolean;
  lastOutcome: AnswerOutcome | null;
  /** Elementos respondidos, dominio antes/después y logros (para el resumen). */
  tally: SessionTally;
  endReason: TriviaEndReason | null;
  summary: SessionSummaryData | null;
}

export interface TriviaGame extends TriviaState {
  spinMs: number;
  /** Durante el feedback: `next()` mostrará los resultados. */
  willFinish: boolean;
  spin(): void;
  answer(optionId: string): void;
  next(): void;
  restart(): void;
}

const INITIAL: TriviaState = {
  phase: 'spin',
  spins: 0,
  rotation: 0,
  category: null,
  question: null,
  response: null,
  answered: [],
  correctCount: 0,
  mistakes: 0,
  badges: [],
  newBadge: null,
  crown: false,
  lastOutcome: null,
  tally: EMPTY_TALLY,
  endReason: null,
  summary: null,
};

function endReasonOf(game: TriviaState): TriviaEndReason | null {
  if (game.crown) return 'crown';
  if (game.mistakes >= TRIVIA_MAX_MISTAKES) return 'mistakes';
  if (game.spins >= TRIVIA_SPINS) return 'spins';
  return null;
}

function pickCategory(badges: readonly TriviaCategoryId[]): TriviaCategoryId {
  const ids = TRIVIA_CATEGORIES.map((c) => c.id);
  const weights = ids.map((id) => (badges.includes(id) ? 1 : MISSING_WEIGHT));
  return weightedSample(ids, weights, 1)[0];
}

/**
 * Motor del Modo Preguntados: ruleta → categoría → pregunta adaptativa de esa categoría →
 * feedback → siguiente giro. Una insignia por categoría acertada; 12 giros o 3 errores;
 * las 6 insignias dan la Corona química (+50 XP). Registra cada respuesta y la sesión.
 */
export function useTriviaGame(): TriviaGame {
  const { state, completeSession, addXp } = useProgress();
  const recorder = useAnswerRecorder('trivia');
  const sound = useSound();
  const reducedMotion = useReducedMotion();
  const spinMs = reducedMotion ? REDUCED_SPIN_MS : SPIN_MS;

  const [game, setGame] = useState<TriviaState>(INITIAL);
  const startedAt = useRef<number | null>(null);
  const shownAt = useRef(0);
  /** Evita cerrar la partida dos veces (doble clic en «Ver resultados»). */
  const ended = useRef(false);

  // Ruleta girando → cae en la categoría → aparece la pregunta.
  useEffect(() => {
    if (game.phase === 'spinning') {
      const id = window.setTimeout(() => setGame((g) => (g.phase === 'spinning' ? { ...g, phase: 'landed' } : g)), spinMs);
      return () => window.clearTimeout(id);
    }
    if (game.phase === 'landed') {
      const id = window.setTimeout(() => setGame((g) => (g.phase === 'landed' ? { ...g, phase: 'question' } : g)), LANDED_MS);
      return () => window.clearTimeout(id);
    }
    // El tiempo de respuesta cuenta desde que se ve la pregunta.
    if (game.phase === 'question') shownAt.current = performance.now();
  }, [game.phase, spinMs]);

  const spin = () => {
    if (game.phase !== 'spin' || endReasonOf(game) !== null) return;
    if (startedAt.current === null) startedAt.current = performance.now();
    const picked = pickCategory(game.badges);
    const recent = game.answered.slice(-RECENT_AVOID).map((a) => a.question.atomicNumber);
    const question = generateAdaptiveQuestion(state, new Date(), {
      types: TRIVIA_CATEGORY_BY_ID[picked].types,
      exclude: recent,
    });
    // La ruleta cae siempre en la categoría real de la pregunta.
    const category = categoryOfType(question.type) ?? picked;
    setGame({
      ...game,
      phase: 'spinning',
      spins: game.spins + 1,
      rotation: wheelTarget(game.rotation, category, Math.random() - 0.5, WHEEL_TURNS),
      category,
      question,
      response: null,
      newBadge: null,
      lastOutcome: null,
    });
  };

  const answer = (optionId: string) => {
    const q = game.question;
    const category = game.category;
    if (game.phase !== 'question' || !q || !category) return;
    const result = recorder.submit(q, optionId, { responseMs: Math.max(0, Math.round(performance.now() - shownAt.current)) });
    if (!result) return;

    const { correct, outcome, entry } = result;
    const newBadge = correct && !game.badges.includes(category) ? category : null;
    const badges = newBadge ? [...game.badges, newBadge] : game.badges;
    const crownNow = !game.crown && badges.length === TRIVIA_CATEGORIES.length;
    if (crownNow) {
      addXp(CROWN_XP);
      window.setTimeout(() => sound.levelUp(), 350);
    }

    setGame({
      ...game,
      phase: 'feedback',
      response: optionId,
      answered: [...game.answered, entry],
      correctCount: game.correctCount + (correct ? 1 : 0),
      mistakes: game.mistakes + (correct ? 0 : 1),
      badges,
      newBadge,
      crown: game.crown || crownNow,
      lastOutcome: outcome,
      tally: tallyAnswer(game.tally, result, outcome),
    });
  };

  const finish = (reason: TriviaEndReason) => {
    if (ended.current) return;
    ended.current = true;
    const total = game.answered.length;
    const durationMs = startedAt.current === null ? 0 : Math.max(0, Math.round(performance.now() - startedAt.current));
    const session = total > 0 ? completeSession({ mode: 'trivia', total, correct: game.correctCount, durationMs }) : null;
    const summary = buildSessionSummary({
      mode: 'trivia',
      title: 'Preguntados',
      answered: game.answered,
      tally: game.tally,
      durationMs,
      extraXp: (game.crown ? CROWN_XP : 0) + (session?.xpGained ?? 0),
      unlocked: session?.unlockedAchievements ?? [],
    });
    setGame({ ...game, phase: 'finished', endReason: reason, summary });
  };

  const next = () => {
    if (game.phase !== 'feedback') return;
    const reason = endReasonOf(game);
    if (reason) {
      finish(reason);
      return;
    }
    setGame({ ...game, phase: 'spin', category: null, question: null, response: null, newBadge: null });
  };

  const restart = () => {
    startedAt.current = null;
    recorder.reset();
    ended.current = false;
    setGame(INITIAL);
  };

  return {
    ...game,
    spinMs,
    willFinish: game.phase === 'feedback' && endReasonOf(game) !== null,
    spin,
    answer,
    next,
    restart,
  };
}
