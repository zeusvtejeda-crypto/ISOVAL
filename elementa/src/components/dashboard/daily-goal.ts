import type { DailyActivity } from '@/types';

export interface DailyGoalStatus {
  /** Actividad real de hoy (quiz + flashcards), sin recortar a la meta: 7 con meta 5 son «7 / 5». */
  done: number;
  /** Meta vigente hoy: la que se cumplió (`today.goal`) o, si aún no se cumple, la de los ajustes. */
  goal: number;
  met: boolean;
  remaining: number;
  /** Meta nueva de los ajustes que empieza mañana (hoy ya se cumplió otra); `null` si no cambia. */
  nextGoal: number | null;
}

/**
 * Estado de la meta diaria. El motor conserva la meta con la que se cumplió el día (`today.goal`)
 * y aplica una meta nueva desde mañana; mientras no se cumple, manda la de los ajustes.
 */
export function dailyGoalStatus(today: Pick<DailyActivity, 'questions' | 'goal' | 'goalMet'>, dailyGoal: number): DailyGoalStatus {
  const settingsGoal = Math.max(1, dailyGoal);
  const goal = today.goalMet ? Math.max(1, today.goal) : settingsGoal;
  const done = Math.max(0, today.questions);
  return {
    done,
    goal,
    met: today.goalMet || done >= goal,
    remaining: Math.max(0, goal - done),
    nextGoal: today.goalMet && goal !== settingsGoal ? settingsGoal : null,
  };
}
