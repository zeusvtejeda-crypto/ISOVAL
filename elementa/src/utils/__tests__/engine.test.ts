import { describe, expect, it } from 'vitest';
import { parseProgressJson, parseProgressState } from '@/services/storage/validate';
import type { AnsweredQuestion, FlashcardRating, ProgressState, Question } from '@/types';
import { ACHIEVEMENTS, achievementStatuses, evaluateAchievements } from '@/utils/achievements';
import { todayKey } from '@/utils/dates';
import {
  applyAnswer,
  applyClearMistakes,
  applyFlashcard,
  applyLearned,
  applyOnboarding,
  applyRecord,
  applyReset,
  applySessionComplete,
  applySettings,
  applyXp,
  diagnosticLevel,
  type AnswerInput,
} from '@/utils/engine';
import { computeMastery } from '@/utils/mastery';
import { generateQuestion } from '@/utils/questions';
import { AGAIN_DELAY_MS } from '@/utils/srs';
import { createInitialState, MAX_XP } from '@/utils/state';
import { daysFrom, NOW } from './helpers';

const TODAY = todayKey(NOW);

function input(patch: Partial<AnswerInput> = {}): AnswerInput {
  return {
    atomicNumber: 11,
    skill: 'symbol',
    correct: true,
    responseMs: 4000,
    mode: 'practice',
    prompt: '¿Cuál es el símbolo del Sodio?',
    correctAnswer: 'Na',
    givenAnswer: 'Na',
    ...patch,
  };
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}

function fresh(): ProgressState {
  return deepFreeze(createInitialState(NOW));
}

describe('applyAnswer', () => {
  it('acierto: progreso, XP, día, racha, estadísticas y logro — sin mutar el estado', () => {
    const state = fresh();
    const { state: next, outcome } = applyAnswer(state, input(), NOW);
    const p = next.elements[11];
    expect(p).toMatchObject({ seen: 1, correct: 1, incorrect: 0, streak: 1, recent: [1], avgResponseMs: 4000, learned: true });
    expect(p.lastSeen).toBe(NOW.toISOString());
    expect(p.lastCorrect).toBe(NOW.toISOString());
    expect(p.learnedAt).toBe(NOW.toISOString());
    expect(p.skills.symbol).toEqual({ correct: 1, incorrect: 0 });
    expect(p.reps).toBe(1);
    expect(p.due).not.toBeNull();
    expect(next.xp).toBe(10);
    expect(next.daily[TODAY]).toMatchObject({ questions: 1, correct: 1, flashcards: 0, xp: 10, newLearned: 1, goalMet: false });
    expect(next.stats).toMatchObject({ totalQuestions: 1, totalCorrect: 1, currentAnswerStreak: 1, totalTimeMs: 4000 });
    expect(next.records.bestAnswerStreak).toBe(1);
    expect(next.achievements['first-element']).toBe(NOW.toISOString());
    expect(outcome).toMatchObject({ xpGained: 10, bonusXp: 0, answerStreak: 1, leveledUp: false, newLevel: 1 });
    expect(outcome.unlockedAchievements).toContain('first-element');
    expect(outcome.masteryAfter).toBeGreaterThan(outcome.masteryBefore);
    expect(state.xp).toBe(0);
    expect(state.elements[11]).toBeUndefined();
  });

  it('dificultad 3 da 15 XP; xpOverride sustituye la regla y calcula el bonus', () => {
    expect(applyAnswer(fresh(), input({ difficulty: 3 }), NOW).outcome.xpGained).toBe(15);
    const r = applyAnswer(fresh(), input({ xpOverride: 40 }), NOW);
    expect(r.outcome).toMatchObject({ xpGained: 40, bonusXp: 30 });
    expect(r.state.xp).toBe(40);
  });

  it('fallo: sin XP, error registrado, racha a cero y repaso en 10 min', () => {
    let s = applyAnswer(fresh(), input(), NOW).state;
    const r = applyAnswer(s, input({ correct: false, givenAnswer: 'So' }), NOW);
    s = r.state;
    expect(r.outcome).toMatchObject({ xpGained: 0, answerStreak: 0 });
    expect(r.outcome.masteryAfter).toBeLessThan(r.outcome.masteryBefore);
    expect(s.mistakes).toHaveLength(1);
    expect(s.mistakes[0]).toMatchObject({ atomicNumber: 11, givenAnswer: 'So', correctAnswer: 'Na', mode: 'practice' });
    expect(s.elements[11]).toMatchObject({ streak: 0, incorrect: 1, reps: 0, intervalDays: 0 });
    expect(s.stats.currentAnswerStreak).toBe(0);
    expect(s.records.bestAnswerStreak).toBe(1);
  });

  it('un fallo no marca el elemento como aprendido', () => {
    const s = applyAnswer(fresh(), input({ correct: false }), NOW).state;
    expect(s.elements[11].learned).toBe(false);
  });

  it('diagnóstico: guarda los fallos en errores pero no suma a la actividad del día', () => {
    const s = createInitialState(NOW);
    const wrong = applyAnswer(s, input({ correct: false, mode: 'diagnostic', givenAnswer: 'So' }), NOW).state;
    expect(wrong.mistakes).toHaveLength(1);
    expect(wrong.mistakes[0]).toMatchObject({ atomicNumber: 11, mode: 'diagnostic', givenAnswer: 'So' });
    expect(wrong.daily[TODAY]).toMatchObject({ questions: 0, correct: 0, goalMet: false });
    expect(wrong.stats).toMatchObject({ totalQuestions: 1, totalCorrect: 0, totalTimeMs: 4000 });
    const right = applyAnswer(wrong, input({ mode: 'diagnostic', xpOverride: 0 }), NOW).state;
    expect(right.daily[TODAY]).toMatchObject({ questions: 0, correct: 0, newLearned: 1 });
    expect(right.stats).toMatchObject({ totalQuestions: 2, totalCorrect: 1, totalTimeMs: 8000 });
    expect(right.elements[11]).toMatchObject({ correct: 1, incorrect: 1, learned: true });
  });

  it('trackElement: false no toca el progreso del elemento, pero sí XP, día, estadísticas y errores', () => {
    const base = applyAnswer(fresh(), input({ atomicNumber: 87 }), NOW).state;
    const franciumBefore = base.elements[87];
    const mastery = computeMastery(franciumBefore, NOW);

    const right = applyAnswer(base, input({ atomicNumber: 87, trackElement: false }), NOW);
    expect(right.state.elements[87]).toBe(franciumBefore);
    expect(right.state.elements).toBe(base.elements);
    expect(right.outcome).toMatchObject({ xpGained: 10, masteryBefore: mastery, masteryAfter: mastery, answerStreak: 2 });
    expect(right.state.daily[TODAY]).toMatchObject({ questions: 2, correct: 2, newLearned: 1 });
    expect(right.state.stats).toMatchObject({ totalQuestions: 2, totalCorrect: 2 });

    const wrong = applyAnswer(right.state, input({ atomicNumber: 2, correct: false, trackElement: false }), NOW);
    expect(wrong.state.elements[2]).toBeUndefined();
    expect(wrong.outcome).toMatchObject({ xpGained: 0, masteryBefore: 0, masteryAfter: 0, answerStreak: 0 });
    expect(wrong.state.mistakes[0]).toMatchObject({ atomicNumber: 2 });
    expect(wrong.state.stats.totalQuestions).toBe(3);

    // Sin atribución no se aprende ningún elemento (ni logro «Primer elemento»).
    const untracked = applyAnswer(fresh(), input({ atomicNumber: 87, trackElement: false }), NOW);
    expect(untracked.state.elements).toEqual({});
    expect(untracked.state.daily[TODAY]).toMatchObject({ questions: 1, newLearned: 0 });
    expect(untracked.outcome.unlockedAchievements).not.toContain('first-element');
  });

  it('errores: máximo 300, el más reciente primero', () => {
    let s = createInitialState(NOW);
    for (let i = 0; i < 305; i++) s = applyAnswer(s, input({ correct: false, givenAnswer: `x${i}` }), NOW).state;
    expect(s.mistakes).toHaveLength(300);
    expect(s.mistakes[0].givenAnswer).toBe('x304');
  });

  it('meta diaria cumplida al llegar a dailyGoal (y se mantiene)', () => {
    let s = createInitialState(NOW);
    for (let i = 0; i < 9; i++) s = applyAnswer(s, input({ correct: i % 2 === 0 }), NOW).state;
    expect(s.daily[TODAY].goalMet).toBe(false);
    s = applyAnswer(s, input(), NOW).state;
    expect(s.daily[TODAY]).toMatchObject({ questions: 10, goal: 10, goalMet: true });
    s = applySettings(s, { dailyGoal: 20 }, NOW);
    expect(s.daily[TODAY].goalMet).toBe(true);
  });

  it('bajar la meta puede cumplirla hoy', () => {
    let s = createInitialState(NOW);
    for (let i = 0; i < 5; i++) s = applyAnswer(s, input(), NOW).state;
    s = applySettings(s, { dailyGoal: 5 }, NOW);
    expect(s.daily[TODAY]).toMatchObject({ goal: 5, goalMet: true });
    expect(s.settings.dailyGoal).toBe(5);
    expect(s.achievements['first-goal']).toBeDefined();
  });

  it('detecta la subida de nivel', () => {
    const s = { ...createInitialState(NOW), xp: 95 };
    const r = applyAnswer(s, input(), NOW);
    expect(r.outcome).toMatchObject({ leveledUp: true, newLevel: 2 });
  });

  it('repetir aciertos el mismo día no infla el intervalo SRS', () => {
    let s = applyAnswer(fresh(), input(), NOW).state;
    const first = s.elements[11].intervalDays;
    s = applyAnswer(s, input(), NOW).state;
    expect(s.elements[11].intervalDays).toBe(first);
    const later = daysFrom(NOW, first + 1);
    s = applyAnswer(s, input(), later).state;
    expect(s.elements[11].intervalDays).toBeGreaterThan(first);
  });
});

describe('applyFlashcard', () => {
  const card = (rating: FlashcardRating, z = 8) => ({ atomicNumber: z, skill: 'symbol' as const, rating, responseMs: 3000 });

  it('XP por calificación, cuenta para la meta (no para la precisión) y reprograma', () => {
    const r = applyFlashcard(fresh(), card('good'), NOW);
    expect(r.outcome.xpGained).toBe(5);
    expect(r.state.stats.flashcardsReviewed).toBe(1);
    expect(r.state.stats.totalQuestions).toBe(0);
    expect(r.state.daily[TODAY]).toMatchObject({ questions: 1, flashcards: 1, correct: 0 });
    expect(r.state.elements[8]).toMatchObject({ learned: true, reps: 1, intervalDays: 1, correct: 1 });
    expect(r.state.elements[8].skills).toEqual({});

    const again = applyFlashcard(r.state, card('again'), NOW);
    expect(again.outcome.xpGained).toBe(1);
    expect(again.state.elements[8]).toMatchObject({ reps: 0, intervalDays: 0, incorrect: 1 });
    expect(Date.parse(again.state.elements[8].due as string) - NOW.getTime()).toBe(AGAIN_DELAY_MS);
    expect(again.state.mistakes).toHaveLength(0);
    expect(again.state.daily[TODAY]).toMatchObject({ questions: 2, flashcards: 2, correct: 0 });
  });

  it('la precisión del día solo cuenta el quiz', () => {
    let s = applyFlashcard(fresh(), card('good'), NOW).state;
    s = applyAnswer(s, input(), NOW).state;
    s = applyAnswer(s, input({ correct: false }), NOW).state;
    const day = s.daily[TODAY];
    expect(day).toMatchObject({ questions: 3, flashcards: 1, correct: 1 });
    expect(day.correct / (day.questions - day.flashcards)).toBe(0.5);
    expect(s.elements[11].skills.symbol).toEqual({ correct: 1, incorrect: 1 });
  });

  it('repasar la misma tarjeta varias veces seguidas no infla el intervalo', () => {
    let s: ProgressState = fresh();
    for (let i = 0; i < 5; i++) s = applyFlashcard(s, card('good'), new Date(NOW.getTime() + i * 60_000)).state;
    expect(s.elements[8]).toMatchObject({ intervalDays: 1, reps: 1, correct: 5 });

    let h = applyFlashcard(fresh(), card('hard'), NOW).state;
    h = applyFlashcard(h, card('good'), new Date(NOW.getTime() + 2 * 60_000)).state;
    expect(h.elements[8].intervalDays).toBe(1);

    // Cuando ya toca repasarla, sí avanza.
    const due = daysFrom(NOW, 1);
    expect(applyFlashcard(s, card('good'), due).state.elements[8]).toMatchObject({ intervalDays: 3, reps: 2 });
  });
});

describe('applyLearned / applyXp', () => {
  it('+5 XP por elemento nuevo; los ya aprendidos no suman', () => {
    const r = applyLearned(fresh(), [1, 2, 3, 3, 999], NOW);
    expect(r.xpGained).toBe(15);
    expect(r.state.elements[1]).toMatchObject({ learned: true, due: NOW.toISOString() });
    expect(r.state.daily[TODAY]).toMatchObject({ newLearned: 3, xp: 15, questions: 0 });
    expect(r.unlockedAchievements).toContain('first-element');
    const again = applyLearned(r.state, [1, 2, 4], NOW);
    expect(again.xpGained).toBe(5);
  });

  it('applyXp suma XP y detecta niveles', () => {
    const r = applyXp(fresh(), 120, NOW);
    expect(r.state.xp).toBe(120);
    expect(r).toMatchObject({ leveledUp: true, newLevel: 2 });
    expect(applyXp(r.state, -5, NOW).state).toBe(r.state);
  });
});

describe('applySessionComplete', () => {
  it('examen: +50 y +100 si es perfecto; guarda el mejor %', () => {
    const r = applySessionComplete(fresh(), { mode: 'exam', total: 10, correct: 10, durationMs: 60_000 }, NOW);
    expect(r.xpGained).toBe(150);
    expect(r.state.stats).toMatchObject({ examsCompleted: 1, perfectExams: 1, sessionsCompleted: 1 });
    expect(r.state.records.bestExamPct).toBe(100);
    expect(r.unlockedAchievements).toEqual(expect.arrayContaining(['first-exam', 'perfect-exam']));
    const r2 = applySessionComplete(r.state, { mode: 'practice', total: 10, correct: 7, durationMs: 1, isExam: true }, NOW);
    expect(r2.xpGained).toBe(50);
    expect(r2.state.records.bestExamPct).toBe(100);
  });

  it('otras sesiones: +20 solo con ≥ 5 preguntas y al menos la mitad de aciertos', () => {
    const xp = (total: number, correct: number) =>
      applySessionComplete(fresh(), { mode: 'study', total, correct, durationMs: 1 }, NOW).xpGained;
    expect(xp(10, 5)).toBe(20);
    expect(xp(5, 3)).toBe(20);
    expect(xp(20, 20)).toBe(20);
    expect(xp(10, 4)).toBe(0);
    expect(xp(4, 4)).toBe(0);
    expect(xp(1, 0)).toBe(0);
    expect(xp(1, 1)).toBe(0);
  });

  it('sin bonus la sesión cuenta igual; diagnóstico o vacías: nada', () => {
    const r = applySessionComplete(fresh(), { mode: 'practice', total: 1, correct: 0, durationMs: 1 }, NOW);
    expect(r.xpGained).toBe(0);
    expect(r.state.xp).toBe(0);
    expect(r.state.stats.sessionsCompleted).toBe(1);
    expect(r.state.daily[TODAY]).toBeUndefined();
    expect(applySessionComplete(fresh(), { mode: 'diagnostic', total: 10, correct: 10, durationMs: 1 }, NOW).xpGained).toBe(0);
    expect(applySessionComplete(fresh(), { mode: 'study', total: 0, correct: 0, durationMs: 1 }, NOW).xpGained).toBe(0);
  });
});

describe('applyRecord', () => {
  it('solo guarda si supera el récord', () => {
    const r = applyRecord(fresh(), 'timeAttack', 21, NOW);
    expect(r.isNewRecord).toBe(true);
    expect(r.state.records.timeAttackBest).toBe(21);
    expect(r.unlockedAchievements).toContain('chemical-speed');
    expect(applyRecord(r.state, 'timeAttack', 21, NOW).isNewRecord).toBe(false);
    expect(applyRecord(r.state, 'survival', 3, NOW).state.records.survivalBest).toBe(3);
    expect(applyRecord(r.state, 'streakMode', 20, NOW).unlockedAchievements).toContain('chain-reaction');
  });
});

function diagnostic(correctCount: number, total = 10): AnsweredQuestion[] {
  return Array.from({ length: total }, (_, i) => {
    const question = generateQuestion('symbol-to-name', i + 1) as Question;
    return { question, correct: i < correctCount, givenAnswer: 'x', responseMs: 3000, xpGained: 0 };
  });
}

describe('applyOnboarding', () => {
  it('nivel inicial según el diagnóstico', () => {
    expect(diagnosticLevel(0, 10, 'beginner')).toBe(1);
    expect(diagnosticLevel(3, 10, 'beginner')).toBe(1);
    expect(diagnosticLevel(4, 10, 'some')).toBe(2);
    expect(diagnosticLevel(6, 10, 'some')).toBe(2);
    expect(diagnosticLevel(7, 10, 'some')).toBe(3);
    expect(diagnosticLevel(8, 10, 'beginner')).toBe(3);
    expect(diagnosticLevel(9, 10, 'beginner')).toBe(4);
    expect(diagnosticLevel(10, 10, 'some')).toBe(4);
    expect(diagnosticLevel(7, 10, 'chemistry')).toBe(4);
    expect(diagnosticLevel(10, 10, 'master')).toBe(5);
    expect(diagnosticLevel(6, 10, 'master')).toBe(2);
    expect(diagnosticLevel(0, 0, 'beginner')).toBe(1);
  });

  it('marca el perfil, registra respuestas y fija la XP del nivel', () => {
    const r = applyOnboarding(fresh(), 'chemistry', diagnostic(8), NOW);
    expect(r.level).toBe(4);
    expect(r.state.profile).toMatchObject({ experience: 'chemistry', onboarded: true });
    expect(r.state.xp).toBe(750);
    expect(Object.keys(r.state.elements)).toHaveLength(10);
    expect(r.state.elements[1].learned).toBe(true);
    expect(r.state.elements[10]).toMatchObject({ learned: false, incorrect: 1 });
    expect(r.state.stats.totalQuestions).toBe(10);
    expect(r.unlockedAchievements).toContain('first-element');
  });

  it('los fallos del diagnóstico van a «Mis errores» y no cumplen la meta del día', () => {
    const s = applySettings(createInitialState(NOW), { dailyGoal: 5 }, NOW);
    const r = applyOnboarding(s, 'some', diagnostic(7), NOW);
    expect(r.state.mistakes).toHaveLength(3);
    expect(r.state.mistakes.every((m) => m.mode === 'diagnostic')).toBe(true);
    expect(r.state.mistakes.map((m) => m.atomicNumber).sort((a, b) => a - b)).toEqual([8, 9, 10]);
    expect(r.state.daily[TODAY]).toMatchObject({ questions: 0, correct: 0, goalMet: false, newLearned: 7 });
    expect(r.state.stats).toMatchObject({ totalQuestions: 10, totalCorrect: 7 });
    expect(r.state.achievements['first-goal']).toBeUndefined();
    expect(r.unlockedAchievements).not.toContain('first-goal');
  });

  it('principiante con 2 aciertos empieza en el nivel 1', () => {
    const r = applyOnboarding(fresh(), 'beginner', diagnostic(2), NOW);
    expect(r.level).toBe(1);
    expect(r.state.xp).toBe(0);
  });
});

describe('otras transiciones', () => {
  it('limpia errores (todos o de un elemento)', () => {
    let s = createInitialState(NOW);
    s = applyAnswer(s, input({ correct: false }), NOW).state;
    s = applyAnswer(s, input({ atomicNumber: 8, correct: false }), NOW).state;
    expect(applyClearMistakes(s, 8, NOW).mistakes.map((m) => m.atomicNumber)).toEqual([11]);
    expect(applyClearMistakes(s, undefined, NOW).mistakes).toEqual([]);
  });

  it('reinicia conservando los ajustes', () => {
    let s = applySettings(createInitialState(NOW), { theme: 'dark', dailyGoal: 20 }, NOW);
    s = applyAnswer(s, input(), NOW).state;
    const reset = applyReset(s, NOW);
    expect(reset.xp).toBe(0);
    expect(reset.elements).toEqual({});
    expect(reset.settings).toMatchObject({ theme: 'dark', dailyGoal: 20 });
    expect(reset.profile.onboarded).toBe(false);
  });
});

describe('achievements', () => {
  it('entre 18 y 24 logros con ids únicos y los obligatorios', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(18);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(24);
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['first-element', 'on-fire', 'half-way', 'atomic-memory', 'table-master', 'chemical-speed']) {
      expect(ids).toContain(id);
    }
  });

  it('estado inicial: ninguno desbloqueado y progreso en 0 (salvo el nivel actual)', () => {
    const s = createInitialState(NOW);
    expect(evaluateAchievements(s, NOW)).toEqual([]);
    const statuses = achievementStatuses(s, NOW);
    expect(statuses).toHaveLength(ACHIEVEMENTS.length);
    for (const st of statuses) {
      expect(st.unlocked).toBe(false);
      expect(st.target).toBeGreaterThan(0);
      expect(st.current).toBe(st.def.id.startsWith('level-') ? 1 : 0);
      expect(st.ratio).toBeLessThan(1);
    }
  });

  it('no vuelve a desbloquear los ya obtenidos', () => {
    const s = applyLearned(createInitialState(NOW), [1], NOW).state;
    expect(evaluateAchievements(s, NOW)).not.toContain('first-element');
    const st = achievementStatuses(s, NOW).find((a) => a.def.id === 'first-element');
    expect(st).toMatchObject({ unlocked: true, ratio: 1 });
  });

  it('primer bloque al aprender del 1 al 10', () => {
    const r = applyLearned(createInitialState(NOW), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], NOW);
    expect(r.unlockedAchievements).toEqual(expect.arrayContaining(['first-block', 'ten-learned']));
  });
});

describe('validación del guardado (flashcards del día y XP)', () => {
  it('ida y vuelta del estado inicial y de un día con flashcards', () => {
    const initial = createInitialState(NOW);
    expect(parseProgressState(JSON.parse(JSON.stringify(initial)), NOW)).toEqual(initial);
    let s = applyFlashcard(initial, { atomicNumber: 8, skill: 'symbol', rating: 'good', responseMs: 3000 }, NOW).state;
    s = applyAnswer(s, input(), NOW).state;
    expect(parseProgressJson(JSON.stringify(s), NOW)).toEqual(s);
  });

  it('guardados antiguos sin `flashcards` valen 0; nunca más que la actividad del día', () => {
    const raw = {
      version: 1,
      profile: { onboarded: true },
      daily: {
        [TODAY]: { questions: 4, correct: 3, xp: 30, timeMs: 1000, newLearned: 0, goal: 10, goalMet: false },
        '2026-01-14': { questions: 2, correct: 0, flashcards: 9, xp: 0, timeMs: 0, newLearned: 0, goal: 10, goalMet: false },
      },
    };
    const s = parseProgressState(raw, NOW) as ProgressState;
    expect(s.daily[TODAY].flashcards).toBe(0);
    expect(s.daily['2026-01-14'].flashcards).toBe(2);
  });

  it('la XP importada se limita a [0, 10 000 000]', () => {
    const base = { version: 1, profile: {} };
    expect((parseProgressState({ ...base, xp: 1e20 }, NOW) as ProgressState).xp).toBe(MAX_XP);
    expect((parseProgressState({ ...base, xp: -40 }, NOW) as ProgressState).xp).toBe(0);
    expect((parseProgressState({ ...base, xp: 1234.7 }, NOW) as ProgressState).xp).toBe(1234);
  });
});
