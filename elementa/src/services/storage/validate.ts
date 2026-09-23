import type {
  DailyActivity,
  ElementProgress,
  ExperienceLevel,
  GameMode,
  MistakeRecord,
  ProgressState,
  QuestionSkill,
  SkillCounts,
  ThemePreference,
} from '@/types';
import { isDateKey } from '@/utils/dates';
import { createElementProgress, MAX_INTERVAL_DAYS } from '@/utils/srs';
import { createInitialState, DAILY_GOALS, MAX_MISTAKES, STATE_VERSION } from '@/utils/state';

/**
 * Valida y normaliza datos desconocidos (localStorage, archivo importado) a un `ProgressState`.
 * Los campos ausentes o inválidos toman el valor por defecto, así que partidas antiguas siguen
 * cargando. Devuelve `null` si la entrada no es un objeto.
 */

type Obj = Record<string, unknown>;

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const EXPERIENCES: readonly ExperienceLevel[] = ['beginner', 'some', 'chemistry', 'master'];
const MODES: readonly GameMode[] = [
  'diagnostic',
  'study',
  'learn5',
  'flashcards',
  'trivia',
  'exam',
  'timeAttack',
  'survival',
  'streak',
  'visual',
  'practice',
];
const SKILLS: readonly QuestionSkill[] = [
  'symbol',
  'atomicNumber',
  'atomicMass',
  'group',
  'period',
  'category',
  'phase',
  'location',
  'configuration',
  'property',
];

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number, min = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function isoOrNull(v: unknown): string | null {
  return typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function oneOf<T extends string | number>(v: unknown, options: readonly T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

function parseSkills(v: unknown): Partial<Record<QuestionSkill, SkillCounts>> {
  const out: Partial<Record<QuestionSkill, SkillCounts>> = {};
  if (!isObj(v)) return out;
  for (const skill of SKILLS) {
    const s = v[skill];
    if (isObj(s)) out[skill] = { correct: num(s.correct, 0), incorrect: num(s.incorrect, 0) };
  }
  return out;
}

function parseElement(z: number, v: unknown): ElementProgress | null {
  if (!isObj(v)) return null;
  const d = createElementProgress(z);
  const recent = Array.isArray(v.recent) ? v.recent.filter((r) => r === 0 || r === 1).slice(-10) : [];
  return {
    atomicNumber: z,
    seen: num(v.seen, d.seen),
    correct: num(v.correct, d.correct),
    incorrect: num(v.incorrect, d.incorrect),
    streak: num(v.streak, d.streak),
    recent,
    avgResponseMs: typeof v.avgResponseMs === 'number' && Number.isFinite(v.avgResponseMs) ? v.avgResponseMs : null,
    lastSeen: isoOrNull(v.lastSeen),
    lastCorrect: isoOrNull(v.lastCorrect),
    ease: Math.min(3, num(v.ease, d.ease, 1.3)),
    intervalDays: Math.min(MAX_INTERVAL_DAYS, num(v.intervalDays, d.intervalDays)),
    reps: num(v.reps, d.reps),
    due: isoOrNull(v.due),
    learned: bool(v.learned, d.learned),
    learnedAt: isoOrNull(v.learnedAt),
    skills: parseSkills(v.skills),
  };
}

function parseElements(v: unknown): Record<number, ElementProgress> {
  const out: Record<number, ElementProgress> = {};
  if (!isObj(v)) return out;
  for (const [key, value] of Object.entries(v)) {
    const z = Number(key);
    if (!Number.isInteger(z) || z < 1 || z > 118) continue;
    const p = parseElement(z, value);
    if (p) out[z] = p;
  }
  return out;
}

function parseMistake(v: unknown): MistakeRecord | null {
  if (!isObj(v)) return null;
  const z = v.atomicNumber;
  const at = isoOrNull(v.at);
  if (typeof z !== 'number' || z < 1 || z > 118 || !at) return null;
  return {
    id: str(v.id, `${z}-${at}`),
    atomicNumber: z,
    skill: oneOf(v.skill, SKILLS, 'symbol'),
    prompt: str(v.prompt, ''),
    correctAnswer: str(v.correctAnswer, ''),
    givenAnswer: str(v.givenAnswer, ''),
    mode: oneOf(v.mode, MODES, 'practice'),
    at,
  };
}

function parseDaily(v: unknown, goalFallback: number): Record<string, DailyActivity> {
  const out: Record<string, DailyActivity> = {};
  if (!isObj(v)) return out;
  for (const [key, value] of Object.entries(v)) {
    if (!isDateKey(key) || !isObj(value)) continue;
    const questions = num(value.questions, 0);
    const goal = num(value.goal, goalFallback, 1);
    out[key] = {
      date: key,
      questions,
      correct: num(value.correct, 0),
      xp: num(value.xp, 0),
      timeMs: num(value.timeMs, 0),
      newLearned: num(value.newLearned, 0),
      goal,
      goalMet: bool(value.goalMet, questions >= goal),
    };
  }
  return out;
}

function parseAchievements(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObj(v)) return out;
  for (const [id, at] of Object.entries(v)) {
    if (typeof at === 'string') out[id] = at;
  }
  return out;
}

/** Migraciones entre versiones del esquema (hoy solo existe la v1). */
function migrate(raw: Obj): Obj {
  return raw;
}

/** Mínimo para reconocer un guardado de Elementa (evita importar un JSON cualquiera). */
function looksLikeProgress(v: Obj): boolean {
  return typeof v.version === 'number' && v.version >= 1 && isObj(v.profile);
}

export function parseProgressState(input: unknown, now: Date = new Date()): ProgressState | null {
  if (!isObj(input) || !looksLikeProgress(input)) return null;
  const raw = migrate(input);
  const d = createInitialState(now);
  const profile = isObj(raw.profile) ? raw.profile : {};
  const settings = isObj(raw.settings) ? raw.settings : {};
  const records = isObj(raw.records) ? raw.records : {};
  const stats = isObj(raw.stats) ? raw.stats : {};
  const dailyGoal = oneOf(settings.dailyGoal, DAILY_GOALS, d.settings.dailyGoal);

  return {
    version: STATE_VERSION,
    profile: {
      name: str(profile.name, d.profile.name).slice(0, 60),
      experience: EXPERIENCES.includes(profile.experience as ExperienceLevel)
        ? (profile.experience as ExperienceLevel)
        : null,
      onboarded: bool(profile.onboarded, d.profile.onboarded),
      createdAt: isoOrNull(profile.createdAt) ?? d.profile.createdAt,
    },
    settings: {
      theme: oneOf(settings.theme, THEMES, d.settings.theme),
      dailyGoal,
      sound: bool(settings.sound, d.settings.sound),
      haptics: bool(settings.haptics, d.settings.haptics),
    },
    xp: Math.floor(num(raw.xp, 0)),
    elements: parseElements(raw.elements),
    mistakes: Array.isArray(raw.mistakes)
      ? raw.mistakes
          .map(parseMistake)
          .filter((m): m is MistakeRecord => m !== null)
          .slice(0, MAX_MISTAKES)
      : [],
    daily: parseDaily(raw.daily, dailyGoal),
    records: {
      timeAttackBest: num(records.timeAttackBest, 0),
      survivalBest: num(records.survivalBest, 0),
      streakModeBest: num(records.streakModeBest, 0),
      bestAnswerStreak: num(records.bestAnswerStreak, 0),
      bestExamPct: Math.min(100, num(records.bestExamPct, 0)),
    },
    stats: {
      totalQuestions: num(stats.totalQuestions, 0),
      totalCorrect: num(stats.totalCorrect, 0),
      totalTimeMs: num(stats.totalTimeMs, 0),
      sessionsCompleted: num(stats.sessionsCompleted, 0),
      examsCompleted: num(stats.examsCompleted, 0),
      perfectExams: num(stats.perfectExams, 0),
      flashcardsReviewed: num(stats.flashcardsReviewed, 0),
      currentAnswerStreak: num(stats.currentAnswerStreak, 0),
    },
    achievements: parseAchievements(raw.achievements),
    updatedAt: isoOrNull(raw.updatedAt) ?? d.updatedAt,
  };
}

/** Parsea texto JSON de forma segura (nunca lanza). */
export function parseProgressJson(json: string, now: Date = new Date()): ProgressState | null {
  try {
    return parseProgressState(JSON.parse(json) as unknown, now);
  } catch {
    return null;
  }
}
