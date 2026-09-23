import { CATEGORIES, CATEGORY_ORDER } from '@/data/categories';
import { ELEMENTS, TOTAL_ELEMENTS } from '@/data/elements';
import type { ElementCategory } from '@/types';

export interface StudyBlock {
  /** 'b1' … 'b12'. */
  id: string;
  /** "Bloque 1". */
  title: string;
  /** "1–10". */
  range: string;
  from: number;
  to: number;
  atomicNumbers: number[];
}

export interface FamilyGroup {
  /** Igual a la categoría (se usa en `?family=<id>`). */
  id: ElementCategory;
  category: ElementCategory;
  /** "Gases nobles". */
  title: string;
  emoji: string;
  blurb: string;
  atomicNumbers: number[];
}

const BLOCK_SIZE = 10;

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** 12 bloques de 10 elementos (el último: 111–118). */
export const STUDY_BLOCKS: StudyBlock[] = Array.from(
  { length: Math.ceil(TOTAL_ELEMENTS / BLOCK_SIZE) },
  (_, i) => {
    const from = i * BLOCK_SIZE + 1;
    const to = Math.min(TOTAL_ELEMENTS, from + BLOCK_SIZE - 1);
    return {
      id: `b${i + 1}`,
      title: `Bloque ${i + 1}`,
      range: `${from}–${to}`,
      from,
      to,
      atomicNumbers: range(from, to),
    };
  },
);

/** Familias en el orden de `CATEGORY_ORDER`. */
export const FAMILY_GROUPS: FamilyGroup[] = CATEGORY_ORDER.map((category) => ({
  id: category,
  category,
  title: CATEGORIES[category].label,
  emoji: CATEGORIES[category].emoji,
  blurb: CATEGORIES[category].blurb,
  atomicNumbers: ELEMENTS.filter((el) => el.category === category).map((el) => el.atomicNumber),
}));

export function getStudyBlock(id: string): StudyBlock | undefined {
  return STUDY_BLOCKS.find((b) => b.id === id);
}

export function getFamilyGroup(id: string): FamilyGroup | undefined {
  return FAMILY_GROUPS.find((f) => f.id === id);
}
