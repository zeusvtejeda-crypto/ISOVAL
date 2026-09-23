import { CATEGORIES } from '@/data/categories';
import { ELEMENTS } from '@/data/elements';
import type { ChemicalElement, ElementCategory, Question } from '@/types';
import { elementDifficulty } from '../difficulty';
import { shuffle } from '../random';
import { categorySentence, hasContestedCategory, isAmbiguousCategoryFor } from './facts';
import { buildMultipleChoice, elementOption } from './helpers';

/**
 * ¿Puede `d` ser un distractor NO ambiguo en "¿Cuál de estos es un <target>?"
 * Excluye superpesados y todo elemento del que `target` no sea claramente falso
 * (misma regla que las familias incorrectas de "¿A qué familia pertenece…?": `isAmbiguousCategoryFor`).
 */
export function isSafeClassificationDistractor(d: ChemicalElement, target: ElementCategory): boolean {
  return !d.predicted && !isAmbiguousCategoryFor(d, target);
}

/** "¿Cuál de estos es un <familia>?" sobre `el`. `null` si su propia familia está discutida (Po, Se, At…). */
export function classificationQuestion(el: ChemicalElement): Question | null {
  if (hasContestedCategory(el)) return null;
  const target = el.category;
  const pool = ELEMENTS.filter((d) => isSafeClassificationDistractor(d, target));
  const dist = (e: ChemicalElement) => Math.abs(e.atomicNumber - el.atomicNumber) + (e.period === el.period ? 0 : 6);
  const sorted = [...pool].sort((a, b) => dist(a) - dist(b));
  const candidates = [...shuffle(sorted.slice(0, 8)), ...shuffle(sorted.slice(8))];
  return buildMultipleChoice({
    type: 'classification',
    el,
    prompt: `¿Cuál de estos es un ${CATEGORIES[target].singular.toLowerCase()}?`,
    correct: elementOption(el),
    candidates: candidates.map((e) => elementOption(e)),
    explanation: categorySentence(el),
    difficulty: elementDifficulty(el),
  });
}
