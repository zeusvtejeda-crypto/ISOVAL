import type { AnsweredQuestion, ProgressState, Question, QuestionType } from '@/types';
import { elementDifficulty, type Difficulty } from '@/utils/difficulty';
import { generateAdaptiveQuestion } from '@/utils/questions';
import { ALL_ATOMIC_NUMBERS } from '@/utils/selection';

/** Elementos por dificultad máxima: 1 = comunes, 2 = + intermedios, 3 = los 118. */
const POOLS: Record<Difficulty, number[]> = {
  1: ALL_ATOMIC_NUMBERS.filter((z) => elementDifficulty(z) <= 1),
  2: ALL_ATOMIC_NUMBERS.filter((z) => elementDifficulty(z) <= 2),
  3: [...ALL_ATOMIC_NUMBERS],
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: 'Fácil', 2: 'Media', 3: 'Difícil' };

export interface GameQuestionOptions {
  /** Dificultad máxima de la pregunta y de sus elementos. */
  tier: Difficulty;
  /** Elementos ya preguntados (del más antiguo al más reciente). */
  asked: readonly number[];
  types?: QuestionType[];
  /** Cuántos de los últimos elementos evitar. */
  avoidLast?: number;
}

/**
 * Pregunta adaptativa para los modos infinitos: prioriza los elementos que más te cuestan dentro de
 * la dificultad actual y evita repetir los últimos. Llamar solo en el cliente (handlers o `nextQuestion`).
 */
export function gameQuestion(state: ProgressState, { tier, asked, types, avoidLast = 10 }: GameQuestionOptions): Question {
  return generateAdaptiveQuestion(state, new Date(), {
    types,
    pool: POOLS[tier],
    maxDifficulty: tier,
    exclude: asked.slice(-avoidLast),
  });
}

/** Tiempo medio de respuesta (ms) o `null` si no hay respuestas. */
export function averageResponseMs(answered: readonly AnsweredQuestion[]): number | null {
  if (answered.length === 0) return null;
  return answered.reduce((sum, a) => sum + a.responseMs, 0) / answered.length;
}

/** 2350 → "2.4 s". */
export function formatSeconds(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Elementos cuyo dominio subió, de mayor a menor mejora. */
export function improvedElements(start: Record<number, number>, end: Record<number, number>): number[] {
  return Object.keys(end)
    .map(Number)
    .map((z) => ({ z, delta: (end[z] ?? 0) - (start[z] ?? 0) }))
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .map((d) => d.z);
}

/** Elementos fallados, sin repetir, en el orden del primer fallo. */
export function failedElements(answered: readonly AnsweredQuestion[]): number[] {
  const out: number[] = [];
  for (const a of answered) {
    if (!a.correct && !out.includes(a.question.atomicNumber)) out.push(a.question.atomicNumber);
  }
  return out;
}
