import { metallicCharacter } from '@/data/categories';
import { ELEMENTS } from '@/data/elements';
import type { Block, ChemicalElement, Question } from '@/types';
import { elementDifficulty, maxDifficulty } from '../difficulty';
import { pick, shuffle } from '../random';
import { buildMultipleChoice, elementOption, withArticle, withArticleCap } from './helpers';

export type PropertyVariant =
  | 'liquid'
  | 'gas'
  | 'radioactive'
  | 'metal'
  | 'nonmetal'
  | 'metalloid'
  | 'electronegativity'
  | 'block';

/** Casi líquidos a temperatura ambiente (se funden entre 28 y 40 °C): nunca se usan como "no líquidos". */
const NEAR_LIQUID = new Set([31, 37, 55, 87]);
/** Clasificación metálica discutida: no se usan en preguntas metal/no metal/metaloide. */
const BORDERLINE_METALLIC = new Set([34, 84, 85]);
/** Diferencia mínima de electronegatividad para que la respuesta no sea ambigua. */
export const MIN_EN_DIFF = 0.3;
const EN_MIN_DISTRACTORS = 3;

/** Elementos con datos experimentales conocidos (no superpesados ni de fase desconocida). */
const KNOWN = ELEMENTS.filter((e) => !e.predicted && e.phase !== 'unknown');

function hasReliableEn(e: ChemicalElement): boolean {
  return e.electronegativity !== null && !e.predicted && e.block !== 'f' && e.category !== 'noble-gas';
}

function enDistractors(el: ChemicalElement): ChemicalElement[] {
  const en = el.electronegativity;
  if (en === null || !hasReliableEn(el)) return [];
  return ELEMENTS.filter(
    (e) =>
      e.atomicNumber !== el.atomicNumber &&
      hasReliableEn(e) &&
      (e.electronegativity ?? Infinity) <= en - MIN_EN_DIFF + 1e-9,
  );
}

function character(el: ChemicalElement): 'metal' | 'nonmetal' | 'metalloid' | null {
  if (el.predicted || BORDERLINE_METALLIC.has(el.atomicNumber)) return null;
  return metallicCharacter(el.category);
}

/** Variantes de pregunta de propiedades en las que `el` es la respuesta correcta. */
export function propertyVariants(el: ChemicalElement): PropertyVariant[] {
  const out: PropertyVariant[] = ['block'];
  if (el.phase === 'liquid') out.push('liquid');
  if (el.phase === 'gas') out.push('gas');
  if (el.radioactive) out.push('radioactive');
  const ch = character(el);
  if (ch) out.push(ch);
  if (enDistractors(el).length >= EN_MIN_DISTRACTORS) out.push('electronegativity');
  return out;
}

/** Ordena por cercanía en la tabla (mismo periodo o grupo primero) y baraja los más cercanos. */
function closestFirst(el: ChemicalElement, pool: ChemicalElement[], top = 8): ChemicalElement[] {
  const dist = (e: ChemicalElement) =>
    Math.abs(e.atomicNumber - el.atomicNumber) / 10 +
    (e.period === el.period ? 0 : 1) +
    (e.group !== null && e.group === el.group ? -0.5 : 0);
  const sorted = [...pool].sort((a, b) => dist(a) - dist(b));
  return [...shuffle(sorted.slice(0, top)), ...shuffle(sorted.slice(top))];
}

interface VariantSpec {
  prompt: string;
  distractors: ChemicalElement[];
  explanation: string;
}

const CHARACTER_LABEL = { metal: 'un metal', nonmetal: 'un no metal', metalloid: 'un metaloide' } as const;

const BLOCK_SPAN: Record<Block, string> = {
  s: 'los grupos 1 y 2, más el helio',
  p: 'los grupos 13 a 18 (sin el helio)',
  d: 'los grupos 3 a 12 (metales de transición)',
  f: 'los lantánidos y los actínidos',
};

function variantSpec(el: ChemicalElement, variant: Exclude<PropertyVariant, 'block'>): VariantSpec {
  const name = withArticleCap(el);
  switch (variant) {
    case 'liquid':
      return {
        prompt: '¿Cuál de estos elementos es líquido a temperatura ambiente?',
        distractors: closestFirst(
          el,
          KNOWN.filter((e) => e.phase !== 'liquid' && !NEAR_LIQUID.has(e.atomicNumber)),
        ),
        explanation: `${name} es líquido a temperatura ambiente. Solo dos elementos lo son: el mercurio (Hg) y el bromo (Br).`,
      };
    case 'gas':
      return {
        prompt: '¿Cuál de estos elementos es un gas a temperatura ambiente?',
        distractors: closestFirst(el, KNOWN.filter((e) => e.phase === 'solid' || e.phase === 'liquid')),
        explanation: `${name} es un gas a temperatura ambiente. Los elementos gaseosos son H, N, O, F, Cl y los gases nobles.`,
      };
    case 'radioactive':
      return {
        prompt: '¿Cuál de estos elementos es radiactivo?',
        distractors: closestFirst(
          el,
          ELEMENTS.filter((e) => e.atomicNumber <= 82 && !e.radioactive),
        ),
        explanation: `${name} no tiene isótopos estables: es radiactivo. Lo son todos a partir del polonio (84), además del tecnecio (43) y el prometio (61).`,
      };
    case 'metal':
    case 'nonmetal':
    case 'metalloid':
      return {
        prompt: `¿Cuál de estos elementos es ${CHARACTER_LABEL[variant]}?`,
        distractors: closestFirst(
          el,
          ELEMENTS.filter((e) => {
            const ch = character(e);
            return ch !== null && ch !== variant;
          }),
        ),
        explanation: `${name} es ${CHARACTER_LABEL[variant]}. Los metales están a la izquierda de la "escalera" de los metaloides (B, Si, Ge, As, Sb, Te) y los no metales a la derecha (salvo el hidrógeno).`,
      };
    case 'electronegativity':
      return {
        prompt: '¿Cuál de estos elementos es el más electronegativo?',
        distractors: closestFirst(el, enDistractors(el)),
        explanation: `${name} tiene la electronegatividad más alta de estas opciones (${el.electronegativity}). Aumenta hacia arriba y a la derecha de la tabla${
          el.atomicNumber === 9 ? ': ¡el flúor es el máximo de todos!' : '; el máximo es el flúor (3.98).'
        }`,
      };
  }
}

function blockQuestion(el: ChemicalElement): Question | null {
  const blocks: Block[] = ['s', 'p', 'd', 'f'];
  return buildMultipleChoice({
    type: 'property',
    el,
    prompt: `¿En qué bloque de la tabla está ${withArticle(el)}?`,
    subject: el.symbol,
    correct: { label: `Bloque ${el.block}` },
    candidates: shuffle(blocks).map((b) => ({ label: `Bloque ${b}` })),
    explanation: `${withArticleCap(el)} está en el bloque ${el.block}, que abarca ${BLOCK_SPAN[el.block]}.`,
    difficulty: maxDifficulty(elementDifficulty(el), 2),
  });
}

export function propertyQuestion(el: ChemicalElement, variant?: PropertyVariant): Question | null {
  const variants = propertyVariants(el);
  const chosen = variant && variants.includes(variant) ? variant : pick(variants);
  if (chosen === 'block') return blockQuestion(el);
  const spec = variantSpec(el, chosen);
  const base = elementDifficulty(el);
  return buildMultipleChoice({
    type: 'property',
    el,
    prompt: spec.prompt,
    correct: elementOption(el),
    candidates: spec.distractors.map((e) => elementOption(e)),
    explanation: spec.explanation,
    difficulty: chosen === 'electronegativity' ? maxDifficulty(base, 2) : base,
  });
}
