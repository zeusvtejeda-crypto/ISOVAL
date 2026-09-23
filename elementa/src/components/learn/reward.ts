import type { SessionSummaryData } from '@/types';

/** Lo que da `markLearned` al terminar las tarjetas: +5 XP por elemento y logros (Primer elemento…). */
export interface LearnReward {
  xpGained: number;
  unlockedAchievements: string[];
}

export const NO_LEARN_REWARD: LearnReward = { xpGained: 0, unlockedAchievements: [] };

/** El resumen del quiz con los logros desbloqueados al aprender (antes de las preguntas). */
export function withLearnAchievements(summary: SessionSummaryData, reward: LearnReward): SessionSummaryData {
  if (reward.unlockedAchievements.length === 0) return summary;
  return {
    ...summary,
    unlockedAchievements: Array.from(new Set([...reward.unlockedAchievements, ...summary.unlockedAchievements])),
  };
}
