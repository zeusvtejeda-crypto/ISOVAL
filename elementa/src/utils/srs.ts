import type { ElementProgress, FlashcardRating } from '@/types';

/** Repetición espaciada: SM-2 simplificado. */

export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
/** Intervalo máximo entre repasos (días). */
export const MAX_INTERVAL_DAYS = 365;
/** Tras "No lo sabía" se vuelve a mostrar en 10 minutos. */
export const AGAIN_DELAY_MS = 10 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Respuestas más lentas que esto cuentan como "Casi". */
export const SLOW_ANSWER_MS = 10_000;
/** Respuestas más rápidas que esto cuentan como "Muy fácil". */
export const FAST_ANSWER_MS = 3_000;

export function createElementProgress(z: number): ElementProgress {
  return {
    atomicNumber: z,
    seen: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    recent: [],
    avgResponseMs: null,
    lastSeen: null,
    lastCorrect: null,
    ease: INITIAL_EASE,
    intervalDays: 0,
    reps: 0,
    due: null,
    learned: false,
    learnedAt: null,
    skills: {},
  };
}

function clampEase(ease: number): number {
  return Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, ease)) * 100) / 100;
}

function roundInterval(days: number): number {
  return Math.round(Math.min(MAX_INTERVAL_DAYS, days) * 100) / 100;
}

/** Aplica una calificación y reprograma el próximo repaso. No modifica contadores de aciertos. */
export function applyRating(p: ElementProgress, rating: FlashcardRating, now: Date): ElementProgress {
  const t = now.getTime();
  if (rating === 'again') {
    return {
      ...p,
      ease: clampEase(p.ease - 0.2),
      reps: 0,
      intervalDays: 0,
      due: new Date(t + AGAIN_DELAY_MS).toISOString(),
    };
  }

  let interval: number;
  let ease = p.ease;
  if (rating === 'hard') {
    interval = Math.max(1, p.intervalDays * 1.2);
    ease -= 0.15;
  } else if (rating === 'good') {
    if (p.reps === 0) interval = 1;
    else if (p.reps === 1) interval = 3;
    else interval = Math.max(p.intervalDays * p.ease, p.intervalDays + 1);
  } else {
    interval = p.reps === 0 ? 4 : Math.max(4, p.intervalDays * p.ease * 1.3);
    ease += 0.15;
  }
  interval = roundInterval(interval);
  return {
    ...p,
    ease: clampEase(ease),
    reps: p.reps + 1,
    intervalDays: interval,
    due: new Date(t + interval * DAY_MS).toISOString(),
  };
}

/** Calificación implícita de una respuesta de quiz. */
export function ratingFromAnswer(correct: boolean, responseMs: number): FlashcardRating {
  if (!correct) return 'again';
  if (responseMs > SLOW_ANSWER_MS) return 'hard';
  if (responseMs < FAST_ANSWER_MS) return 'easy';
  return 'good';
}

/** ¿Toca repasarlo ya? (tiene fecha de repaso y ya pasó). */
export function isDue(p: ElementProgress | undefined, now: Date): boolean {
  if (!p || !p.due) return false;
  const due = Date.parse(p.due);
  return Number.isFinite(due) && due <= now.getTime();
}

/** Días de retraso respecto al repaso programado (0 si no toca aún). */
export function overdueDays(p: ElementProgress | undefined, now: Date): number {
  if (!p || !p.due) return 0;
  const due = Date.parse(p.due);
  if (!Number.isFinite(due)) return 0;
  return Math.max(0, (now.getTime() - due) / DAY_MS);
}
