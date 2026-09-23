import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MistakeRecord, ProgressState } from '@/types';
import { applyAnswer, type AnswerInput } from '@/utils/engine';
import { difficultElements, weakElements } from '@/utils/selection';
import { createInitialState } from '@/utils/state';
import { HardElements } from '../HardElements';
import { MistakeCard } from '../MistakeCard';
import { MistakeHistory } from '../MistakeHistory';
import { hardElements, mistakeGroups, relativeTime } from '../mistakes-data';

const NOW = new Date(2026, 8, 23, 12, 0, 0);

function input(z: number, correct: boolean): AnswerInput {
  return {
    atomicNumber: z,
    skill: 'symbol',
    correct,
    responseMs: 3000,
    mode: 'trivia',
    prompt: `¿Cuál es el símbolo del elemento ${z}?`,
    correctAnswer: 'K',
    givenAnswer: correct ? 'K' : 'P',
  };
}

function build(): ProgressState {
  let state = createInitialState(NOW);
  const plan: Array<[number, boolean]> = [
    [19, false],
    [19, false],
    [19, true],
    [26, false],
    [26, true],
    [26, true],
    [8, true],
    [8, true],
    [8, true],
    [8, true],
    [8, true],
    [8, true],
    [8, true],
    [8, false],
    [8, true],
    [8, true],
    [8, true],
    [8, true],
    [8, true],
  ];
  for (const [z, correct] of plan) state = applyAnswer(state, input(z, correct), NOW).state;
  return state;
}

describe('hardElements', () => {
  it('solo fallados y no dominados, del menor dominio al mayor', () => {
    const state = build();
    const hard = hardElements(state, NOW);
    expect(hard.map((x) => x.atomicNumber)).toEqual([19, 26]);
    expect(hard[0]).toMatchObject({ incorrect: 2, correct: 1 });
    expect(hard[0].mastery).toBeLessThanOrEqual(hard[1].mastery);
    expect(hardElements(createInitialState(NOW), NOW)).toEqual([]);
  });

  it('es la definición única de «difíciles» (difficultElements): nunca un elemento sin fallos', () => {
    let state = build();
    // Acertados pocas veces: débiles (sin dominar), pero no difíciles.
    for (const z of [21, 23, 34]) state = applyAnswer(state, input(z, true), NOW).state;
    const hard = hardElements(state, NOW);
    expect(hard).toEqual(difficultElements(state, NOW));
    expect(hard.map((x) => x.atomicNumber)).toEqual([19, 26]);
    expect(weakElements(state, NOW, 118).map((w) => w.atomicNumber)).toEqual(expect.arrayContaining([21, 23, 34]));
    expect(hard.every((x) => x.incorrect > 0)).toBe(true);
  });
});

describe('mistakeGroups', () => {
  it('cuenta por elemento: más errores primero y, a igualdad, el más reciente', () => {
    const m = (id: string, z: number): MistakeRecord => ({
      id,
      atomicNumber: z,
      skill: 'symbol',
      prompt: '',
      correctAnswer: '',
      givenAnswer: '',
      mode: 'practice',
      at: NOW.toISOString(),
    });
    expect(mistakeGroups([m('a', 26), m('b', 19), m('c', 19), m('d', 8), m('e', 999)])).toEqual([
      { atomicNumber: 19, count: 2 },
      { atomicNumber: 26, count: 1 },
      { atomicNumber: 8, count: 1 },
    ]);
  });
});

describe('relativeTime', () => {
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
  it('frases cortas en español', () => {
    expect(relativeTime(ago(10_000), NOW)).toBe('Justo ahora');
    expect(relativeTime(ago(5 * 60_000), NOW)).toBe('hace 5 min');
    expect(relativeTime(ago(3 * 3_600_000), NOW)).toBe('hace 3 h');
    expect(relativeTime(new Date(2026, 8, 22, 23, 0).toISOString(), NOW)).toBe('Ayer');
    expect(relativeTime(new Date(2026, 8, 19, 9, 0).toISOString(), NOW)).toBe('hace 4 días');
    expect(relativeTime(new Date(2026, 8, 8, 9, 0).toISOString(), NOW)).toBe('hace 2 semanas');
    expect(relativeTime(new Date(2026, 2, 12, 9, 0).toISOString(), NOW)).toBe('12 mar');
    expect(relativeTime(new Date(2025, 2, 12, 9, 0).toISOString(), NOW)).toBe('12 mar 2025');
    expect(relativeTime('no-es-fecha', NOW)).toBe('');
  });
});

describe('componentes', () => {
  it('MistakeCard muestra tu respuesta, la correcta y el modo', () => {
    const state = build();
    const html = renderToStaticMarkup(h(MistakeCard, { mistake: state.mistakes[0], when: 'hace 5 min' }));
    expect(html).toContain('Tu respuesta: </span><span class="font-black">P');
    expect(html).toContain('Correcta: </span><span class="font-black">K');
    expect(html).toContain('Preguntados');
    expect(html).toContain('hace 5 min');
  });

  it('MistakeHistory: los recuentos de los filtros no usan opacidad (contraste AA)', () => {
    const state = build();
    const html = renderToStaticMarkup(h(MistakeHistory, { mistakes: state.mistakes, now: NOW, onClear: () => {} }));
    expect(html).toContain('Todos<span class="text-muted tabular">');
    expect(html).not.toContain('opacity-70');
  });

  it('HardElements: ranking con práctica y ficha por elemento', () => {
    const state = build();
    const html = renderToStaticMarkup(h(HardElements, { items: hardElements(state, NOW) }));
    expect(html).toContain('Potasio');
    expect(html).toContain('href="/practicar?focus=dificiles"');
    expect(html).toContain('href="/practicar?elements=19"');
    expect(html).toContain('href="/tabla?e=19"');
    expect(renderToStaticMarkup(h(HardElements, { items: [] }))).toContain('¡Nada pendiente!');
  });
});
