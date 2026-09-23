'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AnswerOutcome, AnsweredQuestion, GameMode, Question, SessionSummaryData } from '@/types';
import { checkTableAnswer, describeTableSelection } from '@/utils/questions';
import { useCountdown } from './useCountdown';
import { useHaptics } from './useHaptics';
import { useHydrated } from './useHydrated';
import { useProgress } from './useProgress';
import { useResponseTimer } from './useResponseTimer';
import { useSound } from './useSound';

// ---------------------------------------------------------------------------------------------
// Contrato
// ---------------------------------------------------------------------------------------------

export interface QuizQuestionContext {
  /** Índice (0-based) de la pregunta que se va a mostrar. */
  index: number;
  /** Racha de aciertos actual en la sesión. */
  streak: number;
  /** Números atómicos ya preguntados, del más antiguo al más reciente. */
  asked: number[];
}

export interface QuizXpContext {
  correct: boolean;
  /** Racha de la sesión TRAS esta respuesta (1 = primer acierto; 0 si falló). */
  streak: number;
  question: Question;
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
  /** XP a otorgar en lugar de la regla por defecto (p. ej. Modo Racha). */
  xpFor?: (ctx: QuizXpContext) => number | undefined;
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
export type QuizResponse = string | number[];

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
  response: QuizResponse | null;
  /** Dominio de cada elemento al empezar la sesión (primer `masteryBefore`). */
  masteryStart: Record<number, number>;
  /** Último dominio conocido de cada elemento. */
  masteryEnd: Record<number, number>;
  unlocked: string[];
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
    queue = [config.nextQuestion({ index: 0, streak: 0, asked: [] })];
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
    response: null,
    masteryStart: {},
    masteryEnd: {},
    unlocked: [],
    summary: null,
  };
}

function evaluate(question: Question, response: QuizResponse): { correct: boolean; given: string } {
  if (question.kind === 'multiple-choice') {
    const option = typeof response === 'string' ? question.options?.find((o) => o.id === response) : undefined;
    if (!option) return { correct: false, given: '—' };
    return { correct: option.correct, given: option.sublabel ? `${option.label} (${option.sublabel})` : option.label };
  }
  const selected = Array.isArray(response) ? response : [];
  return { correct: checkTableAnswer(question, selected), given: describeTableSelection(selected) };
}

/** Motivo por el que `next()` terminaría la sesión, o `null` si continúa. */
function pendingEnd(run: RunState): QuizEndReason | null {
  if (run.lives === 0) return 'lives';
  if (run.fixed && run.index + 1 >= run.queue.length) return 'completed';
  return null;
}

/** Elementos cuyo dominio subió, de mayor a menor mejora. */
function improvedElements(start: Record<number, number>, end: Record<number, number>): number[] {
  return Object.keys(end)
    .map(Number)
    .map((z) => ({ z, delta: (end[z] ?? 0) - (start[z] ?? 0) }))
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .map((d) => d.z);
}

/** Elementos fallados, sin repetir, en el orden del primer fallo. */
function failedElements(answered: AnsweredQuestion[]): number[] {
  const out: number[] = [];
  for (const a of answered) {
    if (!a.correct && !out.includes(a.question.atomicNumber)) out.push(a.question.atomicNumber);
  }
  return out;
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
  const { recordAnswer, completeSession, ready: progressReady } = useProgress();
  const sound = useSound();
  const haptics = useHaptics();
  const timer = useResponseTimer();

  const record = config.record ?? true;
  const maxLives = normalizeLives(config.lives);
  const timeLimitMs = positiveMs(config.timeLimitMs);
  const autoAdvanceMs = positiveMs(config.autoAdvanceMs);

  // La primera pregunta se genera en el cliente y con el progreso ya cargado (generadores adaptativos).
  const canStart = hydrated && progressReady;
  const [run, setRun] = useState<RunState | null>(() => (canStart ? createRun(config, 1) : null));
  if (run === null && canStart) setRun(createRun(config, 1));

  const handlers = useRef<Handlers | null>(null);
  const answeredId = useRef<string | null>(null);
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
    const unlocked = [...run.unlocked];
    let sessionXp = 0;
    if (record && total > 0) {
      const result = completeSession({
        mode: config.mode,
        total,
        correct: run.correctCount,
        durationMs,
        isExam: config.mode === 'exam',
      });
      sessionXp = result.xpGained;
      unlocked.push(...result.unlockedAchievements);
    }

    const summary: SessionSummaryData = {
      mode: config.mode,
      title: config.title,
      total,
      correct: run.correctCount,
      xpGained: run.answered.reduce((sum, a) => sum + a.xpGained, 0) + sessionXp,
      durationMs,
      improved: improvedElements(run.masteryStart, run.masteryEnd),
      toReview: failedElements(run.answered),
      unlockedAchievements: Array.from(new Set(unlocked)),
    };
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
    if (!question || answeredId.current === question.id) return;
    answeredId.current = question.id;

    const { correct, given } = evaluate(question, response);
    const responseMs = timer.elapsed();
    const streak = correct ? run.streak + 1 : 0;
    const xpOverride = config.xpFor?.({ correct, streak, question });
    const outcome = record
      ? recordAnswer({
          atomicNumber: question.atomicNumber,
          skill: question.skill,
          correct,
          responseMs,
          mode: config.mode,
          prompt: question.prompt,
          correctAnswer: question.correctAnswer,
          givenAnswer: given,
          difficulty: question.difficulty,
          xpOverride,
        })
      : null;

    if (correct) {
      sound.correct();
      haptics.success();
    } else {
      sound.wrong();
      haptics.error();
    }

    const z = question.atomicNumber;
    const entry: AnsweredQuestion = { question, correct, givenAnswer: given, responseMs, xpGained: outcome?.xpGained ?? 0 };
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
      response,
      masteryStart:
        outcome && !(z in run.masteryStart) ? { ...run.masteryStart, [z]: outcome.masteryBefore } : run.masteryStart,
      masteryEnd: outcome ? { ...run.masteryEnd, [z]: outcome.masteryAfter } : run.masteryEnd,
      unlocked: outcome?.unlockedAchievements.length
        ? [...run.unlocked, ...outcome.unlockedAchievements]
        : run.unlocked,
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
        asked: run.queue.map((q) => q.atomicNumber),
      });
      queue = [...run.queue, upcoming];
    }
    setRun({ ...run, status: 'playing', index: run.index + 1, queue, response: null });
  };

  const restartImpl = () => {
    answeredId.current = null;
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
    response: run?.response ?? null,
    willFinish: run !== null && run.status === 'feedback' && pendingEnd(run) !== null,
    answer,
    next,
    finish,
    restart,
    summary: run?.summary ?? null,
  };
}
