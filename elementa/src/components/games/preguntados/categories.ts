import type { QuestionType } from '@/types';

export type TriviaCategoryId = 'symbols' | 'numbers' | 'mass' | 'families' | 'location' | 'properties';

export interface TriviaCategory {
  id: TriviaCategoryId;
  emoji: string;
  label: string;
  /** Qué se pregunta, en pocas palabras. */
  hint: string;
  /** Tipos de pregunta de la categoría. */
  types: QuestionType[];
  /** Relleno SVG del gajo de la ruleta. */
  fill: string;
  /** Texto SVG sobre el gajo. */
  ink: string;
  /** Fondo sólido + texto legible (insignias, píldoras). */
  solid: string;
  /** Borde con el color de la categoría. */
  border: string;
  /** Anillo con el color de la categoría. */
  ring: string;
}

/** Las 6 categorías de la ruleta (orden horario desde arriba). Colores de familia: legibles en ambos temas. */
export const TRIVIA_CATEGORIES: readonly TriviaCategory[] = [
  {
    id: 'symbols',
    emoji: '🔤',
    label: 'Símbolos',
    hint: 'Símbolo ↔ nombre',
    types: ['symbol-to-name', 'name-to-symbol'],
    fill: 'fill-cat-noble-gas',
    ink: 'fill-white dark:fill-bg',
    solid: 'bg-cat-noble-gas text-white dark:text-bg',
    border: 'border-cat-noble-gas',
    ring: 'ring-cat-noble-gas',
  },
  {
    id: 'numbers',
    emoji: '🔢',
    label: 'Números',
    hint: 'Número atómico',
    types: ['number-to-element', 'element-to-number'],
    fill: 'fill-cat-transition-metal',
    ink: 'fill-white dark:fill-bg',
    solid: 'bg-cat-transition-metal text-white dark:text-bg',
    border: 'border-cat-transition-metal',
    ring: 'ring-cat-transition-metal',
  },
  {
    id: 'mass',
    emoji: '⚖️',
    label: 'Masa',
    hint: 'Masa atómica',
    types: ['element-to-mass'],
    fill: 'fill-cat-metalloid',
    ink: 'fill-white dark:fill-bg',
    solid: 'bg-cat-metalloid text-white dark:text-bg',
    border: 'border-cat-metalloid',
    ring: 'ring-cat-metalloid',
  },
  {
    id: 'families',
    emoji: '👪',
    label: 'Familias',
    hint: 'Familias y clasificación',
    types: ['element-to-category', 'classification'],
    fill: 'fill-cat-lanthanide',
    ink: 'fill-white dark:fill-bg',
    solid: 'bg-cat-lanthanide text-white dark:text-bg',
    border: 'border-cat-lanthanide',
    ring: 'ring-cat-lanthanide',
  },
  {
    id: 'location',
    emoji: '📍',
    label: 'Ubicación',
    hint: 'Grupo, periodo y vecinos',
    types: ['location', 'element-to-group', 'element-to-period'],
    fill: 'fill-cat-nonmetal',
    ink: 'fill-white dark:fill-bg',
    solid: 'bg-cat-nonmetal text-white dark:text-bg',
    border: 'border-cat-nonmetal',
    ring: 'ring-cat-nonmetal',
  },
  {
    id: 'properties',
    emoji: '🧪',
    label: 'Propiedades',
    hint: 'Estado y propiedades',
    types: ['property', 'element-to-phase'],
    fill: 'fill-cat-alkaline-earth-metal',
    ink: 'fill-white dark:fill-bg',
    solid: 'bg-cat-alkaline-earth-metal text-white dark:text-bg',
    border: 'border-cat-alkaline-earth-metal',
    ring: 'ring-cat-alkaline-earth-metal',
  },
];

export const TRIVIA_CATEGORY_BY_ID = Object.fromEntries(TRIVIA_CATEGORIES.map((c) => [c.id, c])) as Record<
  TriviaCategoryId,
  TriviaCategory
>;

/** Posición (0–5) de la categoría en la ruleta. */
export function categoryIndex(id: TriviaCategoryId): number {
  return TRIVIA_CATEGORIES.findIndex((c) => c.id === id);
}

/** Categoría a la que pertenece un tipo de pregunta. */
export function categoryOfType(type: QuestionType): TriviaCategoryId | null {
  return TRIVIA_CATEGORIES.find((c) => c.types.includes(type))?.id ?? null;
}
