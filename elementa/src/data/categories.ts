import type { ElementCategory, Phase } from '@/types';

export interface CategoryMeta {
  id: ElementCategory;
  /** Nombre en plural para familias: "Gases nobles". */
  label: string;
  /** Nombre en singular: "Gas noble". */
  singular: string;
  emoji: string;
  /** Explicación de una línea para aprender la familia. */
  blurb: string;
  /**
   * Clases de Tailwind literales (para que el compilador las detecte).
   * Los colores se definen en globals.css como --color-cat-<id> y --color-cat-<id>-soft.
   */
  tileClass: string; // fondo suave + borde + texto de la casilla
  solidClass: string; // fondo sólido + texto legible en ambos temas (chips, puntos, leyenda)
  textClass: string; // texto con el color de la categoría
}

export const CATEGORIES: Record<ElementCategory, CategoryMeta> = {
  'alkali-metal': {
    id: 'alkali-metal',
    label: 'Metales alcalinos',
    singular: 'Metal alcalino',
    emoji: '💥',
    blurb: 'Grupo 1 (sin el H): muy reactivos, blandos y reaccionan con el agua.',
    tileClass: 'bg-cat-alkali-metal-soft border-cat-alkali-metal text-fg',
    solidClass: 'bg-cat-alkali-metal text-white dark:text-bg',
    textClass: 'text-cat-alkali-metal',
  },
  'alkaline-earth-metal': {
    id: 'alkaline-earth-metal',
    label: 'Alcalinotérreos',
    singular: 'Metal alcalinotérreo',
    emoji: '🦴',
    blurb: 'Grupo 2: metales reactivos, forman iones 2+ (como el calcio de los huesos).',
    tileClass: 'bg-cat-alkaline-earth-metal-soft border-cat-alkaline-earth-metal text-fg',
    solidClass: 'bg-cat-alkaline-earth-metal text-white dark:text-bg',
    textClass: 'text-cat-alkaline-earth-metal',
  },
  'transition-metal': {
    id: 'transition-metal',
    label: 'Metales de transición',
    singular: 'Metal de transición',
    emoji: '⚙️',
    blurb: 'Grupos 3–12 (bloque d): duros, buenos conductores y con muchos estados de oxidación.',
    tileClass: 'bg-cat-transition-metal-soft border-cat-transition-metal text-fg',
    solidClass: 'bg-cat-transition-metal text-white dark:text-bg',
    textClass: 'text-cat-transition-metal',
  },
  'post-transition-metal': {
    id: 'post-transition-metal',
    label: 'Metales postransición',
    singular: 'Metal postransición',
    emoji: '🥫',
    blurb: 'Metales del bloque p: más blandos y con puntos de fusión más bajos.',
    tileClass: 'bg-cat-post-transition-metal-soft border-cat-post-transition-metal text-fg',
    solidClass: 'bg-cat-post-transition-metal text-white dark:text-bg',
    textClass: 'text-cat-post-transition-metal',
  },
  metalloid: {
    id: 'metalloid',
    label: 'Metaloides',
    singular: 'Metaloide',
    emoji: '💻',
    blurb: 'Propiedades intermedias entre metales y no metales; muchos son semiconductores.',
    tileClass: 'bg-cat-metalloid-soft border-cat-metalloid text-fg',
    solidClass: 'bg-cat-metalloid text-white dark:text-bg',
    textClass: 'text-cat-metalloid',
  },
  nonmetal: {
    id: 'nonmetal',
    label: 'No metales',
    singular: 'No metal',
    emoji: '🌿',
    blurb: 'Malos conductores; forman la base de la vida (C, H, O, N, P, S).',
    tileClass: 'bg-cat-nonmetal-soft border-cat-nonmetal text-fg',
    solidClass: 'bg-cat-nonmetal text-white dark:text-bg',
    textClass: 'text-cat-nonmetal',
  },
  halogen: {
    id: 'halogen',
    label: 'Halógenos',
    singular: 'Halógeno',
    emoji: '🧂',
    blurb: 'Grupo 17: muy reactivos; con metales forman sales (halógeno = "formador de sal").',
    tileClass: 'bg-cat-halogen-soft border-cat-halogen text-fg',
    solidClass: 'bg-cat-halogen text-white dark:text-bg',
    textClass: 'text-cat-halogen',
  },
  'noble-gas': {
    id: 'noble-gas',
    label: 'Gases nobles',
    singular: 'Gas noble',
    emoji: '🎈',
    blurb: 'Grupo 18: capa externa completa, casi no reaccionan.',
    tileClass: 'bg-cat-noble-gas-soft border-cat-noble-gas text-fg',
    solidClass: 'bg-cat-noble-gas text-white dark:text-bg',
    textClass: 'text-cat-noble-gas',
  },
  lanthanide: {
    id: 'lanthanide',
    label: 'Lantánidos',
    singular: 'Lantánido',
    emoji: '🧲',
    blurb:
      'Serie del 57 al 71 que se dibuja aparte, bajo la tabla: junto con Sc e Y forman las "tierras raras" de imanes y pantallas.',
    tileClass: 'bg-cat-lanthanide-soft border-cat-lanthanide text-fg',
    solidClass: 'bg-cat-lanthanide text-white dark:text-bg',
    textClass: 'text-cat-lanthanide',
  },
  actinide: {
    id: 'actinide',
    label: 'Actínidos',
    singular: 'Actínido',
    emoji: '☢️',
    blurb: 'Segunda fila del bloque f (89–103): todos radiactivos.',
    tileClass: 'bg-cat-actinide-soft border-cat-actinide text-fg',
    solidClass: 'bg-cat-actinide text-white dark:text-bg',
    textClass: 'text-cat-actinide',
  },
};

/** Orden de presentación (leyenda, filtros, estudio por familias). */
export const CATEGORY_ORDER: ElementCategory[] = [
  'alkali-metal',
  'alkaline-earth-metal',
  'transition-metal',
  'post-transition-metal',
  'metalloid',
  'nonmetal',
  'halogen',
  'noble-gas',
  'lanthanide',
  'actinide',
];

export const PHASE_LABELS: Record<Phase, string> = {
  solid: 'Sólido',
  liquid: 'Líquido',
  gas: 'Gas',
  unknown: 'Desconocido',
};

export const PHASE_EMOJI: Record<Phase, string> = {
  solid: '🧊',
  liquid: '💧',
  gas: '💨',
  unknown: '❓',
};

/** Metal / no metal / metaloide a partir de la categoría. */
export function metallicCharacter(category: ElementCategory): 'metal' | 'nonmetal' | 'metalloid' {
  if (category === 'metalloid') return 'metalloid';
  if (category === 'nonmetal' || category === 'halogen' || category === 'noble-gas') return 'nonmetal';
  return 'metal';
}
