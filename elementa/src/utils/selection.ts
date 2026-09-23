import { ELEMENTS } from '@/data/elements';
import type { ElementProgress, ProgressState } from '@/types';
import { elementDifficulty } from './difficulty';
import { weightedSample, type Rng } from './random';
import { isDue, overdueDays } from './srs';

/** Números atómicos 1–118. */
export const ALL_ATOMIC_NUMBERS: readonly number[] = ELEMENTS.map((el) => el.atomicNumber);

const BASE_WEIGHT = 0.15;
const NEW_WEIGHT = 1;
const LEARNED_UNPRACTICED_WEIGHT = 1.4;
const SLOW_MS = 6_000;

/** Peso de los elementos nunca respondidos según su dificultad (los comunes primero). */
const UNSEEN_FAMILIARITY: Record<1 | 2 | 3, number> = { 1: 1, 2: 0.5, 3: 0.25 };

/**
 * Prioridad de práctica de un elemento (> 0; mayor = más urgente).
 * Fallos frecuentes (mayor peso) + días de retraso sobre `due` + elementos nuevos + respuestas lentas.
 */
export function elementPriority(p: ElementProgress | undefined, now: Date): number {
  const answers = p ? p.correct + p.incorrect : 0;
  if (!p || answers === 0) return p?.learned ? LEARNED_UNPRACTICED_WEIGHT : NEW_WEIGHT;

  let w = BASE_WEIGHT;
  const failRate = p.incorrect / answers;
  w += 4 * failRate * Math.min(1, answers / 3);
  w += 0.8 * p.recent.slice(-5).filter((r) => r === 0).length;
  if (p.streak === 0 && p.incorrect > 0) w += 0.5;
  if (isDue(p, now)) w += 0.8 + 0.25 * Math.min(14, overdueDays(p, now));
  if (p.avgResponseMs !== null && p.avgResponseMs > SLOW_MS) {
    w += Math.min(1, (p.avgResponseMs - SLOW_MS) / SLOW_MS);
  }
  return w;
}

/** Peso usado para el muestreo: la prioridad, atenuada para elementos nunca vistos y difíciles. */
export function selectionWeight(state: ProgressState, z: number, now: Date): number {
  const p = state.elements[z];
  const w = elementPriority(p, now);
  const answered = p ? p.correct + p.incorrect > 0 : false;
  return answered || p?.learned ? w : w * UNSEEN_FAMILIARITY[elementDifficulty(z)];
}

/** `n` elementos del `pool` (por defecto los 118) por muestreo ponderado sin reemplazo. */
export function adaptivePool(
  state: ProgressState,
  now: Date,
  n: number,
  pool: readonly number[] = ALL_ATOMIC_NUMBERS,
  rng?: Rng,
): number[] {
  const weights = pool.map((z) => selectionWeight(state, z, now));
  return weightedSample(pool, weights, n, rng);
}
