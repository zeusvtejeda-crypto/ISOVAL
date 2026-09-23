import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '@/data/achievements';
import { achievementStatuses } from '@/utils/achievements';
import { createInitialState } from '@/utils/state';
import { filterStatuses, isRecent, nextAchievement, RECENT_MS, sortStatuses } from '../achievements-view';

const NOW = new Date(2026, 8, 23, 12, 0, 0);

function stateWith(unlocked: Record<string, string>, patch: { totalQuestions?: number } = {}) {
  const state = createInitialState(NOW);
  return {
    ...state,
    achievements: unlocked,
    stats: { ...state.stats, totalQuestions: patch.totalQuestions ?? 0 },
  };
}

describe('achievements-view', () => {
  const old = new Date(NOW.getTime() - 10 * 86_400_000).toISOString();
  const fresh = new Date(NOW.getTime() - 3_600_000).toISOString();
  const state = stateWith({ 'first-element': old, 'first-goal': fresh }, { totalQuestions: 80 });
  const statuses = achievementStatuses(state, NOW);

  it('desbloqueados primero (el más reciente arriba) y luego por cercanía', () => {
    const sorted = sortStatuses(statuses);
    expect(sorted).toHaveLength(ACHIEVEMENTS.length);
    expect(sorted.slice(0, 2).map((s) => s.def.id)).toEqual(['first-goal', 'first-element']);
    expect(sorted[2].def.id).toBe('questions-100'); // 80 / 100
    const lockedRatios = sorted.slice(2).map((s) => s.ratio);
    for (let i = 1; i < lockedRatios.length; i++) expect(lockedRatios[i]).toBeLessThanOrEqual(lockedRatios[i - 1]);
  });

  it('filtros y próximo logro', () => {
    expect(filterStatuses(statuses, 'unlocked')).toHaveLength(2);
    expect(filterStatuses(statuses, 'locked')).toHaveLength(ACHIEVEMENTS.length - 2);
    expect(filterStatuses(statuses, 'all')).toHaveLength(ACHIEVEMENTS.length);
    expect(nextAchievement(statuses)?.def.id).toBe('questions-100');
    const all = achievementStatuses(
      stateWith(Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, old]))),
      NOW,
    );
    expect(nextAchievement(all)).toBeNull();
  });

  it('"nuevo" durante 3 días tras desbloquearse', () => {
    const byId = new Map(statuses.map((s) => [s.def.id, s]));
    expect(isRecent(byId.get('first-goal')!, NOW)).toBe(true);
    expect(isRecent(byId.get('first-element')!, NOW)).toBe(false);
    expect(isRecent(byId.get('questions-100')!, NOW)).toBe(false);
    expect(isRecent(byId.get('first-goal')!, new Date(NOW.getTime() + RECENT_MS))).toBe(false);
  });
});
