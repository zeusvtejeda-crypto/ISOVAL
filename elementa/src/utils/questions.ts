import { ELEMENTS_BY_NUMBER, getElement } from '@/data/elements';
import type {
  ChemicalElement,
  ExamTopic,
  ProgressState,
  Question,
  QuestionGenOptions,
  QuestionType,
} from '@/types';
import { classificationQuestion } from './question-gen/classification';
import {
  elementToCategory,
  elementToConfiguration,
  elementToGroup,
  elementToMass,
  elementToPeriod,
  elementToPhase,
  hasContestedCategory,
  hasKnownPhase,
} from './question-gen/facts';
import { elementToNumber, nameToSymbol, numberToElement, symbolToName } from './question-gen/identity';
import { locationQuestion, locationVariants } from './question-gen/location';
import { ALL_QUESTION_TYPES, MC_TYPES, QUESTION_TYPE_META, TABLE_TYPES } from './question-gen/meta';
import { propertyQuestion, propertyVariants } from './question-gen/property';
import {
  SELECTABLE_CATEGORIES,
  tableFindElement,
  tableFindNumber,
  tableGroupMember,
  tableSelectCategory,
} from './question-gen/table';
import { shuffle, weightedSample } from './random';
import { adaptivePool, ALL_ATOMIC_NUMBERS, selectionWeight } from './selection';

export { MC_TYPES, QUESTION_TYPE_META, TABLE_TYPES, ALL_QUESTION_TYPES };
export { answerAttribution, checkTableAnswer, describeTableSelection, type AnswerAttribution } from './answer-check';
export type { QuestionTypeMeta } from './question-gen/meta';

const GENERATORS: Record<QuestionType, (el: ChemicalElement) => Question | null> = {
  'symbol-to-name': symbolToName,
  'name-to-symbol': nameToSymbol,
  'number-to-element': numberToElement,
  'element-to-number': elementToNumber,
  'element-to-mass': elementToMass,
  'element-to-group': elementToGroup,
  'element-to-period': elementToPeriod,
  'element-to-category': elementToCategory,
  'element-to-phase': elementToPhase,
  'element-to-configuration': elementToConfiguration,
  location: (el) => locationQuestion(el),
  property: (el) => propertyQuestion(el),
  classification: classificationQuestion,
  'table-find-element': tableFindElement,
  'table-find-number': tableFindNumber,
  'table-select-category': tableSelectCategory,
  'table-group-member': tableGroupMember,
};

/** ¿Se puede preguntar este tipo sobre este elemento sin ambigüedad? */
export function isApplicable(type: QuestionType, el: ChemicalElement): boolean {
  switch (type) {
    case 'element-to-group':
    case 'table-group-member':
      return el.group !== null;
    case 'element-to-phase':
      return hasKnownPhase(el);
    case 'location':
      return locationVariants(el).length > 0;
    case 'property':
      return propertyVariants(el).length > 0;
    case 'classification':
      return !hasContestedCategory(el);
    case 'table-select-category':
      return SELECTABLE_CATEGORIES.includes(el.category);
    default:
      return true;
  }
}

/** Genera una pregunta del tipo dado sobre el elemento, o `null` si no aplica. */
export function generateQuestion(type: QuestionType, atomicNumber: number): Question | null {
  const el = ELEMENTS_BY_NUMBER[atomicNumber];
  if (!el || !isApplicable(type, el)) return null;
  return GENERATORS[type](el);
}

/** Primer tipo (en orden aleatorio) que produce una pregunta válida para `z`. */
function questionForElement(
  z: number,
  types: readonly QuestionType[],
  maxDifficulty: 1 | 2 | 3,
  used: ReadonlySet<string>,
): Question | null {
  const el = getElement(z);
  for (const type of shuffle(types)) {
    if (used.has(`${type}:${z}`) || !isApplicable(type, el)) continue;
    // Las variantes aleatorias (ubicación, propiedades) pueden variar de dificultad: reintenta.
    for (let attempt = 0; attempt < 3; attempt++) {
      const q = GENERATORS[type](el);
      if (q && q.difficulty <= maxDifficulty) return q;
      if (!q) break;
    }
  }
  return null;
}

/**
 * Firma de "la misma pregunta": varios elementos pueden producir el mismo enunciado
 * ("Selecciona todos los gases nobles", "Toca un elemento del grupo 1"); no deben repetirse en una sesión.
 */
export function questionSignature(q: Pick<Question, 'type' | 'prompt' | 'subject'>): string {
  return `${q.type}|${q.subject ?? ''}|${q.prompt}`;
}

function validPool(pool: readonly number[] | undefined): number[] {
  const src = pool && pool.length > 0 ? pool : ALL_ATOMIC_NUMBERS;
  return Array.from(new Set(src.filter((z) => ELEMENTS_BY_NUMBER[z] !== undefined)));
}

/**
 * Genera un conjunto de preguntas. Con `state` y `adaptive` (por defecto) los elementos se eligen
 * ponderando por prioridad (fallos, repasos pendientes, nuevos, lentos). Con `uniqueElements`
 * (por defecto) no se repite elemento hasta agotar el `pool`; nunca se repite el mismo tipo+elemento.
 * Puede devolver menos de `count` si el `pool`/`types` no dan para más.
 */
export function generateQuestions(opts: QuestionGenOptions, state?: ProgressState, now: Date = new Date()): Question[] {
  const count = Math.max(0, Math.floor(opts.count));
  const types = opts.types && opts.types.length > 0 ? opts.types : MC_TYPES;
  const pool = validPool(opts.pool);
  const maxDifficulty = opts.maxDifficulty ?? 3;
  const adaptive = (opts.adaptive ?? true) && state !== undefined;
  const unique = opts.uniqueElements ?? true;

  const order = (): number[] =>
    adaptive && state ? adaptivePool(state, now, pool.length, pool) : shuffle(pool);
  const weights = adaptive && state ? pool.map((z) => selectionWeight(state, z, now)) : pool.map(() => 1);

  const out: Question[] = [];
  const used = new Set<string>();
  const signatures = new Set<string>();
  let queue = unique ? order() : [];
  let attempts = 0;
  const maxAttempts = count * 6 + pool.length * 4;

  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    let z: number;
    if (unique) {
      if (queue.length === 0) queue = order();
      z = queue.shift() as number;
    } else {
      z = weightedSample(pool, weights, 1)[0];
    }
    const q = questionForElement(z, types, maxDifficulty, used);
    if (!q) continue;
    used.add(`${q.type}:${z}`);
    const signature = questionSignature(q);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    out.push(q);
  }
  return out;
}

export interface AdaptiveQuestionOptions {
  types?: QuestionType[];
  pool?: number[];
  /** Elementos a evitar (p. ej. los últimos preguntados). Se ignora si deja el pool vacío. */
  exclude?: number[];
  maxDifficulty?: 1 | 2 | 3;
}

/** Siempre devuelve una pregunta (para modos infinitos: contrarreloj, supervivencia, racha…). */
export function generateAdaptiveQuestion(
  state: ProgressState,
  now: Date,
  opts: AdaptiveQuestionOptions = {},
): Question {
  const pool = validPool(opts.pool);
  const excluded = new Set(opts.exclude ?? []);
  const candidates = pool.filter((z) => !excluded.has(z));
  const usable = candidates.length > 0 ? candidates : pool;
  const types = opts.types && opts.types.length > 0 ? opts.types : MC_TYPES;
  const none = new Set<string>();

  for (const z of adaptivePool(state, now, Math.min(12, usable.length), usable)) {
    const q = questionForElement(z, types, opts.maxDifficulty ?? 3, none);
    if (q) return q;
  }
  for (const z of shuffle(usable)) {
    const q = questionForElement(z, types, 3, none);
    if (q) return q;
  }
  const onlyTable = types.every((t) => QUESTION_TYPE_META[t].kind !== 'multiple-choice');
  const fallback = onlyTable ? tableFindElement : symbolToName;
  return fallback(getElement(usable[0])) as Question;
}

/** Tipos de pregunta que cubren los temas elegidos (examen personalizado). */
export function typesForTopics(topics: ExamTopic[]): QuestionType[] {
  const set = new Set(topics);
  const types = ALL_QUESTION_TYPES.filter((t) => set.has(QUESTION_TYPE_META[t].topic));
  return types.length > 0 ? types : [...MC_TYPES];
}
