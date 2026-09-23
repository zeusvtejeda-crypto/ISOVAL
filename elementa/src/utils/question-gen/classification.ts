import { CATEGORIES, metallicCharacter } from '@/data/categories';
import { ELEMENTS } from '@/data/elements';
import type { ChemicalElement, ElementCategory, Question } from '@/types';
import { elementDifficulty } from '../difficulty';
import { shuffle } from '../random';
import { ALT_CATEGORIES, categorySentence } from './facts';
import { buildMultipleChoice, elementOption } from './helpers';

/**
 * ¿Puede `d` ser un distractor NO ambiguo en "¿Cuál de estos es un <target>?"
 * Excluye superpesados, elementos con clasificación discutida hacia esa familia, los
 * "metales de transición internos" cuando se pregunta por transición y halógenos/gases
 * nobles cuando se pregunta por "no metal" (también lo son).
 */
export function isSafeClassificationDistractor(d: ChemicalElement, target: ElementCategory): boolean {
  if (d.predicted || d.category === target) return false;
  if ((ALT_CATEGORIES[d.atomicNumber] ?? []).includes(target)) return false;
  if (target === 'transition-metal' && (d.category === 'lanthanide' || d.category === 'actinide')) return false;
  if (target === 'nonmetal' && metallicCharacter(d.category) === 'nonmetal') return false;
  return true;
}

export function classificationQuestion(el: ChemicalElement): Question | null {
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
