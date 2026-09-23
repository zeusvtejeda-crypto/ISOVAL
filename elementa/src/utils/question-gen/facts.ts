import { CATEGORIES, CATEGORY_ORDER, metallicCharacter, PHASE_LABELS } from '@/data/categories';
import type { ChemicalElement, ElementCategory, Question } from '@/types';
import { elementDifficulty } from '../difficulty';
import { formatConfig, formatMass, pluralize } from '../format';
import { shuffle } from '../random';
import {
  buildMultipleChoice,
  nearbyElements,
  nearbyValues,
  ofElement,
  windowElements,
  windowValues,
  withArticle,
  withArticleCap,
} from './helpers';

/**
 * Clasificaciones alternativas con las que a veces se describe un elemento. Nunca se ofrecen
 * como distractores para ese elemento (ni el elemento como distractor de esas familias).
 */
export const ALT_CATEGORIES: Record<number, ElementCategory[]> = {
  30: ['post-transition-metal'],
  48: ['post-transition-metal'],
  80: ['post-transition-metal'],
  112: ['post-transition-metal'],
  57: ['transition-metal'],
  71: ['transition-metal'],
  89: ['transition-metal'],
  103: ['transition-metal'],
  84: ['post-transition-metal'],
  85: ['metalloid'],
  117: ['metalloid', 'post-transition-metal'],
  34: ['metalloid'],
};

/** Su clasificación en familias está discutida (tiene `ALT_CATEGORIES`). */
export function hasContestedCategory(el: ChemicalElement): boolean {
  return (ALT_CATEGORIES[el.atomicNumber] ?? []).length > 0;
}

/**
 * ¿Se conoce su estado a temperatura ambiente? No para los de fase `unknown` ni para los que solo
 * tienen un estado predicho (`phasePredicted`: At y Fr nunca se han visto en cantidad visible).
 */
export function hasKnownPhase(el: ChemicalElement): boolean {
  return el.phase !== 'unknown' && !el.phasePredicted;
}

/** Frase común sobre los elementos gaseosos (el oganesón está en el grupo 18 pero su estado se desconoce). */
export const GASEOUS_ELEMENTS_NOTE =
  'Los elementos gaseosos son H, N, O, F, Cl y los gases nobles (del oganesón aún no se sabe).';

export function elementToMass(el: ChemicalElement): Question | null {
  const mass = formatMass(el);
  const explanation = el.massIsMassNumber
    ? `${withArticleCap(el)} no tiene isótopos estables: ${mass} es el número másico de su isótopo más estable.`
    : `La masa atómica ${ofElement(el)} (Z = ${el.atomicNumber}) es ${mass} u.`;
  return buildMultipleChoice({
    type: 'element-to-mass',
    el,
    prompt: `¿Cuál es la masa atómica ${ofElement(el)}?`,
    subject: el.symbol,
    correct: { label: mass },
    candidates: [...windowElements(el.atomicNumber), ...nearbyElements(el.atomicNumber, 8)].map((e) => ({
      label: formatMass(e),
    })),
    explanation,
    difficulty: 3,
  });
}

function familyOfGroup(el: ChemicalElement): string {
  if (el.group === 1 && el.category === 'alkali-metal') return ', el de los metales alcalinos';
  if (el.group === 1) return ' (aunque no es un metal alcalino)';
  if (el.group === 2) return ', el de los alcalinotérreos';
  if (el.group === 17) return ', el de los halógenos';
  if (el.group === 18) return ', el de los gases nobles';
  return '';
}

export function elementToGroup(el: ChemicalElement): Question | null {
  if (el.group === null) return null;
  return buildMultipleChoice({
    type: 'element-to-group',
    el,
    prompt: `¿En qué grupo está ${withArticle(el)}?`,
    subject: el.symbol,
    correct: { label: `Grupo ${el.group}` },
    candidates: [...windowValues(el.group, 1, 18), ...nearbyValues(el.group, 1, 18, 17)].map((g) => ({
      label: `Grupo ${g}`,
    })),
    explanation: `${withArticleCap(el)} está en el grupo ${el.group}${familyOfGroup(el)}. Periodo ${el.period}.`,
    difficulty: elementDifficulty(el),
  });
}

export function elementToPeriod(el: ChemicalElement): Question | null {
  const fRow =
    el.group === null
      ? ` En la tabla se dibuja aparte, en la fila de los ${el.category === 'actinide' ? 'actínidos' : 'lantánidos'}.`
      : '';
  return buildMultipleChoice({
    type: 'element-to-period',
    el,
    prompt: `¿En qué periodo está ${withArticle(el)}?`,
    subject: el.symbol,
    correct: { label: `Periodo ${el.period}` },
    candidates: [...windowValues(el.period, 1, 7), ...nearbyValues(el.period, 1, 7, 6)].map((p) => ({
      label: `Periodo ${p}`,
    })),
    explanation: `${withArticleCap(el)} está en el periodo ${el.period}: la fila ${el.period} de la tabla.${fRow}`,
    difficulty: elementDifficulty(el),
  });
}

/**
 * `true` si decir que `el` es un `category` NO es claramente falso, así que esa familia no puede ser
 * una respuesta incorrecta sobre `el` (ni `el` un distractor de "¿Cuál de estos es un <category>?"):
 * - su propia familia o una clasificación alternativa (`ALT_CATEGORIES`);
 * - "no metal" para halógenos y gases nobles (también son no metales);
 * - "metal de transición" para lantánidos y actínidos (a veces, "metales de transición internos").
 */
export function isAmbiguousCategoryFor(el: ChemicalElement, category: ElementCategory): boolean {
  if (category === el.category || (ALT_CATEGORIES[el.atomicNumber] ?? []).includes(category)) return true;
  if (category === 'nonmetal') return metallicCharacter(el.category) === 'nonmetal';
  if (category === 'transition-metal') return el.category === 'lanthanide' || el.category === 'actinide';
  return false;
}

export function categorySentence(el: ChemicalElement): string {
  const meta = CATEGORIES[el.category];
  return `${withArticleCap(el)} (${el.symbol}) es un ${meta.singular.toLowerCase()}. ${meta.blurb}`;
}

export function elementToCategory(el: ChemicalElement): Question | null {
  const others = shuffle(CATEGORY_ORDER.filter((c) => !isAmbiguousCategoryFor(el, c)));
  return buildMultipleChoice({
    type: 'element-to-category',
    el,
    prompt: `¿A qué familia pertenece ${withArticle(el)}?`,
    subject: el.symbol,
    correct: { label: CATEGORIES[el.category].singular },
    candidates: others.map((c) => ({ label: CATEGORIES[c].singular })),
    explanation: categorySentence(el),
    difficulty: elementDifficulty(el),
  });
}

const PHASE_NOTES: Record<number, string> = {
  31: ' Curiosidad: se funde a unos 30 °C, ¡con el calor de tu mano!',
  55: ' Curiosidad: se funde a unos 28 °C.',
};

function phaseExplanation(el: ChemicalElement): string {
  if (el.phase === 'liquid') {
    return `${withArticleCap(el)} está en estado líquido a temperatura ambiente. Solo dos elementos lo están: el mercurio (Hg) y el bromo (Br).`;
  }
  if (el.phase === 'gas') {
    return `${withArticleCap(el)} es un gas a temperatura ambiente. ${GASEOUS_ELEMENTS_NOTE}`;
  }
  return `${withArticleCap(el)} está en estado sólido a temperatura ambiente, como la mayoría de los elementos.${PHASE_NOTES[el.atomicNumber] ?? ''}`;
}

export function elementToPhase(el: ChemicalElement): Question | null {
  if (!hasKnownPhase(el)) return null;
  return buildMultipleChoice({
    type: 'element-to-phase',
    el,
    prompt: `¿En qué estado está ${withArticle(el)} a temperatura ambiente (25 °C)?`,
    subject: el.symbol,
    correct: { label: PHASE_LABELS[el.phase] },
    candidates: shuffle([PHASE_LABELS.solid, PHASE_LABELS.liquid, PHASE_LABELS.gas, 'Plasma']).map((label) => ({
      label,
    })),
    explanation: phaseExplanation(el),
    difficulty: elementDifficulty(el),
  });
}

export function elementToConfiguration(el: ChemicalElement): Question | null {
  const correct = formatConfig(el.electronConfiguration);
  const predicted = el.predicted ? ' (es una predicción teórica)' : '';
  return buildMultipleChoice({
    type: 'element-to-configuration',
    el,
    prompt: `¿Cuál es la configuración electrónica ${ofElement(el)}?`,
    subject: el.symbol,
    correct: { label: correct },
    candidates: [...windowElements(el.atomicNumber), ...nearbyElements(el.atomicNumber, 4)].map((e) => ({
      label: formatConfig(e.electronConfiguration),
    })),
    explanation: `${withArticleCap(el)} tiene ${el.atomicNumber} ${pluralize(el.atomicNumber, 'electrón', 'electrones')}: ${correct}${predicted}.`,
    difficulty: 3,
  });
}
