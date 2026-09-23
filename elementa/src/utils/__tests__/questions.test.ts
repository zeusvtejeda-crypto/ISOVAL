import { beforeAll, describe, expect, it } from 'vitest';
import { CATEGORIES, metallicCharacter } from '@/data/categories';
import { ELEMENTS, ELEMENTS_BY_SYMBOL, getElement } from '@/data/elements';
import type { ChemicalElement, Question, QuestionType } from '@/types';
import { elementPhaseLabel, formatMass, normalizeText } from '@/utils/format';
import { ALT_CATEGORIES } from '@/utils/question-gen/facts';
import { enDistractors, propertyQuestion, propertyVariants } from '@/utils/question-gen/property';
import {
  ALL_QUESTION_TYPES,
  answerAttribution,
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
      expect(ALT_CATEGORIES[el.atomicNumber] ?? [], where).toEqual([]);
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
      // Grupo 3: La, Lu, Ac y Lr (bloque f en la app) también se aceptan por convención.
      const alternates = el.group === 3 ? [57, 71, 89, 103] : [];
      expect(targets, where).toContain(el.atomicNumber);
      for (const z of targets) {
        if (!alternates.includes(z)) expect(getElement(z).group, where).toBe(el.group);
      }
      expect(targets.length, where).toBe(ELEMENTS.filter((e) => e.group === el.group).length + alternates.length);
      break;
    }
    case 'table-select-category': {
      const targets = q.targetAtomicNumbers ?? [];
      const optional = q.optionalAtomicNumbers ?? [];
      const required = targets.filter((z) => !optional.includes(z));
      // Solo las familias sin grupo propio tienen frontera discutida (casillas opcionales).
      const contested = el.category === 'metalloid' || el.category === 'nonmetal';
      if (!contested) expect(optional, where).toEqual([]);
      for (const z of optional) expect(targets, where).toContain(z);
      for (const z of required) {
        expect(getElement(z).category, where).toBe(el.category);
        if (contested) expect(ALT_CATEGORIES[z] ?? [], where).toEqual([]);
      }
      for (const m of ELEMENTS.filter((e) => e.category === el.category)) expect(targets, where).toContain(m.atomicNumber);
      expect(checkTableAnswer(q, required), where).toBe(true);
      expect(checkTableAnswer(q, targets), where).toBe(true);
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

  it('nunca pregunta el grupo del bloque f ni la fase desconocida o predicha', () => {
    for (const el of ELEMENTS.filter((e) => e.group === null)) {
      expect(isApplicable('element-to-group', el)).toBe(false);
      expect(isApplicable('table-group-member', el)).toBe(false);
      expect(isApplicable('location', el)).toBe(false);
    }
    for (const el of ELEMENTS.filter((e) => e.phase === 'unknown' || e.phasePredicted)) {
      expect(isApplicable('element-to-phase', el)).toBe(false);
    }
    expect(ELEMENTS.filter((e) => e.phasePredicted).map((e) => e.atomicNumber)).toEqual([85, 87]);
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

  it('metaloides: acepta la selección con y sin el Po (y con los dudosos Se, At y Ts)', () => {
    const metalloids = [5, 14, 32, 33, 51, 52];
    for (const z of [5, 84]) {
      const q = generateQuestion('table-select-category', z) as Question;
      expect(q.prompt).toBe('Selecciona todos los metaloides.');
      expect([...(q.optionalAtomicNumbers ?? [])].sort((a, b) => a - b)).toEqual([34, 84, 85, 117]);
      expect(checkTableAnswer(q, metalloids)).toBe(true);
      expect(checkTableAnswer(q, [...metalloids, 84])).toBe(true);
      expect(checkTableAnswer(q, [84, ...metalloids, 84])).toBe(true);
      expect(checkTableAnswer(q, [...metalloids, 84, 34, 85, 117])).toBe(true);
      expect(checkTableAnswer(q, metalloids.slice(1))).toBe(false);
      expect(checkTableAnswer(q, [...metalloids.slice(1), 84])).toBe(false);
      expect(checkTableAnswer(q, [...metalloids, 83])).toBe(false);
      expect(q.correctAnswer).toBe('B, Si, Ge, As, Sb, Te (también valen Se, Po, At, Ts)');
      expect(q.explanation).toContain('El Po a veces se clasifica como metal postransición');
      expect(q.explanation).toContain('el Se, el At y el Ts a veces se consideran metaloides');
      expect(q.explanation).toContain('vale marcarlos o no');
    }
  });

  it('no metales: el Se se acepta marcado o sin marcar', () => {
    const nonmetals = [1, 6, 7, 8, 15, 16];
    const q = generateQuestion('table-select-category', 6) as Question;
    expect(q.optionalAtomicNumbers).toEqual([34]);
    expect(checkTableAnswer(q, nonmetals)).toBe(true);
    expect(checkTableAnswer(q, [...nonmetals, 34])).toBe(true);
    expect(checkTableAnswer(q, [...nonmetals, 9])).toBe(false);
    expect(checkTableAnswer(q, nonmetals.slice(1))).toBe(false);
    expect(q.correctAnswer).toBe('H, C, N, O, P, S (también vale Se)');
    expect(q.explanation).toContain('El Se a veces se clasifica como metaloide: vale marcarlo o no.');
  });

  it('las familias con grupo propio no tienen casillas opcionales', () => {
    for (const z of [2, 3, 4, 9]) expect(generateQuestion('table-select-category', z)?.optionalAtomicNumbers).toBeUndefined();
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

describe('answerAttribution', () => {
  it('opción múltiple y casilla única: el elemento de la pregunta', () => {
    const mc = generateQuestion('symbol-to-name', 8) as Question;
    expect(answerAttribution(mc, 'a')).toEqual({ atomicNumber: 8, trackElement: true });
    const find = generateQuestion('table-find-element', 26) as Question;
    expect(answerAttribution(find, [27])).toEqual({ atomicNumber: 26, trackElement: true });
    const num = generateQuestion('table-find-number', 79) as Question;
    expect(answerAttribution(num, [79])).toEqual({ atomicNumber: 79, trackElement: true });
  });

  it('miembro del grupo: el elemento tocado (acierto o fallo)', () => {
    const q = generateQuestion('table-group-member', 87) as Question;
    expect(answerAttribution(q, [11])).toEqual({ atomicNumber: 11, trackElement: true });
    expect(answerAttribution(q, [11, 11])).toEqual({ atomicNumber: 11, trackElement: true });
    expect(answerAttribution(q, [12])).toEqual({ atomicNumber: 12, trackElement: true });
    expect(answerAttribution(q, [])).toEqual({ atomicNumber: 87, trackElement: false });
    expect(answerAttribution(q, [3, 11])).toEqual({ atomicNumber: 87, trackElement: false });
    expect(answerAttribution(q, [999])).toEqual({ atomicNumber: 87, trackElement: false });
    expect(answerAttribution(q, '—')).toEqual({ atomicNumber: 87, trackElement: false });
  });

  it('familia: el primer obligatorio que faltó, si no el primer error, sin seguimiento por elemento', () => {
    const nobles = generateQuestion('table-select-category', 54) as Question;
    const all = [2, 10, 18, 36, 54, 86, 118];
    expect(answerAttribution(nobles, [2, 18, 36, 54, 86, 118, 1])).toEqual({ atomicNumber: 10, trackElement: false });
    expect(answerAttribution(nobles, [...all, 9, 1])).toEqual({ atomicNumber: 9, trackElement: false });
    expect(answerAttribution(nobles, all)).toEqual({ atomicNumber: 54, trackElement: false });

    const metalloids = generateQuestion('table-select-category', 84) as Question;
    // El Po es opcional: no cuenta como "faltó".
    expect(answerAttribution(metalloids, [14, 32, 33, 51, 52])).toEqual({ atomicNumber: 5, trackElement: false });
    expect(answerAttribution(metalloids, [5, 14, 32, 33, 51, 52])).toEqual({ atomicNumber: 84, trackElement: false });
    expect(answerAttribution(metalloids, [5, 14, 32, 33, 51, 52, 83])).toEqual({ atomicNumber: 83, trackElement: false });
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

/** Tabla abreviada de pesos atómicos estándar (CIAAW, Atomic Weights 2021, rev. 2024), tal como se imprime. */
const CIAAW_ABRIDGED: Record<string, string> = {
  H: '1.0080', He: '4.0026', Li: '6.94', Be: '9.0122', B: '10.81', C: '12.011', N: '14.007', O: '15.999',
  F: '18.998', Ne: '20.180', Na: '22.990', Mg: '24.305', Al: '26.982', Si: '28.085', P: '30.974', S: '32.06',
  Cl: '35.45', Ar: '39.95', K: '39.098', Ca: '40.078', Sc: '44.956', Ti: '47.867', V: '50.942', Cr: '51.996',
  Mn: '54.938', Fe: '55.845', Co: '58.933', Ni: '58.693', Cu: '63.546', Zn: '65.38', Ga: '69.723',
  Ge: '72.630', As: '74.922', Se: '78.971', Br: '79.904', Kr: '83.798', Rb: '85.468', Sr: '87.62', Y: '88.906',
  Zr: '91.222', Nb: '92.906', Mo: '95.95', Ru: '101.07', Rh: '102.91', Pd: '106.42', Ag: '107.87',
  Cd: '112.41', In: '114.82', Sn: '118.71', Sb: '121.76', Te: '127.60', I: '126.90', Xe: '131.29',
  Cs: '132.91', Ba: '137.33', La: '138.91', Ce: '140.12', Pr: '140.91', Nd: '144.24', Sm: '150.36',
  Eu: '151.96', Gd: '157.25', Tb: '158.93', Dy: '162.50', Ho: '164.93', Er: '167.26', Tm: '168.93',
  Yb: '173.05', Lu: '174.97', Hf: '178.49', Ta: '180.95', W: '183.84', Re: '186.21', Os: '190.23',
  Ir: '192.22', Pt: '195.08', Au: '196.97', Hg: '200.59', Tl: '204.38', Pb: '207.2', Bi: '208.98',
  Th: '232.04', Pa: '231.04', U: '238.03',
};

describe('masas atómicas', () => {
  it('formatMass imprime la precisión de la tabla abreviada de la CIAAW', () => {
    const standard = ELEMENTS.filter((e) => !e.massIsMassNumber);
    expect(standard.map((e) => e.symbol).sort()).toEqual(Object.keys(CIAAW_ABRIDGED).sort());
    for (const el of standard) expect(formatMass(el), el.symbol).toBe(CIAAW_ABRIDGED[el.symbol]);
    expect(formatMass(getElement(43))).toBe('[97]');
    expect(formatMass(getElement(108))).toBe('[269]');
  });

  it('las opciones de masa usan el mismo formato', () => {
    for (let i = 0; i < 10; i++) {
      const q = generateQuestion('element-to-mass', 1) as Question;
      expect(q.correctAnswer).toBe('1.0080');
      expect(q.explanation).toContain('1.0080 u');
    }
  });
});

const SWEEP_RUNS = 20;

describe(`barrido: ninguna pregunta ambigua (todos los tipos × elementos × ${SWEEP_RUNS})`, () => {
  const generated = new Map<QuestionType, Array<{ el: ChemicalElement; q: Question }>>();
  const of = (type: QuestionType) => generated.get(type) ?? [];
  const wrongOptions = (q: Question) => (q.options ?? []).filter((o) => !o.correct);

  beforeAll(() => {
    for (const type of ALL_QUESTION_TYPES) {
      const list: Array<{ el: ChemicalElement; q: Question }> = [];
      for (const el of ELEMENTS) {
        if (!isApplicable(type, el)) continue;
        for (let i = 0; i < SWEEP_RUNS; i++) {
          const q = generateQuestion(type, el.atomicNumber);
          if (q) list.push({ el, q });
        }
      }
      generated.set(type, list);
    }
  });

  it('genera todas las combinaciones aplicables', () => {
    for (const type of ALL_QUESTION_TYPES) {
      const applicable = ELEMENTS.filter((el) => isApplicable(type, el)).length;
      expect(of(type).length, type).toBe(applicable * SWEEP_RUNS);
    }
  });

  it('familia: halógenos y gases nobles nunca ofrecen «No metal»; el bloque f, nunca «Metal de transición»', () => {
    const nonmetal = CATEGORIES.nonmetal.singular;
    const transition = CATEGORIES['transition-metal'].singular;
    for (const { el, q } of of('element-to-category')) {
      const labels = wrongOptions(q).map((o) => o.label);
      const where = `${el.symbol}: ${labels.join(' | ')}`;
      if (el.category === 'halogen' || el.category === 'noble-gas') expect(labels, where).not.toContain(nonmetal);
      if (el.category === 'lanthanide' || el.category === 'actinide') expect(labels, where).not.toContain(transition);
      for (const alt of ALT_CATEGORIES[el.atomicNumber] ?? []) expect(labels, where).not.toContain(CATEGORIES[alt].singular);
    }
  });

  it('clasificación: ningún distractor pertenece a la familia pedida en ningún sentido', () => {
    for (const { el, q } of of('classification')) {
      expect(ALT_CATEGORIES[el.atomicNumber] ?? [], el.symbol).toEqual([]);
      for (const o of wrongOptions(q)) {
        const d = getElement(o.atomicNumber as number);
        const where = `${q.prompt} ${el.symbol} vs ${d.symbol}`;
        expect(d.category, where).not.toBe(el.category);
        expect(ALT_CATEGORIES[d.atomicNumber] ?? [], where).not.toContain(el.category);
        if (el.category === 'nonmetal') expect(metallicCharacter(d.category), where).not.toBe('nonmetal');
        if (el.category === 'transition-metal') expect(['lanthanide', 'actinide'], where).not.toContain(d.category);
      }
    }
    for (const z of Object.keys(ALT_CATEGORIES).map(Number)) {
      expect(isApplicable('classification', getElement(z))).toBe(false);
      expect(generateQuestion('classification', z)).toBeNull();
    }
  });

  it('bloque: nunca se pregunta el de La, Lu, Ac y Lr', () => {
    const contested = [57, 71, 89, 103];
    for (const { el, q } of of('property')) {
      if (q.correctAnswer.startsWith('Bloque ')) expect(contested, el.symbol).not.toContain(el.atomicNumber);
    }
    for (const z of contested) {
      const el = getElement(z);
      expect(propertyVariants(el)).not.toContain('block');
      for (let i = 0; i < SWEEP_RUNS; i++) {
        expect(propertyQuestion(el, 'block')?.correctAnswer, el.symbol).not.toMatch(/^Bloque/);
      }
    }
    expect(propertyVariants(getElement(58))).toContain('block');
  });

  it('electronegatividad: ningún distractor está encima o a la derecha de la respuesta', () => {
    const aboveOrRight = (d: ChemicalElement, el: ChemicalElement) =>
      d.group !== null && el.group !== null && d.period <= el.period && d.group >= el.group;
    let asked = 0;
    for (const { el, q } of of('property')) {
      if (!q.prompt.includes('electronegativo')) continue;
      asked++;
      expect(q.explanation).toContain('En general aumenta hacia arriba y a la derecha de la tabla');
      for (const o of wrongOptions(q)) {
        const d = getElement(o.atomicNumber as number);
        expect(aboveOrRight(d, el), `${el.symbol} (${el.electronegativity}) vs ${d.symbol} (${d.electronegativity})`).toBe(false);
      }
    }
    expect(asked).toBeGreaterThan(0);
    for (const el of ELEMENTS) {
      const distractors = enDistractors(el);
      for (const d of distractors) expect(aboveOrRight(d, el), `${el.symbol} vs ${d.symbol}`).toBe(false);
      if (distractors.length < 3) expect(propertyVariants(el), el.symbol).not.toContain('electronegativity');
    }
    // Plomo: el Si, el Ge y el Sn están encima y son menos electronegativos.
    expect(enDistractors(getElement(82)).map((e) => e.symbol)).not.toEqual(expect.arrayContaining(['Si']));
    for (const z of [14, 32, 50]) expect(enDistractors(getElement(82)).map((e) => e.atomicNumber)).not.toContain(z);
  });

  it('estado: nunca se pregunta el del astato ni el del francio, ni se usan como distractores de estado', () => {
    for (const z of [85, 87]) {
      expect(elementPhaseLabel(getElement(z))).toBe('Sólido (predicho)');
      expect(generateQuestion('element-to-phase', z)).toBeNull();
      expect(of('element-to-phase').some(({ el }) => el.atomicNumber === z)).toBe(false);
    }
    for (const { q } of of('property')) {
      if (!q.prompt.includes('líquido') && !q.prompt.includes('gas')) continue;
      for (const o of wrongOptions(q)) expect([85, 87], q.prompt).not.toContain(o.atomicNumber);
    }
    for (const { el, q } of [...of('element-to-phase'), ...of('property')]) {
      if (el.phase === 'gas' && q.explanation.includes('gaseosos')) {
        expect(q.explanation).toContain('los gases nobles (del oganesón aún no se sabe)');
      }
    }
  });

  it('selección de familia: acepta los obligatorios con y sin los opcionales', () => {
    for (const { el, q } of of('table-select-category')) {
      const targets = q.targetAtomicNumbers ?? [];
      const optional = q.optionalAtomicNumbers ?? [];
      const required = targets.filter((z) => !optional.includes(z));
      expect(checkTableAnswer(q, required), el.symbol).toBe(true);
      expect(checkTableAnswer(q, targets), el.symbol).toBe(true);
      if (required.length > 1) expect(checkTableAnswer(q, required.slice(1)), el.symbol).toBe(false);
    }
  });
});
