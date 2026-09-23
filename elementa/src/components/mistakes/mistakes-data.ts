import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { MistakeRecord, ProgressState } from '@/types';
import { dateKey, daysBetween } from '@/utils/dates';
import { MASTERED_THRESHOLD, computeMastery } from '@/utils/mastery';
import { pluralize } from '@/utils/format';
import { MONTHS_SHORT } from '@/components/stats/labels';

export interface HardElement {
  atomicNumber: number;
  /** Dominio actual 0–100. */
  mastery: number;
  correct: number;
  incorrect: number;
  /** Aciertos / respuestas (0–1). */
  accuracy: number;
}

/**
 * "Tus elementos más difíciles": los que has fallado alguna vez y aún no dominas,
 * del menor dominio al mayor (a igual dominio, más fallos primero).
 */
export function hardElements(state: ProgressState, now: Date): HardElement[] {
  return Object.values(state.elements)
    .filter((p) => p.incorrect > 0 && ELEMENTS_BY_NUMBER[p.atomicNumber] !== undefined)
    .map((p) => ({
      atomicNumber: p.atomicNumber,
      mastery: computeMastery(p, now),
      correct: p.correct,
      incorrect: p.incorrect,
      accuracy: p.correct / (p.correct + p.incorrect),
    }))
    .filter((h) => h.mastery < MASTERED_THRESHOLD)
    .sort((a, b) => a.mastery - b.mastery || b.incorrect - a.incorrect || a.atomicNumber - b.atomicNumber);
}

export interface MistakeGroup {
  atomicNumber: number;
  count: number;
}

/** Elementos con preguntas falladas guardadas: más errores primero (a igualdad, el más reciente). */
export function mistakeGroups(mistakes: readonly MistakeRecord[]): MistakeGroup[] {
  const counts = new Map<number, number>();
  const firstSeen = new Map<number, number>();
  mistakes.forEach((m, i) => {
    if (!ELEMENTS_BY_NUMBER[m.atomicNumber]) return;
    counts.set(m.atomicNumber, (counts.get(m.atomicNumber) ?? 0) + 1);
    if (!firstSeen.has(m.atomicNumber)) firstSeen.set(m.atomicNumber, i);
  });
  return Array.from(counts.entries())
    .map(([atomicNumber, count]) => ({ atomicNumber, count }))
    .sort(
      (a, b) =>
        b.count - a.count || (firstSeen.get(a.atomicNumber) ?? 0) - (firstSeen.get(b.atomicNumber) ?? 0),
    );
}

/** "Justo ahora", "hace 5 min", "hace 2 h", "Ayer", "hace 3 días", "hace 2 semanas", "12 mar". */
export function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 60_000) return 'Justo ahora';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `hace ${minutes} min`;
  const days = daysBetween(dateKey(then), dateKey(now));
  if (days <= 0) return `hace ${Math.floor(minutes / 60)} h`;
  if (days === 1) return 'Ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `hace ${weeks} ${pluralize(weeks, 'semana', 'semanas')}`;
  }
  const date = `${then.getDate()} ${MONTHS_SHORT[then.getMonth()]}`;
  return then.getFullYear() === now.getFullYear() ? date : `${date} ${then.getFullYear()}`;
}
