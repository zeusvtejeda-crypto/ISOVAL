import { describe, expect, it } from 'vitest';
import { STUDY_BLOCKS } from '@/data/blocks';
import type { ProgressState } from '@/types';
import { createInitialState } from '@/utils/engine';
import { masteryMap } from '@/utils/mastery';
import { createElementProgress } from '@/utils/srs';
import { buildCheckQuestions, CHECK_QUESTIONS_PER_ELEMENT } from '../check-questions';
import { groupProgress, miniTileTone, suggestNextBlock, type GroupProgress } from '../group-progress';
import { flashcardsHref, practiceHref, resolveLearnSource } from '../learn-source';

const NOW = new Date(2026, 0, 15, 12, 0, 0);

function params(query: string) {
  return new URLSearchParams(query);
}

/** Generador determinista para las pruebas. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function withLearned(state: ProgressState, zs: number[], answeredCorrect = 0): ProgressState {
  const elements = { ...state.elements };
  for (const z of zs) {
    elements[z] = {
      ...createElementProgress(z),
      learned: true,
      learnedAt: NOW.toISOString(),
      seen: answeredCorrect + 1,
      correct: answeredCorrect,
      recent: Array.from({ length: answeredCorrect }, () => 1),
    };
  }
  return { ...state, elements };
}

describe('buildCheckQuestions', () => {
  it('genera 2 preguntas por elemento: símbolo↔nombre y número o familia', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const zs = [21, 22, 23, 24, 25];
      const qs = buildCheckQuestions(zs, seeded(seed));
      expect(qs).toHaveLength(zs.length * CHECK_QUESTIONS_PER_ELEMENT);
      for (const z of zs) {
        const mine = qs.filter((q) => q.atomicNumber === z);
        expect(mine).toHaveLength(2);
        expect(mine.some((q) => q.type === 'symbol-to-name' || q.type === 'name-to-symbol')).toBe(true);
        expect(mine.some((q) => q.type === 'element-to-number' || q.type === 'element-to-category')).toBe(true);
      }
      // Primero la ronda de símbolos, luego la de detalles.
      expect(qs.slice(0, 5).every((q) => q.skill === 'symbol')).toBe(true);
      // Nunca el mismo elemento dos veces seguidas.
      for (let i = 1; i < qs.length; i++) expect(qs[i].atomicNumber).not.toBe(qs[i - 1].atomicNumber);
      // Preguntas válidas: 4 opciones y una correcta.
      for (const q of qs) {
        expect(q.options).toHaveLength(4);
        expect(q.options?.filter((o) => o.correct)).toHaveLength(1);
      }
    }
  });

  it('funciona con menos de 5 elementos y sin duplicados', () => {
    expect(buildCheckQuestions([118, 118])).toHaveLength(2);
    expect(buildCheckQuestions([])).toEqual([]);
  });
});

describe('resolveLearnSource', () => {
  it('lee bloques y familias', () => {
    const block = resolveLearnSource(params('block=b3'));
    expect(block).toMatchObject({ kind: 'block', id: 'b3', invalid: false });
    expect(block.pool).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
    expect(block.label).toBe('Bloque 3 · Elementos 21–30');

    const family = resolveLearnSource(params('family=noble-gas'));
    expect(family).toMatchObject({ kind: 'family', id: 'noble-gas', label: 'Gases nobles', invalid: false });
    expect(family.pool).toEqual([2, 10, 18, 36, 54, 86, 118]);
  });

  it('usa toda la tabla si no hay parámetros o no son válidos', () => {
    expect(resolveLearnSource(params(''))).toMatchObject({ kind: 'all', invalid: false });
    expect(resolveLearnSource(params('')).pool).toHaveLength(118);
    expect(resolveLearnSource(params('block=b99'))).toMatchObject({ kind: 'all', invalid: true });
    expect(resolveLearnSource(params('family=unicornio'))).toMatchObject({ kind: 'all', invalid: true });
  });

  it('enlaces con la misma selección', () => {
    expect(practiceHref(resolveLearnSource(params('block=b2')))).toBe('/practicar?block=b2');
    expect(practiceHref(resolveLearnSource(params('family=halogen')))).toBe('/practicar?family=halogen');
    expect(practiceHref(resolveLearnSource(params('')))).toBe('/practicar');
    expect(flashcardsHref([1, 2, 3])).toBe('/flashcards?elements=1,2,3');
    expect(flashcardsHref([])).toBe('/flashcards');
  });
});

describe('groupProgress / suggestNextBlock', () => {
  it('estados Nuevo, En progreso y Completado', () => {
    const base = createInitialState(NOW);
    const b1 = STUDY_BLOCKS[0].atomicNumbers;

    const fresh = groupProgress(b1, base, masteryMap(base, NOW));
    expect(fresh).toMatchObject({ total: 10, learned: 0, mastered: 0, practiced: 0, status: 'new' });

    const partial = withLearned(base, [1, 2, 3]);
    expect(groupProgress(b1, partial, masteryMap(partial, NOW))).toMatchObject({ learned: 3, status: 'progress' });

    const done = withLearned(base, b1, 8);
    const progress = groupProgress(b1, done, masteryMap(done, NOW));
    expect(progress).toMatchObject({ learned: 10, practiced: 10, status: 'done' });
    expect(progress.avgMastery).toBeGreaterThan(0);
  });

  it('sugiere el primer bloque sin completar y, si están todos, el más flojo', () => {
    const base = createInitialState(NOW);
    const state = withLearned(base, [...STUDY_BLOCKS[0].atomicNumbers, 11, 12]);
    const mastery = masteryMap(state, NOW);
    const progress: Record<string, GroupProgress> = {};
    for (const b of STUDY_BLOCKS) progress[b.id] = groupProgress(b.atomicNumbers, state, mastery);
    expect(suggestNextBlock(STUDY_BLOCKS, progress)).toMatchObject({ block: { id: 'b2' }, reason: 'continue' });

    const onlyFirst = withLearned(base, STUDY_BLOCKS[0].atomicNumbers);
    const m2 = masteryMap(onlyFirst, NOW);
    const p2: Record<string, GroupProgress> = {};
    for (const b of STUDY_BLOCKS) p2[b.id] = groupProgress(b.atomicNumbers, onlyFirst, m2);
    expect(suggestNextBlock(STUDY_BLOCKS, p2)).toMatchObject({ block: { id: 'b2' }, reason: 'start' });

    const all: Record<string, GroupProgress> = {};
    for (const b of STUDY_BLOCKS) {
      all[b.id] = { total: 10, learned: 10, mastered: 0, practiced: 10, avgMastery: b.id === 'b7' ? 12 : 60, status: 'done' };
    }
    expect(suggestNextBlock(STUDY_BLOCKS, all)).toMatchObject({ block: { id: 'b7' }, reason: 'review' });
  });

  it('mini casillas: sin practicar hasta la primera respuesta', () => {
    expect(miniTileTone(undefined, 0)).toBe('unseen');
    expect(miniTileTone({ ...createElementProgress(1), learned: true }, 0)).toBe('unseen');
    expect(miniTileTone({ ...createElementProgress(1), correct: 1 }, 90)).toBe('mastered');
    expect(miniTileTone({ ...createElementProgress(1), incorrect: 2 }, 10)).toBe('practice');
  });
});
