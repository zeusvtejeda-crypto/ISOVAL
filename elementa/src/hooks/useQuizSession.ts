'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  buildSessionSummary,
  EMPTY_TALLY,
  tallyAnswer,
  type AnswerResponse,
  type SessionTally,
} from '@/components/quiz/session-tally';
import { useAnswerRecorder } from '@/components/quiz/use-answer-recorder';
import type { AnswerOutcome, AnsweredQuestion, GameMode, Question, SessionSummaryData } from '@/types';
import { useCountdown } from './useCountdown';
import { useHydrated } from './useHydrated';
import { useProgress } from './useProgress';
import { useResponseTimer } from './useResponseTimer';

// ---------------------------------------------------------------------------------------------
// Contrato
// ---------------------------------------------------------------------------------------------

export interface QuizQuestionContext {
  /** Índice (0-based) de la pregunta que se va a mostrar. */
  index: number;
  /** Racha de aciertos actual en la sesión. */
  streak: number;
  /** Aciertos de la sesión hasta ahora. */
  correctCount: number;
  /** Números atómicos ya preguntados, del más antiguo al más reciente. */
  asked: number[];
}

export interface QuizXpContext {
  correct: boolean;
  /** Racha de la sesión TRAS esta respuesta (1 = primer acierto; 0 si falló). */
  streak: number;
  question: Question;
}

/**
 * XP de un acierto con su desglose para el feedback (p. ej. Modo Racha: "+15 XP · x1.5" y
 * "+25 XP de bonus"). `xp` es el total otorgado (multiplicado + bonus).
 */
export interface XpAward {
  xp: number;
  /** Multiplicador aplicado (se muestra aparte: "x1.5"). Por defecto 1. */
  multiplier?: number;
  /** Parte de `xp` que es bonus por hito. Por defecto 0. */
  bonus?: number;
}

/** Desglose de la XP de la última respuesta (solo si `xpFor` devolvió un `XpAward`). */
export interface XpDetail {
  multiplier: number;
  bonus: number;
}

export type QuizEndReason = 'completed' | 'lives' | 'time' | 'manual';

export interface QuizFinishContext {
  reason: QuizEndReason;
  answered: AnsweredQuestion[];
  correct: number;
  total: number;
  bestStreak: number;
  durationMs: number;
}

export interface QuizConfig {
  mode: GameMode;
  title: string;
  /**
   * Conjunto fijo (examen, diagnóstico). Admite una función para generarlo en el cliente
   * al empezar y en cada `restart()`.
   */
  questions?: Question[] | (() => Question[]);
  /** Modos infinitos: genera la siguiente pregunta. */
  nextQuestion?: (ctx: QuizQuestionContext) => Question;
  /** Vidas (supervivencia: 3). Sin él, ilimitadas. */
  lives?: number;
  /** Límite global de tiempo (contrarreloj: 60_000). */
  timeLimitMs?: number;
  /**
   * XP a otorgar en lugar de la regla por defecto (p. ej. Modo Racha). Con un `XpAward`, el
   * multiplicador y el bonus se muestran por separado en el feedback (`lastXp`).
   */
  xpFor?: (ctx: QuizXpContext) => number | XpAward | undefined;
  /** Avanza solo tras responder, sin pulsar "Continuar". */
  autoAdvanceMs?: number;
  /** Registrar respuestas y sesión en el progreso. Por defecto `true`. */
  record?: boolean;
  /**
   * Al terminar (una vez, antes de construir el resumen): p. ej. guardar un récord.
   * Lo que devuelva se mezcla en el resumen (`newRecord`, `title`; `unlockedAchievements` se suma
   * a los de la sesión, p. ej. los que desbloquea `submitRecord`).
   */
  onFinish?: (
    ctx: QuizFinishContext,
  ) => Partial<Pick<SessionSummaryData, 'newRecord' | 'title' | 'unlockedAchievements'>> | void;
}

/** Id de opción (opción múltiple) o números atómicos elegidos (preguntas de tabla). */
export type QuizResponse = AnswerResponse;

export type QuizStatus = 'playing' | 'feedback' | 'finished';

export interface QuizSession {
  /** `false` hasta generar la primera pregunta (en el cliente, con el progreso cargado). */
  ready: boolean;
  status: QuizStatus;
  mode: GameMode;
  title: string;
  current: Question | null;
  /** Índice 0-based de la pregunta actual. */
  index: number;
  /** Nº de preguntas del conjunto fijo; `null` si es infinito. */
  total: number | null;
  /** Vidas restantes; `null` si son ilimitadas. */
  lives: number | null;
  maxLives: number | null;
  streak: number;
  bestStreak: number;
  correctCount: number;
  answered: AnsweredQuestion[];
  /** Tiempo global restante; `null` sin límite de tiempo. */
  remainingMs: number | null;
  timeLimitMs: number | null;
  autoAdvanceMs: number | null;
  lastOutcome: AnswerOutcome | null;
  lastAnswer: AnsweredQuestion | null;
  /** Desglose de la XP de la última respuesta (multiplicador y bonus), si el modo lo da. */
  lastXp: XpDetail | null;
  /** Respuesta dada a la pregunta actual (durante el feedback). */
  response: QuizResponse | null;
  /** `true` durante el feedback si `next()` terminará la sesión. */
  willFinish: boolean;
  answer(response: QuizResponse): void;
  next(): void;
  finish(): void;
  restart(): void;
  summary: SessionSummaryData | null;
}

// ---------------------------------------------------------------------------------------------
// Estado interno y funciones puras
// ---------------------------------------------------------------------------------------------

interface RunState {
  runId: number;
  fixed: boolean;
  status: QuizStatus;
  /** Conjunto fijo completo, o preguntas generadas hasta ahora (modos infinitos). */
  queue: Question[];
  index: number;
  lives: number | null;
  streak: number;
  bestStreak: number;
  correctCount: number;
  answered: AnsweredQuestion[];
  lastOutcome: AnswerOutcome | null;
  lastAnswer: AnsweredQuestion | null;
  lastXp: XpDetail | null;
  response: QuizResponse | null;
  /** Elementos respondidos (atribuidos), dominio antes/después y logros. */
  tally: SessionTally;
  summary: SessionSummaryData | null;
}

interface Handlers {
  answer(response: QuizResponse): void;
  next(): void;
  end(reason: QuizEndReason): void;
  restart(): void;
}

const NO_ANSWERS: AnsweredQuestion[] = [];

function normalizeLives(lives: number | undefined): number | null {
  return lives !== undefined && Number.isFinite(lives) && lives > 0 ? Math.floor(lives) : null;
}

function positiveMs(ms: number | undefined): number | null {
  return ms !== undefined && Number.isFinite(ms) && ms > 0 ? ms : null;
}

function createRun(config: QuizConfig, runId: number): RunState {
  const fixed = config.questions !== undefined;
  let queue: Question[] = [];
  if (fixed) {
    queue = typeof config.questions === 'function' ? config.questions() : (config.questions ?? []);
  } else if (config.nextQuestion) {
    queue = [config.nextQuestion({ index: 0, streak: 0, correctCount: 0, asked: [] })];
  }
  return {
    runId,
    fixed,
    status: queue.length > 0 ? 'playing' : 'finished',
    queue,
    index: 0,
    lives: normalizeLives(config.lives),
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    answered: [],
    lastOutcome: null,
    lastAnswer: null,
    lastXp: null,
    response: null,
    tally: EMPTY_TALLY,
    summary: null,
  };
}

function xpOf(award: number | XpAward | undefined): number | undefined {
  return typeof award === 'number' ? award : award?.xp;
}

function xpDetail(award: number | XpAward | undefined): XpDetail | null {
  if (award === undefined || typeof award === 'number') return null;
  return { multiplier: award.multiplier ?? 1, bonus: award.bonus ?? 0 };
}

/** Motivo por el que `next()` terminaría la sesión, o `null` si continúa. */
function pendingEnd(run: RunState): QuizEndReason | null {
  if (run.lives === 0) return 'lives';
  if (run.fixed && run.index + 1 >= run.queue.length) return 'completed';
  return null;
}

// ---------------------------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------------------------

/**
 * Motor de una sesión de preguntas para todos los modos de juego: conjuntos fijos o infinitos,
 * vidas, cuenta atrás global, avance automático, XP (con `xpFor`), dominio antes/después,
 * registro en el progreso y resumen final. Las funciones devueltas son estables.
 *
 * La primera pregunta se genera en el cliente, tras la hidratación y la carga del progreso (`ready`).
 */
export function useQuizSession(config: QuizConfig): QuizSession {
  const hydrated = useHydrated();
  const { completeSession, ready: progressReady } = useProgress();
  const record = config.record ?? true;
  const recorder = useAnswerRecorder(config.mode, { record });
  const timer = useResponseTimer();

  const maxLives = normalizeLives(config.lives);
  const timeLimitMs = positiveMs(config.timeLimitMs);
  const autoAdvanceMs = positiveMs(config.autoAdvanceMs);

  // La primera pregunta se genera en el cliente y con el progreso ya cargado (generadores adaptativos).
  const canStart = hydrated && progressReady;
  const [run, setRun] = useState<RunState | null>(() => (canStart ? createRun(config, 1) : null));
  if (run === null && canStart) setRun(createRun(config, 1));

  const handlers = useRef<Handlers | null>(null);
  const endedRun = useRef<number | null>(null);
  const startedAt = useRef(0);

  const {
    remainingMs,
    start: startCountdown,
    pause: pauseCountdown,
    reset: resetCountdown,
  } = useCountdown(timeLimitMs ?? 0, { onEnd: () => handlers.current?.end('time') });

  const end = (reason: QuizEndReason) => {
    if (!run || run.status === 'finished' || endedRun.current === run.runId) return;
    endedRun.current = run.runId;
    pauseCountdown();

    const durationMs = Math.max(0, Math.round(performance.now() - startedAt.current));
    const total = run.answered.length;
    const session =
      record && total > 0
        ? completeSession({
            mode: config.mode,
            total,
            correct: run.correctCount,
            durationMs,
            isExam: config.mode === 'exam',
          })
        : null;

    const summary = buildSessionSummary({
      mode: config.mode,
      title: config.title,
      answered: run.answered,
      tally: run.tally,
      durationMs,
      extraXp: session?.xpGained ?? 0,
      unlocked: session?.unlockedAchievements ?? [],
    });
    const extra = config.onFinish?.({
      reason,
      answered: run.answered,
      correct: run.correctCount,
      total,
      bestStreak: run.bestStreak,
      durationMs,
    });
    const merged: SessionSummaryData = extra
      ? {
          ...summary,
          ...extra,
          unlockedAchievements: Array.from(new Set([...summary.unlockedAchievements, ...(extra.unlockedAchievements ?? [])])),
        }
      : summary;
    setRun({ ...run, status: 'finished', summary: merged });
  };

  const answerImpl = (response: QuizResponse) => {
    if (!run || run.status !== 'playing') return;
    const question = run.queue[run.index];
    if (!question) return;

    const awardFor = (correct: boolean) => config.xpFor?.({ correct, streak: correct ? run.streak + 1 : 0, question });
    const result = recorder.submit(question, response, {
      responseMs: timer.elapsed(),
      xpFor: (correct) => xpOf(awardFor(correct)),
    });
    if (!result) return;

    const { correct, outcome, entry } = result;
    const streak = correct ? run.streak + 1 : 0;
    setRun({
      ...run,
      status: 'feedback',
      streak,
      bestStreak: Math.max(run.bestStreak, streak),
      correctCount: run.correctCount + (correct ? 1 : 0),
      lives: run.lives === null || correct ? run.lives : Math.max(0, run.lives - 1),
      answered: [...run.answered, entry],
      lastOutcome: outcome,
      lastAnswer: entry,
      lastXp: xpDetail(awardFor(correct)),
      response,
      tally: tallyAnswer(run.tally, result, outcome),
    });
  };

  const nextImpl = () => {
    if (!run || run.status !== 'feedback') return;
    const reason = pendingEnd(run);
    if (reason) {
      end(reason);
      return;
    }
    let queue = run.queue;
    if (!run.fixed) {
      if (!config.nextQuestion) {
        end('completed');
        return;
      }
      const upcoming = config.nextQuestion({
        index: run.index + 1,
        streak: run.streak,
        correctCount: run.correctCount,
        asked: run.queue.map((q) => q.atomicNumber),
      });
      queue = [...run.queue, upcoming];
    }
    setRun({ ...run, status: 'playing', index: run.index + 1, queue, response: null });
  };

  const restartImpl = () => {
    recorder.reset();
    setRun(createRun(config, (run?.runId ?? 0) + 1));
  };

  useLayoutEffect(() => {
    handlers.current = { answer: answerImpl, next: nextImpl, end, restart: restartImpl };
  });

  const runId = run?.runId ?? 0;
  const status = run?.status ?? 'playing';
  const hasQuestions = (run?.queue.length ?? 0) > 0;
  const current = run && run.status !== 'finished' ? (run.queue[run.index] ?? null) : null;
  const currentId = current?.id ?? null;
  const answeredCount = run?.answered.length ?? 0;

  // Inicio de cada partida: reloj de la sesión y cuenta atrás global.
  useEffect(() => {
    if (runId === 0) return;
    startedAt.current = performance.now();
    if (timeLimitMs === null || !hasQuestions) return;
    resetCountdown(timeLimitMs);
    startCountdown();
  }, [runId, timeLimitMs, hasQuestions, resetCountdown, startCountdown]);

  // Tiempo de respuesta: empieza al mostrar cada pregunta.
  useEffect(() => {
    if (currentId !== null && status === 'playing') timer.start();
  }, [currentId, status, timer]);

  // Avance automático tras el feedback.
  useEffect(() => {
    if (status !== 'feedback' || autoAdvanceMs === null) return;
    const id = window.setTimeout(() => handlers.current?.next(), autoAdvanceMs);
    return () => window.clearTimeout(id);
  }, [status, answeredCount, runId, autoAdvanceMs]);

  const answer = useCallback((response: QuizResponse) => handlers.current?.answer(response), []);
  const next = useCallback(() => handlers.current?.next(), []);
  const finish = useCallback(() => handlers.current?.end('manual'), []);
  const restart = useCallback(() => handlers.current?.restart(), []);

  return {
    ready: run !== null,
    status,
    mode: config.mode,
    title: config.title,
    current,
    index: run?.index ?? 0,
    total: run?.fixed ? run.queue.length : null,
    lives: run ? run.lives : maxLives,
    maxLives,
    streak: run?.streak ?? 0,
    bestStreak: run?.bestStreak ?? 0,
    correctCount: run?.correctCount ?? 0,
    answered: run?.answered ?? NO_ANSWERS,
    remainingMs: timeLimitMs === null ? null : remainingMs,
    timeLimitMs,
    autoAdvanceMs,
    lastOutcome: run?.lastOutcome ?? null,
    lastAnswer: run?.lastAnswer ?? null,
    lastXp: run?.lastXp ?? null,
    response: run?.response ?? null,
    willFinish: run !== null && run.status === 'feedback' && pendingEnd(run) !== null,
    answer,
    next,
    finish,
    restart,
    summary: run?.summary ?? null,
  };
}
