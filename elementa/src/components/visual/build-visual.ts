import type { ProgressState, Question } from '@/types';
import { categoryMembers, SELECTABLE_CATEGORIES } from '@/utils/question-gen/table';
import { generateQuestion, generateQuestions } from '@/utils/questions';
import { shuffle } from '@/utils/random';
import { adaptivePool } from '@/utils/selection';
import type { VisualMode } from './modes';

/**
 * "Selecciona la familia": una pregunta por familia seleccionable, en orden aleatorio. El elemento
 * que suma o resta dominio se elige de forma adaptativa entre los miembros (los más flojos pesan más).
 */
function familyQuestions(state: ProgressState, now: Date, count: number): Question[] {
  const out: Question[] = [];
  for (const category of shuffle(SELECTABLE_CATEGORIES)) {
    if (out.length >= count) break;
    const members = categoryMembers(category).map((e) => e.atomicNumber);
    const [z] = adaptivePool(state, now, 1, members);
    const q = generateQuestion('table-select-category', z ?? members[0]);
    if (q) out.push(q);
  }
  return out;
}

/**
 * Preguntas de una sesión visual: adaptativas (priorizan tus elementos débiles) y sin enunciados
 * repetidos (`generateQuestions` descarta «Toca un elemento del grupo 1» si ya salió).
 */
export function buildVisualQuestions(mode: VisualMode, state: ProgressState, now: Date): Question[] {
  if (mode.types.length === 1 && mode.types[0] === 'table-select-category') {
    return familyQuestions(state, now, mode.count);
  }
  return generateQuestions({ count: mode.count, types: mode.types }, state, now);
}
