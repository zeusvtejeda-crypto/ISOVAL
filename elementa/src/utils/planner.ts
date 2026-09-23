import { ELEMENTS } from '@/data/elements';
import type { ProgressState, Question, QuestionType } from '@/types';
import { computeMastery, MASTERED_THRESHOLD } from './mastery';
import { generateQuestion } from './questions';
import { pick, shuffle } from './random';
import { adaptivePool, ALL_ATOMIC_NUMBERS, elementPriority } from './selection';
import { isDue } from './srs';

export { adaptivePool, elementPriority };

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

/** Elementos intentados que aún no se dominan, del menor dominio al mayor. */
export function weakElements(
  state: ProgressState,
  now: Date,
  limit = 10,
): Array<{ atomicNumber: number; mastery: number }> {
  return Object.values(state.elements)
    .filter((p) => p.correct + p.incorrect > 0)
    .map((p) => ({ atomicNumber: p.atomicNumber, mastery: computeMastery(p, now), incorrect: p.incorrect }))
    .filter((x) => x.mastery < MASTERED_THRESHOLD)
    .sort((a, b) => a.mastery - b.mastery || b.incorrect - a.incorrect || a.atomicNumber - b.atomicNumber)
    .slice(0, limit)
    .map(({ atomicNumber, mastery }) => ({ atomicNumber, mastery }));
}

/** Elementos cuyo repaso ya toca, los más atrasados primero. */
export function dueReviews(state: ProgressState, now: Date, n: number): number[] {
  return Object.values(state.elements)
    .filter((p) => isDue(p, now))
    .sort((a, b) => Date.parse(a.due as string) - Date.parse(b.due as string))
    .slice(0, Math.max(0, n))
    .map((p) => p.atomicNumber);
}

/** Elementos aún no aprendidos, en orden atómico (limitado al `pool` si se da). */
export function newElements(state: ProgressState, n: number, pool?: number[]): number[] {
  const src = pool && pool.length > 0 ? [...pool].sort((a, b) => a - b) : ALL_ATOMIC_NUMBERS;
  return src.filter((z) => !state.elements[z]?.learned).slice(0, Math.max(0, n));
}

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
 * Sesión inteligente: elementos nuevos + repasos pendientes + difíciles.
 * Nunca queda vacía: si faltan repasos/difíciles se completa con nuevos, recientes o una
 * selección adaptativa.
 */
export function planStudySession(state: ProgressState, now: Date, opts: StudyPlanOptions = {}): StudyPlan {
  const newCount = opts.newCount ?? 5;
  const reviewCount = opts.reviewCount ?? 10;
  const hardCount = opts.hardCount ?? 5;

  const reviews = dueReviews(state, now, reviewCount);
  const taken = new Set(reviews);
  const hard = weakElements(state, now, hardCount + reviews.length)
    .map((w) => w.atomicNumber)
    .filter((z) => !taken.has(z))
    .slice(0, hardCount);
  hard.forEach((z) => taken.add(z));

  const newEls = newElements(state, newCount + taken.size)
    .filter((z) => !taken.has(z))
    .slice(0, newCount);
  newEls.forEach((z) => taken.add(z));

  const used = new Set<string>();
  const questions: Question[] = [];
  for (const z of newEls) questions.push(...questionsFor(z, NEW_TYPES, 2, used));
  for (const z of reviews) questions.push(...questionsFor(z, REVIEW_TYPES, 1, used));
  for (const z of hard) questions.push(...questionsFor(z, HARD_TYPES, 2, used));

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
