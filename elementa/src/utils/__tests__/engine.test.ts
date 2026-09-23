import { describe, expect, it } from 'vitest';
import type { AnsweredQuestion, ProgressState, Question } from '@/types';
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
import { generateQuestion } from '@/utils/questions';
import { createInitialState } from '@/utils/state';
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
    expect(next.daily[TODAY]).toMatchObject({ questions: 1, correct: 1, xp: 10, newLearned: 1, goalMet: false });
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
  it('XP por calificación, cuenta para la meta y reprograma', () => {
    const r = applyFlashcard(fresh(), { atomicNumber: 8, skill: 'symbol', rating: 'good', responseMs: 3000 }, NOW);
    expect(r.outcome.xpGained).toBe(5);
    expect(r.state.stats.flashcardsReviewed).toBe(1);
    expect(r.state.stats.totalQuestions).toBe(0);
    expect(r.state.daily[TODAY].questions).toBe(1);
    expect(r.state.elements[8]).toMatchObject({ learned: true, reps: 1, intervalDays: 1 });

    const again = applyFlashcard(r.state, { atomicNumber: 8, skill: 'symbol', rating: 'again', responseMs: 3000 }, NOW);
    expect(again.outcome.xpGained).toBe(1);
    expect(again.state.elements[8]).toMatchObject({ reps: 0, incorrect: 1 });
    expect(again.state.mistakes).toHaveLength(0);
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

  it('otras sesiones: +20; diagnóstico o vacías: 0', () => {
    expect(applySessionComplete(fresh(), { mode: 'study', total: 10, correct: 3, durationMs: 1 }, NOW).xpGained).toBe(20);
    expect(applySessionComplete(fresh(), { mode: 'diagnostic', total: 10, correct: 3, durationMs: 1 }, NOW).xpGained).toBe(0);
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
    expect(r.state.mistakes).toHaveLength(0);
    expect(r.state.stats.totalQuestions).toBe(10);
    expect(r.unlockedAchievements).toContain('first-element');
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
