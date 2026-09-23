import type { AnsweredQuestion } from '@/types';
import type { Difficulty } from '@/utils/difficulty';
import { streakModeXp, streakMultiplier } from '@/utils/xp';

export interface NextMilestone {
  /** Hito anterior (inicio del tramo). */
  from: number;
  /** Próximo hito. */
  at: number;
  bonus: number;
  /** El bonus especial de la racha 20. */
  special: boolean;
}

/** Próximo hito con bonus: 5, 10, 20 y luego cada 10. */
export function nextMilestone(streak: number): NextMilestone {
  const s = Math.max(0, Math.floor(streak));
  let from: number;
  let at: number;
  if (s < 5) [from, at] = [0, 5];
  else if (s < 10) [from, at] = [5, 10];
  else if (s < 20) [from, at] = [10, 20];
  else {
    from = Math.floor(s / 10) * 10;
    at = from + 10;
  }
  return { from, at, bonus: streakModeXp(at).bonus, special: at === 20 };
}

/** Bonus total acumulado al llegar a `streak`. */
export function totalStreakBonus(streak: number): number {
  let sum = 0;
  for (let k = 1; k <= streak; k++) sum += streakModeXp(k).bonus;
  return sum;
}

/** Las preguntas se endurecen con la racha: comunes hasta 5, intermedias hasta 10, luego todas. */
export function streakTier(streak: number): Difficulty {
  if (streak < 5) return 1;
  if (streak < 10) return 2;
  return 3;
}

/** 1.5 → "x1.5". */
export function formatMultiplier(multiplier: number): string {
  return `x${multiplier}`;
}

/** Multiplicador vigente (x1 sin racha). */
export function currentMultiplier(streak: number): number {
  return streakMultiplier(Math.max(1, streak));
}

/** ¿La racha `streak` es un hito con bonus? (5, 10, 20 y cada 10 después; igual que `isStreakMilestone`). */
export function isBonusMilestone(streak: number): boolean {
  return streak > 0 && streakModeXp(streak).bonus > 0;
}

/** Índice de la última respuesta que alcanzó un hito (y la racha de ese hito), o `null`. */
export function lastMilestone(answered: readonly AnsweredQuestion[]): { index: number; streak: number } | null {
  let streak = 0;
  let found: { index: number; streak: number } | null = null;
  for (let index = 0; index < answered.length; index++) {
    streak = answered[index].correct ? streak + 1 : 0;
    if (isBonusMilestone(streak)) found = { index, streak };
  }
  return found;
}

/** Escalera de multiplicadores y bonus (pantalla de presentación). */
export const STREAK_LADDER = [
  { range: '1–4', multiplier: 1, xp: 10, bonus: null, special: false },
  { range: '5–9', multiplier: 1.5, xp: 15, bonus: streakModeXp(5).bonus, special: false },
  { range: '10–19', multiplier: 2, xp: 20, bonus: streakModeXp(10).bonus, special: false },
  { range: '20+', multiplier: 3, xp: 30, bonus: streakModeXp(20).bonus, special: true },
] as const;
