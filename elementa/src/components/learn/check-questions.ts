import type { Question, QuestionType } from '@/types';
import { generateQuestion } from '@/utils/questions';
import { shuffle, type Rng } from '@/utils/random';

/** Preguntas de comprobación por elemento en «Aprende 5». */
export const CHECK_QUESTIONS_PER_ELEMENT = 2;

/** Ronda 1: símbolo ↔ nombre. */
const NAME_TYPES: readonly QuestionType[] = ['symbol-to-name', 'name-to-symbol'];
/** Ronda 2: número atómico o familia. */
const DETAIL_TYPES: readonly QuestionType[] = ['element-to-number', 'element-to-category'];
/** Respaldo si algún generador no aplica (nunca debería pasar con los tipos anteriores). */
const FALLBACK_TYPES: readonly QuestionType[] = ['number-to-element', 'element-to-number', 'name-to-symbol', 'symbol-to-name'];

function firstQuestion(z: number, types: readonly QuestionType[], used: Set<string>): Question | null {
  for (const type of types) {
    const key = `${type}:${z}`;
    if (used.has(key)) continue;
    const q = generateQuestion(type, z);
    if (!q) continue;
    used.add(key);
    return q;
  }
  return null;
}

/** Evita que el mismo elemento salga dos veces seguidas en la unión de dos rondas. */
function joinRounds(first: Question[], second: Question[]): Question[] {
  const last = first[first.length - 1];
  if (last && second.length > 1 && second[0].atomicNumber === last.atomicNumber) {
    const swapped = second.slice();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    return [...first, ...swapped];
  }
  return [...first, ...second];
}

/**
 * Comprobación de «Aprende 5»: 2 preguntas por elemento. Primero una ronda de símbolo ↔ nombre
 * (lo más básico) y después otra de número atómico o familia, cada ronda en orden aleatorio.
 * Solo en el cliente (usa aleatoriedad).
 */
export function buildCheckQuestions(atomicNumbers: readonly number[], rng: Rng = Math.random): Question[] {
  const used = new Set<string>();
  const first: Question[] = [];
  const second: Question[] = [];
  for (const z of Array.from(new Set(atomicNumbers))) {
    const a = firstQuestion(z, [...shuffle(NAME_TYPES, rng), ...FALLBACK_TYPES], used);
    const b = firstQuestion(z, [...shuffle(DETAIL_TYPES, rng), ...FALLBACK_TYPES], used);
    if (a) first.push(a);
    if (b) second.push(b);
  }
  return joinRounds(shuffle(first, rng), shuffle(second, rng));
}
