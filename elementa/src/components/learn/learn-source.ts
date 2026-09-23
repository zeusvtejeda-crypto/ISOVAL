import { CATEGORIES } from '@/data/categories';
import { getFamilyGroup, getStudyBlock } from '@/data/blocks';
import { ALL_ATOMIC_NUMBERS } from '@/utils/selection';

export type LearnSourceKind = 'all' | 'block' | 'family';

/** De dónde salen los elementos de «Aprende 5» (`?block=<id>` o `?family=<categoría>`). */
export interface LearnSource {
  kind: LearnSourceKind;
  /** Id del bloque ('b3') o de la familia ('noble-gas'); `null` para toda la tabla. */
  id: string | null;
  /** "Bloque 3 · Elementos 21–30" · "Gases nobles" · "Toda la tabla". */
  label: string;
  emoji: string;
  /** Candidatos (número atómico, en orden). */
  pool: number[];
  /** Venía `?block`/`?family` pero no es válido (se usa toda la tabla). */
  invalid: boolean;
}

interface ParamSource {
  get(name: string): string | null;
}

const ALL: Omit<LearnSource, 'invalid'> = {
  kind: 'all',
  id: null,
  label: 'Toda la tabla',
  emoji: '🧪',
  pool: Array.from(ALL_ATOMIC_NUMBERS),
};

/** Lee `?block=` (prioridad) o `?family=`; si no hay o no son válidos, toda la tabla. */
export function resolveLearnSource(params: ParamSource): LearnSource {
  const blockId = params.get('block')?.trim() || null;
  const familyId = params.get('family')?.trim() || null;

  const block = blockId ? getStudyBlock(blockId) : undefined;
  if (block) {
    return {
      kind: 'block',
      id: block.id,
      label: `${block.title} · Elementos ${block.range}`,
      emoji: '🧱',
      pool: block.atomicNumbers,
      invalid: false,
    };
  }

  const family = familyId ? getFamilyGroup(familyId) : undefined;
  if (family) {
    return {
      kind: 'family',
      id: family.id,
      label: family.title,
      emoji: CATEGORIES[family.category].emoji,
      pool: family.atomicNumbers,
      invalid: false,
    };
  }

  return { ...ALL, invalid: blockId !== null || familyId !== null };
}

/** Parámetro de búsqueda para enlazar a otras pantallas con la misma selección. */
export function sourceQuery(source: LearnSource): string {
  if (source.kind === 'block' && source.id) return `block=${encodeURIComponent(source.id)}`;
  if (source.kind === 'family' && source.id) return `family=${encodeURIComponent(source.id)}`;
  return '';
}

/** `/practicar` con la misma selección (toda la tabla → el menú de práctica). */
export function practiceHref(source: LearnSource): string {
  const query = sourceQuery(source);
  return query ? `/practicar?${query}` : '/practicar';
}

/** Flashcards de una lista de elementos (sin lista: el mazo por defecto). */
export function flashcardsHref(atomicNumbers: readonly number[]): string {
  return atomicNumbers.length > 0 && atomicNumbers.length < ALL_ATOMIC_NUMBERS.length
    ? `/flashcards?elements=${atomicNumbers.join(',')}`
    : '/flashcards';
}

/** Práctica de una lista concreta de elementos. */
export function practiceElementsHref(atomicNumbers: readonly number[]): string {
  return atomicNumbers.length > 0 ? `/practicar?elements=${atomicNumbers.join(',')}` : '/practicar';
}
