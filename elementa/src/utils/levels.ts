import { LEVEL_EMOJIS, LEVEL_TITLES, MAX_TITLED_LEVEL } from '@/data/levels';

export interface LevelInfo {
  level: number;
  title: string;
  /** XP acumulada dentro del nivel actual. */
  xpIntoLevel: number;
  /** XP necesaria para pasar al siguiente nivel. */
  xpForNext: number;
  /** 0–1 dentro del nivel actual. */
  progress: number;
  totalXp: number;
}

/** XP para pasar del nivel `level` al siguiente: 100 + (n − 1) × 150. */
export function xpToNext(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 100 + (n - 1) * 150;
}

/** XP total acumulada al empezar `level` (nivel 1 = 0). */
export function xpAtLevelStart(level: number): number {
  const k = Math.max(1, Math.floor(level)) - 1;
  // Σ_{i=1..k} (100 + (i − 1)·150) = 100k + 75k(k − 1) = 75k² + 25k
  return 100 * k + 75 * k * (k - 1);
}

/**
 * Nivel alcanzado con `totalXp` (entero ≥ 0) en tiempo constante: los niveles completados son el
 * mayor k con 75k² + 25k ≤ xp, es decir k = ⌊(−25 + √(625 + 300·xp)) / 150⌋. Los bucles solo
 * corrigen ±1 por redondeo de coma flotante.
 */
function levelForXp(totalXp: number): number {
  let level = Math.max(1, Math.floor((-25 + Math.sqrt(625 + 300 * totalXp)) / 150) + 1);
  while (level > 1 && xpAtLevelStart(level) > totalXp) level--;
  while (xpAtLevelStart(level + 1) <= totalXp) level++;
  return level;
}

export function levelTitle(level: number): string {
  const idx = Math.min(Math.max(1, Math.floor(level)), MAX_TITLED_LEVEL) - 1;
  return LEVEL_TITLES[idx];
}

export function levelEmoji(level: number): string {
  const idx = Math.min(Math.max(1, Math.floor(level)), MAX_TITLED_LEVEL) - 1;
  return LEVEL_EMOJIS[idx];
}

export function levelFromXp(xp: number): LevelInfo {
  const totalXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  const level = levelForXp(totalXp);
  const xpIntoLevel = totalXp - xpAtLevelStart(level);
  const xpForNext = xpToNext(level);
  return {
    level,
    title: levelTitle(level),
    xpIntoLevel,
    xpForNext,
    progress: Math.min(1, xpIntoLevel / xpForNext),
    totalXp,
  };
}
