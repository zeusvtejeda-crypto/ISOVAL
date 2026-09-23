import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { hardElements } from '@/components/mistakes/mistakes-data';
import type { DailyActivity, DailyGoal } from '@/types';
import { todayKey } from '@/utils/dates';
import { applyAnswer, applySettings, type AnswerInput } from '@/utils/engine';
import { difficultElements } from '@/utils/selection';
import { createInitialState } from '@/utils/state';
import { dailyGoalStatus } from '../daily-goal';
import { QuickAccess } from '../QuickAccess';

const NOW = new Date(2026, 8, 23, 12, 0, 0);

function input(z: number, correct: boolean): AnswerInput {
  return {
    atomicNumber: z,
    skill: 'symbol',
    correct,
    responseMs: 3000,
    mode: 'practice',
    prompt: `Pregunta ${z}`,
    correctAnswer: 'A',
    givenAnswer: correct ? 'A' : 'B',
  };
}

/** Estado tras responder `n` preguntas hoy con la meta `goal`. */
function answered(n: number, goal: DailyGoal) {
  let state = applySettings(createInitialState(NOW), { dailyGoal: goal }, NOW);
  for (let i = 0; i < n; i++) state = applyAnswer(state, input(1 + i, true), NOW).state;
  return state;
}

const today = (state: ReturnType<typeof answered>): DailyActivity => state.daily[todayKey(NOW)];

describe('dailyGoalStatus', () => {
  it('meta cumplida y luego subida: cuenta la de hoy y avisa de la nueva para mañana', () => {
    const state = applySettings(answered(10, 10), { dailyGoal: 20 }, NOW);
    expect(dailyGoalStatus(today(state), state.settings.dailyGoal)).toEqual({
      done: 10,
      goal: 10,
      met: true,
      remaining: 0,
      nextGoal: 20,
    });
  });

  it('meta bajada con más respuestas: muestra la cuenta real (7 / 5), sin recortar', () => {
    const state = applySettings(answered(7, 10), { dailyGoal: 5 }, NOW);
    const status = dailyGoalStatus(today(state), state.settings.dailyGoal);
    expect(status).toMatchObject({ done: 7, goal: 5, met: true, remaining: 0, nextGoal: null });
  });

  it('sin cumplir: la meta de los ajustes y lo que falta', () => {
    const state = answered(3, 10);
    expect(dailyGoalStatus(today(state), state.settings.dailyGoal)).toMatchObject({ done: 3, goal: 10, met: false, remaining: 7 });
    const empty = { questions: 0, goal: 10, goalMet: false };
    expect(dailyGoalStatus(empty, 20)).toMatchObject({ done: 0, goal: 20, remaining: 20, nextGoal: null });
  });
});

describe('QuickAccess', () => {
  it('«Mis errores» cuenta los elementos difíciles, como /errores', () => {
    let state = createInitialState(NOW);
    // Diagnóstico 7/10: 3 fallos (Sc, V, Se) y 7 aciertos.
    const plan: Array<[number, boolean]> = [[1, true], [2, true], [6, true], [8, true], [11, true], [26, true], [79, true], [21, false], [23, false], [34, false]];
    for (const [z, correct] of plan) state = applyAnswer(state, input(z, correct), NOW).state;
    const count = difficultElements(state, NOW).length;
    expect(count).toBe(3);
    expect(count).toBe(hardElements(state, NOW).length);
    const html = renderToStaticMarkup(h(QuickAccess, { difficultCount: count }));
    expect(html).toContain('3 elementos por reforzar');
    expect(renderToStaticMarkup(h(QuickAccess, { difficultCount: 0 }))).toContain('¡Nada pendiente!');
  });
});
