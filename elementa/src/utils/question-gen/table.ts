import { CATEGORIES } from '@/data/categories';
import { ELEMENTS } from '@/data/elements';
import type { ChemicalElement, ElementCategory, Question, QuestionType } from '@/types';
import { elementDifficulty, type Difficulty } from '../difficulty';
import { uid } from '../random';
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

/** Grupos cuyos miembros son fáciles de reconocer. */
const EASY_GROUPS = new Set([1, 2, 17, 18]);

function symbolsOf(els: ChemicalElement[]): string {
  return els.map((e) => e.symbol).join(', ');
}

function tableQuestion(
  type: QuestionType,
  el: ChemicalElement,
  fields: {
    prompt: string;
    subject: string;
    targets: number[];
    correctAnswer: string;
    explanation: string;
    difficulty: Difficulty;
  },
): Question {
  return {
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
export function tableGroupMember(el: ChemicalElement): Question | null {
  if (el.group === null) return null;
  const members = groupMembers(el.group);
  const symbols = symbolsOf(members);
  return tableQuestion('table-group-member', el, {
    prompt: `Toca un elemento del grupo ${el.group}.`,
    subject: `Grupo ${el.group}`,
    targets: members.map((e) => e.atomicNumber),
    correctAnswer: `Cualquiera del grupo ${el.group}: ${symbols}`,
    explanation: `El grupo ${el.group} es la columna ${el.group} de la tabla: ${symbols}.`,
    difficulty: EASY_GROUPS.has(el.group) ? 1 : 2,
  });
}

/** Miembros de una familia (según la clasificación de la app). */
export function categoryMembers(category: ElementCategory): ChemicalElement[] {
  return ELEMENTS.filter((e) => e.category === category);
}

export function tableSelectCategory(el: ChemicalElement): Question | null {
  if (!SELECTABLE_CATEGORIES.includes(el.category)) return null;
  const meta = CATEGORIES[el.category];
  const members = categoryMembers(el.category);
  const family = meta.label.toLowerCase();
  const clarification = el.category === 'nonmetal' ? ' (sin contar halógenos ni gases nobles)' : '';
  return tableQuestion('table-select-category', el, {
    prompt: `Selecciona todos los ${family}${clarification}.`,
    subject: meta.label,
    targets: members.map((e) => e.atomicNumber),
    correctAnswer: symbolsOf(members),
    explanation: `Los ${family} son ${symbolsOf(members)} (${members.length} en total). ${meta.blurb}`,
    difficulty: 2,
  });
}
