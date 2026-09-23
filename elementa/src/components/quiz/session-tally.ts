import type { AnswerOutcome, AnsweredQuestion, GameMode, Question, SessionSummaryData } from '@/types';
import type { AnswerInput } from '@/utils/engine';
import { answerAttribution, checkTableAnswer, describeTableSelection } from '@/utils/answer-check';

// ---------------------------------------------------------------------------------------------
// Recuento de una sesión (lógica pura, sin React): corrección de cada respuesta, a qué elemento se
// atribuye, dominio antes/después y listas del resumen («Hoy mejoraste» / «Elementos que debes repasar»).
// Lo comparten `useQuizSession`, Preguntados y las flashcards.
// ---------------------------------------------------------------------------------------------

/** Una respuesta de la sesión reducida a lo que cuenta para el resumen. */
export interface TallyEntry {
  /** Elemento al que se atribuye la respuesta (ver `answerAttribution`). */
  atomicNumber: number;
  correct: boolean;
}

/** Elementos con al menos un fallo en la sesión, sin repetir, en el orden del primer fallo. */
export function failedElements(entries: readonly TallyEntry[]): number[] {
  const out: number[] = [];
  for (const entry of entries) {
    if (!entry.correct && !out.includes(entry.atomicNumber)) out.push(entry.atomicNumber);
  }
  return out;
}

/**
 * «Hoy mejoraste»: elementos con al menos un acierto, NINGÚN fallo en la sesión y cuyo dominio subió
 * (`masteryEnd > masteryStart`), de mayor a menor mejora (a igual mejora, en orden de aparición).
 * Así ningún elemento aparece a la vez en «mejoraste» y en «debes repasar».
 */
export function improvedElements(
  entries: readonly TallyEntry[],
  masteryStart: Record<number, number>,
  masteryEnd: Record<number, number>,
): number[] {
  const failed = new Set(failedElements(entries));
  const seen = new Set<number>();
  const gains: { z: number; gain: number }[] = [];
  for (const { atomicNumber: z, correct } of entries) {
    if (!correct || failed.has(z) || seen.has(z)) continue;
    seen.add(z);
    const start = masteryStart[z];
    const end = masteryEnd[z];
    if (start === undefined || end === undefined || !(end > start)) continue;
    gains.push({ z, gain: end - start });
  }
  return gains.sort((a, b) => b.gain - a.gain).map((g) => g.z);
}

/** Texto de una opción elegida: "Na (Sodio)" o "Na". */
export function describeOption(option: { label: string; sublabel?: string }): string {
  return option.sublabel ? `${option.label} (${option.sublabel})` : option.label;
}

// ---------------------------------------------------------------------------------------------
// Corrección y registro de una respuesta
// ---------------------------------------------------------------------------------------------

/** Id de opción (opción múltiple) o números atómicos tocados (preguntas de tabla). */
export type AnswerResponse = string | number[];

export interface AnswerEvaluation extends TallyEntry {
  /** Respuesta dada, legible: "Na (Sodio)", "Na, K" o "—". */
  givenAnswer: string;
  /** `false` si la respuesta es sobre una familia o un grupo (sin progreso por elemento). */
  trackElement: boolean;
}

/** Corrige una respuesta y decide a qué elemento se atribuye (`answerAttribution`). */
export function evaluateResponse(question: Question, response: AnswerResponse): AnswerEvaluation {
  const { atomicNumber, trackElement } = answerAttribution(question, response);
  if (question.kind === 'multiple-choice') {
    const option = typeof response === 'string' ? question.options?.find((o) => o.id === response) : undefined;
    return { atomicNumber, trackElement, correct: option?.correct ?? false, givenAnswer: option ? describeOption(option) : '—' };
  }
  const selected = Array.isArray(response) ? response : [];
  return {
    atomicNumber,
    trackElement,
    correct: checkTableAnswer(question, selected),
    givenAnswer: describeTableSelection(selected),
  };
}

/** Entrada de `recordAnswer` para una respuesta ya corregida. */
export function toAnswerInput(
  question: Question,
  evaluation: AnswerEvaluation,
  context: { mode: GameMode; responseMs: number; xpOverride?: number },
): AnswerInput {
  return {
    atomicNumber: evaluation.atomicNumber,
    trackElement: evaluation.trackElement,
    skill: question.skill,
    correct: evaluation.correct,
    responseMs: context.responseMs,
    mode: context.mode,
    prompt: question.prompt,
    correctAnswer: question.correctAnswer,
    givenAnswer: evaluation.givenAnswer,
    difficulty: question.difficulty,
    xpOverride: context.xpOverride,
  };
}

// ---------------------------------------------------------------------------------------------
// Acumulado de la sesión y resumen
// ---------------------------------------------------------------------------------------------

export interface SessionTally {
  entries: TallyEntry[];
  /** Dominio de cada elemento al empezar (primer `masteryBefore` de una respuesta con seguimiento). */
  masteryStart: Record<number, number>;
  /** Último dominio conocido de cada elemento. */
  masteryEnd: Record<number, number>;
  /** Logros desbloqueados por las respuestas. */
  unlocked: string[];
}

export const EMPTY_TALLY: SessionTally = Object.freeze({ entries: [], masteryStart: {}, masteryEnd: {}, unlocked: [] });

/**
 * Suma una respuesta al recuento. El dominio solo se anota si la respuesta se registró (`outcome`)
 * y se atribuye a un elemento concreto (`trackElement`).
 */
export function tallyAnswer(
  tally: SessionTally,
  answer: Pick<AnswerEvaluation, 'atomicNumber' | 'correct' | 'trackElement'>,
  outcome: AnswerOutcome | null,
): SessionTally {
  const z = answer.atomicNumber;
  const tracked = outcome !== null && answer.trackElement;
  return {
    entries: [...tally.entries, { atomicNumber: z, correct: answer.correct }],
    masteryStart:
      tracked && !(z in tally.masteryStart) ? { ...tally.masteryStart, [z]: outcome.masteryBefore } : tally.masteryStart,
    masteryEnd: tracked ? { ...tally.masteryEnd, [z]: outcome.masteryAfter } : tally.masteryEnd,
    unlocked: outcome?.unlockedAchievements.length ? [...tally.unlocked, ...outcome.unlockedAchievements] : tally.unlocked,
  };
}

export interface SummaryInput {
  mode: GameMode;
  title: string;
  answered: readonly AnsweredQuestion[];
  tally: SessionTally;
  durationMs: number;
  /** XP ganada fuera de las respuestas (sesión completada, corona…). */
  extraXp?: number;
  /** Logros desbloqueados fuera de las respuestas (p. ej. los de `completeSession`). */
  unlocked?: readonly string[];
}

/** Resumen final de una sesión: marcador, XP, «Hoy mejoraste», «Elementos que debes repasar» y logros. */
export function buildSessionSummary({
  mode,
  title,
  answered,
  tally,
  durationMs,
  extraXp = 0,
  unlocked = [],
}: SummaryInput): SessionSummaryData {
  return {
    mode,
    title,
    total: answered.length,
    correct: answered.filter((a) => a.correct).length,
    xpGained: answered.reduce((sum, a) => sum + a.xpGained, 0) + extraXp,
    durationMs,
    improved: improvedElements(tally.entries, tally.masteryStart, tally.masteryEnd),
    toReview: failedElements(tally.entries),
    unlockedAchievements: Array.from(new Set([...tally.unlocked, ...unlocked])),
  };
}
