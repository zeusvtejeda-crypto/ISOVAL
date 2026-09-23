import type { Difficulty } from '@/utils/difficulty';

export const SURVIVAL_LIVES = 3;

/**
 * Dificultad según la pregunta (≈ puntos, pues solo caben 2 fallos antes del final):
 * fácil las 8 primeras, media hasta la 20 y luego difícil.
 */
export function survivalTier(index: number): Difficulty {
  if (index < 8) return 1;
  if (index < 20) return 2;
  return 3;
}
