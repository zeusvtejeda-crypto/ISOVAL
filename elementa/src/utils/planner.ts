import { ELEMENTS } from '@/data/elements';
import type { ProgressState, Question, QuestionType } from '@/types';
import { generateQuestion } from './questions';
import { pick, shuffle } from './random';
import {
  adaptivePool,
  ALL_ATOMIC_NUMBERS,
  difficultElements,
  dueReviews,
  elementPriority,
  newElements,
  weakElements,
} from './selection';

// Las listas de selección viven en `selection.ts` (sin generadores de preguntas); se re-exportan
// aquí para no romper los imports existentes.
export { adaptivePool, difficultElements, dueReviews, elementPriority, newElements, weakElements };
export type { DifficultElement } from './selection';

export interface StudyPlan {
  newElements: number[];
  reviews: number[];
  hard: number[];
  questions: Question[];
  estimatedMinutes: number;
}

export interface StudyPlanOptions {
  newCount?: number;
  reviewCount?: number;
  hardCount?: number;
}

/** Segundos estimados por pregunta (lectura + respuesta + feedback). */
const SECONDS_PER_QUESTION = 15;
/** Mínimo de preguntas para que una sesión valga la pena. */
const MIN_SESSION_QUESTIONS = 8;

/** Tipos amables para presentar un elemento recién aprendido. */
const NEW_TYPES: QuestionType[] = ['name-to-symbol', 'symbol-to-name', 'element-to-number', 'table-find-element'];
/** Tipos variados para repasos. */
const REVIEW_TYPES: QuestionType[] = [
  'name-to-symbol',
  'symbol-to-name',
  'number-to-element',
  'element-to-number',
  'element-to-category',
  'element-to-group',
  'element-to-period',
  'location',
  'classification',
  'property',
  'table-find-element',
];
/** Para elementos difíciles: primero lo esencial (símbolo y número). */
const HARD_TYPES: QuestionType[] = ['name-to-symbol', 'symbol-to-name', 'element-to-number', 'number-to-element'];

/** Aprendidos más recientemente (para completar sesiones de usuarios nuevos). */
function recentlyLearned(state: ProgressState, exclude: Set<number>, n: number): number[] {
  return Object.values(state.elements)
    .filter((p) => p.learned && !exclude.has(p.atomicNumber))
    .sort((a, b) => Date.parse(b.learnedAt ?? '') - Date.parse(a.learnedAt ?? '') || a.atomicNumber - b.atomicNumber)
    .slice(0, n)
    .map((p) => p.atomicNumber);
}

function questionsFor(z: number, types: QuestionType[], n: number, used: Set<string>): Question[] {
  const out: Question[] = [];
  for (const type of shuffle(types)) {
    if (out.length >= n) break;
    if (used.has(`${type}:${z}`)) continue;
    const q = generateQuestion(type, z);
    if (!q) continue;
    used.add(`${type}:${z}`);
    out.push(q);
  }
  return out;
}

/** Baraja evitando que el mismo elemento salga dos veces seguidas cuando sea posible. */
function spreadOut(questions: Question[]): Question[] {
  const remaining = shuffle(questions);
  const out: Question[] = [];
  while (remaining.length > 0) {
    const prev = out.length > 0 ? out[out.length - 1].atomicNumber : null;
    const idx = Math.max(0, remaining.findIndex((q) => q.atomicNumber !== prev));
    out.push(remaining.splice(idx, 1)[0]);
  }
  return out;
}

/**
 * Sesión inteligente (§25/§26): difíciles + repasos pendientes + elementos nuevos, UNA pregunta por
 * elemento planificado (los nuevos ya ven su ficha antes del quiz en `/estudiar`). Con 5 nuevos,
 * 10 repasos y 5 difíciles son 20 preguntas, ~5 minutos.
 * - `hard`: primero, de `difficultElements` (fallados alguna vez y sin dominar; menor dominio y más
 *   fallos primero). Nunca incluye elementos sin fallos: si hay menos que `hardCount`, queda corto.
 * - `reviews`: repasos que ya tocan (`dueReviews`) que no estén en `hard`; los huecos que queden se
 *   completan con elementos intentados aún sin dominar (p. ej. acertados pero lentos).
 * - `newElements`: no aprendidos, en orden atómico.
 * Nunca queda vacía: si hay menos de `MIN_SESSION_QUESTIONS` preguntas se completa con elementos
 * aprendidos recientemente y una selección adaptativa.
 */
export function planStudySession(state: ProgressState, now: Date, opts: StudyPlanOptions = {}): StudyPlan {
  const newCount = Math.max(0, opts.newCount ?? 5);
  const reviewCount = Math.max(0, opts.reviewCount ?? 10);
  const hardCount = Math.max(0, opts.hardCount ?? 5);

  const hard = difficultElements(state, now, hardCount).map((d) => d.atomicNumber);
  const taken = new Set(hard);

  const reviews = dueReviews(state, now, reviewCount + taken.size)
    .filter((z) => !taken.has(z))
    .slice(0, reviewCount);
  reviews.forEach((z) => taken.add(z));
  if (reviews.length < reviewCount) {
    for (const { atomicNumber: z } of weakElements(state, now, reviewCount + taken.size)) {
      if (reviews.length >= reviewCount) break;
      if (taken.has(z)) continue;
      reviews.push(z);
      taken.add(z);
    }
  }

  const newEls = newElements(state, newCount + taken.size)
    .filter((z) => !taken.has(z))
    .slice(0, newCount);
  newEls.forEach((z) => taken.add(z));

  const used = new Set<string>();
  const questions: Question[] = [];
  for (const z of newEls) questions.push(...questionsFor(z, NEW_TYPES, 1, used));
  for (const z of reviews) questions.push(...questionsFor(z, REVIEW_TYPES, 1, used));
  for (const z of hard) questions.push(...questionsFor(z, HARD_TYPES, 1, used));

  // Completar sesiones cortas con recientes y, si hace falta, con una selección adaptativa.
  if (questions.length < MIN_SESSION_QUESTIONS) {
    const recent = recentlyLearned(state, taken, MIN_SESSION_QUESTIONS);
    const adaptive = adaptivePool(
      state,
      now,
      MIN_SESSION_QUESTIONS,
      ALL_ATOMIC_NUMBERS.filter((z) => !taken.has(z) && !recent.includes(z)),
    );
    for (const z of [...recent, ...adaptive]) {
      if (questions.length >= MIN_SESSION_QUESTIONS) break;
      questions.push(...questionsFor(z, REVIEW_TYPES, 1, used));
    }
  }
  if (questions.length === 0) {
    const q = generateQuestion('symbol-to-name', pick(ELEMENTS).atomicNumber);
    if (q) questions.push(q);
  }

  return {
    newElements: newEls,
    reviews,
    hard,
    questions: spreadOut(questions),
    estimatedMinutes: Math.max(1, Math.ceil((questions.length * SECONDS_PER_QUESTION) / 60)),
  };
}
