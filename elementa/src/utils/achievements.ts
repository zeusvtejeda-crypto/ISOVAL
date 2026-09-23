import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_ID,
  type AchievementContext,
  type AchievementDef,
  type AchievementProgress,
} from '@/data/achievements';
import type { ProgressState } from '@/types';
import { todayKey } from './dates';
import { levelFromXp } from './levels';
import { countLearned, masteryMap, MASTERED_THRESHOLD } from './mastery';
import { computeStreak } from './streak';

export { ACHIEVEMENTS, ACHIEVEMENTS_BY_ID };
export type { AchievementContext, AchievementDef, AchievementProgress };

export interface AchievementStatus {
  def: AchievementDef;
  unlocked: boolean;
  /** ISO de desbloqueo, o `null`. */
  unlockedAt: string | null;
  current: number;
  target: number;
  /** 0–1 (1 si está desbloqueado). */
  ratio: number;
}

export function buildAchievementContext(state: ProgressState, now: Date): AchievementContext {
  const mastery = masteryMap(state, now);
  return {
    state,
    now,
    mastery,
    masteredCount: Object.values(mastery).filter((m) => m >= MASTERED_THRESHOLD).length,
    learnedCount: countLearned(state),
    level: levelFromXp(state.xp).level,
    bestDayStreak: computeStreak(state.daily, todayKey(now)).best,
  };
}

/** Ids de logros que se cumplen ahora y aún no están en `state.achievements`. */
export function evaluateAchievements(state: ProgressState, now: Date): string[] {
  const pending = ACHIEVEMENTS.filter((a) => !state.achievements[a.id]);
  if (pending.length === 0) return [];
  const ctx = buildAchievementContext(state, now);
  return pending
    .filter((a) => {
      const { current, target } = a.progress(ctx);
      return current >= target;
    })
    .map((a) => a.id);
}

/** Estado de todos los logros (para la pantalla de logros), en el orden de definición. */
export function achievementStatuses(state: ProgressState, now: Date): AchievementStatus[] {
  const ctx = buildAchievementContext(state, now);
  return ACHIEVEMENTS.map((def) => {
    const unlockedAt = state.achievements[def.id] ?? null;
    const { current, target } = def.progress(ctx);
    const unlocked = unlockedAt !== null;
    return {
      def,
      unlocked,
      unlockedAt,
      current: unlocked ? target : current,
      target,
      ratio: unlocked ? 1 : target > 0 ? Math.min(1, current / target) : 0,
    };
  });
}
