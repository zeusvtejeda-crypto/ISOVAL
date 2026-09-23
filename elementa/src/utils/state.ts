import type {
  DailyActivity,
  DailyGoal,
  GlobalStats,
  PersonalRecords,
  ProgressState,
  UserProfile,
  UserSettings,
} from '@/types';

export const STATE_VERSION = 1 as const;
export const DAILY_GOALS: readonly DailyGoal[] = [5, 10, 20, 50];
export const MAX_MISTAKES = 300;

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  dailyGoal: 10,
  sound: true,
  haptics: true,
};

export const EMPTY_RECORDS: PersonalRecords = {
  timeAttackBest: 0,
  survivalBest: 0,
  streakModeBest: 0,
  bestAnswerStreak: 0,
  bestExamPct: 0,
};

export const EMPTY_STATS: GlobalStats = {
  totalQuestions: 0,
  totalCorrect: 0,
  totalTimeMs: 0,
  sessionsCompleted: 0,
  examsCompleted: 0,
  perfectExams: 0,
  flashcardsReviewed: 0,
  currentAnswerStreak: 0,
};

export function createProfile(now: Date): UserProfile {
  return { name: '', experience: null, onboarded: false, createdAt: now.toISOString() };
}

/** Estado inicial de un usuario nuevo. */
export function createInitialState(now: Date): ProgressState {
  const iso = now.toISOString();
  return {
    version: STATE_VERSION,
    profile: createProfile(now),
    settings: { ...DEFAULT_SETTINGS },
    xp: 0,
    elements: {},
    mistakes: [],
    daily: {},
    records: { ...EMPTY_RECORDS },
    stats: { ...EMPTY_STATS },
    achievements: {},
    updatedAt: iso,
  };
}

/** Día sin actividad. */
export function emptyDay(date: string, goal: number): DailyActivity {
  return { date, questions: 0, correct: 0, xp: 0, timeMs: 0, newLearned: 0, goal, goalMet: false };
}
