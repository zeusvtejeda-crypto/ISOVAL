import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AnsweredQuestion, DailyActivity, ElementProgress, ProgressState, Question } from '@/types';
import { applyAnswer, applyOnboarding } from '@/utils/engine';
import {
  computeMastery,
  countLearned,
  countMastered,
  MASTERED_THRESHOLD,
  masteryMap,
  masteryTier,
  TIER_META,
} from '@/utils/mastery';
import * as planner from '@/utils/planner';
import {
  adaptivePool,
  dueReviews,
  elementPriority,
  newElements,
  planStudySession,
  weakElements,
} from '@/utils/planner';
import { generateQuestion } from '@/utils/questions';
import * as selection from '@/utils/selection';
import { difficultElements, selectionWeight } from '@/utils/selection';
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
  it('0 sin respuestas o sin ningún acierto', () => {
    expect(computeMastery(undefined, NOW)).toBe(0);
    expect(computeMastery(progress(8, { learned: true }), NOW)).toBe(0);
    expect(computeMastery(progress(8, { incorrect: 1, recent: [0] }), NOW)).toBe(0);
    expect(computeMastery(progress(8, { incorrect: 5, recent: [0, 0, 0, 0, 0] }), NOW)).toBe(0);
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
    // El olvido se mide desde el último acierto: 2 días (dentro del intervalo) frente a 33 (30 de retraso).
    const fresh = computeMastery(progress(8, { ...base, lastCorrect: daysFrom(NOW, -2).toISOString() }), NOW);
    const forgotten = computeMastery(progress(8, { ...base, lastCorrect: daysFrom(NOW, -33).toISOString() }), NOW);
    expect(forgotten).toBeLessThan(fresh);
    expect(forgotten).toBeGreaterThanOrEqual(Math.floor(fresh * 0.6));
    // `due` ya no interviene: un fallo (due a +10 min) no borra el olvido.
    const afterAgain = progress(8, { ...base, lastCorrect: daysFrom(NOW, -33).toISOString(), intervalDays: 0, due: NOW.toISOString() });
    expect(computeMastery(afterAgain, NOW)).toBeLessThanOrEqual(forgotten);
  });

  it('niveles de dominio', () => {
    expect(masteryTier(0)).toBe('practice');
    expect(masteryTier(39)).toBe('practice');
    expect(masteryTier(40)).toBe('learning');
    expect(masteryTier(65)).toBe('almost');
    expect(masteryTier(85)).toBe('mastered');
    expect(TIER_META.mastered.emoji).toBe('🟢');
    expect(TIER_META.practice.barClass).toBe('bg-tier-practice');
    expect(TIER_META.learning.barClass).toBe('bg-tier-learning');
    expect(TIER_META.almost.barClass).toBe('bg-tier-almost');
    expect(TIER_META.mastered.barClass).toBe('bg-tier-mastered');
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
  return { date, questions, correct: questions, flashcards: 0, xp: 0, timeMs: 0, newLearned: 0, goal: 10, goalMet };
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

  it('§25: fallados > nuevos > lentos pero acertados (sin tocar repaso)', () => {
    const state = createInitialState(NOW);
    const slowCorrect = { correct: 6, recent: [1, 1, 1, 1, 1, 1], streak: 6, avgResponseMs: 25_000, learned: true, due: daysFrom(NOW, 3).toISOString(), intervalDays: 3 };
    const recentFail = { correct: 9, incorrect: 1, recent: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0], streak: 0, avgResponseMs: 3_000, learned: true, due: daysFrom(NOW, 1).toISOString(), intervalDays: 0 };
    // Dificultad 1 (Z ≤ 20) y 2 (p. ej. 22, 23, 24).
    for (const [newZ, slowZ, failZ] of [
      [3, 4, 5],
      [22, 23, 24],
    ]) {
      state.elements[slowZ] = progress(slowZ, slowCorrect);
      state.elements[failZ] = progress(failZ, recentFail);
      const wNew = selectionWeight(state, newZ, NOW);
      const wSlow = selectionWeight(state, slowZ, NOW);
      const wFail = selectionWeight(state, failZ, NOW);
      expect(wNew).toBeGreaterThan(wSlow);
      expect(wFail).toBeGreaterThan(wNew);
      expect(wFail).toBeGreaterThan(wSlow);
    }
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

  it('planner re-exporta las listas de selection', () => {
    expect(planner.weakElements).toBe(selection.weakElements);
    expect(planner.dueReviews).toBe(selection.dueReviews);
    expect(planner.newElements).toBe(selection.newElements);
    expect(planner.difficultElements).toBe(selection.difficultElements);
  });
});

/** 12 elementos acertados una vez (dominio 38) + Potasio: 2 fallos y luego 4 aciertos. */
function onceCorrectPlusPotassium(): ProgressState {
  let state = createInitialState(NOW);
  const answerAt = (z: number, correct: boolean) =>
    applyAnswer(
      state,
      { atomicNumber: z, skill: 'symbol', correct, responseMs: 2500, mode: 'practice', prompt: 'p', correctAnswer: 'a', givenAnswer: 'b' },
      NOW,
    ).state;
  for (let z = 1; z <= 12; z++) state = answerAt(z, true);
  for (const correct of [false, false, true, true, true, true]) state = answerAt(19, correct);
  return state;
}

describe('difficultElements (definición única de «difíciles»)', () => {
  it('solo elementos fallados y sin dominar: un acierto suelto no desplaza a los fallados', () => {
    const state = onceCorrectPlusPotassium();
    expect(computeMastery(state.elements[1], NOW)).toBe(38);
    const k = computeMastery(state.elements[19], NOW);
    expect(difficultElements(state, NOW)).toEqual([
      { atomicNumber: 19, mastery: k, correct: 4, incorrect: 2, accuracy: 4 / 6 },
    ]);
    // weakElements (intentados sin dominar) sí se llena con los acertados una vez y deja fuera al Potasio.
    expect(weakElements(state, NOW, 12).map((w) => w.atomicNumber)).not.toContain(19);
  });

  it('orden: menor dominio, más fallos, número atómico; ignora dominados y Z inválidos; respeta el límite', () => {
    const state = createInitialState(NOW);
    state.elements[26] = progress(26, { correct: 0, incorrect: 2, recent: [0, 0] });
    state.elements[29] = progress(29, { correct: 0, incorrect: 5, recent: [0, 0, 0, 0, 0] });
    state.elements[19] = progress(19, { correct: 0, incorrect: 2, recent: [0, 0] });
    state.elements[8] = progress(8, { correct: 3, incorrect: 1, recent: [1, 0, 1, 1] });
    state.elements[9] = progress(9, { correct: 20, incorrect: 1, recent: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] });
    state.elements[10] = progress(10, { correct: 4 });
    state.elements[200] = progress(200, { incorrect: 3, recent: [0, 0, 0] });
    const list = difficultElements(state, NOW);
    expect(list.map((d) => d.atomicNumber)).toEqual([29, 19, 26, 8]);
    expect(list[0]).toMatchObject({ mastery: 0, correct: 0, incorrect: 5, accuracy: 0 });
    expect(list[3].accuracy).toBe(0.75);
    expect(difficultElements(state, NOW, 2).map((d) => d.atomicNumber)).toEqual([29, 19]);
    expect(difficultElements(createInitialState(NOW), NOW)).toEqual([]);
  });

  it('selection.ts no importa el generador de preguntas (ni planner.ts)', () => {
    const src = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const code = readFileSync(file, 'utf8');
      for (const m of code.matchAll(/^(?:import|export)\s[^;]*?from\s+'([^']+)'/gm)) {
        const spec = m[1];
        if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
        const base = spec.startsWith('@/') ? resolve(src, spec.slice(2)) : resolve(dirname(file), spec);
        const target = [`${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts')].find((f) => {
          try {
            readFileSync(f);
            return true;
          } catch {
            return false;
          }
        });
        if (target) visit(target);
      }
    };
    visit(resolve(src, 'utils/selection.ts'));
    const files = Array.from(seen).map((f) => f.slice(src.length + 1));
    expect(files).toContain('utils/mastery.ts');
    expect(files.filter((f) => /utils\/(questions|planner)\.ts$|question-gen\//.test(f))).toEqual([]);
  });
});

function diagnosticAnswers(correctCount: number, total = 10): AnsweredQuestion[] {
  return Array.from({ length: total }, (_, i) => {
    const question = generateQuestion('symbol-to-name', i + 1) as Question;
    return { question, correct: i < correctCount, givenAnswer: 'x', responseMs: 3000, xpGained: 0 };
  });
}

describe('planStudySession: buckets', () => {
  it('sesión del brief: 5 nuevos, 10 repasos y 5 difíciles → 20 preguntas, ~5 min', () => {
    const state = createInitialState(NOW);
    // 10 repasos pendientes (acertados, sin fallos).
    for (let z = 1; z <= 10; z++) {
      state.elements[z] = progress(z, { learned: true, correct: 3, recent: [1, 1, 1], streak: 3, intervalDays: 3, due: daysFrom(NOW, -1).toISOString(), avgResponseMs: 3000 });
    }
    // 6 difíciles (fallados), uno más de los que caben.
    for (const [z, incorrect] of [[19, 6], [26, 6], [29, 6], [30, 2], [47, 1], [50, 1]] as const) {
      const recent = [...Array<number>(incorrect).fill(0), 1, 1];
      state.elements[z] = progress(z, { learned: true, correct: 2, incorrect, recent, due: daysFrom(NOW, 1).toISOString() });
    }
    const plan = planStudySession(state, NOW);
    expect(plan.hard).toHaveLength(5);
    expect(plan.hard.slice(0, 3).sort((a, b) => a - b)).toEqual([19, 26, 29]);
    expect([...plan.reviews].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(plan.newElements).toEqual([11, 12, 13, 14, 15]);
    expect(plan.questions).toHaveLength(20);
    expect(plan.estimatedMinutes).toBe(5);
    // Una pregunta por elemento planificado.
    const asked = plan.questions.map((q) => q.atomicNumber).sort((a, b) => a - b);
    expect(asked).toEqual([...plan.hard, ...plan.reviews, ...plan.newElements].sort((a, b) => a - b));
  });

  it('los fallados van a «difíciles» aunque toque repasarlos; los lentos pero acertados, nunca', () => {
    const state = createInitialState(NOW);
    const dueNow = new Date(NOW.getTime() - 60_000).toISOString();
    for (const z of [19, 26, 29]) {
      state.elements[z] = progress(z, { learned: true, correct: 4, incorrect: 6, recent: [0, 1, 0, 0, 1, 0, 1, 0, 1, 0], due: dueNow });
    }
    for (const z of [50, 51, 52]) {
      state.elements[z] = progress(z, { learned: true, correct: 5, recent: [1, 1, 1, 1, 1], streak: 5, avgResponseMs: 14_000, due: dueNow, intervalDays: 7 });
    }
    const plan = planStudySession(state, NOW);
    expect([...plan.hard].sort((a, b) => a - b)).toEqual([19, 26, 29]);
    for (const z of [50, 51, 52]) {
      expect(plan.hard).not.toContain(z);
      expect(plan.reviews).toContain(z);
    }
  });

  it('con menos difíciles que hardCount, «difíciles» queda corto (no se rellena)', () => {
    const state = onceCorrectPlusPotassium();
    const plan = planStudySession(state, NOW);
    expect(plan.hard).toEqual([19]);
    // Los acertados sin fallos pueden ocupar huecos de repaso.
    expect(plan.reviews.length).toBeGreaterThan(0);
    expect(plan.reviews).not.toContain(19);
  });

  it('tras el diagnóstico solo son difíciles los fallados', () => {
    const { state } = applyOnboarding(createInitialState(NOW), 'some', diagnosticAnswers(7), NOW);
    const plan = planStudySession(state, NOW);
    expect(plan.hard).toEqual([8, 9, 10]);
    expect(plan.questions.length).toBeGreaterThanOrEqual(8);
  });
});
