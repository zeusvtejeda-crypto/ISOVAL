import type { ExperienceLevel, Question, QuestionType } from '@/types';
import { generateQuestions, MC_TYPES } from '@/utils/questions';
import { ALL_ATOMIC_NUMBERS } from '@/utils/selection';

/** Preguntas del diagnóstico de la bienvenida. */
export const DIAGNOSTIC_LENGTH = 10;

type Difficulty = 1 | 2 | 3;

export interface DiagnosticProfile {
  /** Elementos candidatos (número atómico). */
  pool: readonly number[];
  /** Tipos de pregunta permitidos (opción múltiple: rápidas de responder en cualquier pantalla). */
  types: readonly QuestionType[];
  /** Tipos que deben salir al menos una vez. */
  required: readonly QuestionType[];
  maxDifficulty: Difficulty;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Famosos fuera de los 20 primeros: Fe, Cu, Zn, Ag, Sn, I, Au, Hg, Pb, U. */
const FAMOUS = [26, 29, 30, 47, 50, 53, 79, 80, 82, 92];

/** Tipos básicos para completar si un perfil no diera para 10 preguntas. */
const FALLBACK_TYPES: readonly QuestionType[] = ['name-to-symbol', 'symbol-to-name'];

/**
 * La dificultad del diagnóstico escala con la experiencia declarada:
 * - Empezando: Z ≤ 20 y preguntas sencillas (símbolo, número, estado).
 * - Algunos: Z ≤ 36 + famosos, con familias.
 * - Química: tabla principal hasta el Rn (+ U), con grupos, periodos, familias, ubicación y propiedades.
 * - Dominarla: los 118 y todos los tipos, incluidas masa atómica y configuración electrónica.
 */
export const DIAGNOSTIC_PROFILES: Record<ExperienceLevel, DiagnosticProfile> = {
  beginner: {
    pool: range(1, 20),
    types: ['name-to-symbol', 'symbol-to-name', 'element-to-phase', 'number-to-element'],
    required: [],
    maxDifficulty: 1,
  },
  some: {
    pool: Array.from(new Set([...range(1, 36), ...FAMOUS])),
    types: [
      'name-to-symbol',
      'symbol-to-name',
      'element-to-number',
      'number-to-element',
      'element-to-phase',
      'element-to-category',
    ],
    required: ['element-to-category'],
    maxDifficulty: 2,
  },
  chemistry: {
    pool: [...range(1, 56), ...range(72, 86), 92],
    types: [
      'name-to-symbol',
      'symbol-to-name',
      'element-to-number',
      'element-to-group',
      'element-to-period',
      'element-to-category',
      'classification',
      'location',
      'property',
    ],
    required: ['element-to-group', 'classification'],
    maxDifficulty: 3,
  },
  master: {
    pool: ALL_ATOMIC_NUMBERS,
    types: MC_TYPES,
    required: ['element-to-mass', 'element-to-configuration'],
    maxDifficulty: 3,
  },
};

/**
 * Genera el diagnóstico (llamar en el cliente: usa aleatoriedad). Sin repetir elemento, con los
 * tipos obligatorios del perfil y ordenado de fácil a difícil.
 */
export function buildDiagnostic(experience: ExperienceLevel, count: number = DIAGNOSTIC_LENGTH): Question[] {
  const profile = DIAGNOSTIC_PROFILES[experience];
  const out: Question[] = [];
  const usedElements = new Set<number>();
  const freePool = () => profile.pool.filter((z) => !usedElements.has(z));

  const take = (questions: Question[]) => {
    for (const q of questions) {
      if (out.length >= count) return;
      if (usedElements.has(q.atomicNumber)) continue;
      usedElements.add(q.atomicNumber);
      out.push(q);
    }
  };

  const generate = (types: readonly QuestionType[], n: number, maxDifficulty: Difficulty) =>
    generateQuestions({ count: n, types: [...types], pool: freePool(), adaptive: false, maxDifficulty });

  for (const type of profile.required) take(generate([type], 1, profile.maxDifficulty));
  take(generate(profile.types, count - out.length, profile.maxDifficulty));
  if (out.length < count) take(generate(FALLBACK_TYPES, count - out.length, 3));

  return out
    .map((question, i) => ({ question, i }))
    .sort((a, b) => a.question.difficulty - b.question.difficulty || a.i - b.i)
    .map(({ question }) => question);
}

/** Números atómicos (sin repetir) de las respuestas acertadas / falladas. */
export function splitByResult(answered: readonly { question: Question; correct: boolean }[]): {
  known: number[];
  toLearn: number[];
} {
  const known: number[] = [];
  const toLearn: number[] = [];
  for (const a of answered) {
    const z = a.question.atomicNumber;
    if (a.correct) {
      if (!known.includes(z)) known.push(z);
    } else if (!toLearn.includes(z)) {
      toLearn.push(z);
    }
  }
  return { known, toLearn: toLearn.filter((z) => !known.includes(z)) };
}
