import { getFamilyGroup, getStudyBlock } from '@/data/blocks';
import { ELEMENTS_BY_NUMBER, TOTAL_ELEMENTS } from '@/data/elements';
import type { ElementCategory, ProgressState } from '@/types';
import { adaptivePool, dueReviews, newElements, weakElements } from '@/utils/planner';
import { sample, shuffle, type Rng } from '@/utils/random';
import { ALL_ATOMIC_NUMBERS } from '@/utils/selection';
import type { FlashcardMode } from './modes';

/** De dónde salen las tarjetas del mazo. */
export type DeckSelection =
  | { kind: 'smart' }
  | { kind: 'all' }
  | { kind: 'block'; id: string }
  | { kind: 'family'; id: ElementCategory }
  | { kind: 'mistakes' }
  | { kind: 'custom'; elements: readonly number[]; title?: string };

export type DeckKind = DeckSelection['kind'];

export const DECK_SIZES = [10, 20, 30] as const;
export type DeckSize = (typeof DECK_SIZES)[number];
export const DEFAULT_DECK_SIZE: DeckSize = 10;

/** Parte de los "nuevos" en el repaso inteligente (mín. 2): 10 → 2, 20 → 4, 30 → 6. */
const NEW_SHARE = 0.2;
/** Parte de los repasos pendientes antes de dar paso a los difíciles. */
const DUE_SHARE = 0.6;

/** Números atómicos válidos (1–118), sin repetir y en el orden dado. */
export function sanitizeElements(values: Iterable<number>): number[] {
  const out: number[] = [];
  for (const z of values) {
    if (Number.isInteger(z) && ELEMENTS_BY_NUMBER[z] !== undefined && !out.includes(z)) out.push(z);
  }
  return out;
}

/** Solo los elementos que tienen tarjeta en este modo (p. ej. sin bloque f en «Grupo»). */
export function applicableNumbers(mode: FlashcardMode, pool: readonly number[]): number[] {
  return pool.filter((z) => {
    const el = ELEMENTS_BY_NUMBER[z];
    return el !== undefined && mode.applies(el);
  });
}

/** Elementos débiles (intentados y no dominados), del menor dominio al mayor. */
export function weakNumbers(state: ProgressState, now: Date): number[] {
  return weakElements(state, now, TOTAL_ELEMENTS).map((w) => w.atomicNumber);
}

/**
 * Candidatos del mazo antes de aplicar el tamaño (ya filtrados por el modo).
 * Sirve para contar cuántas tarjetas hay disponibles en el selector.
 */
export function deckPool(selection: DeckSelection, state: ProgressState, now: Date, mode: FlashcardMode): number[] {
  switch (selection.kind) {
    case 'smart':
    case 'all':
      return applicableNumbers(mode, ALL_ATOMIC_NUMBERS);
    case 'block':
      return applicableNumbers(mode, getStudyBlock(selection.id)?.atomicNumbers ?? []);
    case 'family':
      return applicableNumbers(mode, getFamilyGroup(selection.id)?.atomicNumbers ?? []);
    case 'mistakes':
      return applicableNumbers(mode, weakNumbers(state, now));
    case 'custom':
      return applicableNumbers(mode, sanitizeElements(selection.elements));
  }
}

/** Nº de tarjetas que tendrá el mazo (el mazo personalizado usa todos sus elementos). */
export function deckCount(selection: DeckSelection, poolSize: number, size: number): number {
  return selection.kind === 'custom' ? poolSize : Math.min(poolSize, size);
}

/**
 * Repaso inteligente: repasos pendientes + elementos débiles + algunos nuevos; si faltan,
 * se completa con una selección adaptativa (ponderada por prioridad).
 */
export function smartDeck(
  state: ProgressState,
  now: Date,
  size: number,
  pool: readonly number[],
  rng: Rng = Math.random,
): number[] {
  const target = Math.min(size, pool.length);
  const allowed = new Set(pool);
  const picked: number[] = [];
  const has = new Set<number>();
  const take = (candidates: readonly number[], limit: number) => {
    let added = 0;
    for (const z of candidates) {
      if (picked.length >= target || added >= limit) return;
      if (!allowed.has(z) || has.has(z)) continue;
      picked.push(z);
      has.add(z);
      added += 1;
    }
  };

  const newQuota = Math.max(2, Math.round(size * NEW_SHARE));
  const reviewQuota = Math.max(0, target - newQuota);
  const due = dueReviews(state, now, TOTAL_ELEMENTS);
  take(due, Math.ceil(reviewQuota * DUE_SHARE));
  take(weakNumbers(state, now), reviewQuota - picked.length);
  take(due, reviewQuota - picked.length);
  take(newElements(state, newQuota + picked.length, [...pool]), newQuota);

  const rest = pool.filter((z) => !has.has(z));
  take(adaptivePool(state, now, target - picked.length, rest, rng), target);
  return shuffle(picked, rng);
}

/** Mazo final (barajado salvo el personalizado, que respeta el orden dado). Llamar en handlers. */
export function buildDeck(
  selection: DeckSelection,
  state: ProgressState,
  now: Date,
  mode: FlashcardMode,
  size: number,
  rng: Rng = Math.random,
): number[] {
  const pool = deckPool(selection, state, now, mode);
  switch (selection.kind) {
    case 'smart':
      return smartDeck(state, now, size, pool, rng);
    case 'all':
      return sample(pool, size, rng);
    case 'block':
    case 'family':
      return shuffle(adaptivePool(state, now, Math.min(size, pool.length), pool, rng), rng);
    case 'mistakes':
      return shuffle(pool.slice(0, size), rng);
    case 'custom':
      return pool;
  }
}

/** Nombre corto del mazo: "Repaso inteligente", "Bloque 3 · 21–30", "Gases nobles"… */
export function deckTitle(selection: DeckSelection): string {
  switch (selection.kind) {
    case 'smart':
      return 'Repaso inteligente';
    case 'all':
      return 'Todos los elementos';
    case 'block': {
      const block = getStudyBlock(selection.id);
      return block ? `${block.title} · ${block.range}` : 'Bloque';
    }
    case 'family':
      return getFamilyGroup(selection.id)?.title ?? 'Familia';
    case 'mistakes':
      return 'Mis errores';
    case 'custom':
      return selection.title ?? 'Tu selección';
  }
}

export function sameSelection(a: DeckSelection, b: DeckSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'block' && b.kind === 'block') return a.id === b.id;
  if (a.kind === 'family' && b.kind === 'family') return a.id === b.id;
  return true;
}
