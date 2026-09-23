import { improvedElements, type TallyEntry } from '@/components/quiz/session-tally';
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
  /** «Hoy mejoraste»: siempre «Lo sabía»/«Muy fácil», nunca «No lo sabía»/«Casi», y el dominio subió. */
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

/** «Lo sabía» y «Muy fácil» cuentan como acierto; «No lo sabía» y «Casi», como fallo. */
export function isKnownRating(rating: FlashcardRating): boolean {
  return rating === 'good' || rating === 'easy';
}

/** Las calificaciones como respuestas del recuento de sesión (`session-tally`). */
export function tallyEntries(reviews: readonly ReviewRecord[]): TallyEntry[] {
  return reviews.map((r) => ({ atomicNumber: r.atomicNumber, correct: isKnownRating(r.rating) }));
}

/** «Elementos que debes repasar»: calificados «No lo sabía» o «Casi» alguna vez («No lo sabía» primero). */
export function difficultCards(reviews: readonly ReviewRecord[]): number[] {
  const again: number[] = [];
  const hard: number[] = [];
  for (const r of reviews) {
    if (r.rating === 'again' && !again.includes(r.atomicNumber)) again.push(r.atomicNumber);
    if (r.rating === 'hard' && !hard.includes(r.atomicNumber)) hard.push(r.atomicNumber);
  }
  return [...again, ...hard.filter((z) => !again.includes(z))];
}

/**
 * «Hoy mejoraste» con la regla común de `session-tally`: al menos un «Lo sabía»/«Muy fácil», ningún
 * «No lo sabía»/«Casi» y más dominio que al empezar. Nunca coincide con `difficultCards`.
 */
export function improvedCards(
  reviews: readonly ReviewRecord[],
  masteryStart: Record<number, number>,
  masteryEnd: Record<number, number>,
): number[] {
  return improvedElements(tallyEntries(reviews), masteryStart, masteryEnd);
}
