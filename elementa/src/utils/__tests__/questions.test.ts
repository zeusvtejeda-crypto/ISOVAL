import { describe, expect, it } from 'vitest';
import { ELEMENTS, ELEMENTS_BY_SYMBOL, getElement } from '@/data/elements';
import type { ChemicalElement, Question, QuestionType } from '@/types';
import { normalizeText } from '@/utils/format';
import {
  ALL_QUESTION_TYPES,
  checkTableAnswer,
  describeTableSelection,
  generateAdaptiveQuestion,
  generateQuestion,
  generateQuestions,
  isApplicable,
  MC_TYPES,
  QUESTION_TYPE_META,
  TABLE_TYPES,
  typesForTopics,
} from '@/utils/questions';
import { createInitialState } from '@/utils/state';
import { getNeighbor } from '@/utils/table-layout';
import { NOW, progress } from './helpers';

const FORBIDDEN = /undefined|NaN|null|\[object/;
const RUNS_PER_ELEMENT = 4;

/** Tipos cuya opción correcta es el propio elemento preguntado. */
const ANSWER_IS_ELEMENT: QuestionType[] = ['symbol-to-name', 'number-to-element', 'classification'];

function texts(q: Question): string[] {
  return [
    q.prompt,
    q.explanation,
    q.correctAnswer,
    q.subject ?? '',
    ...(q.options ?? []).flatMap((o) => [o.label, o.sublabel ?? '']),
  ];
}

function assertValid(q: Question, type: QuestionType, el: ChemicalElement): void {
  const where = `${type} ${el.symbol}`;
  const meta = QUESTION_TYPE_META[type];
  expect(q.type, where).toBe(type);
  expect(q.kind, where).toBe(meta.kind);
  expect(q.skill, where).toBe(meta.skill);
  expect(q.atomicNumber, where).toBe(el.atomicNumber);
  expect([1, 2, 3], where).toContain(q.difficulty);
  expect(q.id.length, where).toBeGreaterThan(0);
  expect(q.prompt.trim().length, where).toBeGreaterThan(0);
  expect(q.explanation.trim().length, where).toBeGreaterThan(0);
  for (const t of texts(q)) expect(t, where).not.toMatch(FORBIDDEN);

  if (q.kind === 'multiple-choice') {
    const options = q.options ?? [];
    expect(options, where).toHaveLength(4);
    expect(options.map((o) => o.id), where).toEqual(['a', 'b', 'c', 'd']);
    const labels = options.map((o) => normalizeText(o.label));
    expect(new Set(labels).size, `${where}: ${labels.join(' | ')}`).toBe(4);
    const correct = options.filter((o) => o.correct);
    expect(correct, where).toHaveLength(1);
    expect(q.correctAnswer, where).toBe(correct[0].label);
    expect(q.targetAtomicNumbers, where).toBeUndefined();
  } else {
    const targets = q.targetAtomicNumbers ?? [];
    expect(targets.length, where).toBeGreaterThan(0);
    expect(q.options, where).toBeUndefined();
    expect(q.correctAnswer.trim().length, where).toBeGreaterThan(0);
  }
}

function assertSemantics(q: Question, type: QuestionType, el: ChemicalElement): void {
  const where = `${type} ${el.symbol}`;
  const options = q.options ?? [];
  const correct = options.find((o) => o.correct);
  const wrong = options.filter((o) => !o.correct);

  if (ANSWER_IS_ELEMENT.includes(type)) expect(correct?.atomicNumber, where).toBe(el.atomicNumber);

  switch (type) {
    case 'name-to-symbol':
      expect(q.correctAnswer, where).toBe(el.symbol);
      expect(wrong.map((o) => o.label), where).not.toContain(el.symbol);
      break;
    case 'symbol-to-name':
      expect(q.correctAnswer, where).toBe(el.name);
      break;
    case 'number-to-element':
      expect(q.correctAnswer, where).toBe(el.name);
      expect(q.subject, where).toBe(String(el.atomicNumber));
      break;
    case 'element-to-number':
      expect(q.correctAnswer, where).toBe(String(el.atomicNumber));
      for (const o of options) {
        const n = Number(o.label);
        expect(Number.isInteger(n) && n >= 1 && n <= 118, where).toBe(true);
      }
      break;
    case 'element-to-group':
      expect(el.group, where).not.toBeNull();
      expect(q.correctAnswer, where).toBe(`Grupo ${el.group}`);
      break;
    case 'element-to-period':
      expect(q.correctAnswer, where).toBe(`Periodo ${el.period}`);
      break;
    case 'element-to-phase':
      expect(el.phase, where).not.toBe('unknown');
      break;
    case 'classification':
      for (const o of wrong) expect(getElement(o.atomicNumber as number).category, where).not.toBe(el.category);
      break;
    case 'property':
      assertProperty(q, el);
      break;
    case 'location':
      if (correct?.atomicNumber !== undefined) {
        const neighbors = (['up', 'down', 'left', 'right'] as const).map((d) => getNeighbor(el, d)?.atomicNumber);
        expect(neighbors, where).toContain(correct.atomicNumber);
      } else {
        expect(q.correctAnswer, where).toBe(`Periodo ${el.period}, grupo ${el.group}`);
      }
      break;
    case 'table-find-element':
    case 'table-find-number':
      expect(q.targetAtomicNumbers, where).toEqual([el.atomicNumber]);
      break;
    case 'table-group-member': {
      const targets = q.targetAtomicNumbers ?? [];
      expect(targets, where).toContain(el.atomicNumber);
      for (const z of targets) expect(getElement(z).group, where).toBe(el.group);
      expect(targets.length, where).toBe(ELEMENTS.filter((e) => e.group === el.group).length);
      break;
    }
    case 'table-select-category': {
      const targets = q.targetAtomicNumbers ?? [];
      expect(targets.length, where).toBe(ELEMENTS.filter((e) => e.category === el.category).length);
      for (const z of targets) expect(getElement(z).category, where).toBe(el.category);
      break;
    }
    default:
      break;
  }
}

function assertProperty(q: Question, el: ChemicalElement): void {
  const where = `property ${el.symbol}: ${q.prompt}`;
  const options = q.options ?? [];
  if (q.correctAnswer.startsWith('Bloque ')) {
    expect(q.correctAnswer, where).toBe(`Bloque ${el.block}`);
    return;
  }
  const correct = getElement(options.find((o) => o.correct)?.atomicNumber as number);
  const wrong = options.filter((o) => !o.correct).map((o) => getElement(o.atomicNumber as number));
  expect(correct.atomicNumber, where).toBe(el.atomicNumber);
  if (q.prompt.includes('líquido')) {
    expect([35, 80], where).toContain(correct.atomicNumber);
    for (const w of wrong) expect(w.phase === 'solid' || w.phase === 'gas', where).toBe(true);
  } else if (q.prompt.includes('gas')) {
    expect(correct.phase, where).toBe('gas');
    for (const w of wrong) expect(w.phase === 'solid' || w.phase === 'liquid', where).toBe(true);
  } else if (q.prompt.includes('radiactivo')) {
    expect(correct.radioactive, where).toBe(true);
    for (const w of wrong) {
      expect(w.radioactive, where).toBe(false);
      expect(w.atomicNumber, where).toBeLessThanOrEqual(82);
    }
  } else if (q.prompt.includes('electronegativo')) {
    for (const w of wrong) {
      expect((correct.electronegativity ?? 0) - (w.electronegativity ?? 0), where).toBeGreaterThanOrEqual(0.3 - 1e-9);
    }
  } else {
    // metal / no metal / metaloide: ningún distractor comparte el carácter pedido.
    expect(q.prompt, where).toMatch(/metal|metaloide/);
    for (const w of wrong) expect(w.predicted, where).toBe(false);
  }
}

describe('generateQuestion — todos los tipos × 118 elementos', () => {
  for (const type of ALL_QUESTION_TYPES) {
    it(`${type}: válida para cada elemento aplicable y null si no aplica`, () => {
      for (const el of ELEMENTS) {
        if (!isApplicable(type, el)) {
          expect(generateQuestion(type, el.atomicNumber), `${type} ${el.symbol}`).toBeNull();
          continue;
        }
        for (let i = 0; i < RUNS_PER_ELEMENT; i++) {
          const q = generateQuestion(type, el.atomicNumber);
          expect(q, `${type} ${el.symbol}`).not.toBeNull();
          assertValid(q as Question, type, el);
          assertSemantics(q as Question, type, el);
        }
      }
    });
  }

  it('nunca pregunta el grupo del bloque f ni la fase desconocida', () => {
    for (const el of ELEMENTS.filter((e) => e.group === null)) {
      expect(isApplicable('element-to-group', el)).toBe(false);
      expect(isApplicable('table-group-member', el)).toBe(false);
      expect(isApplicable('location', el)).toBe(false);
    }
    for (const el of ELEMENTS.filter((e) => e.phase === 'unknown')) {
      expect(isApplicable('element-to-phase', el)).toBe(false);
    }
  });

  it('devuelve null para números atómicos inexistentes', () => {
    expect(generateQuestion('symbol-to-name', 0)).toBeNull();
    expect(generateQuestion('symbol-to-name', 119)).toBeNull();
  });

  it('Sodio → símbolo: mezcla símbolos inventados con letras del nombre y reales', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const q = generateQuestion('name-to-symbol', 11) as Question;
      const wrong = (q.options ?? []).filter((o) => !o.correct).map((o) => o.label);
      expect(wrong).not.toContain('Na');
      expect(wrong.some((s) => !ELEMENTS_BY_SYMBOL[s])).toBe(true);
      wrong.forEach((s) => seen.add(s));
    }
    expect(seen.has('So') || seen.has('Sd')).toBe(true);
  });

  it('la explicación del símbolo usa la etimología si existe', () => {
    for (const el of ELEMENTS) {
      const q = generateQuestion('name-to-symbol', el.atomicNumber) as Question;
      if (el.etymology.trim()) expect(q.explanation).toContain(el.etymology.trim());
      else expect(q.explanation).toContain(`número atómico ${el.atomicNumber}`);
    }
  });

  it('usa el artículo femenino con la Plata', () => {
    const q = generateQuestion('name-to-symbol', 47) as Question;
    expect(q.prompt).toBe('¿Cuál es el símbolo de la Plata?');
  });

  it('la respuesta numérica no queda siempre en medio de los distractores', () => {
    const positions = new Set<number>();
    for (let i = 0; i < 80; i++) {
      const q = generateQuestion('element-to-number', 50) as Question;
      const sorted = (q.options ?? []).map((o) => Number(o.label)).sort((a, b) => a - b);
      positions.add(sorted.indexOf(50));
    }
    expect(positions.has(0) || positions.has(3)).toBe(true);
  });

  it('asigna dificultad: común 1, masa y configuración 3, bloque f 3', () => {
    expect(generateQuestion('symbol-to-name', 8)?.difficulty).toBe(1);
    expect(generateQuestion('symbol-to-name', 79)?.difficulty).toBe(1);
    expect(generateQuestion('symbol-to-name', 40)?.difficulty).toBe(2);
    expect(generateQuestion('symbol-to-name', 60)?.difficulty).toBe(3);
    expect(generateQuestion('symbol-to-name', 110)?.difficulty).toBe(3);
    expect(generateQuestion('element-to-mass', 8)?.difficulty).toBe(3);
    expect(generateQuestion('element-to-configuration', 1)?.difficulty).toBe(3);
  });
});

describe('checkTableAnswer', () => {
  it('table-select con un solo objetivo', () => {
    const q = generateQuestion('table-find-element', 8) as Question;
    expect(checkTableAnswer(q, [8])).toBe(true);
    expect(checkTableAnswer(q, [16])).toBe(false);
    expect(checkTableAnswer(q, [8, 16])).toBe(false);
    expect(checkTableAnswer(q, [])).toBe(false);
  });

  it('table-group-member acepta cualquier miembro del grupo', () => {
    const q = generateQuestion('table-group-member', 11) as Question;
    expect(q.kind).toBe('table-select');
    for (const z of [1, 3, 11, 19, 37, 55, 87]) expect(checkTableAnswer(q, [z])).toBe(true);
    expect(checkTableAnswer(q, [4])).toBe(false);
    expect(checkTableAnswer(q, [3, 11])).toBe(false);
  });

  it('table-multi-select exige el conjunto exacto (sin importar orden ni duplicados)', () => {
    const q = generateQuestion('table-select-category', 2) as Question;
    const nobles = [2, 10, 18, 36, 54, 86, 118];
    expect(checkTableAnswer(q, [...nobles].reverse())).toBe(true);
    expect(checkTableAnswer(q, [...nobles, 2])).toBe(true);
    expect(checkTableAnswer(q, nobles.slice(1))).toBe(false);
    expect(checkTableAnswer(q, [...nobles, 1])).toBe(false);
  });

  it('devuelve false para preguntas de opción múltiple', () => {
    const q = generateQuestion('symbol-to-name', 8) as Question;
    expect(checkTableAnswer(q, [8])).toBe(false);
  });

  it('describe la selección', () => {
    expect(describeTableSelection([11, 19])).toBe('Na, K');
    expect(describeTableSelection([])).toBe('—');
  });
});

describe('generateQuestions', () => {
  it('genera la cantidad pedida sin repetir elementos', () => {
    const qs = generateQuestions({ count: 20 });
    expect(qs).toHaveLength(20);
    expect(new Set(qs.map((q) => q.atomicNumber)).size).toBe(20);
    for (const q of qs) expect(MC_TYPES).toContain(q.type);
  });

  it('respeta pool, tipos y dificultad máxima', () => {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const qs = generateQuestions({ count: 10, pool, types: ['symbol-to-name', 'element-to-mass'], maxDifficulty: 2 });
    expect(qs).toHaveLength(10);
    for (const q of qs) {
      expect(pool).toContain(q.atomicNumber);
      expect(q.type).toBe('symbol-to-name');
      expect(q.difficulty).toBeLessThanOrEqual(2);
    }
  });

  it('con un pool pequeño repite elementos pero no la misma pregunta', () => {
    const qs = generateQuestions({ count: 6, pool: [11, 17], types: ['symbol-to-name', 'name-to-symbol', 'element-to-number'] });
    expect(qs).toHaveLength(6);
    expect(new Set(qs.map((q) => `${q.type}:${q.atomicNumber}`)).size).toBe(6);
  });

  it('devuelve menos si no hay combinaciones suficientes', () => {
    const qs = generateQuestions({ count: 5, pool: [8], types: ['symbol-to-name'] });
    expect(qs).toHaveLength(1);
  });

  it('no repite enunciados que comparten varios elementos (misma familia)', () => {
    const qs = generateQuestions({ count: 5, pool: [2, 10, 18, 36, 54], types: ['table-select-category'] });
    expect(qs).toHaveLength(1);
  });

  it('modo adaptativo con progreso: los elementos fallados salen más', () => {
    const state = createInitialState(NOW);
    state.elements[26] = progress(26, { seen: 6, incorrect: 6, recent: [0, 0, 0, 0, 0, 0], due: NOW.toISOString() });
    let hits = 0;
    for (let i = 0; i < 100; i++) {
      const qs = generateQuestions({ count: 3, pool: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 26] }, state, NOW);
      if (qs.some((q) => q.atomicNumber === 26)) hits++;
    }
    expect(hits).toBeGreaterThan(60);
  });

  it('solo preguntas de tabla cuando se piden TABLE_TYPES', () => {
    const qs = generateQuestions({ count: 12, types: TABLE_TYPES });
    expect(qs).toHaveLength(12);
    for (const q of qs) expect(q.kind).not.toBe('multiple-choice');
  });
});

describe('generateAdaptiveQuestion', () => {
  const state = createInitialState(NOW);

  it('siempre devuelve una pregunta válida', () => {
    for (let i = 0; i < 50; i++) {
      const q = generateAdaptiveQuestion(state, NOW);
      assertValid(q, q.type, getElement(q.atomicNumber));
    }
  });

  it('respeta exclude salvo que vacíe el pool', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateAdaptiveQuestion(state, NOW, { pool: [1, 2, 3], exclude: [1, 2] }).atomicNumber).toBe(3);
    }
    expect([1, 2]).toContain(generateAdaptiveQuestion(state, NOW, { pool: [1, 2], exclude: [1, 2] }).atomicNumber);
  });

  it('respeta los tipos pedidos', () => {
    const q = generateAdaptiveQuestion(state, NOW, { types: ['table-find-number'] });
    expect(q.type).toBe('table-find-number');
  });
});

describe('typesForTopics', () => {
  it('mapea temas a tipos', () => {
    expect(typesForTopics(['symbols'])).toEqual(['symbol-to-name', 'name-to-symbol']);
    expect(typesForTopics(['families']).sort()).toEqual(['classification', 'element-to-category']);
    expect(typesForTopics(['visual']).sort()).toEqual([...TABLE_TYPES].sort());
    expect(typesForTopics([])).toEqual(MC_TYPES);
  });

  it('MC_TYPES y TABLE_TYPES particionan todos los tipos', () => {
    expect(MC_TYPES).toHaveLength(13);
    expect(TABLE_TYPES).toHaveLength(4);
    expect([...MC_TYPES, ...TABLE_TYPES].sort()).toEqual([...ALL_QUESTION_TYPES].sort());
  });
});
