import { achievementStatuses, type AchievementStatus } from '@/utils/achievements';
import { createInitialState } from '@/utils/state';

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
 * Progreso con el que parte cada logro en un progreso nuevo (p. ej. «Experto — nivel 5» empieza en 1/5
 * porque todo usuario tiene nivel 1). Se descuenta para no premiar un avance que no costó nada.
 */
let baselineCache: Map<string, number> | null = null;

function baselineOf(id: string): number {
  if (!baselineCache) {
    const epoch = new Date(0);
    baselineCache = new Map(achievementStatuses(createInitialState(epoch), epoch).map((s) => [s.def.id, s.current]));
  }
  return baselineCache.get(id) ?? 0;
}

/**
 * Esfuerzo que queda, normalizado de 0 (conseguido) a 1 (sin empezar): lo que falta
 * (`target − current`) sobre el recorrido total desde el punto de partida.
 */
export function remainingEffort(s: AchievementStatus): number {
  if (s.unlocked) return 0;
  const base = Math.min(baselineOf(s.def.id), s.target);
  const span = s.target - base;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (s.target - s.current) / span));
}

/** Logro de inicio aún sin empezar: está a un solo paso (primer elemento, primera meta, primer examen…). */
export function isStarter(s: AchievementStatus): boolean {
  const base = baselineOf(s.def.id);
  return !s.unlocked && s.target - base === 1 && s.current <= base;
}

/** Pendientes: primero los de inicio sin empezar, luego por esfuerzo restante (a igualdad, orden de definición). */
function compareLocked(a: AchievementStatus, b: AchievementStatus, idx: (s: AchievementStatus) => number): number {
  const starter = Number(isStarter(b)) - Number(isStarter(a));
  return starter || remainingEffort(a) - remainingEffort(b) || idx(a) - idx(b);
}

/**
 * Orden de la pantalla: desbloqueados primero (el más reciente arriba) y luego los pendientes, del más
 * cercano a conseguirse al más lejano (`compareLocked`).
 */
export function sortStatuses(statuses: readonly AchievementStatus[]): AchievementStatus[] {
  const order = new Map(statuses.map((s, i) => [s.def.id, i]));
  const idx = (s: AchievementStatus) => order.get(s.def.id) ?? 0;
  const unlocked = statuses.filter((s) => s.unlocked).sort((a, b) => unlockedTime(b) - unlockedTime(a) || idx(a) - idx(b));
  const locked = statuses.filter((s) => !s.unlocked).sort((a, b) => compareLocked(a, b, idx));
  return [...unlocked, ...locked];
}

export function filterStatuses(statuses: readonly AchievementStatus[], filter: AchievementFilter): AchievementStatus[] {
  if (filter === 'unlocked') return statuses.filter((s) => s.unlocked);
  if (filter === 'locked') return statuses.filter((s) => !s.unlocked);
  return [...statuses];
}

/**
 * El logro pendiente que menos esfuerzo pide: a un usuario nuevo, «Primer elemento» (a una respuesta)
 * antes que «Experto — nivel 5».
 */
export function nextAchievement(statuses: readonly AchievementStatus[]): AchievementStatus | null {
  const order = new Map(statuses.map((s, i) => [s.def.id, i]));
  const idx = (s: AchievementStatus) => order.get(s.def.id) ?? 0;
  const locked = statuses.filter((s) => !s.unlocked);
  if (locked.length === 0) return null;
  return locked.reduce((best, s) => (compareLocked(s, best, idx) < 0 ? s : best), locked[0]);
}
