import type { QuestionType } from '@/types';
import type { Difficulty } from '@/utils/difficulty';

export const TIME_ATTACK_MS = 60_000;
/** Pausa tras cada respuesta antes de la siguiente (feedback relámpago). */
export const TIME_ATTACK_ADVANCE_MS = 600;
/** El reloj se pone rojo (y suena el tic) en los últimos segundos. */
export const LOW_TIME_SECONDS = 10;

/** Preguntas rápidas: símbolo ↔ nombre y número → elemento. */
export const TIME_ATTACK_TYPES: QuestionType[] = ['symbol-to-name', 'name-to-symbol', 'number-to-element'];

/** La dificultad sube despacio: 10 preguntas fáciles, luego intermedias y, a partir de 25, todas. */
export function timeAttackTier(index: number): Difficulty {
  if (index < 10) return 1;
  if (index < 25) return 2;
  return 3;
}
