import { CATEGORIES } from '@/data/categories';
import { ELEMENTS } from '@/data/elements';
import type { ChemicalElement, ElementCategory, Question, QuestionType } from '@/types';
import { elementDifficulty, type Difficulty } from '../difficulty';
import { uid } from '../random';
import { ALT_CATEGORIES } from './facts';
import { QUESTION_TYPE_META } from './meta';
import { ofElement, positionPhrase, withArticle, withArticleCap } from './helpers';

/** Familias pequeñas que se pueden pedir en "Selecciona todos los…". */
export const SELECTABLE_CATEGORIES: ElementCategory[] = [
  'alkali-metal',
  'alkaline-earth-metal',
  'halogen',
  'noble-gas',
  'metalloid',
  'nonmetal',
];

/**
 * Familias sin un grupo que las defina: su frontera es discutida y los elementos dudosos se aceptan
 * marcados o sin marcar (`optionalAtomicNumbers`).
 */
const CONTESTED_BOUNDARY: ReadonlySet<ElementCategory> = new Set(['metalloid', 'nonmetal']);

/** Grupos cuyos miembros son fáciles de reconocer. */
const EASY_GROUPS = new Set([1, 2, 17, 18]);

/** Aclaraciones sobre la composición de un grupo. */
const GROUP_NOTES: Record<number, string> = {
  3: ' y, según la convención, La y Ac o Lu y Lr (en las filas de abajo)',
};

const andList = new Intl.ListFormat('es', { type: 'conjunction' });
const orList = new Intl.ListFormat('es', { type: 'disjunction' });

function symbolsOf(els: ChemicalElement[]): string {
  return els.map((e) => e.symbol).join(', ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tableQuestion(
  type: QuestionType,
  el: ChemicalElement,
  fields: {
    prompt: string;
    subject: string;
    targets: number[];
    /** Subconjunto de `targets` que se acepta pero no se exige. */
    optional?: number[];
    correctAnswer: string;
    explanation: string;
    difficulty: Difficulty;
  },
): Question {
  const question: Question = {
    id: uid(),
    kind: QUESTION_TYPE_META[type].kind,
    type,
    skill: QUESTION_TYPE_META[type].skill,
    atomicNumber: el.atomicNumber,
    prompt: fields.prompt,
    subject: fields.subject,
    targetAtomicNumbers: fields.targets,
    correctAnswer: fields.correctAnswer,
    explanation: fields.explanation,
    difficulty: fields.difficulty,
  };
  if (fields.optional && fields.optional.length > 0) question.optionalAtomicNumbers = fields.optional;
  return question;
}

function nameWithSymbol(el: ChemicalElement): string {
  return `${el.name} (${el.symbol})`;
}

export function tableFindElement(el: ChemicalElement): Question {
  return tableQuestion('table-find-element', el, {
    prompt: `Toca la casilla ${ofElement(el)}.`,
    subject: el.name,
    targets: [el.atomicNumber],
    correctAnswer: nameWithSymbol(el),
    explanation: `${withArticleCap(el)} (${el.symbol}) está en el ${positionPhrase(el)}.`,
    difficulty: elementDifficulty(el),
  });
}

export function tableFindNumber(el: ChemicalElement): Question {
  const z = el.atomicNumber;
  return tableQuestion('table-find-number', el, {
    prompt: `Encuentra el elemento con número atómico ${z}.`,
    subject: String(z),
    targets: [z],
    correctAnswer: nameWithSymbol(el),
    explanation: `El número atómico ${z} es ${withArticle(el)} (${el.symbol}), en el ${positionPhrase(el)}. Los números crecen de izquierda a derecha y de arriba abajo.`,
    difficulty: elementDifficulty(el),
  });
}

/** Miembros de un grupo en la tabla principal (sin bloque f). */
export function groupMembers(group: number): ChemicalElement[] {
  return ELEMENTS.filter((e) => e.group === group);
}

/**
 * "Toca un elemento del grupo N": `table-select` en el que CUALQUIER miembro del grupo es correcto
 * (`targetAtomicNumbers` contiene todos los miembros).
 */
/**
 * Grupo 3: según la convención, La y Ac (o Lu y Lr) también ocupan el grupo 3. En la app están en las
 * filas del bloque f, pero tocarlos se acepta para no penalizar una respuesta correcta en otras tablas.
 */
const GROUP_3_ALTERNATES = [57, 71, 89, 103];

export function tableGroupMember(el: ChemicalElement): Question | null {
  if (el.group === null) return null;
  const members = groupMembers(el.group);
  const symbols = symbolsOf(members);
  const alternates = el.group === 3 ? GROUP_3_ALTERNATES : [];
  return tableQuestion('table-group-member', el, {
    prompt: `Toca un elemento del grupo ${el.group}.`,
    subject: `Grupo ${el.group}`,
    targets: [...members.map((e) => e.atomicNumber), ...alternates],
    correctAnswer: `Cualquiera del grupo ${el.group}: ${symbols}`,
    explanation: `El grupo ${el.group} es la columna ${el.group} de la tabla: ${symbols}${GROUP_NOTES[el.group] ?? ''}.`,
    difficulty: EASY_GROUPS.has(el.group) ? 1 : 2,
  });
}

/** Miembros de una familia (según la clasificación de la app). */
export function categoryMembers(category: ElementCategory): ChemicalElement[] {
  return ELEMENTS.filter((e) => e.category === category);
}

/**
 * Casillas que "Selecciona todos los <familia>" acepta marcadas o sin marcar. Solo en familias sin
 * grupo propio (metaloides, no metales): los miembros con clasificación alternativa (Po, Se) y los
 * no miembros que a veces se incluyen en la familia (Se, At y Ts entre los metaloides).
 */
export function optionalCategoryMembers(category: ElementCategory): ChemicalElement[] {
  if (!CONTESTED_BOUNDARY.has(category)) return [];
  return ELEMENTS.filter((e) => {
    const alt = ALT_CATEGORIES[e.atomicNumber] ?? [];
    return e.category === category ? alt.length > 0 : alt.includes(category);
  });
}

/** "El Po a veces se clasifica como metal postransición; el Se, el At y el Ts…: vale marcarlos o no." */
function optionalNote(category: ElementCategory, optional: ChemicalElement[]): string {
  const meta = CATEGORIES[category];
  const withArticleSymbol = (e: ChemicalElement) => `el ${e.symbol}`;
  const members = optional.filter((e) => e.category === category);
  const others = optional.filter((e) => e.category !== category);
  const parts = members.map((e) => {
    const alternatives = (ALT_CATEGORIES[e.atomicNumber] ?? []).map((c) => CATEGORIES[c].singular.toLowerCase());
    return `${withArticleSymbol(e)} a veces se clasifica como ${orList.format(alternatives)}`;
  });
  if (others.length > 0) {
    const verb = others.length === 1 ? 'considera' : 'consideran';
    const family = (others.length === 1 ? meta.singular : meta.label).toLowerCase();
    parts.push(`${andList.format(others.map(withArticleSymbol))} a veces se ${verb} ${family}`);
  }
  const pronoun = optional.length === 1 ? 'marcarlo' : 'marcarlos';
  return `${capitalize(parts.join('; '))}: vale ${pronoun} o no.`;
}

export function tableSelectCategory(el: ChemicalElement): Question | null {
  if (!SELECTABLE_CATEGORIES.includes(el.category)) return null;
  const meta = CATEGORIES[el.category];
  const members = categoryMembers(el.category);
  const family = meta.label.toLowerCase();
  const clarification = el.category === 'nonmetal' ? ' (sin contar halógenos ni gases nobles)' : '';
  const prompt = `Selecciona todos los ${family}${clarification}.`;
  const optional = optionalCategoryMembers(el.category);
  if (optional.length === 0) {
    return tableQuestion('table-select-category', el, {
      prompt,
      subject: meta.label,
      targets: members.map((e) => e.atomicNumber),
      correctAnswer: symbolsOf(members),
      explanation: `Los ${family} son ${symbolsOf(members)} (${members.length} en total). ${meta.blurb}`,
      difficulty: 2,
    });
  }
  const optionalSet = new Set(optional.map((e) => e.atomicNumber));
  const required = members.filter((e) => !optionalSet.has(e.atomicNumber));
  return tableQuestion('table-select-category', el, {
    prompt,
    subject: meta.label,
    targets: [...required, ...optional].map((e) => e.atomicNumber).sort((a, b) => a - b),
    optional: optional.map((e) => e.atomicNumber),
    correctAnswer: `${symbolsOf(required)} (también ${optional.length === 1 ? 'vale' : 'valen'} ${symbolsOf(optional)})`,
    explanation: `Los ${family} son ${symbolsOf(required)}. ${meta.blurb} ${optionalNote(el.category, optional)}`,
    difficulty: 2,
  });
}
