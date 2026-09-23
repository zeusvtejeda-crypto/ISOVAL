import { fillRoundRobin, QuestionCollector, spreadByElement } from '@/components/exam/build-exam';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ProgressState, Question, QuestionType } from '@/types';
import { generateQuestions } from '@/utils/questions';
import { shuffle } from '@/utils/random';
import { DEFAULT_PRACTICE_TYPES } from './target';

export interface PracticeSpec {
  /** Elementos a practicar; nunca se sale de ellos. */
  elements: readonly number[];
  count: number;
  types?: readonly QuestionType[];
}

/**
 * Preguntas de práctica restringidas a `elements`:
 * 1. Una por elemento (si no caben todos, los de más prioridad: fallos, pendientes…).
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
  const collector = new QuestionCollector();
  // Con más de la mitad de preguntas sobre un mismo elemento, dos seguidas serían inevitables.
  const maxPerElement = pool.length > 1 ? Math.ceil(count / 2) : count;

  const firstCount = Math.min(count, pool.length);
  for (let attempt = 0; attempt < 3 && collector.size < firstCount; attempt++) {
    const fresh = pool.filter((z) => !collector.usedElements.has(z));
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

  if (collector.size < count) fillRoundRobin(collector, pool, types, count - collector.size);

  return spreadByElement(shuffle(collector.questions)).slice(0, count);
}
