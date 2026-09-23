import { CATEGORIES } from '@/data/categories';
import type { ChemicalElement, QuestionSkill } from '@/types';
import { categoryLabel, formatMass, groupLabel } from '@/utils/format';

/** Los 7 modos de flashcards (anverso → reverso). Se usan también en `?mode=<id>`. */
export type FlashcardModeId =
  | 'symbol-name'
  | 'name-symbol'
  | 'number-element'
  | 'element-number'
  | 'element-family'
  | 'element-group'
  | 'element-mass';

/** Contenido de una cara: texto grande + línea secundaria opcional. */
export interface FlashcardFace {
  main: string;
  sub?: string;
  /** Emoji decorativo junto al texto grande (familia). */
  emoji?: string;
}

export interface FlashcardMode {
  id: FlashcardModeId;
  /** "Símbolo → Nombre". */
  title: string;
  /** Qué se ve en el anverso / reverso. */
  frontLabel: string;
  backLabel: string;
  emoji: string;
  /** Habilidad que se registra con `rateFlashcard`. */
  skill: QuestionSkill;
  /** Pregunta del anverso: "¿Qué elemento representa este símbolo?". */
  prompt: string;
  /** Ejemplo corto para el selector (con el Oxígeno): ["O", "Oxígeno"]. */
  example: readonly [string, string];
  /** Nota del selector cuando el modo omite elementos. */
  note?: string;
  applies: (el: ChemicalElement) => boolean;
  front: (el: ChemicalElement) => FlashcardFace;
  back: (el: ChemicalElement) => FlashcardFace;
}

const always = () => true;
/** Anverso "Elemento": nombre grande y símbolo pequeño. */
const elementFace = (el: ChemicalElement): FlashcardFace => ({ main: el.name, sub: el.symbol });

export const FLASHCARD_MODES: readonly FlashcardMode[] = [
  {
    id: 'symbol-name',
    title: 'Símbolo → Nombre',
    frontLabel: 'Símbolo',
    backLabel: 'Nombre',
    emoji: '🔤',
    skill: 'symbol',
    prompt: '¿Qué elemento representa este símbolo?',
    example: ['O', 'Oxígeno'],
    applies: always,
    front: (el) => ({ main: el.symbol }),
    back: (el) => ({ main: el.name }),
  },
  {
    id: 'name-symbol',
    title: 'Nombre → Símbolo',
    frontLabel: 'Nombre',
    backLabel: 'Símbolo',
    emoji: '✍️',
    skill: 'symbol',
    prompt: '¿Cuál es su símbolo?',
    example: ['Oxígeno', 'O'],
    applies: always,
    front: (el) => ({ main: el.name }),
    back: (el) => ({ main: el.symbol }),
  },
  {
    id: 'number-element',
    title: 'Número atómico → Elemento',
    frontLabel: 'Número atómico',
    backLabel: 'Elemento',
    emoji: '🔢',
    skill: 'atomicNumber',
    prompt: '¿Qué elemento tiene este número atómico?',
    example: ['8', 'Oxígeno'],
    applies: always,
    front: (el) => ({ main: String(el.atomicNumber) }),
    back: (el) => ({ main: el.name, sub: el.symbol }),
  },
  {
    id: 'element-number',
    title: 'Elemento → Número atómico',
    frontLabel: 'Elemento',
    backLabel: 'Número atómico',
    emoji: '#️⃣',
    skill: 'atomicNumber',
    prompt: '¿Cuál es su número atómico?',
    example: ['Oxígeno', '8'],
    applies: always,
    front: elementFace,
    back: (el) => ({ main: String(el.atomicNumber) }),
  },
  {
    id: 'element-family',
    title: 'Elemento → Familia',
    frontLabel: 'Elemento',
    backLabel: 'Familia',
    emoji: '🧪',
    skill: 'category',
    prompt: '¿A qué familia pertenece?',
    example: ['Oxígeno', 'No metal'],
    applies: always,
    front: elementFace,
    back: (el) => ({ main: categoryLabel(el.category), emoji: CATEGORIES[el.category].emoji }),
  },
  {
    id: 'element-group',
    title: 'Elemento → Grupo',
    frontLabel: 'Elemento',
    backLabel: 'Grupo',
    emoji: '🧭',
    skill: 'group',
    prompt: '¿En qué grupo de la tabla está?',
    example: ['Oxígeno', 'Grupo 16'],
    note: 'Lantánidos y actínidos no tienen grupo: se omiten.',
    applies: (el) => el.group !== null,
    front: elementFace,
    back: (el) => ({ main: groupLabel(el), sub: `Periodo ${el.period}` }),
  },
  {
    id: 'element-mass',
    title: 'Elemento → Masa atómica',
    frontLabel: 'Elemento',
    backLabel: 'Masa atómica',
    emoji: '⚖️',
    skill: 'atomicMass',
    prompt: '¿Cuál es su masa atómica?',
    example: ['Oxígeno', '15.999'],
    applies: always,
    front: elementFace,
    back: (el) => ({
      main: formatMass(el),
      sub: el.massIsMassNumber ? 'Número másico del isótopo más estable' : 'unidades de masa atómica (u)',
    }),
  },
];

export const DEFAULT_MODE_ID: FlashcardModeId = 'symbol-name';

const MODES_BY_ID = Object.fromEntries(FLASHCARD_MODES.map((m) => [m.id, m])) as Record<FlashcardModeId, FlashcardMode>;

export function isFlashcardModeId(value: string | null | undefined): value is FlashcardModeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MODES_BY_ID, value);
}

export function getFlashcardMode(id: FlashcardModeId): FlashcardMode {
  return MODES_BY_ID[id];
}
