import type { StudyBlock } from '@/data/blocks';
import type { ElementProgress, MasteryTier, ProgressState } from '@/types';
import { MASTERED_THRESHOLD, masteryTier } from '@/utils/mastery';

/** Nuevo · En progreso · Completado (todos aprendidos). */
export type GroupStatus = 'new' | 'progress' | 'done';

export interface GroupProgress {
  total: number;
  /** Elementos marcados como aprendidos. */
  learned: number;
  /** Elementos con dominio ≥ 85. */
  mastered: number;
  /** Elementos con al menos una respuesta. */
  practiced: number;
  /** Dominio medio 0–100 (los no vistos cuentan como 0). */
  avgMastery: number;
  status: GroupStatus;
}

/** Aspecto de una mini casilla: sin practicar o el nivel de dominio. */
export type MiniTileTone = 'unseen' | MasteryTier;

function answered(p: ElementProgress | undefined): boolean {
  return p !== undefined && p.correct + p.incorrect > 0;
}

/** Tono de la mini casilla de un elemento (igual criterio que la leyenda de dominio de la tabla). */
export function miniTileTone(p: ElementProgress | undefined, mastery: number): MiniTileTone {
  return answered(p) ? masteryTier(mastery) : 'unseen';
}

/** Progreso agregado de un grupo de elementos (bloque o familia). */
export function groupProgress(
  atomicNumbers: readonly number[],
  state: ProgressState,
  mastery: Readonly<Record<number, number>>,
): GroupProgress {
  let learned = 0;
  let mastered = 0;
  let practiced = 0;
  let masterySum = 0;
  for (const z of atomicNumbers) {
    const p = state.elements[z];
    const m = mastery[z] ?? 0;
    if (p?.learned) learned += 1;
    if (answered(p)) practiced += 1;
    if (m >= MASTERED_THRESHOLD) mastered += 1;
    masterySum += m;
  }
  const total = atomicNumbers.length;
  const status: GroupStatus =
    total > 0 && learned === total ? 'done' : learned > 0 || practiced > 0 ? 'progress' : 'new';
  return {
    total,
    learned,
    mastered,
    practiced,
    avgMastery: total > 0 ? Math.round(masterySum / total) : 0,
    status,
  };
}

export interface BlockSuggestion {
  block: StudyBlock;
  /** `continue`: bloque empezado · `start`: bloque nuevo · `review`: todo aprendido, reforzar el más flojo. */
  reason: 'continue' | 'start' | 'review';
}

/**
 * Siguiente bloque a estudiar: el primero (en orden) sin completar, igual que el orden de
 * «Aprende 5». Si todos están completos, el de menor dominio medio para repasarlo.
 */
export function suggestNextBlock(
  blocks: readonly StudyBlock[],
  progress: Readonly<Record<string, GroupProgress>>,
): BlockSuggestion | null {
  const pending = blocks.find((b) => progress[b.id]?.status !== 'done');
  if (pending) {
    return { block: pending, reason: progress[pending.id]?.status === 'progress' ? 'continue' : 'start' };
  }
  let weakest: StudyBlock | null = null;
  for (const b of blocks) {
    if (!weakest || (progress[b.id]?.avgMastery ?? 0) < (progress[weakest.id]?.avgMastery ?? 0)) weakest = b;
  }
  return weakest ? { block: weakest, reason: 'review' } : null;
}
