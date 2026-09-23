import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/utils/engine';
import { elementDifficulty } from '@/utils/difficulty';
import { generateAdaptiveQuestion, generateQuestion } from '@/utils/questions';
import { ALL_ATOMIC_NUMBERS } from '@/utils/selection';
import { streakModeXp } from '@/utils/xp';
import { TIME_ATTACK_TYPES, timeAttackTier } from '../contrarreloj/time-attack';
import { TRIVIA_CATEGORIES, categoryOfType } from '../preguntados/categories';
import { categoryAtPointer, wheelTarget, wheelTickTimes } from '../preguntados/wheel-math';
import { isBonusMilestone, lastMilestone, nextMilestone, streakTier, totalStreakBonus } from '../racha/streak-rules';
import { failedElements, gameQuestion, improvedElements } from '../shared/game-questions';
import { survivalTier } from '../supervivencia/survival';
import type { AnsweredQuestion, Question } from '@/types';

const NOW = new Date('2026-03-10T12:00:00');

function answered(results: boolean[]): AnsweredQuestion[] {
  return results.map((correct, i) => ({
    question: generateQuestion('symbol-to-name', (i % 20) + 1) as Question,
    correct,
    givenAnswer: correct ? 'ok' : 'x',
    responseMs: 1000,
    xpGained: correct ? 10 : 0,
  }));
}

describe('ruleta de Preguntados', () => {
  it('el puntero cae siempre en la categoría pedida, tras 5 vueltas', () => {
    let rotation = 0;
    for (let round = 0; round < 40; round++) {
      for (const cat of TRIVIA_CATEGORIES) {
        const jitter = ((round * 7 + cat.id.length) % 11) / 10 - 0.5;
        const next = wheelTarget(rotation, cat.id, jitter, 5);
        expect(next - rotation).toBeGreaterThanOrEqual(5 * 360);
        expect(next - rotation).toBeLessThan(6 * 360);
        expect(categoryAtPointer(next)).toBe(cat.id);
        rotation = next;
      }
    }
  });

  it('los clics se espacian al frenar y caben en el giro', () => {
    const times = wheelTickTimes(2400);
    expect(times.length).toBeGreaterThan(8);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(70);
    expect(times[times.length - 1]).toBeLessThanOrEqual(2400);
    const firstGap = times[1] - times[0];
    const lastGap = times[times.length - 1] - times[times.length - 2];
    expect(lastGap).toBeGreaterThan(firstGap);
  });

  it('cada categoría genera preguntas de sus propios tipos', () => {
    const state = createInitialState(NOW);
    for (const cat of TRIVIA_CATEGORIES) {
      for (const t of cat.types) expect(categoryOfType(t)).toBe(cat.id);
      for (let i = 0; i < 25; i++) {
        const q = generateAdaptiveQuestion(state, NOW, { types: cat.types });
        expect(cat.types).toContain(q.type);
        expect(q.options).toHaveLength(4);
        expect(q.options?.filter((o) => o.correct)).toHaveLength(1);
      }
    }
  });
});

describe('Modo Racha', () => {
  it('hitos y bonus coinciden con streakModeXp', () => {
    expect([5, 10, 20, 30, 40].every(isBonusMilestone)).toBe(true);
    expect([0, 1, 4, 6, 15, 25].some(isBonusMilestone)).toBe(false);
    expect(nextMilestone(0)).toMatchObject({ from: 0, at: 5, bonus: 25 });
    expect(nextMilestone(7)).toMatchObject({ from: 5, at: 10, bonus: 50 });
    expect(nextMilestone(12)).toMatchObject({ from: 10, at: 20, bonus: 150, special: true });
    expect(nextMilestone(23)).toMatchObject({ from: 20, at: 30, bonus: 100 });
    expect(totalStreakBonus(4)).toBe(0);
    expect(totalStreakBonus(12)).toBe(streakModeXp(5).bonus + streakModeXp(10).bonus);
  });

  it('encuentra el último hito alcanzado en la partida', () => {
    expect(lastMilestone(answered([true, true, true, true]))).toBeNull();
    expect(lastMilestone(answered([true, true, true, true, true, true]))).toEqual({ index: 4, streak: 5 });
    const ten = Array.from({ length: 10 }, () => true);
    expect(lastMilestone(answered(ten))).toEqual({ index: 9, streak: 10 });
  });

  it('la dificultad sube con la racha', () => {
    expect([0, 4, 5, 9, 10, 30].map(streakTier)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

describe('preguntas de los modos infinitos', () => {
  it('el nivel 1 solo usa elementos comunes y evita los últimos preguntados', () => {
    const state = createInitialState(NOW);
    const asked: number[] = [];
    for (let i = 0; i < 60; i++) {
      const q = gameQuestion(state, { tier: 1, asked, types: TIME_ATTACK_TYPES, avoidLast: 12 });
      expect(elementDifficulty(q.atomicNumber)).toBe(1);
      expect(TIME_ATTACK_TYPES).toContain(q.type);
      expect(asked.slice(-12)).not.toContain(q.atomicNumber);
      asked.push(q.atomicNumber);
    }
  });

  it('los niveles 2 y 3 respetan la dificultad máxima', () => {
    const state = createInitialState(NOW);
    for (let i = 0; i < 40; i++) {
      const q2 = gameQuestion(state, { tier: 2, asked: [] });
      expect(elementDifficulty(q2.atomicNumber)).toBeLessThanOrEqual(2);
      const q3 = gameQuestion(state, { tier: 3, asked: [] });
      expect(ALL_ATOMIC_NUMBERS).toContain(q3.atomicNumber);
    }
  });

  it('contrarreloj y supervivencia endurecen poco a poco', () => {
    expect([0, 9, 10, 24, 25].map(timeAttackTier)).toEqual([1, 1, 2, 2, 3]);
    expect([0, 7, 8, 19, 20].map(survivalTier)).toEqual([1, 1, 2, 2, 3]);
  });

  it('resumen: mejorados y fallados', () => {
    expect(improvedElements({ 1: 10, 2: 50 }, { 1: 40, 2: 45, 3: 5 })).toEqual([1, 3]);
    const list = answered([true, false, false, true]);
    expect(failedElements(list)).toEqual([2, 3]);
  });
});
