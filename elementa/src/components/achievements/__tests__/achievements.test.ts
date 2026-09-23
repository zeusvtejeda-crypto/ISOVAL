import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '@/data/achievements';
import { achievementStatuses } from '@/utils/achievements';
import { createInitialState } from '@/utils/state';
import {
  filterStatuses,
  isRecent,
  isStarter,
  nextAchievement,
  RECENT_MS,
  remainingEffort,
  sortStatuses,
} from '../achievements-view';

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

  it('desbloqueados primero (el más reciente arriba) y luego por esfuerzo restante', () => {
    const sorted = sortStatuses(statuses);
    expect(sorted).toHaveLength(ACHIEVEMENTS.length);
    expect(sorted.slice(0, 2).map((s) => s.def.id)).toEqual(['first-goal', 'first-element']);
    // Logros a un solo paso sin empezar (en orden de definición) y después el más avanzado: 80 / 100 preguntas.
    expect(sorted.slice(2, 5).map((s) => s.def.id)).toEqual(['first-exam', 'perfect-exam', 'questions-100']);
    const efforts = sorted.slice(4).map(remainingEffort);
    for (let i = 1; i < efforts.length; i++) expect(efforts[i]).toBeGreaterThanOrEqual(efforts[i - 1]);
  });

  it('filtros y próximo logro', () => {
    expect(filterStatuses(statuses, 'unlocked')).toHaveLength(2);
    expect(filterStatuses(statuses, 'locked')).toHaveLength(ACHIEVEMENTS.length - 2);
    expect(filterStatuses(statuses, 'all')).toHaveLength(ACHIEVEMENTS.length);
    expect(nextAchievement(statuses)?.def.id).toBe('first-exam');
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

  it('a un usuario nuevo le propone «Primer elemento», no «Experto — nivel 5» (1/5 sin esfuerzo)', () => {
    const fresh = achievementStatuses(createInitialState(NOW), NOW);
    const level5 = fresh.find((s) => s.def.id === 'level-5')!;
    expect(level5.current).toBe(1);
    expect(remainingEffort(level5)).toBe(1);
    expect(isStarter(fresh.find((s) => s.def.id === 'first-element')!)).toBe(true);
    expect(nextAchievement(fresh)?.def.id).toBe('first-element');
  });

  it('sin logros de inicio pendientes, gana el de menor esfuerzo restante', () => {
    const s = stateWith(
      { 'first-element': old, 'first-goal': old, 'first-exam': old, 'perfect-exam': old },
      { totalQuestions: 60 },
    );
    const next = nextAchievement(achievementStatuses(s, NOW));
    expect(next?.def.id).toBe('questions-100'); // 60 / 100 → 0,4 restante
  });
});
