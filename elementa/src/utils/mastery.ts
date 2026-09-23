import { ELEMENTS } from '@/data/elements';
import type { ElementProgress, MasteryTier, ProgressState } from '@/types';
import { overdueDays } from './srs';

export const MASTERED_THRESHOLD = 85;
const LEARNING_THRESHOLD = 40;
const ALMOST_THRESHOLD = 65;

/** Respuestas a partir de las cuales la confianza es plena. */
const FULL_CONFIDENCE_ANSWERS = 6;
const FAST_MS = 4_000;
const SLOW_MS = 12_000;
const MAX_SPEED_PENALTY = 0.15;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Dominio 0–100 de un elemento. Combina:
 * - precisión bayesiana (prior neutro) y precisión reciente (últimos 10),
 * - confianza según el número de respuestas (plena a partir de ~6),
 * - velocidad (≤ 4 s sin penalización, ≥ 12 s −15 %),
 * - olvido: decae suavemente si pasó la fecha de repaso sin repasar.
 */
export function computeMastery(p: ElementProgress | undefined, now: Date): number {
  if (!p) return 0;
  const answers = p.correct + p.incorrect;
  if (answers <= 0) return 0;

  const bayes = (p.correct + 1) / (answers + 2);
  const recent = p.recent.length > 0 ? p.recent.reduce((a, b) => a + b, 0) / p.recent.length : bayes;
  const accuracy = 0.5 * bayes + 0.5 * recent;

  const confidence = clamp01(answers / FULL_CONFIDENCE_ANSWERS);
  const confidenceFactor = 0.35 + 0.65 * confidence;

  let speedFactor = 1;
  if (p.avgResponseMs !== null && p.avgResponseMs > FAST_MS) {
    const t = clamp01((p.avgResponseMs - FAST_MS) / (SLOW_MS - FAST_MS));
    speedFactor = 1 - MAX_SPEED_PENALTY * t;
  }

  const overdue = overdueDays(p, now);
  const stabilityDays = 3 + 2 * Math.max(1, p.intervalDays);
  const decay = overdue > 0 ? 0.6 + 0.4 * Math.exp(-overdue / stabilityDays) : 1;

  const value = 100 * accuracy * confidenceFactor * speedFactor * decay;
  return Math.round(Math.min(100, Math.max(0, value)));
}

export function masteryTier(m: number): MasteryTier {
  if (m >= MASTERED_THRESHOLD) return 'mastered';
  if (m >= ALMOST_THRESHOLD) return 'almost';
  if (m >= LEARNING_THRESHOLD) return 'learning';
  return 'practice';
}

export interface TierMeta {
  label: string;
  emoji: string;
  /** Clase de fondo para barras y puntos. */
  barClass: string;
  /** Clase de texto con el color del nivel. */
  textClass: string;
}

export const TIER_META: Record<MasteryTier, TierMeta> = {
  practice: { label: 'Necesita práctica', emoji: '🔴', barClass: 'bg-danger', textClass: 'text-danger' },
  learning: { label: 'Aprendiendo', emoji: '🟠', barClass: 'bg-streak', textClass: 'text-streak' },
  almost: { label: 'Casi dominado', emoji: '🟡', barClass: 'bg-warning', textClass: 'text-warning' },
  mastered: { label: 'Dominado', emoji: '🟢', barClass: 'bg-success', textClass: 'text-success' },
};

/** Dominio de los 118 elementos (0 para los no vistos). */
export function masteryMap(state: ProgressState, now: Date): Record<number, number> {
  const out: Record<number, number> = {};
  for (const el of ELEMENTS) out[el.atomicNumber] = computeMastery(state.elements[el.atomicNumber], now);
  return out;
}

export function countMastered(state: ProgressState, now: Date): number {
  let n = 0;
  for (const el of ELEMENTS) {
    if (computeMastery(state.elements[el.atomicNumber], now) >= MASTERED_THRESHOLD) n++;
  }
  return n;
}

export function countLearned(state: ProgressState): number {
  return Object.values(state.elements).filter((p) => p.learned).length;
}
