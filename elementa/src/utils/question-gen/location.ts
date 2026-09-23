import type { ChemicalElement, Question } from '@/types';
import { elementDifficulty, maxDifficulty } from '../difficulty';
import { pick, shuffle } from '../random';
import { getNeighbor, type NeighborDirection } from '../table-layout';
import {
  buildMultipleChoice,
  elementOption,
  fallbackElements,
  nearbyElements,
  ofElement,
  withArticle,
  withArticleCap,
} from './helpers';

const DIRECTIONS: NeighborDirection[] = ['up', 'down', 'left', 'right'];

const DIRECTION_PHRASE: Record<NeighborDirection, string> = {
  up: 'justo encima',
  down: 'justo debajo',
  left: 'justo a la izquierda',
  right: 'justo a la derecha',
};

const DIRECTION_REASON: Record<NeighborDirection, string> = {
  up: 'mismo grupo, un periodo más arriba',
  down: 'mismo grupo, un periodo más abajo',
  left: 'mismo periodo, un grupo a la izquierda',
  right: 'mismo periodo, un grupo a la derecha',
};

const DIRECTION_START: Record<NeighborDirection, string> = {
  up: 'Encima',
  down: 'Debajo',
  left: 'A la izquierda',
  right: 'A la derecha',
};

export type LocationVariant = NeighborDirection | 'coordinates';

/** Variantes posibles: vecinos reales en la tabla principal + "periodo y grupo". */
export function locationVariants(el: ChemicalElement): LocationVariant[] {
  if (el.group === null) return [];
  return [...DIRECTIONS.filter((d) => getNeighbor(el, d) !== null), 'coordinates'];
}

function neighborQuestion(el: ChemicalElement, dir: NeighborDirection): Question | null {
  const target = getNeighbor(el, dir);
  if (!target) return null;
  const around = (e: ChemicalElement) =>
    DIRECTIONS.map((d) => getNeighbor(e, d)).filter((n): n is ChemicalElement => n !== null);
  const plausible = shuffle(
    [...around(el), ...around(target)].filter(
      (e) => e.atomicNumber !== el.atomicNumber && e.atomicNumber !== target.atomicNumber,
    ),
  );
  return buildMultipleChoice({
    type: 'location',
    el,
    prompt: `¿Qué elemento está ${DIRECTION_PHRASE[dir]} ${ofElement(el)}?`,
    subject: el.symbol,
    correct: elementOption(target),
    candidates: [...plausible, ...nearbyElements(target.atomicNumber, 3), ...fallbackElements(target)]
      .filter((e) => e.atomicNumber !== el.atomicNumber)
      .map((e) => elementOption(e)),
    explanation: `${DIRECTION_START[dir]} ${ofElement(el)} está ${withArticle(target)} (${target.symbol}): ${DIRECTION_REASON[dir]}.`,
    difficulty: maxDifficulty(elementDifficulty(el), 2),
  });
}

function coordinatesLabel(period: number, group: number): string {
  return `Periodo ${period}, grupo ${group}`;
}

function coordinatesQuestion(el: ChemicalElement): Question | null {
  if (el.group === null) return null;
  const p = el.period;
  const g = el.group;
  const near: Array<[number, number]> = [
    [p - 1, g],
    [p + 1, g],
    [p, g - 1],
    [p, g + 1],
    [p - 1, g + 1],
    [p + 1, g - 1],
    [p + 1, g + 1],
    [p - 1, g - 1],
    [p, g + 2],
    [p, g - 2],
  ];
  // Trampa clásica: confundir periodo y grupo.
  const swapped: Array<[number, number]> = g !== p && g <= 7 && p <= 18 ? [[g, p]] : [];
  const valid = (pair: [number, number]) => pair[0] >= 1 && pair[0] <= 7 && pair[1] >= 1 && pair[1] <= 18;
  const shuffled = shuffle(near.filter(valid));
  const preferred = shuffle([...swapped.filter(valid), ...shuffled.slice(0, 4)]);
  const candidates = [...preferred, ...shuffled.slice(4)].map(([cp, cg]) => ({
    label: coordinatesLabel(cp, cg),
  }));
  return buildMultipleChoice({
    type: 'location',
    el,
    prompt: `¿En qué periodo y grupo está ${withArticle(el)}?`,
    subject: el.symbol,
    correct: { label: coordinatesLabel(p, g) },
    candidates,
    explanation: `${withArticleCap(el)} está en el periodo ${p} (fila) y el grupo ${g} (columna).`,
    difficulty: maxDifficulty(elementDifficulty(el), 2),
  });
}

export function locationQuestion(el: ChemicalElement, variant?: LocationVariant): Question | null {
  const variants = locationVariants(el);
  if (variants.length === 0) return null;
  const chosen = variant && variants.includes(variant) ? variant : pick(variants);
  return chosen === 'coordinates' ? coordinatesQuestion(el) : neighborQuestion(el, chosen);
}
