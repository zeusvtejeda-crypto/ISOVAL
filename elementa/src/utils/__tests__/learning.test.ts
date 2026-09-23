import { describe, expect, it } from 'vitest';
import type { DailyActivity, ElementProgress } from '@/types';
import { applyAnswer } from '@/utils/engine';
import {
  computeMastery,
  countLearned,
  countMastered,
  MASTERED_THRESHOLD,
  masteryMap,
  masteryTier,
  TIER_META,
} from '@/utils/mastery';
import {
  adaptivePool,
  dueReviews,
  elementPriority,
  newElements,
  planStudySession,
  weakElements,
} from '@/utils/planner';
import {
  AGAIN_DELAY_MS,
  applyRating,
  createElementProgress,
  isDue,
  MAX_INTERVAL_DAYS,
  ratingFromAnswer,
} from '@/utils/srs';
import { createInitialState } from '@/utils/state';
import { computeStreak, weekActivity } from '@/utils/streak';
import { daysFrom, NOW, progress } from './helpers';

const DAY = 86_400_000;

function answer(p: ElementProgress | undefined, correct: boolean, ms = 2500): ElementProgress {
  let state = createInitialState(NOW);
  if (p) state = { ...state, elements: { [p.atomicNumber]: p } };
  const z = p?.atomicNumber ?? 26;
  return applyAnswer(
    state,
    { atomicNumber: z, skill: 'symbol', correct, responseMs: ms, mode: 'practice', prompt: 'p', correctAnswer: 'a', givenAnswer: 'b' },
    NOW,
  ).state.elements[z];
}

describe('srs', () => {
  it('valores iniciales', () => {
    expect(createElementProgress(8)).toMatchObject({ atomicNumber: 8, ease: 2.5, intervalDays: 0, reps: 0, due: null, learned: false });
  });

  it('again: reinicia y vuelve en 10 minutos', () => {
    const p = applyRating(progress(8, { reps: 3, intervalDays: 10, ease: 2.5 }), 'again', NOW);
    expect(p).toMatchObject({ reps: 0, intervalDays: 0, ease: 2.3 });
    expect(Date.parse(p.due as string) - NOW.getTime()).toBe(AGAIN_DELAY_MS);
  });

  it('good: 1 día, 3 días y luego intervalo × ease', () => {
    let p = applyRating(progress(8), 'good', NOW);
    expect(p).toMatchObject({ reps: 1, intervalDays: 1 });
    p = applyRating(p, 'good', NOW);
    expect(p).toMatchObject({ reps: 2, intervalDays: 3 });
    p = applyRating(p, 'good', NOW);
    expect(p).toMatchObject({ reps: 3, intervalDays: 7.5 });
    expect(Date.parse(p.due as string) - NOW.getTime()).toBe(7.5 * DAY);
  });

  it('hard y easy ajustan intervalo y facilidad', () => {
    expect(applyRating(progress(8), 'hard', NOW)).toMatchObject({ intervalDays: 1, ease: 2.35 });
    expect(applyRating(progress(8, { intervalDays: 10, reps: 3 }), 'hard', NOW).intervalDays).toBe(12);
    expect(applyRating(progress(8), 'easy', NOW)).toMatchObject({ intervalDays: 4, ease: 2.65 });
    expect(applyRating(progress(8, { intervalDays: 4, reps: 2 }), 'easy', NOW).intervalDays).toBe(13);
  });

  it('la facilidad se mantiene en [1.3, 3.0]', () => {
    let p = progress(8);
    for (let i = 0; i < 20; i++) p = applyRating(p, 'again', NOW);
    expect(p.ease).toBe(1.3);
    for (let i = 0; i < 20; i++) p = applyRating(p, 'easy', NOW);
    expect(p.ease).toBe(3);
    expect(p.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it('ratingFromAnswer e isDue', () => {
    expect(ratingFromAnswer(false, 1000)).toBe('again');
    expect(ratingFromAnswer(true, 12_000)).toBe('hard');
    expect(ratingFromAnswer(true, 2_000)).toBe('easy');
    expect(ratingFromAnswer(true, 5_000)).toBe('good');
    expect(isDue(undefined, NOW)).toBe(false);
    expect(isDue(progress(8), NOW)).toBe(false);
    expect(isDue(progress(8, { due: daysFrom(NOW, -1).toISOString() }), NOW)).toBe(true);
    expect(isDue(progress(8, { due: daysFrom(NOW, 1).toISOString() }), NOW)).toBe(false);
  });
});

describe('mastery', () => {
  it('0 sin respuestas', () => {
    expect(computeMastery(undefined, NOW)).toBe(0);
    expect(computeMastery(progress(8, { learned: true }), NOW)).toBe(0);
  });

  it('siempre entre 0 y 100 (entero)', () => {
    for (let c = 0; c <= 20; c += 4) {
      for (let i = 0; i <= 20; i += 4) {
        const m = computeMastery(
          progress(8, { correct: c, incorrect: i, recent: [1, 0, 1], avgResponseMs: 20_000, due: daysFrom(NOW, -90).toISOString() }),
          NOW,
        );
        expect(Number.isInteger(m)).toBe(true);
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(100);
      }
    }
  });

  it('sube con aciertos, baja con fallos y se domina con ~6 aciertos rápidos', () => {
    let p: ElementProgress | undefined;
    let prev = 0;
    for (let i = 0; i < 6; i++) {
      p = answer(p, true);
      const m = computeMastery(p, NOW);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
    expect(prev).toBeGreaterThanOrEqual(MASTERED_THRESHOLD);
    const failed = answer(p, false);
    expect(computeMastery(failed, NOW)).toBeLessThan(prev);
  });

  it('penaliza la lentitud y el olvido', () => {
    const base = { correct: 8, incorrect: 0, recent: [1, 1, 1, 1, 1, 1, 1, 1], intervalDays: 3 };
    const fast = computeMastery(progress(8, { ...base, avgResponseMs: 3000 }), NOW);
    const slow = computeMastery(progress(8, { ...base, avgResponseMs: 15_000 }), NOW);
    expect(slow).toBeLessThan(fast);
    expect(slow).toBeGreaterThanOrEqual(Math.floor(fast * 0.85));
    const fresh = computeMastery(progress(8, { ...base, due: daysFrom(NOW, 1).toISOString() }), NOW);
    const forgotten = computeMastery(progress(8, { ...base, due: daysFrom(NOW, -30).toISOString() }), NOW);
    expect(forgotten).toBeLessThan(fresh);
    expect(forgotten).toBeGreaterThanOrEqual(Math.floor(fresh * 0.6));
  });

  it('niveles de dominio', () => {
    expect(masteryTier(0)).toBe('practice');
    expect(masteryTier(39)).toBe('practice');
    expect(masteryTier(40)).toBe('learning');
    expect(masteryTier(65)).toBe('almost');
    expect(masteryTier(85)).toBe('mastered');
    expect(TIER_META.mastered.emoji).toBe('🟢');
  });

  it('mapa, dominados y aprendidos', () => {
    const state = createInitialState(NOW);
    state.elements[8] = progress(8, { correct: 10, recent: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], learned: true });
    state.elements[9] = progress(9, { learned: true });
    const map = masteryMap(state, NOW);
    expect(Object.keys(map)).toHaveLength(118);
    expect(map[8]).toBeGreaterThanOrEqual(85);
    expect(countMastered(state, NOW)).toBe(1);
    expect(countLearned(state)).toBe(2);
  });
});

function day(date: string, goalMet: boolean, questions = goalMet ? 10 : 3): DailyActivity {
  return { date, questions, correct: questions, xp: 0, timeMs: 0, newLearned: 0, goal: 10, goalMet };
}

describe('streak', () => {
  const today = '2026-01-15';

  it('sin actividad', () => {
    expect(computeStreak({}, today)).toEqual({ current: 0, best: 0, todayMet: false, atRisk: false });
  });

  it('meta cumplida hoy y ayer', () => {
    const daily = { '2026-01-14': day('2026-01-14', true), '2026-01-15': day('2026-01-15', true) };
    expect(computeStreak(daily, today)).toEqual({ current: 2, best: 2, todayMet: true, atRisk: false });
  });

  it('cumplida ayer pero hoy todavía no: sigue viva y en riesgo', () => {
    const daily = {
      '2026-01-13': day('2026-01-13', true),
      '2026-01-14': day('2026-01-14', true),
      '2026-01-15': day('2026-01-15', false),
    };
    expect(computeStreak(daily, today)).toEqual({ current: 2, best: 2, todayMet: false, atRisk: true });
  });

  it('racha rota conserva la mejor histórica', () => {
    const daily = {
      '2026-01-01': day('2026-01-01', true),
      '2026-01-02': day('2026-01-02', true),
      '2026-01-03': day('2026-01-03', true),
      '2026-01-13': day('2026-01-13', true),
    };
    expect(computeStreak(daily, today)).toEqual({ current: 0, best: 3, todayMet: false, atRisk: false });
  });

  it('semana de lunes a domingo', () => {
    const daily = { '2026-01-12': day('2026-01-12', true), '2026-01-13': day('2026-01-13', false) };
    const week = weekActivity(daily, today);
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ key: '2026-01-12', letter: 'L', goalMet: true, active: true, isToday: false });
    expect(week[1]).toMatchObject({ goalMet: false, active: true });
    expect(week[3]).toMatchObject({ key: today, isToday: true, isFuture: false, active: false });
    expect(week[6]).toMatchObject({ key: '2026-01-18', letter: 'D', isFuture: true });
  });
});

describe('planner', () => {
  it('usuario nuevo: plan no vacío con elementos nuevos', () => {
    const state = createInitialState(NOW);
    const plan = planStudySession(state, NOW);
    expect(plan.newElements).toEqual([1, 2, 3, 4, 5]);
    expect(plan.reviews).toEqual([]);
    expect(plan.hard).toEqual([]);
    expect(plan.questions.length).toBeGreaterThanOrEqual(8);
    expect(plan.estimatedMinutes).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < plan.questions.length; i++) {
      // Se intenta no repetir el mismo elemento dos veces seguidas.
      if (plan.questions[i].atomicNumber === plan.questions[i - 1].atomicNumber) {
        expect(new Set(plan.questions.map((q) => q.atomicNumber)).size).toBeLessThan(plan.questions.length);
      }
    }
  });

  it('nunca vacío aunque todo esté aprendido y al día', () => {
    const state = createInitialState(NOW);
    for (let z = 1; z <= 118; z++) {
      state.elements[z] = progress(z, {
        learned: true,
        correct: 8,
        recent: [1, 1, 1, 1, 1, 1, 1, 1],
        due: daysFrom(NOW, 5).toISOString(),
        intervalDays: 5,
        avgResponseMs: 2000,
      });
    }
    const plan = planStudySession(state, NOW);
    expect(plan.newElements).toEqual([]);
    expect(plan.questions.length).toBeGreaterThan(0);
  });

  it('incluye repasos pendientes y elementos difíciles', () => {
    const state = createInitialState(NOW);
    state.elements[26] = progress(26, { learned: true, correct: 3, due: daysFrom(NOW, -2).toISOString(), intervalDays: 3 });
    state.elements[29] = progress(29, { correct: 0, incorrect: 4, recent: [0, 0, 0, 0], due: daysFrom(NOW, 1).toISOString() });
    const plan = planStudySession(state, NOW);
    expect(plan.reviews).toContain(26);
    expect(plan.hard).toContain(29);
    expect(plan.questions.some((q) => q.atomicNumber === 29)).toBe(true);
  });

  it('prioridad: fallados > nuevos > dominados; atrasados y lentos suben', () => {
    const failed = progress(8, { incorrect: 4, correct: 1, recent: [0, 0, 1, 0, 0] });
    const mastered = progress(8, { correct: 10, recent: [1, 1, 1, 1, 1], streak: 10, due: daysFrom(NOW, 5).toISOString() });
    const overdue = { ...mastered, due: daysFrom(NOW, -10).toISOString() };
    const slow = { ...mastered, avgResponseMs: 12_000 };
    expect(elementPriority(failed, NOW)).toBeGreaterThan(elementPriority(undefined, NOW));
    expect(elementPriority(undefined, NOW)).toBeGreaterThan(elementPriority(mastered, NOW));
    expect(elementPriority(overdue, NOW)).toBeGreaterThan(elementPriority(mastered, NOW));
    expect(elementPriority(slow, NOW)).toBeGreaterThan(elementPriority(mastered, NOW));
    expect(elementPriority(mastered, NOW)).toBeGreaterThan(0);
  });

  it('adaptivePool elige más a menudo los elementos fallados', () => {
    const state = createInitialState(NOW);
    state.elements[26] = progress(26, { incorrect: 5, recent: [0, 0, 0, 0, 0] });
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 26];
    let hits = 0;
    for (let i = 0; i < 400; i++) if (adaptivePool(state, NOW, 1, pool)[0] === 26) hits++;
    expect(hits / 400).toBeGreaterThan(2 / pool.length);
  });

  it('weakElements, dueReviews y newElements', () => {
    const state = createInitialState(NOW);
    state.elements[3] = progress(3, { correct: 1, incorrect: 3, recent: [0, 0, 1, 0] });
    state.elements[4] = progress(4, { correct: 3, incorrect: 1, recent: [1, 1, 0, 1], learned: true });
    state.elements[5] = progress(5, { correct: 10, recent: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], learned: true });
    state.elements[6] = progress(6, { due: daysFrom(NOW, -3).toISOString(), learned: true });
    state.elements[7] = progress(7, { due: daysFrom(NOW, -1).toISOString(), learned: true });
    expect(weakElements(state, NOW).map((w) => w.atomicNumber)).toEqual([3, 4]);
    expect(dueReviews(state, NOW, 5)).toEqual([6, 7]);
    expect(dueReviews(state, NOW, 1)).toEqual([6]);
    expect(newElements(state, 3)).toEqual([1, 2, 3]);
    expect(newElements(state, 3, [9, 8, 5])).toEqual([8, 9]);
  });
});
