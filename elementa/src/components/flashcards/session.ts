import type { FlashcardRating } from '@/types';
import type { FlashcardModeId } from './modes';

/** Una calificación dentro de la sesión (una tarjeta puede calificarse varias veces). */
export interface ReviewRecord {
  key: string;
  atomicNumber: number;
  rating: FlashcardRating;
  responseMs: number;
  xp: number;
}

/** Lo que se estudia: modo + elementos en orden + nombre del mazo. */
export interface StudyDeck {
  /** Cambia en cada inicio (reinicia la pantalla de estudio). */
  id: number;
  modeId: FlashcardModeId;
  elements: number[];
  title: string;
}

/** Resultado de una sesión terminada (para el resumen). */
export interface FlashcardSessionResult {
  deck: StudyDeck;
  reviews: ReviewRecord[];
  counts: Record<FlashcardRating, number>;
  /** XP de las tarjetas + bonus por completar la sesión. */
  xpGained: number;
  durationMs: number;
  /** Elementos cuyo dominio subió, mayor mejora primero. */
  improved: number[];
  /** Elementos calificados «No lo sabía» o «Casi» al menos una vez («No lo sabía» primero). */
  difficult: number[];
  unlockedAchievements: string[];
}

export function ratingCounts(reviews: readonly ReviewRecord[]): Record<FlashcardRating, number> {
  const counts: Record<FlashcardRating, number> = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const r of reviews) counts[r.rating] += 1;
  return counts;
}

/** Aciertos para `completeSession`: «Lo sabía» + «Muy fácil». */
export function knownCount(counts: Record<FlashcardRating, number>): number {
  return counts.good + counts.easy;
}

export function difficultElements(reviews: readonly ReviewRecord[]): number[] {
  const again: number[] = [];
  const hard: number[] = [];
  for (const r of reviews) {
    if (r.rating === 'again' && !again.includes(r.atomicNumber)) again.push(r.atomicNumber);
    if (r.rating === 'hard' && !hard.includes(r.atomicNumber)) hard.push(r.atomicNumber);
  }
  return [...again, ...hard.filter((z) => !again.includes(z))];
}

export function improvedElements(start: Record<number, number>, end: Record<number, number>): number[] {
  return Object.keys(end)
    .map(Number)
    .map((z) => ({ z, delta: (end[z] ?? 0) - (start[z] ?? 0) }))
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .map((d) => d.z);
}
