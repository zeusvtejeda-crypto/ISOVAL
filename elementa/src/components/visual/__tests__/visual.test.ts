import { describe, expect, it } from 'vitest';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import { createInitialState } from '@/utils/state';
import { checkTableAnswer, TABLE_TYPES } from '@/utils/questions';
import { buildVisualQuestions } from '../build-visual';
import { getVisualMode, VISUAL_MODES } from '../modes';

const NOW = new Date(2026, 8, 23, 12, 0, 0);

describe('retos visuales', () => {
  it('cada modo usa solo preguntas de tabla', () => {
    for (const mode of VISUAL_MODES) {
      expect(mode.types.length).toBeGreaterThan(0);
      expect(mode.types.every((t) => TABLE_TYPES.includes(t))).toBe(true);
    }
    expect(getVisualMode('familia')?.count).toBe(6);
    expect(getVisualMode('nada')).toBeNull();
  });

  it.each(VISUAL_MODES.map((m) => [m.id, m] as const))('%s: sesión completa, sin enunciados repetidos y corregible', (_, mode) => {
    const state = createInitialState(NOW);
    for (let run = 0; run < 40; run++) {
      const questions = buildVisualQuestions(mode, state, NOW);
      expect(questions).toHaveLength(mode.count);
      expect(new Set(questions.map((q) => `${q.type}:${q.subject}`)).size).toBe(questions.length);
      for (const q of questions) {
        expect(mode.types).toContain(q.type);
        expect(q.kind).not.toBe('multiple-choice');
        const targets = q.targetAtomicNumbers ?? [];
        expect(targets.length).toBeGreaterThan(0);
        expect(targets.every((z) => ELEMENTS_BY_NUMBER[z] !== undefined)).toBe(true);
        // La respuesta correcta se acepta y una casilla ajena no.
        const right = q.kind === 'table-multi-select' ? targets : [targets[0]];
        expect(checkTableAnswer(q, right)).toBe(true);
        const outsider = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((z) => !targets.includes(z)) as number;
        expect(checkTableAnswer(q, [outsider])).toBe(false);
      }
    }
  });
});
