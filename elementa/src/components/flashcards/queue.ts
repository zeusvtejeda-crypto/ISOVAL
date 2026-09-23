import type { FlashcardRating } from '@/types';
import { randomInt, type Rng } from '@/utils/random';

/**
 * Cola de estudio con repetición espaciada dentro de la sesión: una tarjeta calificada
 * «No lo sabía» vuelve 3–4 posiciones después y una «Casi», ~7 después (máx. 2 veces por tarjeta).
 */
export interface QueueCard {
  /** Clave única de esta aparición: `${origin}-${pass}`. */
  key: string;
  atomicNumber: number;
  /** Posición de la tarjeta en el mazo original (identifica la tarjeta entre repeticiones). */
  origin: number;
  /** 0 = primera vez; 1–2 = repetición. */
  pass: number;
}

export const MAX_REQUEUES = 2;

/** Posiciones hacia delante (mín.–máx.) en las que vuelve a salir la tarjeta. */
export const REQUEUE_OFFSET: Partial<Record<FlashcardRating, readonly [number, number]>> = {
  again: [3, 4],
  hard: [6, 8],
};

export function createQueue(deck: readonly number[]): QueueCard[] {
  return deck.map((atomicNumber, origin) => ({ key: `${origin}-0`, atomicNumber, origin, pass: 0 }));
}

/**
 * Tras calificar la tarjeta en `index`: la reinserta más adelante si hace falta y quedan repeticiones.
 * Devuelve la misma cola si no cambia.
 */
export function requeue(
  queue: readonly QueueCard[],
  index: number,
  rating: FlashcardRating,
  rng: Rng = Math.random,
): readonly QueueCard[] {
  const card = queue[index];
  const offset = REQUEUE_OFFSET[rating];
  if (!card || !offset || card.pass >= MAX_REQUEUES) return queue;
  const at = Math.min(queue.length, index + randomInt(offset[0], offset[1], rng));
  const pass = card.pass + 1;
  const copy: QueueCard = { ...card, key: `${card.origin}-${pass}`, pass };
  return [...queue.slice(0, at), copy, ...queue.slice(at)];
}
