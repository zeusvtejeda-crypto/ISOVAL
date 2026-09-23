import { FAMILY_GROUPS, type FamilyGroup } from '@/data/blocks';
import { ELEMENTS } from '@/data/elements';
import type { DailyActivity, MasteryTier, ProgressState, QuestionSkill } from '@/types';
import { dateKey } from '@/utils/dates';
import { MASTERED_THRESHOLD, masteryTier } from '@/utils/mastery';

/**
 * Cálculos puros para `/estadisticas` (y reutilizados por `/visual`). No usan React ni `Date.now()`:
 * reciben el estado, el mapa de dominio y las claves de día ya calculadas.
 */

type DailyMap = Record<string, DailyActivity>;

/**
 * Actividad de cada día que cuenta para la meta diaria: preguntas de quiz + flashcards calificadas
 * (`DailyActivity.questions`). Es lo que se compara con la meta en «Progreso semanal».
 */
export function activityPerDay(daily: DailyMap, keys: readonly string[]): number[] {
  return keys.map((k) => daily[k]?.questions ?? 0);
}

/** Respuestas de quiz de un día (sin flashcards): la base de la precisión. */
export function quizAnswers(day: DailyActivity | undefined): number {
  if (!day) return 0;
  return Math.max(0, day.questions - (day.flashcards ?? 0));
}

/** Preguntas de quiz respondidas cada día (sin flashcards), igual que el KPI «Preguntas respondidas». */
export function questionsPerDay(daily: DailyMap, keys: readonly string[]): number[] {
  return keys.map((k) => quizAnswers(daily[k]));
}

/**
 * Precisión 0–100 de cada día, solo con respuestas de quiz (`correct / (questions − flashcards)`),
 * igual que «Precisión» y «Precisión general»; `null` si ese día no hubo preguntas de quiz.
 */
export function accuracyPerDay(daily: DailyMap, keys: readonly string[]): Array<number | null> {
  return keys.map((k) => {
    const answered = quizAnswers(daily[k]);
    if (answered <= 0) return null;
    return Math.round((100 * Math.min(daily[k]?.correct ?? 0, answered)) / answered);
  });
}

/** Aciertos y respuestas de quiz sumados en esos días (para la precisión media del periodo). */
export function accuracyTotals(daily: DailyMap, keys: readonly string[]): { correct: number; answered: number } {
  return keys.reduce(
    (acc, k) => {
      const answered = quizAnswers(daily[k]);
      return { correct: acc.correct + Math.min(daily[k]?.correct ?? 0, answered), answered: acc.answered + answered };
    },
    { correct: 0, answered: 0 },
  );
}

/** Día (clave local) en que se aprendió cada elemento aprendido; los antiguos sin fecha cuentan desde siempre. */
function learnedDays(state: ProgressState): string[] {
  const out: string[] = [];
  for (const p of Object.values(state.elements)) {
    if (!p.learned) continue;
    const at = p.learnedAt ? new Date(p.learnedAt) : null;
    out.push(at && !Number.isNaN(at.getTime()) ? dateKey(at) : '0000-00-00');
  }
  return out;
}

/** Elementos aprendidos acumulados al final de cada día. */
export function learnedCumulative(state: ProgressState, keys: readonly string[]): number[] {
  const days = learnedDays(state);
  return keys.map((k) => days.filter((d) => d <= k).length);
}

export type DistributionKey = 'unseen' | MasteryTier;

export const DISTRIBUTION_ORDER: readonly DistributionKey[] = ['mastered', 'almost', 'learning', 'practice', 'unseen'];

/** Elementos con al menos una respuesta registrada. */
export function hasAnswers(state: ProgressState, z: number): boolean {
  const p = state.elements[z];
  return p !== undefined && p.correct + p.incorrect > 0;
}

/** Cuántos elementos hay en cada nivel de dominio (los que nunca respondiste van aparte). */
export function masteryDistribution(
  state: ProgressState,
  mastery: Readonly<Record<number, number>>,
): Record<DistributionKey, number> {
  const out: Record<DistributionKey, number> = { unseen: 0, practice: 0, learning: 0, almost: 0, mastered: 0 };
  for (const el of ELEMENTS) {
    const z = el.atomicNumber;
    if (!hasAnswers(state, z)) out.unseen++;
    else out[masteryTier(mastery[z] ?? 0)]++;
  }
  return out;
}

export interface FamilyStat {
  group: FamilyGroup;
  /** Dominio medio de TODOS sus miembros (0 los no vistos), 0–100. */
  average: number;
  mastered: number;
  /** Miembros con al menos una respuesta. */
  attempted: number;
  total: number;
}

export function familyStats(state: ProgressState, mastery: Readonly<Record<number, number>>): FamilyStat[] {
  return FAMILY_GROUPS.map((group) => {
    const zs = group.atomicNumbers;
    const sum = zs.reduce((acc, z) => acc + (mastery[z] ?? 0), 0);
    return {
      group,
      average: zs.length > 0 ? Math.round(sum / zs.length) : 0,
      mastered: zs.filter((z) => (mastery[z] ?? 0) >= MASTERED_THRESHOLD).length,
      attempted: zs.filter((z) => hasAnswers(state, z)).length,
      total: zs.length,
    };
  });
}

/** Las familias con mayor dominio medio (solo las que ya empezaste). */
export function bestFamilies(stats: readonly FamilyStat[], n = 3): FamilyStat[] {
  return stats
    .filter((f) => f.attempted > 0 && f.average > 0)
    .sort((a, b) => b.average - a.average || b.mastered - a.mastered || a.total - b.total)
    .slice(0, n);
}

/** Las familias empezadas con menor dominio, sin repetir las mejores ni las ya dominadas. */
export function weakestFamilies(stats: readonly FamilyStat[], exclude: readonly FamilyStat[], n = 3): FamilyStat[] {
  const skip = new Set(exclude.map((f) => f.group.id));
  return stats
    .filter((f) => f.attempted > 0 && !skip.has(f.group.id) && f.average < MASTERED_THRESHOLD)
    .sort((a, b) => a.average - b.average || b.total - a.total)
    .slice(0, n);
}

export interface SkillStat {
  skill: QuestionSkill;
  correct: number;
  total: number;
  /** 0–1. */
  accuracy: number;
}

/** Precisión por habilidad (símbolos, números, familias…), de la más floja a la mejor. */
export function skillAccuracy(state: ProgressState): SkillStat[] {
  const acc = new Map<QuestionSkill, { correct: number; incorrect: number }>();
  for (const p of Object.values(state.elements)) {
    for (const [skill, counts] of Object.entries(p.skills) as Array<[QuestionSkill, { correct: number; incorrect: number }]>) {
      if (!counts) continue;
      const prev = acc.get(skill) ?? { correct: 0, incorrect: 0 };
      acc.set(skill, { correct: prev.correct + counts.correct, incorrect: prev.incorrect + counts.incorrect });
    }
  }
  return Array.from(acc.entries())
    .map(([skill, c]) => ({ skill, correct: c.correct, total: c.correct + c.incorrect, accuracy: 0 }))
    .filter((s) => s.total > 0)
    .map((s) => ({ ...s, accuracy: s.correct / s.total }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

/** Totales de una habilidad (0 si nunca se evaluó). */
export function skillTotals(state: ProgressState, skill: QuestionSkill): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const p of Object.values(state.elements)) {
    const c = p.skills[skill];
    if (!c) continue;
    correct += c.correct;
    total += c.correct + c.incorrect;
  }
  return { correct, total };
}

/** Elementos en los que más fallaste una habilidad (para practicarla). */
export function skillWeakElements(state: ProgressState, skill: QuestionSkill, limit = 12): number[] {
  return Object.values(state.elements)
    .map((p) => ({ z: p.atomicNumber, counts: p.skills[skill] }))
    .filter((x): x is { z: number; counts: { correct: number; incorrect: number } } => (x.counts?.incorrect ?? 0) > 0)
    .sort(
      (a, b) =>
        b.counts.incorrect - a.counts.incorrect ||
        a.counts.correct - b.counts.correct ||
        a.z - b.z,
    )
    .slice(0, limit)
    .map((x) => x.z);
}

/** Máximo "redondo" (1, 2, 5 × 10ⁿ) para la escala de un gráfico. */
export function niceMax(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const f = value / magnitude;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * magnitude;
}

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
