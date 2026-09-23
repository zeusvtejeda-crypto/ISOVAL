import { describe, expect, it } from 'vitest';
import { getFamilyGroup } from '@/data/blocks';
import type { MistakeRecord, ProgressState } from '@/types';
import { createInitialState } from '@/utils/engine';
import { createElementProgress } from '@/utils/srs';
import { buildPracticeQuestions } from '../build-practice';
import { DEFAULT_PRACTICE_COUNT, parsePracticeParams } from '../params';
import { DEFAULT_PRACTICE_TYPES, practiceCounts, resolvePracticeTarget } from '../target';

const NOW = new Date(2026, 0, 15, 12, 0, 0);

function params(query: string) {
  return parsePracticeParams(new URLSearchParams(query));
}

function mistake(z: number, skill: MistakeRecord['skill'] = 'symbol'): MistakeRecord {
  return { id: `m${z}${skill}`, atomicNumber: z, skill, prompt: '?', correctAnswer: 'a', givenAnswer: 'b', mode: 'exam', at: NOW.toISOString() };
}

function weakState(zs: number[]): ProgressState {
  const state = createInitialState(NOW);
  for (const z of zs) {
    state.elements[z] = { ...createElementProgress(z), seen: 4, correct: 1, incorrect: 3, recent: [1, 0, 0, 0] };
  }
  return state;
}

describe('parsePracticeParams', () => {
  it('lee y valida todos los parámetros', () => {
    const p = params('focus=errores&elements=19, 26,26,999,x&block=b1&family=halogen&n=15&types=symbol-to-name,nope');
    expect(p.focus).toBe('errores');
    expect(p.elements).toEqual([19, 26]);
    expect(p.block).toBe('b1');
    expect(p.family).toBe('halogen');
    expect(p.count).toBe(15);
    expect(p.types).toEqual(['symbol-to-name']);
  });

  it('valores por defecto e inválidos', () => {
    const p = params('focus=otro&n=0&types=nope');
    expect(p.focus).toBeNull();
    expect(p.elements).toBeNull();
    expect(p.count).toBe(DEFAULT_PRACTICE_COUNT);
    expect(p.types).toBeNull();
    expect(params('n=500').count).toBe(50);
    expect(params('elements=abc').elements).toEqual([]);
  });
});

describe('resolvePracticeTarget', () => {
  it('prioridad: elements > block > family > focus', () => {
    const state = createInitialState(NOW);
    expect(resolvePracticeTarget(params('elements=26&block=b1&focus=repaso'), state, NOW)).toMatchObject({
      source: 'elements',
      elements: [26],
      title: 'Fe — Hierro',
    });
    expect(resolvePracticeTarget(params('block=b1&family=halogen'), state, NOW).elements).toHaveLength(10);
    expect(resolvePracticeTarget(params('family=halogen'), state, NOW).elements).toEqual(
      getFamilyGroup('halogen')?.atomicNumbers,
    );
    expect(resolvePracticeTarget(params(''), state, NOW).source).toBe('none');
  });

  it('bloque o familia inexistentes → inválido y vacío', () => {
    const state = createInitialState(NOW);
    expect(resolvePracticeTarget(params('block=b99'), state, NOW)).toMatchObject({ invalid: true, elements: [] });
    expect(resolvePracticeTarget(params('family=unicornio'), state, NOW)).toMatchObject({ invalid: true, elements: [] });
  });

  it('errores: elementos de los fallos recientes, con los tipos de la habilidad fallada', () => {
    const state = createInitialState(NOW);
    state.mistakes = [mistake(26, 'atomicMass'), mistake(19), mistake(26)];
    const target = resolvePracticeTarget(params('focus=errores'), state, NOW);
    expect(target.elements).toEqual([26, 19]);
    expect(target.fallback).toBe(false);
    expect(target.types).toContain('element-to-mass');
    expect(target.types).toContain('name-to-symbol');
  });

  it('errores sin fallos recientes → los difíciles; sin nada → vacío', () => {
    const weak = weakState([8, 11]);
    const target = resolvePracticeTarget(params('focus=errores'), weak, NOW);
    expect(target.fallback).toBe(true);
    expect([...target.elements].sort((a, b) => a - b)).toEqual([8, 11]);
    expect(resolvePracticeTarget(params('focus=errores'), createInitialState(NOW), NOW).elements).toEqual([]);
    expect(resolvePracticeTarget(params('focus=dificiles'), createInitialState(NOW), NOW).elements).toEqual([]);
    expect(resolvePracticeTarget(params('focus=repaso'), createInitialState(NOW), NOW).elements).toEqual([]);
  });

  it('?types= sustituye a los tipos por defecto', () => {
    const target = resolvePracticeTarget(params('elements=1,2&types=element-to-number'), createInitialState(NOW), NOW);
    expect(target.types).toEqual(['element-to-number']);
  });

  it('cuenta errores, difíciles y repasos', () => {
    const state = weakState([8, 11]);
    state.mistakes = [mistake(8), mistake(8), mistake(11)];
    expect(practiceCounts(state, NOW)).toMatchObject({ mistakes: 2, weak: 2 });
  });
});

describe('buildPracticeQuestions', () => {
  it('nunca sale del pool y no repite tipo+elemento', () => {
    const pool = [19, 26, 47];
    for (let run = 0; run < 10; run++) {
      const qs = buildPracticeQuestions({ elements: pool, count: 10 }, createInitialState(NOW), NOW);
      expect(qs).toHaveLength(10);
      expect(new Set(qs.map((q) => `${q.type}:${q.atomicNumber}`)).size).toBe(10);
      for (const q of qs) {
        expect(pool).toContain(q.atomicNumber);
        expect(DEFAULT_PRACTICE_TYPES).toContain(q.type);
      }
      for (const z of pool) expect(qs.some((q) => q.atomicNumber === z)).toBe(true);
      for (let i = 1; i < qs.length; i++) expect(qs[i].atomicNumber).not.toBe(qs[i - 1].atomicNumber);
    }
  });

  it('los elementos difíciles reciben más preguntas', () => {
    const state = weakState([26]);
    state.elements[19] = { ...createElementProgress(19), seen: 8, correct: 8, incorrect: 0, recent: [1, 1, 1, 1, 1, 1, 1, 1], streak: 8 };
    let weak = 0;
    let easy = 0;
    for (let run = 0; run < 20; run++) {
      const qs = buildPracticeQuestions({ elements: [19, 26, 47], count: 9 }, state, NOW);
      weak += qs.filter((q) => q.atomicNumber === 26).length;
      easy += qs.filter((q) => q.atomicNumber === 19).length;
    }
    expect(weak).toBeGreaterThan(easy);
  });

  it('un solo elemento: tantas preguntas como tipos distintos', () => {
    const qs = buildPracticeQuestions({ elements: [26], count: 10 }, createInitialState(NOW), NOW);
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.type)).size).toBe(10);
  });

  it('tipos explícitos: devuelve menos si no dan para más; pool vacío → nada', () => {
    const qs = buildPracticeQuestions({ elements: [1, 2], count: 10, types: ['symbol-to-name'] }, createInitialState(NOW), NOW);
    expect(qs).toHaveLength(2);
    expect(buildPracticeQuestions({ elements: [], count: 10 }, createInitialState(NOW), NOW)).toEqual([]);
  });
});
