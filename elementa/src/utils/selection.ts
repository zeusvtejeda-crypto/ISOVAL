import { ELEMENTS, ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ElementProgress, ProgressState } from '@/types';
import { elementDifficulty } from './difficulty';
import { computeMastery, MASTERED_THRESHOLD } from './mastery';
import { weightedSample, type Rng } from './random';
import { isDue, overdueDays } from './srs';

/**
 * Selección de elementos para practicar (lógica pura, sin generadores de preguntas).
 * No importa `planner.ts` ni `questions.ts`: así `/estadisticas`, el inicio o «Mis errores»
 * pueden usar estas listas sin cargar el generador de preguntas.
 */

/** Números atómicos 1–118. */
export const ALL_ATOMIC_NUMBERS: readonly number[] = ELEMENTS.map((el) => el.atomicNumber);

const BASE_WEIGHT = 0.15;
const NEW_WEIGHT = 1;
const LEARNED_UNPRACTICED_WEIGHT = 1.4;
const SLOW_MS = 6_000;
/**
 * Aporte máximo de la lentitud. Por debajo del peso de un elemento nuevo atenuado (0.5 − 0.15 base),
 * así un elemento lento pero acertado nunca adelanta a uno nuevo de dificultad 1 o 2 (§25:
 * fallados > atrasados > nuevos > lentos).
 */
const MAX_SLOW_WEIGHT = 0.3;

/** Peso de los elementos nunca respondidos según su dificultad (los comunes primero). */
const UNSEEN_FAMILIARITY: Record<1 | 2 | 3, number> = { 1: 1, 2: 0.5, 3: 0.25 };

/**
 * Prioridad de práctica de un elemento (> 0; mayor = más urgente).
 * Fallos frecuentes (mayor peso) + días de retraso sobre `due` + elementos nuevos + respuestas lentas
 * (estas últimas con un aporte pequeño y acotado).
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
    w += MAX_SLOW_WEIGHT * Math.min(1, (p.avgResponseMs - SLOW_MS) / SLOW_MS);
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

/** Elemento difícil: fallado alguna vez y aún sin dominar. */
export interface DifficultElement {
  atomicNumber: number;
  /** Dominio actual 0–100. */
  mastery: number;
  correct: number;
  incorrect: number;
  /** Aciertos / respuestas (0–1). */
  accuracy: number;
}

/**
 * Definición ÚNICA de «elementos difíciles» (Mis errores, `/practicar?focus=dificiles`, el mazo
 * «Mis errores» de flashcards, sus contadores y el bloque «difíciles» de `planStudySession`):
 * elementos válidos con al menos un fallo (`incorrect > 0`) y dominio < `MASTERED_THRESHOLD`.
 * Orden: menor dominio primero; a igualdad, más fallos; luego número atómico.
 */
export function difficultElements(state: ProgressState, now: Date, limit = 118): DifficultElement[] {
  return Object.values(state.elements)
    .filter((p) => p.incorrect > 0 && ELEMENTS_BY_NUMBER[p.atomicNumber] !== undefined)
    .map((p) => ({
      atomicNumber: p.atomicNumber,
      mastery: computeMastery(p, now),
      correct: p.correct,
      incorrect: p.incorrect,
      accuracy: p.correct / (p.correct + p.incorrect),
    }))
    .filter((d) => d.mastery < MASTERED_THRESHOLD)
    .sort((a, b) => a.mastery - b.mastery || b.incorrect - a.incorrect || a.atomicNumber - b.atomicNumber)
    .slice(0, Math.max(0, limit));
}

/**
 * Elementos intentados que aún no se dominan (hayan fallado o no), del menor dominio al mayor.
 * Incluye elementos acertados pocas veces o lentos: para «difíciles» usar `difficultElements`.
 */
export function weakElements(
  state: ProgressState,
  now: Date,
  limit = 10,
): Array<{ atomicNumber: number; mastery: number }> {
  return Object.values(state.elements)
    .filter((p) => p.correct + p.incorrect > 0)
    .map((p) => ({ atomicNumber: p.atomicNumber, mastery: computeMastery(p, now), incorrect: p.incorrect }))
    .filter((x) => x.mastery < MASTERED_THRESHOLD)
    .sort((a, b) => a.mastery - b.mastery || b.incorrect - a.incorrect || a.atomicNumber - b.atomicNumber)
    .slice(0, limit)
    .map(({ atomicNumber, mastery }) => ({ atomicNumber, mastery }));
}

/** Elementos cuyo repaso ya toca, los más atrasados primero. */
export function dueReviews(state: ProgressState, now: Date, n: number): number[] {
  return Object.values(state.elements)
    .filter((p) => isDue(p, now))
    .sort((a, b) => Date.parse(a.due as string) - Date.parse(b.due as string))
    .slice(0, Math.max(0, n))
    .map((p) => p.atomicNumber);
}

/** Elementos aún no aprendidos, en orden atómico (limitado al `pool` si se da). */
export function newElements(state: ProgressState, n: number, pool?: number[]): number[] {
  const src = pool && pool.length > 0 ? [...pool].sort((a, b) => a - b) : ALL_ATOMIC_NUMBERS;
  return src.filter((z) => !state.elements[z]?.learned).slice(0, Math.max(0, n));
}
