import { fillRoundRobin, QuestionCollector, spreadByElement } from '@/components/exam/build-exam';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ProgressState, Question, QuestionType } from '@/types';
import { generateQuestions } from '@/utils/questions';
import { shuffle } from '@/utils/random';
import { selectionWeight } from '@/utils/selection';
import { DEFAULT_PRACTICE_TYPES } from './target';

export interface PracticeSpec {
  /** Elementos a practicar; nunca se sale de ellos. */
  elements: readonly number[];
  count: number;
  types?: readonly QuestionType[];
  /**
   * Sesión enfocada (errores, difíciles, repasos): en vez de una pregunta por elemento, se concentra
   * en los de más prioridad para que los que más te cuestan salgan varias veces.
   */
  focused?: boolean;
}

/** Veces que sale como mínimo cada elemento de una sesión enfocada, si caben todos. */
const FOCUS_MIN_PER_ELEMENT = 2;

/** Elementos ordenados por prioridad de práctica (fallos, repasos atrasados…), de mayor a menor. */
export function byPriority(pool: readonly number[], state: ProgressState, now: Date): number[] {
  return pool
    .map((z, i) => ({ z, i, w: selectionWeight(state, z, now) }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map((x) => x.z);
}

/**
 * Preguntas de práctica restringidas a `elements`:
 * 1. Una por elemento (si no caben todos, los de más prioridad: fallos, pendientes…). En una sesión
 *    enfocada, solo para los `ceil(count / 2)` más prioritarios y, si caben dos por elemento, todos
 *    salen al menos dos veces.
 * 2. El resto por muestreo ponderado: los elementos que más te cuestan salen más veces, pero
 *    ninguno ocupa más de la mitad de la sesión (así nunca sale dos veces seguido).
 * 3. Si aún faltan (pocos elementos), otros tipos por turnos.
 * Nunca repite tipo + elemento ni pone el mismo elemento dos veces seguidas (si se puede).
 */
export function buildPracticeQuestions(spec: PracticeSpec, state: ProgressState, now: Date): Question[] {
  const pool = Array.from(new Set(spec.elements.filter((z) => ELEMENTS_BY_NUMBER[z] !== undefined)));
  const count = Math.max(0, Math.floor(spec.count));
  if (pool.length === 0 || count === 0) return [];
  const types = spec.types && spec.types.length > 0 ? [...spec.types] : [...DEFAULT_PRACTICE_TYPES];
  const focused = spec.focused === true;
  const collector = new QuestionCollector();
  // Con más de la mitad de preguntas sobre un mismo elemento, dos seguidas serían inevitables.
  const maxPerElement = pool.length > 1 ? Math.ceil(count / 2) : count;

  // 1) Una por elemento. Sin enfoque, el muestreo elige entre todos; con enfoque, solo los más
  //    prioritarios, para dejar sitio a la pasada ponderada (y a las repeticiones).
  const firstPool = focused ? byPriority(pool, state, now).slice(0, Math.ceil(count / 2)) : pool;
  const firstCount = Math.min(count, firstPool.length);
  for (let attempt = 0; attempt < 3 && collector.size < firstCount; attempt++) {
    const fresh = firstPool.filter((z) => !collector.usedElements.has(z));
    const first = generateQuestions(
      { count: firstCount - collector.size, types, pool: fresh, adaptive: true, uniqueElements: true },
      state,
      now,
    );
    for (const q of first) {
      if (collector.size >= firstCount) break;
      if (!collector.usedElements.has(q.atomicNumber)) collector.accept(q);
    }
  }

  // 1b) Enfocada y con sitio para dos por elemento: cada uno sale al menos dos veces (por turnos,
  //     primero los que menos preguntas tienen).
  if (focused && pool.length * FOCUS_MIN_PER_ELEMENT <= count) {
    const missing = pool.reduce((acc, z) => acc + Math.max(0, FOCUS_MIN_PER_ELEMENT - collector.countOf(z)), 0);
    if (missing > 0) fillRoundRobin(collector, pool, types, missing);
  }

  // 2) El resto, ponderado por prioridad.
  for (let attempt = 0; attempt < 3 && collector.size < count; attempt++) {
    const extra = generateQuestions(
      { count: count - collector.size, types, pool, adaptive: true, uniqueElements: false },
      state,
      now,
    );
    for (const q of extra) {
      if (collector.size >= count) break;
      if (collector.countOf(q.atomicNumber) < maxPerElement) collector.accept(q);
    }
  }

  // 3) Pocos elementos: otros tipos por turnos.
  if (collector.size < count) fillRoundRobin(collector, pool, types, count - collector.size);

  return spreadByElement(shuffle(collector.questions)).slice(0, count);
}
