import type { FlashcardRating } from '@/types';

export const XP_RULES = {
  correct: 10,
  hardCorrect: 15,
  examComplete: 50,
  perfectExam: 100,
  learnElement: 5,
  flashcard: { again: 1, hard: 3, good: 5, easy: 5 } satisfies Record<FlashcardRating, number>,
  sessionComplete: 20,
} as const;

/** XP por responder: 0 si falla, 15 si la pregunta es difícil (3), 10 en otro caso. */
export function xpForAnswer(correct: boolean, difficulty: 1 | 2 | 3 = 1): number {
  if (!correct) return 0;
  return difficulty === 3 ? XP_RULES.hardCorrect : XP_RULES.correct;
}

export type StreakMilestone = 5 | 10 | 20;

export interface StreakModeXp {
  /** XP total a otorgar por este acierto (incluye `bonus`). */
  xp: number;
  /** Bonus por hito incluido en `xp`. */
  bonus: number;
  milestone: StreakMilestone | null;
  multiplier: number;
}

/** Multiplicador del Modo Racha: x1 (1–4), x1.5 (5–9), x2 (10–19), x3 (20+). */
export function streakMultiplier(streak: number): number {
  if (streak >= 20) return 3;
  if (streak >= 10) return 2;
  if (streak >= 5) return 1.5;
  return 1;
}

/**
 * XP de un acierto en Modo Racha, donde `streak` es la racha TRAS el acierto (1 = primer acierto).
 * Bonus: +25 al llegar a 5, +50 a 10, +150 a 20 y +100 en cada múltiplo de 10 posterior.
 */
export function streakModeXp(streak: number): StreakModeXp {
  const s = Math.max(0, Math.floor(streak));
  if (s === 0) return { xp: 0, bonus: 0, milestone: null, multiplier: 1 };
  const multiplier = streakMultiplier(s);
  let bonus = 0;
  let milestone: StreakMilestone | null = null;
  if (s === 5) {
    bonus = 25;
    milestone = 5;
  } else if (s === 10) {
    bonus = 50;
    milestone = 10;
  } else if (s === 20) {
    bonus = 150;
    milestone = 20;
  } else if (s > 20 && s % 10 === 0) {
    bonus = 100;
  }
  return { xp: Math.round(XP_RULES.correct * multiplier) + bonus, bonus, milestone, multiplier };
}
