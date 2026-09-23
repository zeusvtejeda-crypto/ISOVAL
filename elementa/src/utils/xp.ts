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
  /** XP total a otorgar por este acierto: `multiplied + bonus`. */
  xp: number;
  /** XP base de la pregunta sin multiplicar (`xpForAnswer(true, difficulty)`: 10, o 15 si es difícil). */
  base: number;
  multiplier: number;
  /** `round(base × multiplier)`. */
  multiplied: number;
  /** Solo el bonus por hito (+25 en 5, +50 en 10, +150 en 20, +100 en cada múltiplo de 10 posterior). */
  bonus: number;
  milestone: StreakMilestone | null;
}

/** Multiplicador del Modo Racha: x1 (1–4), x1.5 (5–9), x2 (10–19), x3 (20+). */
export function streakMultiplier(streak: number): number {
  if (streak >= 20) return 3;
  if (streak >= 10) return 2;
  if (streak >= 5) return 1.5;
  return 1;
}

/** Bonus por hito de racha: +25 al llegar a 5, +50 a 10, +150 a 20 y +100 en cada múltiplo de 10 posterior. */
function streakBonus(streak: number): { bonus: number; milestone: StreakMilestone | null } {
  if (streak === 5) return { bonus: 25, milestone: 5 };
  if (streak === 10) return { bonus: 50, milestone: 10 };
  if (streak === 20) return { bonus: 150, milestone: 20 };
  if (streak > 20 && streak % 10 === 0) return { bonus: 100, milestone: null };
  return { bonus: 0, milestone: null };
}

/**
 * XP de un acierto en Modo Racha, donde `streak` es la racha TRAS el acierto (1 = primer acierto).
 * `xp = round(base × streakMultiplier(streak)) + bonus`, con `base = xpForAnswer(true, difficulty)`
 * (las preguntas difíciles también dan +15 aquí). `bonus` es solo el del hito, así la UI puede
 * mostrar por separado el extra del multiplicador (`multiplied − base`) y el bonus.
 */
export function streakModeXp(streak: number, difficulty: 1 | 2 | 3 = 1): StreakModeXp {
  const s = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  if (s === 0) return { xp: 0, base: 0, multiplier: 1, multiplied: 0, bonus: 0, milestone: null };
  const base = xpForAnswer(true, difficulty);
  const multiplier = streakMultiplier(s);
  const multiplied = Math.round(base * multiplier);
  const { bonus, milestone } = streakBonus(s);
  return { xp: multiplied + bonus, base, multiplier, multiplied, bonus, milestone };
}
