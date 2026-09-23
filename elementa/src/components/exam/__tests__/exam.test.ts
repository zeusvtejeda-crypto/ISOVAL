import { describe, expect, it } from 'vitest';
import { getFamilyGroup, getStudyBlock } from '@/data/blocks';
import type { AnsweredQuestion, ProgressState, Question } from '@/types';
import { createInitialState } from '@/utils/engine';
import { generateQuestion, QUESTION_TYPE_META, typesForTopics } from '@/utils/questions';
import { createElementProgress } from '@/utils/srs';
import { allocate, buildExam, examCapacity, spreadByElement } from '../build-exam';
import { customSpec, EXAM_PRESETS, presetSpec } from '../presets';
import { examGrade, examPercent, practiceMistakesHref, topicScores } from '../results';

const NOW = new Date(2026, 0, 15, 12, 0, 0);

function keys(qs: readonly Question[]): string[] {
  return qs.map((q) => `${q.type}:${q.atomicNumber}`);
}

function stateWithMistakes(zs: number[]): ProgressState {
  const state = createInitialState(NOW);
  for (const z of zs) {
    state.elements[z] = { ...createElementProgress(z), seen: 4, correct: 0, incorrect: 4, recent: [0, 0, 0, 0] };
  }
  return state;
}

function answered(q: Question, correct: boolean): AnsweredQuestion {
  return { question: q, correct, givenAnswer: correct ? q.correctAnswer : 'X', responseMs: 2000, xpGained: correct ? 10 : 0 };
}

describe('allocate', () => {
  it('reparte exactamente el total según los pesos', () => {
    expect(allocate(10, [4, 2, 2, 1, 1])).toEqual([4, 2, 2, 1, 1]);
    expect(allocate(20, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(20);
    expect(allocate(3, [1, 1, 1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(3);
    expect(allocate(5, [0, 0])).toEqual([0, 0]);
    expect(allocate(7, [1, 0, 1])).toEqual([4, 0, 3]);
  });
});

describe('buildExam', () => {
  it.each(EXAM_PRESETS.map((p) => [p.id, p] as const))('examen %s: cantidad exacta, sin repetir elemento ni tipo+elemento', (_, preset) => {
    const state = createInitialState(NOW);
    for (let run = 0; run < 5; run++) {
      const qs = buildExam(presetSpec(preset), state, NOW);
      expect(qs).toHaveLength(preset.count);
      expect(new Set(keys(qs)).size).toBe(qs.length);
      expect(new Set(qs.map((q) => q.atomicNumber)).size).toBe(qs.length);
      const allowed = new Set(preset.mix.flatMap((m) => m.types));
      for (const q of qs) expect(allowed.has(q.type)).toBe(true);
    }
  });

  it('el rápido no incluye tipos difíciles (masa, configuración)', () => {
    const quick = EXAM_PRESETS.find((p) => p.id === 'quick');
    expect(quick).toBeDefined();
    const types = new Set(quick?.mix.flatMap((m) => m.types));
    expect(types.has('element-to-mass')).toBe(false);
    expect(types.has('element-to-configuration')).toBe(false);
  });

  it('el completo cubre varios temas', () => {
    const complete = EXAM_PRESETS.find((p) => p.id === 'complete');
    const qs = buildExam(presetSpec(complete!), createInitialState(NOW), NOW);
    const topics = new Set(qs.map((q) => QUESTION_TYPE_META[q.type].topic));
    expect(topics.size).toBeGreaterThanOrEqual(8);
  });

  it('personalizado: respeta temas y alcance', () => {
    const block = getStudyBlock('b2');
    const qs = buildExam(
      customSpec({ topics: ['symbols', 'families'], scope: { kind: 'block', id: 'b2' }, count: 10 }),
      createInitialState(NOW),
      NOW,
    );
    expect(qs).toHaveLength(10);
    const allowed = new Set(typesForTopics(['symbols', 'families']));
    for (const q of qs) {
      expect(allowed.has(q.type)).toBe(true);
      expect(block?.atomicNumbers).toContain(q.atomicNumber);
    }
    // Temas equilibrados: 5 y 5.
    const symbols = qs.filter((q) => QUESTION_TYPE_META[q.type].topic === 'symbols').length;
    expect(symbols).toBe(5);
  });

  it('personalizado pequeño: llega a la capacidad sin repetir tipo+elemento', () => {
    const family = getFamilyGroup('noble-gas');
    const config = { topics: ['symbols' as const], scope: { kind: 'family' as const, id: 'noble-gas' as const }, count: 20 as const };
    const capacity = examCapacity(family?.atomicNumbers ?? [], typesForTopics(['symbols']));
    expect(capacity).toBe(14);
    for (let run = 0; run < 10; run++) {
      const qs = buildExam(customSpec(config), createInitialState(NOW), NOW);
      expect(qs).toHaveLength(14);
      expect(new Set(keys(qs)).size).toBe(14);
    }
  });

  it('es adaptativo: los elementos con fallos salen mucho más que al azar', () => {
    const weak = [26, 19, 47];
    const state = stateWithMistakes(weak);
    let hits = 0;
    for (let run = 0; run < 10; run++) {
      const qs = buildExam(presetSpec(EXAM_PRESETS[1]), state, NOW);
      hits += weak.filter((z) => qs.some((q) => q.atomicNumber === z)).length;
    }
    // Muestreo ponderado: ~83 % de inclusión (al azar serían ~17 %); umbral holgado para no fallar por azar.
    expect(hits).toBeGreaterThanOrEqual(18);
  });
});

describe('spreadByElement', () => {
  it('evita el mismo elemento dos veces seguidas cuando es posible', () => {
    const qs = ['symbol-to-name', 'name-to-symbol', 'element-to-number'].flatMap((t) =>
      [1, 2].map((z) => generateQuestion(t as Question['type'], z) as Question),
    );
    qs.push(generateQuestion('number-to-element', 1) as Question);
    const sorted = [...qs].sort((a, b) => a.atomicNumber - b.atomicNumber);
    const out = spreadByElement(sorted);
    expect(out).toHaveLength(qs.length);
    for (let i = 1; i < out.length; i++) expect(out[i].atomicNumber).not.toBe(out[i - 1].atomicNumber);
  });
});

describe('resultados', () => {
  it('porcentaje y nota', () => {
    expect(examPercent(17, 20)).toBe(85);
    expect(examPercent(0, 0)).toBe(0);
    expect(examGrade(100).title).toBe('¡Examen perfecto!');
    expect(examGrade(85).tone).toBe('success');
    expect(examGrade(10).tone).toBe('danger');
  });

  it('aciertos por tema y enlace para practicar errores', () => {
    const q1 = generateQuestion('symbol-to-name', 26) as Question;
    const q2 = generateQuestion('element-to-mass', 19) as Question;
    const q3 = generateQuestion('name-to-symbol', 47) as Question;
    const list = [answered(q1, false), answered(q2, false), answered(q3, true)];
    expect(topicScores(list)).toEqual([
      { topic: 'symbols', correct: 1, total: 2 },
      { topic: 'atomicMass', correct: 0, total: 1 },
    ]);
    const href = practiceMistakesHref(list);
    expect(href).not.toBeNull();
    const url = new URL(href as string, 'https://x.test');
    expect(url.pathname).toBe('/practicar');
    expect(url.searchParams.get('elements')).toBe('26,19');
    expect(url.searchParams.get('types')?.split(',')).toContain('element-to-mass');
    expect(practiceMistakesHref([answered(q3, true)])).toBeNull();
  });
});
