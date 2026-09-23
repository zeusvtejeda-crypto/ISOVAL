import type { DailyGoal } from '@/types';

export interface GoalOption {
  value: DailyGoal;
  /** "Meta relajada", "Meta normal"… */
  label: string;
  emoji: string;
}

/** Metas diarias disponibles (preguntas al día). Compartidas por la bienvenida y Ajustes. */
export const GOAL_OPTIONS: readonly GoalOption[] = [
  { value: 5, label: 'Relajada', emoji: '🌿' },
  { value: 10, label: 'Normal', emoji: '🙂' },
  { value: 20, label: 'Seria', emoji: '💪' },
  { value: 50, label: 'Intensa', emoji: '🔥' },
];

export const DEFAULT_GOAL: DailyGoal = 10;

/** Segundos por pregunta usados para estimar el tiempo (mismo criterio que el planificador). */
const SECONDS_PER_QUESTION = 15;

/** Minutos aproximados que lleva cumplir una meta: 10 → 3. */
export function goalMinutes(goal: number): number {
  return Math.max(1, Math.ceil((goal * SECONDS_PER_QUESTION) / 60));
}

export function goalOption(goal: number): GoalOption {
  return GOAL_OPTIONS.find((o) => o.value === goal) ?? GOAL_OPTIONS[1];
}
