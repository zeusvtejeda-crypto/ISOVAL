import type { DailyActivity } from '@/types';
import { addDays, daysBetween, isDateKey, weekKeys, weekdayLetter } from './dates';

export interface StreakInfo {
  /** Días consecutivos con la meta cumplida (hoy incluido si ya se cumplió). */
  current: number;
  /** Mejor racha histórica. */
  best: number;
  todayMet: boolean;
  /** Ayer se cumplió la meta pero hoy todavía no: la racha peligra. */
  atRisk: boolean;
}

export interface WeekDay {
  key: string;
  letter: string;
  goalMet: boolean;
  /** Hubo al menos una pregunta ese día. */
  active: boolean;
  isToday: boolean;
  isFuture: boolean;
}

type DailyMap = Record<string, DailyActivity>;

function met(daily: DailyMap, key: string): boolean {
  return daily[key]?.goalMet === true;
}

function longestRun(daily: DailyMap): number {
  const keys = Object.keys(daily)
    .filter((k) => isDateKey(k) && met(daily, k))
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of keys) {
    run = prev !== null && daysBetween(prev, key) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

/** Un día cuenta para la racha cuando se cumple la meta diaria. */
export function computeStreak(daily: DailyMap, todayKey: string): StreakInfo {
  const todayMet = met(daily, todayKey);
  const yesterday = addDays(todayKey, -1);
  let cursor = todayMet ? todayKey : yesterday;
  let current = 0;
  while (met(daily, cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return {
    current,
    best: Math.max(current, longestRun(daily)),
    todayMet,
    atRisk: !todayMet && met(daily, yesterday),
  };
}

/** Semana actual (lunes → domingo) con el estado de cada día. */
export function weekActivity(daily: DailyMap, todayKey: string): WeekDay[] {
  return weekKeys(todayKey).map((key) => {
    const day = daily[key];
    return {
      key,
      letter: weekdayLetter(key),
      goalMet: day?.goalMet === true,
      active: (day?.questions ?? 0) > 0,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    };
  });
}
