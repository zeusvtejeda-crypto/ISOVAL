import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type {
  AnswerOutcome,
  AnsweredQuestion,
  DailyActivity,
  ElementProgress,
  ExperienceLevel,
  FlashcardRating,
  GameMode,
  MistakeRecord,
  PersonalRecords,
  ProgressState,
  QuestionSkill,
  UserProfile,
  UserSettings,
} from '@/types';
import { evaluateAchievements } from './achievements';
import { todayKey } from './dates';
import { levelFromXp, xpAtLevelStart } from './levels';
import { computeMastery } from './mastery';
import { uid } from './random';
import { applyRating, createElementProgress, isDue, ratingFromAnswer } from './srs';
import { createInitialState, emptyDay, MAX_MISTAKES } from './state';
import { XP_RULES, xpForAnswer } from './xp';

export { createInitialState, emptyDay };

export interface AnswerInput {
  atomicNumber: number;
  skill: QuestionSkill;
  correct: boolean;
  responseMs: number;
  mode: GameMode;
  prompt: string;
  correctAnswer: string;
  givenAnswer: string;
  difficulty?: 1 | 2 | 3;
  /** XP a otorgar en vez de la regla por defecto (p. ej. Modo Racha). */
  xpOverride?: number;
  /**
   * Si es `false`, la respuesta no se atribuye a `atomicNumber` (preguntas de tabla donde la casilla
   * tocada o el conjunto no corresponde a un único elemento): no crea ni modifica
   * `state.elements[atomicNumber]` (ni SRS, ni aprendido, ni dominio). XP, actividad diaria,
   * estadísticas, racha de aciertos y el registro de errores (con `atomicNumber`) sí se aplican.
   * Por defecto `true`.
   */
  trackElement?: boolean;
}

export interface FlashcardInput {
  atomicNumber: number;
  /** Habilidad de la tarjeta (informativa: las flashcards no suman a la precisión por habilidad). */
  skill: QuestionSkill;
  rating: FlashcardRating;
  responseMs: number;
}

export interface SessionCompleteInput {
  mode: GameMode;
  total: number;
  correct: number;
  durationMs: number;
  isExam?: boolean;
}

export type RecordKind = 'timeAttack' | 'survival' | 'streakMode';

export interface XpResult {
  state: ProgressState;
  leveledUp: boolean;
  newLevel: number;
  unlockedAchievements: string[];
}

const RECENT_WINDOW = 10;
const EMA_ALPHA = 0.3;
/** Tope de tiempo por respuesta para la media (evita que un despiste la dispare). */
const MAX_EMA_MS = 30_000;
/** Tope de tiempo por respuesta para las estadísticas de tiempo de estudio. */
const MAX_COUNTED_MS = 60_000;
/** Preguntas mínimas de una sesión (no examen) para pagar el bonus de sesión. */
export const SESSION_BONUS_MIN_QUESTIONS = 5;

const RECORD_FIELDS: Record<RecordKind, keyof PersonalRecords> = {
  timeAttack: 'timeAttackBest',
  survival: 'survivalBest',
  streakMode: 'streakModeBest',
};

function safeMs(ms: number, cap: number): number {
  return Number.isFinite(ms) ? Math.min(cap, Math.max(0, Math.round(ms))) : 0;
}

interface DayDelta {
  questions?: number;
  correct?: number;
  flashcards?: number;
  xp?: number;
  timeMs?: number;
  newLearned?: number;
}

/** Suma actividad al día actual y recalcula `goalMet` (una vez cumplida, se mantiene). */
function touchDay(state: ProgressState, now: Date, delta: DayDelta): Record<string, DailyActivity> {
  const key = todayKey(now);
  const prev = state.daily[key] ?? emptyDay(key, state.settings.dailyGoal);
  const next: DailyActivity = {
    ...prev,
    questions: prev.questions + (delta.questions ?? 0),
    correct: prev.correct + (delta.correct ?? 0),
    flashcards: prev.flashcards + (delta.flashcards ?? 0),
    xp: prev.xp + (delta.xp ?? 0),
    timeMs: prev.timeMs + (delta.timeMs ?? 0),
    newLearned: prev.newLearned + (delta.newLearned ?? 0),
  };
  if (!next.goalMet) {
    next.goal = state.settings.dailyGoal;
    next.goalMet = next.questions >= next.goal;
  }
  return { ...state.daily, [key]: next };
}

/** Desbloquea logros, sella `updatedAt` y compara niveles con el estado anterior. */
function finalize(prev: ProgressState, next: ProgressState, now: Date): XpResult {
  const iso = now.toISOString();
  const unlocked = evaluateAchievements(next, now);
  const achievements =
    unlocked.length > 0
      ? { ...next.achievements, ...Object.fromEntries(unlocked.map((id) => [id, iso])) }
      : next.achievements;
  const state: ProgressState = { ...next, achievements, updatedAt: iso };
  const before = levelFromXp(prev.xp).level;
  const after = levelFromXp(state.xp).level;
  return { state, leveledUp: after > before, newLevel: after, unlockedAchievements: unlocked };
}

/** Suma un resultado a la precisión por habilidad (solo preguntas de quiz). */
function addSkillResult(p: ElementProgress, skill: QuestionSkill, correct: boolean): ElementProgress {
  const prev = p.skills[skill] ?? { correct: 0, incorrect: 0 };
  return {
    ...p,
    skills: {
      ...p.skills,
      [skill]: { correct: prev.correct + (correct ? 1 : 0), incorrect: prev.incorrect + (correct ? 0 : 1) },
    },
  };
}

/**
 * Contadores, racha, recientes y EMA de tiempo de un elemento.
 * La media de tiempo solo se actualiza con aciertos: un fallo rápido no mejora la velocidad.
 */
function recordResult(p: ElementProgress, correct: boolean, responseMs: number, now: Date): ElementProgress {
  const iso = now.toISOString();
  const ms = safeMs(responseMs, MAX_EMA_MS);
  let avgResponseMs = p.avgResponseMs;
  if (correct) {
    avgResponseMs = avgResponseMs === null ? ms : Math.round(avgResponseMs * (1 - EMA_ALPHA) + ms * EMA_ALPHA);
  }
  return {
    ...p,
    seen: p.seen + 1,
    correct: p.correct + (correct ? 1 : 0),
    incorrect: p.incorrect + (correct ? 0 : 1),
    streak: correct ? p.streak + 1 : 0,
    recent: [...p.recent, correct ? 1 : 0].slice(-RECENT_WINDOW),
    avgResponseMs,
    lastSeen: iso,
    lastCorrect: correct ? iso : p.lastCorrect,
  };
}

function markLearned(p: ElementProgress, now: Date): ElementProgress {
  return p.learned ? p : { ...p, learned: true, learnedAt: now.toISOString() };
}

/** Progreso de un elemento tras una respuesta de quiz (contadores, habilidad, SRS y aprendido). */
function answeredProgress(base: ElementProgress, input: AnswerInput, now: Date): ElementProgress {
  let p = recordResult(base, input.correct, input.responseMs, now);
  p = addSkillResult(p, input.skill, input.correct);
  if (!input.correct) p = applyRating(p, 'again', now);
  else if (base.due === null || isDue(base, now)) p = applyRating(p, ratingFromAnswer(true, input.responseMs), now);
  return input.correct ? markLearned(p, now) : p;
}

/**
 * Registra una respuesta: progreso del elemento (SRS incluido), XP, actividad diaria, errores,
 * racha global de aciertos, estadísticas y logros.
 * - SRS: un fallo siempre reprograma ("again"); un acierto solo avanza el intervalo si el elemento
 *   es nuevo o ya tocaba repasarlo (repetir el mismo día no infla los intervalos).
 * - Cada fallo guarda un `MistakeRecord` (también en el diagnóstico, con `mode: 'diagnostic'`).
 * - Diagnóstico (`mode: 'diagnostic'`): cuenta en `stats` (preguntas, aciertos, tiempo) pero NO en
 *   `daily.questions`/`daily.correct`: la meta diaria y la racha empiezan con la primera sesión real.
 * - `trackElement: false`: no toca `state.elements` (ver `AnswerInput.trackElement`).
 */
export function applyAnswer(
  state: ProgressState,
  input: AnswerInput,
  now: Date,
): { state: ProgressState; outcome: AnswerOutcome } {
  const z = input.atomicNumber;
  const prevProgress = state.elements[z];
  const masteryBefore = computeMastery(prevProgress, now);
  const track = input.trackElement ?? true;
  const isDiagnostic = input.mode === 'diagnostic';

  let elements = state.elements;
  let masteryAfter = masteryBefore;
  let newlyLearned = false;
  if (track) {
    const base = prevProgress ?? createElementProgress(z);
    const p = answeredProgress(base, input, now);
    newlyLearned = p.learned && !base.learned;
    masteryAfter = computeMastery(p, now);
    elements = { ...state.elements, [z]: p };
  }

  const defaultXp = xpForAnswer(input.correct, input.difficulty ?? 1);
  const xpGained = Math.max(0, Math.round(input.xpOverride ?? defaultXp));
  const bonusXp = input.correct ? Math.max(0, xpGained - defaultXp) : 0;
  const answerStreak = input.correct ? state.stats.currentAnswerStreak + 1 : 0;
  const ms = safeMs(input.responseMs, MAX_COUNTED_MS);

  let mistakes = state.mistakes;
  if (!input.correct) {
    const record: MistakeRecord = {
      id: uid(),
      atomicNumber: z,
      skill: input.skill,
      prompt: input.prompt,
      correctAnswer: input.correctAnswer,
      givenAnswer: input.givenAnswer,
      mode: input.mode,
      at: now.toISOString(),
    };
    mistakes = [record, ...state.mistakes].slice(0, MAX_MISTAKES);
  }

  const next: ProgressState = {
    ...state,
    xp: state.xp + xpGained,
    elements,
    mistakes,
    daily: touchDay(state, now, {
      questions: isDiagnostic ? 0 : 1,
      correct: input.correct && !isDiagnostic ? 1 : 0,
      xp: xpGained,
      timeMs: ms,
      newLearned: newlyLearned ? 1 : 0,
    }),
    records: { ...state.records, bestAnswerStreak: Math.max(state.records.bestAnswerStreak, answerStreak) },
    stats: {
      ...state.stats,
      totalQuestions: state.stats.totalQuestions + 1,
      totalCorrect: state.stats.totalCorrect + (input.correct ? 1 : 0),
      totalTimeMs: state.stats.totalTimeMs + ms,
      currentAnswerStreak: answerStreak,
    },
  };
  const result = finalize(state, next, now);
  return {
    state: result.state,
    outcome: {
      xpGained,
      bonusXp,
      masteryBefore,
      masteryAfter,
      answerStreak,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      unlockedAchievements: result.unlockedAchievements,
    },
  };
}

/**
 * Registra una flashcard calificada (autoevaluación).
 * - Cuenta para la meta diaria (`daily.questions` y `daily.flashcards`), pero no para
 *   `daily.correct`, `stats.totalQuestions`, la racha global de aciertos, los errores ni la precisión
 *   por habilidad (`p.skills`): las precisiones son solo de quiz. Sí suma a aciertos/fallos del
 *   elemento y, por tanto, a su dominio.
 * - SRS: "No lo sabía" siempre reprograma; "Casi", "Lo sabía" y "Muy fácil" solo avanzan el
 *   intervalo si el elemento es nuevo o ya tocaba repasarlo (repasar el mazo varias veces seguidas
 *   no infla los intervalos).
 */
export function applyFlashcard(
  state: ProgressState,
  input: FlashcardInput,
  now: Date,
): { state: ProgressState; outcome: AnswerOutcome } {
  const z = input.atomicNumber;
  const prevProgress = state.elements[z];
  const base = prevProgress ?? createElementProgress(z);
  const masteryBefore = computeMastery(prevProgress, now);
  const correct = input.rating !== 'again';

  let p = recordResult(base, correct, input.responseMs, now);
  if (!correct || base.due === null || isDue(base, now)) p = applyRating(p, input.rating, now);
  const newlyLearned = correct && !base.learned;
  if (newlyLearned) p = markLearned(p, now);
  const masteryAfter = computeMastery(p, now);

  const xpGained = XP_RULES.flashcard[input.rating];
  const ms = safeMs(input.responseMs, MAX_COUNTED_MS);
  const next: ProgressState = {
    ...state,
    xp: state.xp + xpGained,
    elements: { ...state.elements, [z]: p },
    daily: touchDay(state, now, {
      questions: 1,
      flashcards: 1,
      xp: xpGained,
      timeMs: ms,
      newLearned: newlyLearned ? 1 : 0,
    }),
    stats: {
      ...state.stats,
      flashcardsReviewed: state.stats.flashcardsReviewed + 1,
      totalTimeMs: state.stats.totalTimeMs + ms,
    },
  };
  const result = finalize(state, next, now);
  return {
    state: result.state,
    outcome: {
      xpGained,
      bonusXp: 0,
      masteryBefore,
      masteryAfter,
      answerStreak: state.stats.currentAnswerStreak,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      unlockedAchievements: result.unlockedAchievements,
    },
  };
}

/** Marca elementos como aprendidos (lección vista): +5 XP por cada elemento nuevo. Quedan listos para repasar. */
export function applyLearned(
  state: ProgressState,
  atomicNumbers: number[],
  now: Date,
): { state: ProgressState; xpGained: number; unlockedAchievements: string[] } {
  const iso = now.toISOString();
  const fresh = Array.from(new Set(atomicNumbers)).filter(
    (z) => ELEMENTS_BY_NUMBER[z] !== undefined && !state.elements[z]?.learned,
  );
  if (fresh.length === 0) return { state, xpGained: 0, unlockedAchievements: [] };

  const elements = { ...state.elements };
  for (const z of fresh) {
    const base = elements[z] ?? createElementProgress(z);
    elements[z] = { ...base, learned: true, learnedAt: iso, seen: base.seen + 1, lastSeen: iso, due: base.due ?? iso };
  }
  const xpGained = fresh.length * XP_RULES.learnElement;
  const next: ProgressState = {
    ...state,
    xp: state.xp + xpGained,
    elements,
    daily: touchDay(state, now, { xp: xpGained, newLearned: fresh.length }),
  };
  const result = finalize(state, next, now);
  return { state: result.state, xpGained, unlockedAchievements: result.unlockedAchievements };
}

/** Suma XP libre (bonus de modos de juego). */
export function applyXp(state: ProgressState, amount: number, now: Date): XpResult {
  const xp = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  if (xp === 0) {
    return { state, leveledUp: false, newLevel: levelFromXp(state.xp).level, unlockedAchievements: [] };
  }
  const next: ProgressState = { ...state, xp: state.xp + xp, daily: touchDay(state, now, { xp }) };
  return finalize(state, next, now);
}

/**
 * Cierra una sesión.
 * - Examen: +50 XP (+100 más si es perfecto).
 * - Otros modos: +20 XP solo si la sesión tuvo al menos `SESSION_BONUS_MIN_QUESTIONS` (5) preguntas y
 *   al menos la mitad de aciertos (`correct × 2 ≥ total`); si no, 0 (evita farmear XP con «Repetir»
 *   en sesiones de 1 pregunta). La sesión cuenta igualmente en `stats.sessionsCompleted`.
 * - Diagnóstico o sesiones vacías: nada.
 */
export function applySessionComplete(
  state: ProgressState,
  input: SessionCompleteInput,
  now: Date,
): { state: ProgressState; xpGained: number; unlockedAchievements: string[]; leveledUp: boolean; newLevel: number } {
  const total = Math.max(0, Math.floor(input.total));
  const correct = Math.min(total, Math.max(0, Math.floor(input.correct)));
  if (total === 0 || input.mode === 'diagnostic') {
    return { state, xpGained: 0, unlockedAchievements: [], leveledUp: false, newLevel: levelFromXp(state.xp).level };
  }
  const isExam = input.isExam ?? input.mode === 'exam';
  const stats = { ...state.stats, sessionsCompleted: state.stats.sessionsCompleted + 1 };
  const records = { ...state.records };
  let xpGained: number;
  if (isExam) {
    const perfect = correct === total;
    stats.examsCompleted += 1;
    if (perfect) stats.perfectExams += 1;
    records.bestExamPct = Math.max(records.bestExamPct, Math.round((correct / total) * 100));
    xpGained = XP_RULES.examComplete + (perfect ? XP_RULES.perfectExam : 0);
  } else {
    const earned = total >= SESSION_BONUS_MIN_QUESTIONS && correct * 2 >= total;
    xpGained = earned ? XP_RULES.sessionComplete : 0;
  }
  const next: ProgressState = {
    ...state,
    xp: state.xp + xpGained,
    stats,
    records,
    daily: xpGained > 0 ? touchDay(state, now, { xp: xpGained }) : state.daily,
  };
  const result = finalize(state, next, now);
  return {
    state: result.state,
    xpGained,
    unlockedAchievements: result.unlockedAchievements,
    leveledUp: result.leveledUp,
    newLevel: result.newLevel,
  };
}

/** Guarda un récord personal si supera el anterior. */
export function applyRecord(
  state: ProgressState,
  kind: RecordKind,
  value: number,
  now: Date,
): { state: ProgressState; isNewRecord: boolean; unlockedAchievements: string[] } {
  const field = RECORD_FIELDS[kind];
  const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  if (v <= state.records[field]) return { state, isNewRecord: false, unlockedAchievements: [] };
  const next: ProgressState = { ...state, records: { ...state.records, [field]: v } };
  const result = finalize(state, next, now);
  return { state: result.state, isNewRecord: true, unlockedAchievements: result.unlockedAchievements };
}

/**
 * Nivel inicial según el diagnóstico (escalado a 10 preguntas):
 * 0–3 → 1, 4–6 → 2, 7–8 → 3, 9–10 → 4; con experiencia 'chemistry' o 'master' y ≥ 7, +1.
 */
export function diagnosticLevel(correct: number, total: number, experience: ExperienceLevel): number {
  const score = total > 0 ? Math.round((Math.max(0, correct) / total) * 10) : 0;
  let level = score <= 3 ? 1 : score <= 6 ? 2 : score <= 8 ? 3 : 4;
  if ((experience === 'chemistry' || experience === 'master') && score >= 7) level += 1;
  return level;
}

/**
 * Completa la bienvenida: guarda la experiencia, registra el diagnóstico y fija la XP inicial.
 * Las respuestas se registran con `mode: 'diagnostic'`: los fallos quedan en «Mis errores», pero no
 * suman a la actividad del día (la meta diaria y la racha empiezan con la primera sesión real).
 */
export function applyOnboarding(
  state: ProgressState,
  experience: ExperienceLevel,
  diagnostic: AnsweredQuestion[],
  now: Date,
): { state: ProgressState; level: number; unlockedAchievements: string[] } {
  let s: ProgressState = { ...state, profile: { ...state.profile, experience, onboarded: true } };
  for (const a of diagnostic) {
    s = applyAnswer(
      s,
      {
        atomicNumber: a.question.atomicNumber,
        skill: a.question.skill,
        correct: a.correct,
        responseMs: a.responseMs,
        mode: 'diagnostic',
        prompt: a.question.prompt,
        correctAnswer: a.question.correctAnswer,
        givenAnswer: a.givenAnswer,
        difficulty: a.question.difficulty,
        xpOverride: 0,
      },
      now,
    ).state;
  }
  const correct = diagnostic.filter((a) => a.correct).length;
  const target = diagnosticLevel(correct, diagnostic.length, experience);
  s = { ...s, xp: Math.max(s.xp, xpAtLevelStart(target)) };
  const result = finalize(state, s, now);
  return {
    state: result.state,
    level: levelFromXp(result.state.xp).level,
    unlockedAchievements: collectUnlocked(state, result.state),
  };
}

/** Ids de logros presentes en `after` que no estaban en `before`. */
export function collectUnlocked(before: ProgressState, after: ProgressState): string[] {
  return Object.keys(after.achievements).filter((id) => !before.achievements[id]);
}

/** Actualiza ajustes. Si cambia la meta y hoy aún no se cumplía, se recalcula con la nueva meta. */
export function applySettings(state: ProgressState, patch: Partial<UserSettings>, now: Date): ProgressState {
  const settings: UserSettings = { ...state.settings, ...patch };
  const key = todayKey(now);
  const day = state.daily[key];
  let daily = state.daily;
  if (day && !day.goalMet && settings.dailyGoal !== state.settings.dailyGoal) {
    daily = {
      ...daily,
      [key]: { ...day, goal: settings.dailyGoal, goalMet: day.questions >= settings.dailyGoal },
    };
  }
  return finalize(state, { ...state, settings, daily }, now).state;
}

export function applyProfile(state: ProgressState, patch: Partial<UserProfile>, now: Date): ProgressState {
  return { ...state, profile: { ...state.profile, ...patch }, updatedAt: now.toISOString() };
}

/** Borra todos los errores o solo los de un elemento. */
export function applyClearMistakes(state: ProgressState, atomicNumber: number | undefined, now: Date): ProgressState {
  const mistakes = atomicNumber === undefined ? [] : state.mistakes.filter((m) => m.atomicNumber !== atomicNumber);
  if (mistakes.length === state.mistakes.length) return state;
  return { ...state, mistakes, updatedAt: now.toISOString() };
}

/** Reinicia el progreso conservando los ajustes (tema, meta, sonido). */
export function applyReset(state: ProgressState, now: Date): ProgressState {
  return { ...createInitialState(now), settings: { ...state.settings } };
}
