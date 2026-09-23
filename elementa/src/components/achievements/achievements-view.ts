import type { AchievementStatus } from '@/utils/achievements';

/** Un logro cuenta como "nuevo" durante este tiempo tras desbloquearse. */
export const RECENT_MS = 3 * 86_400_000;

export type AchievementFilter = 'all' | 'unlocked' | 'locked';

function unlockedTime(s: AchievementStatus): number {
  const t = s.unlockedAt ? Date.parse(s.unlockedAt) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/** ¿Se desbloqueó hace poco (últimos 3 días)? */
export function isRecent(s: AchievementStatus, now: Date): boolean {
  if (!s.unlocked) return false;
  const t = unlockedTime(s);
  return t > 0 && now.getTime() - t < RECENT_MS && now.getTime() - t >= -60_000;
}

/**
 * Orden de la pantalla: desbloqueados primero (el más reciente arriba) y luego los pendientes,
 * del más cercano a conseguirse al más lejano (a igualdad, el orden de definición).
 */
export function sortStatuses(statuses: readonly AchievementStatus[]): AchievementStatus[] {
  const order = new Map(statuses.map((s, i) => [s.def.id, i]));
  const idx = (s: AchievementStatus) => order.get(s.def.id) ?? 0;
  const unlocked = statuses.filter((s) => s.unlocked).sort((a, b) => unlockedTime(b) - unlockedTime(a) || idx(a) - idx(b));
  const locked = statuses.filter((s) => !s.unlocked).sort((a, b) => b.ratio - a.ratio || idx(a) - idx(b));
  return [...unlocked, ...locked];
}

export function filterStatuses(statuses: readonly AchievementStatus[], filter: AchievementFilter): AchievementStatus[] {
  if (filter === 'unlocked') return statuses.filter((s) => s.unlocked);
  if (filter === 'locked') return statuses.filter((s) => !s.unlocked);
  return [...statuses];
}

/** El logro pendiente más cercano a conseguirse (con algo de progreso si lo hay). */
export function nextAchievement(statuses: readonly AchievementStatus[]): AchievementStatus | null {
  const locked = statuses.filter((s) => !s.unlocked);
  if (locked.length === 0) return null;
  return locked.reduce((best, s) => (s.ratio > best.ratio ? s : best), locked[0]);
}
