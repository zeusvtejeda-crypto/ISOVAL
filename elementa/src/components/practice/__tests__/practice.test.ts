import { describe, expect, it } from 'vitest';
import { getFamilyGroup } from '@/data/blocks';
import { hardElements } from '@/components/mistakes/mistakes-data';
import type { MistakeRecord, ProgressState } from '@/types';
import { applyAnswer, createInitialState, type AnswerInput } from '@/utils/engine';
import { difficultElements } from '@/utils/selection';
import { createElementProgress } from '@/utils/srs';
import { buildPracticeQuestions, byPriority } from '../build-practice';
import { DEFAULT_PRACTICE_COUNT, parsePracticeParams } from '../params';
import {
  DEFAULT_PRACTICE_TYPES,
  difficultFocus,
  isFocusSource,
  MIN_FOCUS,
  practiceCounts,
  resolvePracticeTarget,
} from '../target';

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

function answer(z: number, correct: boolean): AnswerInput {
  return {
    atomicNumber: z,
    skill: 'symbol',
    correct,
    responseMs: 3000,
    mode: 'trivia',
    prompt: `Pregunta ${z}`,
    correctAnswer: 'A',
    givenAnswer: correct ? 'A' : 'B',
  };
}

/** Na, Fe, K, Cu y Zn fallados (K y Na más veces); H…O acertados y nunca fallados (como en la auditoría). */
const FAILED = [11, 26, 19, 29, 30];
const NEVER_FAILED = [1, 2, 3, 4, 5, 6, 7, 8];
function auditState(): ProgressState {
  let state = createInitialState(NOW);
  const plan: Array<[number, boolean]> = [
    ...NEVER_FAILED.map((z): [number, boolean] => [z, true]),
    [19, false],
    [19, false],
    [19, true],
    [11, false],
    [11, false],
    [26, false],
    [26, true],
    [29, false],
    [29, true],
    [29, true],
    [30, false],
    [30, true],
    [30, true],
  ];
  for (const [z, correct] of plan) state = applyAnswer(state, answer(z, correct), NOW).state;
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

  it('cuenta errores, difíciles y repasos (difíciles = los de «Mis errores»)', () => {
    const state = weakState([8, 11]);
    state.mistakes = [mistake(8), mistake(8), mistake(11)];
    expect(practiceCounts(state, NOW)).toMatchObject({ mistakes: 2, difficult: 2 });
    const audit = auditState();
    expect(practiceCounts(audit, NOW).difficult).toBe(hardElements(audit, NOW).length);
    expect(practiceCounts(audit, NOW).difficult).toBe(5);
  });

  it('difíciles: exactamente los fallados que ves en /errores, nunca los acertados', () => {
    const state = auditState();
    const target = resolvePracticeTarget(params('focus=dificiles'), state, NOW);
    expect([...target.elements].sort((a, b) => a - b)).toEqual([...FAILED].sort((a, b) => a - b));
    expect(target.elements).toEqual(hardElements(state, NOW).map((h) => h.atomicNumber));
    expect(target.elements.some((z) => NEVER_FAILED.includes(z))).toBe(false);
    expect(target.description).toBe('Los que has fallado y aún no dominas.');
  });

  it('difíciles: con menos de 4 fallados se completa con los que menos dominas', () => {
    let state = createInitialState(NOW);
    for (const z of [1, 2, 3, 4, 5, 6]) state = applyAnswer(state, answer(z, true), NOW).state;
    state = applyAnswer(state, answer(26, false), NOW).state;
    const focus = difficultFocus(state, NOW);
    expect(focus).toHaveLength(MIN_FOCUS);
    expect(focus[0]).toMatchObject({ atomicNumber: 26, failed: true });
    expect(focus.slice(1).every((f) => !f.failed)).toBe(true);
    const target = resolvePracticeTarget(params('focus=dificiles'), state, NOW);
    expect(target.elements[0]).toBe(26);
    expect(target.elements).toHaveLength(MIN_FOCUS);
    // Con 4 o más fallados, no se añade ninguno sin fallos.
    expect(difficultFocus(auditState(), NOW).every((f) => f.failed)).toBe(true);
  });

  it('errores sin errores recientes → prefiere los difíciles', () => {
    const state = auditState();
    state.mistakes = [];
    const target = resolvePracticeTarget(params('focus=errores'), state, NOW);
    expect(target.fallback).toBe(true);
    expect(target.elements).toEqual(difficultElements(state, NOW).map((d) => d.atomicNumber));
  });

  it('fuentes enfocadas', () => {
    expect(['errores', 'dificiles', 'repaso'].every((s) => isFocusSource(s as never))).toBe(true);
    expect(['elements', 'block', 'family', 'none'].some((s) => isFocusSource(s as never))).toBe(false);
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

  it('enfocada (difíciles, 10 preguntas): solo los fallados y cada uno al menos dos veces', () => {
    const state = auditState();
    const elements = resolvePracticeTarget(params('focus=dificiles'), state, NOW).elements;
    for (let run = 0; run < 15; run++) {
      const qs = buildPracticeQuestions({ elements, count: 10, focused: true }, state, NOW);
      expect(qs).toHaveLength(10);
      for (const q of qs) expect(FAILED).toContain(q.atomicNumber);
      for (const z of FAILED) expect(qs.filter((q) => q.atomicNumber === z).length).toBeGreaterThanOrEqual(2);
      expect(new Set(qs.map((q) => `${q.type}:${q.atomicNumber}`)).size).toBe(10);
      for (let i = 1; i < qs.length; i++) expect(qs[i].atomicNumber).not.toBe(qs[i - 1].atomicNumber);
    }
  });

  it('enfocada con más preguntas: los que más fallas salen más veces', () => {
    const state = auditState();
    const elements = resolvePracticeTarget(params('focus=dificiles'), state, NOW).elements;
    const ranked = byPriority(elements, state, NOW);
    const [weakest] = ranked;
    const strongest = ranked[ranked.length - 1];
    let weak = 0;
    let strong = 0;
    for (let run = 0; run < 20; run++) {
      const qs = buildPracticeQuestions({ elements, count: 20, focused: true }, state, NOW);
      expect(qs).toHaveLength(20);
      for (const z of FAILED) expect(qs.filter((q) => q.atomicNumber === z).length).toBeGreaterThanOrEqual(2);
      weak += qs.filter((q) => q.atomicNumber === weakest).length;
      strong += qs.filter((q) => q.atomicNumber === strongest).length;
    }
    expect(weak).toBeGreaterThan(strong);
  });

  it('enfocada con muchos elementos: la primera pasada cubre solo los más prioritarios', () => {
    const state = weakState([3, 11, 19, 37, 55]);
    const pool = [...Array.from({ length: 12 }, (_, i) => i + 20), 3, 11, 19, 37, 55];
    const ranked = byPriority(pool, state, NOW);
    expect(ranked.slice(0, 5).sort((a, b) => a - b)).toEqual([3, 11, 19, 37, 55]);
    let failedShare = 0;
    for (let run = 0; run < 10; run++) {
      const qs = buildPracticeQuestions({ elements: pool, count: 10, focused: true }, state, NOW);
      expect(qs).toHaveLength(10);
      for (const z of [3, 11, 19, 37, 55]) expect(qs.some((q) => q.atomicNumber === z)).toBe(true);
      failedShare += qs.filter((q) => [3, 11, 19, 37, 55].includes(q.atomicNumber)).length;
    }
    // Sin enfoque saldría 1 pregunta por elemento (5 de 10 serían de los fallados).
    expect(failedShare / 10).toBeGreaterThan(5);
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
