import { describe, expect, it } from 'vitest';
import { getStudyBlock } from '@/data/blocks';
import { ELEMENTS_BY_NUMBER, getElement } from '@/data/elements';
import type { ProgressState } from '@/types';
import { createInitialState } from '@/utils/engine';
import { ALL_ATOMIC_NUMBERS } from '@/utils/selection';
import { createElementProgress } from '@/utils/srs';
import { applicableNumbers, buildDeck, deckCount, deckPool, deckTitle, smartDeck } from '../deck';
import { FLASHCARD_MODES, getFlashcardMode, isFlashcardModeId } from '../modes';
import { parseFlashcardParams } from '../params';
import { createQueue, MAX_REQUEUES, requeue, type QueueCard } from '../queue';
import { ratingFromKey } from '../ratings';
import { difficultElements, improvedElements, knownCount, ratingCounts, type ReviewRecord } from '../session';

const NOW = new Date(2026, 0, 15, 12, 0, 0);

/** Generador determinista (LCG) para las pruebas. */
function seeded(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function params(query: string) {
  return parseFlashcardParams(new URLSearchParams(query));
}

function withProgress(state: ProgressState, entries: Array<[number, Partial<ReturnType<typeof createElementProgress>>]>) {
  const elements = { ...state.elements };
  for (const [z, patch] of entries) elements[z] = { ...createElementProgress(z), ...patch };
  return { ...state, elements };
}

const past = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const future = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

describe('modos de flashcards', () => {
  it('hay 7 modos con ids únicos y una habilidad cada uno', () => {
    expect(FLASHCARD_MODES).toHaveLength(7);
    expect(new Set(FLASHCARD_MODES.map((m) => m.id)).size).toBe(7);
    for (const m of FLASHCARD_MODES) expect(isFlashcardModeId(m.id)).toBe(true);
    expect(isFlashcardModeId('otro')).toBe(false);
    expect(isFlashcardModeId(null)).toBe(false);
  });

  it('anverso y reverso correctos para el Oxígeno', () => {
    const o = getElement(8);
    const face = (id: Parameters<typeof getFlashcardMode>[0]) => {
      const mode = getFlashcardMode(id);
      return [mode.front(o).main, mode.back(o).main];
    };
    expect(face('symbol-name')).toEqual(['O', 'Oxígeno']);
    expect(face('name-symbol')).toEqual(['Oxígeno', 'O']);
    expect(face('number-element')).toEqual(['8', 'Oxígeno']);
    expect(face('element-number')).toEqual(['Oxígeno', '8']);
    expect(face('element-family')).toEqual(['Oxígeno', 'No metal']);
    expect(face('element-group')).toEqual(['Oxígeno', 'Grupo 16']);
    expect(face('element-mass')).toEqual(['Oxígeno', '15.999']);
    expect(getFlashcardMode('element-mass').back(getElement(43)).main).toMatch(/^\[\d+\]$/);
  });

  it('«Elemento → Grupo» omite los elementos del bloque f', () => {
    const pool = applicableNumbers(getFlashcardMode('element-group'), ALL_ATOMIC_NUMBERS);
    expect(pool.length).toBeLessThan(118);
    expect(pool.every((z) => ELEMENTS_BY_NUMBER[z].group !== null)).toBe(true);
    expect(pool).not.toContain(57);
    expect(pool).not.toContain(92);
    expect(applicableNumbers(getFlashcardMode('symbol-name'), ALL_ATOMIC_NUMBERS)).toHaveLength(118);
  });
});

describe('parámetros de la URL', () => {
  it('lee ?elements= sin duplicados ni valores inválidos', () => {
    expect(params('elements=8,%2026,abc,0,119,8,1.5').elements).toEqual([8, 26]);
    expect(params('elements=').elements).toBeNull();
    expect(params('').elements).toBeNull();
  });

  it('lee ?mode= solo si existe', () => {
    expect(params('mode=element-mass').mode).toBe('element-mass');
    expect(params('mode=nada').mode).toBeNull();
  });
});

describe('mazos', () => {
  const fresh = createInitialState(NOW);
  const symbolMode = getFlashcardMode('symbol-name');

  it('el repaso inteligente de un usuario nuevo trae nuevos (H, He) y se completa hasta el tamaño', () => {
    const deck = buildDeck({ kind: 'smart' }, fresh, NOW, symbolMode, 10, seeded());
    expect(deck).toHaveLength(10);
    expect(new Set(deck).size).toBe(10);
    expect(deck).toContain(1);
    expect(deck).toContain(2);
  });

  it('el repaso inteligente prioriza los repasos pendientes y los débiles', () => {
    const state = withProgress(fresh, [
      [26, { learned: true, correct: 3, reps: 2, intervalDays: 3, due: past(2) }],
      [79, { learned: true, correct: 2, reps: 1, intervalDays: 1, due: past(1) }],
      [11, { learned: true, correct: 1, incorrect: 4, recent: [0, 0, 1, 0, 0], due: future(1) }],
      [6, { learned: true, correct: 8, reps: 5, intervalDays: 30, due: future(20), recent: [1, 1, 1, 1, 1, 1, 1, 1] }],
    ]);
    const deck = smartDeck(state, NOW, 10, ALL_ATOMIC_NUMBERS, seeded(7));
    expect(deck).toHaveLength(10);
    expect(deck).toEqual(expect.arrayContaining([26, 79, 11]));
  });

  it('respeta el modo: sin bloque f en «Grupo»', () => {
    const groupMode = getFlashcardMode('element-group');
    for (let seed = 1; seed <= 5; seed++) {
      const deck = buildDeck({ kind: 'all' }, fresh, NOW, groupMode, 30, seeded(seed));
      expect(deck).toHaveLength(30);
      expect(deck.every((z) => ELEMENTS_BY_NUMBER[z].group !== null)).toBe(true);
    }
    const lanthanides = buildDeck({ kind: 'family', id: 'lanthanide' }, fresh, NOW, groupMode, 10, seeded());
    expect(lanthanides).toEqual([]);
  });

  it('bloques, familias, errores y selección propia', () => {
    const block = buildDeck({ kind: 'block', id: 'b3' }, fresh, NOW, symbolMode, 20, seeded());
    expect([...block].sort((a, b) => a - b)).toEqual(getStudyBlock('b3')?.atomicNumbers);

    const nobles = buildDeck({ kind: 'family', id: 'noble-gas' }, fresh, NOW, symbolMode, 10, seeded());
    expect(nobles.length).toBeGreaterThan(0);
    expect(nobles.every((z) => ELEMENTS_BY_NUMBER[z].category === 'noble-gas')).toBe(true);

    expect(buildDeck({ kind: 'mistakes' }, fresh, NOW, symbolMode, 10, seeded())).toEqual([]);
    const withErrors = withProgress(fresh, [
      [17, { correct: 0, incorrect: 3, recent: [0, 0, 0] }],
      [35, { correct: 1, incorrect: 2, recent: [0, 1, 0] }],
    ]);
    expect(buildDeck({ kind: 'mistakes' }, withErrors, NOW, symbolMode, 10, seeded()).sort()).toEqual([17, 35]);

    const custom = { kind: 'custom', elements: [79, 1, 79, 57] } as const;
    expect(buildDeck(custom, fresh, NOW, symbolMode, 10)).toEqual([79, 1, 57]);
    expect(buildDeck(custom, fresh, NOW, getFlashcardMode('element-group'), 10)).toEqual([79, 1]);
  });

  it('cuenta las tarjetas disponibles y nombra el mazo', () => {
    expect(deckPool({ kind: 'block', id: 'b1' }, fresh, NOW, symbolMode)).toHaveLength(10);
    expect(deckCount({ kind: 'block', id: 'b1' }, 10, 30)).toBe(10);
    expect(deckCount({ kind: 'all' }, 118, 20)).toBe(20);
    expect(deckCount({ kind: 'custom', elements: [1, 2, 3] }, 3, 10)).toBe(3);
    expect(deckTitle({ kind: 'block', id: 'b2' })).toBe('Bloque 2 · 11–20');
    expect(deckTitle({ kind: 'family', id: 'noble-gas' })).toBe('Gases nobles');
    expect(deckTitle({ kind: 'smart' })).toBe('Repaso inteligente');
  });
});

describe('cola de la sesión', () => {
  const deck = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('«No lo sabía» vuelve 3–4 posiciones después', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const queue = requeue(createQueue(deck), 0, 'again', seeded(seed));
      expect(queue).toHaveLength(11);
      const at = queue.findIndex((c, i) => i > 0 && c.atomicNumber === 1);
      expect([3, 4]).toContain(at);
      expect(queue[at].pass).toBe(1);
      expect(queue[at].key).toBe('0-1');
    }
  });

  it('«Casi» vuelve ~7 posiciones después y al final si quedan pocas', () => {
    const queue = requeue(createQueue(deck), 1, 'hard', seeded(3));
    const at = queue.findIndex((c, i) => i > 1 && c.atomicNumber === 2);
    expect(at - 1).toBeGreaterThanOrEqual(6);
    expect(at - 1).toBeLessThanOrEqual(8);

    const tail = requeue(createQueue(deck), 9, 'hard', seeded(3));
    expect(tail).toHaveLength(11);
    expect(tail[10].atomicNumber).toBe(10);
  });

  it('«Lo sabía» y «Muy fácil» no cambian la cola; máximo 2 repeticiones por tarjeta', () => {
    const queue = createQueue(deck);
    expect(requeue(queue, 0, 'good')).toBe(queue);
    expect(requeue(queue, 0, 'easy')).toBe(queue);

    let q: readonly QueueCard[] = createQueue([1]);
    let index = 0;
    let appearances = 1;
    while (index < q.length) {
      const next = requeue(q, index, 'again');
      if (next !== q) appearances += 1;
      q = next;
      index += 1;
    }
    expect(appearances).toBe(1 + MAX_REQUEUES);
  });
});

describe('resultado de la sesión', () => {
  const review = (atomicNumber: number, rating: ReviewRecord['rating']): ReviewRecord => ({
    key: `${atomicNumber}`,
    atomicNumber,
    rating,
    responseMs: 1000,
    xp: 1,
  });

  it('cuenta calificaciones y elige las difíciles («No lo sabía» primero)', () => {
    const reviews = [review(1, 'hard'), review(2, 'good'), review(3, 'again'), review(1, 'again'), review(4, 'easy'), review(5, 'hard')];
    const counts = ratingCounts(reviews);
    expect(counts).toEqual({ again: 2, hard: 2, good: 1, easy: 1 });
    expect(knownCount(counts)).toBe(2);
    expect(difficultElements(reviews)).toEqual([3, 1, 5]);
  });

  it('elementos mejorados de mayor a menor', () => {
    expect(improvedElements({ 1: 10, 2: 50, 3: 40 }, { 1: 30, 2: 45, 3: 70 })).toEqual([3, 1]);
  });

  it('teclas 1–4', () => {
    expect(['1', '2', '3', '4', '5'].map(ratingFromKey)).toEqual(['again', 'hard', 'good', 'easy', null]);
  });
});
