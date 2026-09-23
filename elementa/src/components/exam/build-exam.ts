import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ProgressState, Question, QuestionType } from '@/types';
import { generateQuestion, generateQuestions, isApplicable, questionSignature } from '@/utils/questions';
import { shuffle } from '@/utils/random';
import { adaptivePool, ALL_ATOMIC_NUMBERS } from '@/utils/selection';

/** Una parte de la mezcla de un examen: tipos de pregunta y su peso relativo. */
export interface ExamMixPart {
  types: readonly QuestionType[];
  weight: number;
}

export interface ExamSpec {
  title: string;
  count: number;
  mix: readonly ExamMixPart[];
  /** Elementos candidatos; por defecto los 118. */
  pool?: readonly number[];
}

/** Parte de los elementos que se elige por prioridad (débiles, pendientes…); el resto, al azar. */
const ADAPTIVE_SHARE = 0.7;
/** Tandas por nivel de candidatos antes de pasar al siguiente. */
const TIER_ATTEMPTS = 3;

/** Números atómicos válidos y sin repetir (los 118 si no queda ninguno). */
export function cleanPool(pool: readonly number[] | undefined): number[] {
  const valid = Array.from(new Set((pool ?? []).filter((z) => ELEMENTS_BY_NUMBER[z] !== undefined)));
  return valid.length > 0 ? valid : [...ALL_ATOMIC_NUMBERS];
}

/**
 * Reparte `count` preguntas según los pesos (método del mayor resto). La suma es exactamente
 * `count` si hay algún peso positivo.
 */
export function allocate(count: number, weights: readonly number[]): number[] {
  const n = Math.max(0, Math.floor(count));
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  if (sum === 0 || n === 0) return safe.map(() => 0);
  const exact = safe.map((w) => (w / sum) * n);
  const out = exact.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, rest: x - Math.floor(x) }))
    .filter(({ i }) => safe[i] > 0)
    .sort((a, b) => b.rest - a.rest || safe[b.i] - safe[a.i] || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i] += 1;
  return out;
}

/** Nº máximo de preguntas distintas (tipo + elemento) que admiten estos elementos y tipos. */
export function examCapacity(pool: readonly number[], types: readonly QuestionType[]): number {
  let total = 0;
  for (const z of new Set(pool)) {
    const el = ELEMENTS_BY_NUMBER[z];
    if (!el) continue;
    for (const type of new Set(types)) if (isApplicable(type, el)) total++;
  }
  return total;
}

/** Tipos distintos de toda la mezcla. */
export function mixTypes(mix: readonly ExamMixPart[]): QuestionType[] {
  return Array.from(new Set(mix.flatMap((part) => part.types)));
}

/**
 * Reordena para que no salga el mismo elemento dos veces seguidas (si se puede): en cada paso
 * toma, entre los elementos distintos del anterior, el que más preguntas tiene pendientes
 * (en empate, el primero: se conserva el orden aleatorio). No modifica el arreglo original.
 */
export function spreadByElement(questions: readonly Question[]): Question[] {
  const rest = [...questions];
  const pending = new Map<number, number>();
  for (const q of rest) pending.set(q.atomicNumber, (pending.get(q.atomicNumber) ?? 0) + 1);
  const out: Question[] = [];
  while (rest.length > 0) {
    const last = out.length > 0 ? out[out.length - 1].atomicNumber : null;
    let best = -1;
    for (let i = 0; i < rest.length; i++) {
      const z = rest[i].atomicNumber;
      if (z === last) continue;
      if (best < 0 || (pending.get(z) ?? 0) > (pending.get(rest[best].atomicNumber) ?? 0)) best = i;
    }
    const [q] = rest.splice(best < 0 ? 0 : best, 1);
    pending.set(q.atomicNumber, (pending.get(q.atomicNumber) ?? 1) - 1);
    out.push(q);
  }
  return out;
}

const keyOf = (type: QuestionType, z: number) => `${type}:${z}`;

/** Acumula preguntas sin repetir tipo + elemento ni enunciado. */
export class QuestionCollector {
  readonly questions: Question[] = [];
  readonly usedElements = new Set<number>();
  private readonly usedKeys = new Set<string>();
  private readonly signatures = new Set<string>();
  private readonly perElement = new Map<number, number>();

  has(type: QuestionType, z: number): boolean {
    return this.usedKeys.has(keyOf(type, z));
  }

  /** Nº de preguntas aceptadas sobre el elemento `z`. */
  countOf(z: number): number {
    return this.perElement.get(z) ?? 0;
  }

  /** Añade la pregunta si su tipo + elemento (y su enunciado) no estaban ya; devuelve si se añadió. */
  accept(q: Question): boolean {
    const key = keyOf(q.type, q.atomicNumber);
    const signature = questionSignature(q);
    if (this.usedKeys.has(key) || this.signatures.has(signature)) return false;
    this.usedKeys.add(key);
    this.signatures.add(signature);
    this.usedElements.add(q.atomicNumber);
    this.perElement.set(q.atomicNumber, this.countOf(q.atomicNumber) + 1);
    this.questions.push(q);
    return true;
  }

  get size(): number {
    return this.questions.length;
  }
}

/**
 * Completa hasta `need` preguntas recorriendo los elementos por turnos (uno de cada elemento por
 * vuelta, con tipos aún no usados; primero los que menos preguntas tienen), así los repetidos se
 * reparten. Devuelve cuántas faltaron.
 */
export function fillRoundRobin(
  collector: QuestionCollector,
  pool: readonly number[],
  types: readonly QuestionType[],
  need: number,
): number {
  const remaining = new Map<number, QuestionType[]>();
  for (const z of pool) remaining.set(z, shuffle(types.filter((t) => !collector.has(t, z))));
  let progress = true;
  while (need > 0 && progress) {
    progress = false;
    const turn = shuffle(pool).sort((a, b) => collector.countOf(a) - collector.countOf(b));
    for (const z of turn) {
      if (need === 0) break;
      const list = remaining.get(z) ?? [];
      while (list.length > 0) {
        const q = generateQuestion(list.shift() as QuestionType, z);
        if (q && collector.accept(q)) {
          need--;
          progress = true;
          break;
        }
      }
    }
  }
  return need;
}

/**
 * Genera las preguntas de un examen:
 * - Elementos: ~70 % elegidos por prioridad (fallos, repasos pendientes, nuevos) y el resto al azar,
 *   para que el examen se adapte a ti pero cubra toda la selección.
 * - Temas: cada parte de la mezcla recibe su cuota de preguntas.
 * - Sin repetir tipo + elemento, y sin repetir elemento mientras queden elementos libres.
 * Puede devolver menos de `count` si la selección no da para más (ver `examCapacity`).
 */
export function buildExam(spec: ExamSpec, state: ProgressState, now: Date): Question[] {
  const pool = cleanPool(spec.pool);
  const count = Math.max(0, Math.floor(spec.count));
  const mix = spec.mix.filter((part) => part.types.length > 0 && part.weight > 0);
  if (count === 0 || mix.length === 0) return [];

  const nAdaptive = Math.min(pool.length, Math.ceil(count * ADAPTIVE_SHARE));
  const adaptive = adaptivePool(state, now, nAdaptive, pool);
  const picked = new Set(adaptive);
  const coverage = shuffle(pool.filter((z) => !picked.has(z))).slice(0, Math.max(0, count - adaptive.length));
  const preferred = [...adaptive, ...coverage];
  const collector = new QuestionCollector();

  /** Añade hasta `need` preguntas de estos tipos; devuelve cuántas faltaron. */
  const fill = (types: readonly QuestionType[], need: number): number => {
    // 1) Elementos elegidos y 2) cualquier elemento libre: sin repetir elemento. Se piden de más
    // (y se reintenta) porque el colector descarta enunciados ya usados («Toca un elemento del grupo 18»).
    const tiers = [preferred, pool];
    for (const tier of tiers) {
      for (let attempt = 0; attempt < TIER_ATTEMPTS && need > 0; attempt++) {
        const candidates = tier.filter((z) => !collector.usedElements.has(z));
        if (candidates.length === 0) break;
        const batch = generateQuestions(
          { count: Math.min(need * 2 + 2, candidates.length), types: [...types], pool: candidates, adaptive: true },
          state,
          now,
        );
        if (batch.length === 0) break;
        for (const q of batch) {
          if (need === 0) break;
          // `generateQuestions` vuelve a empezar el pool si descarta alguna: sin repetir elemento aquí.
          if (!collector.usedElements.has(q.atomicNumber) && collector.accept(q)) need--;
        }
      }
    }
    // 3) Si la selección es pequeña: otros tipos sobre elementos ya preguntados.
    return need > 0 ? fillRoundRobin(collector, pool, types, need) : 0;
  };

  const quotas = allocate(count, mix.map((part) => part.weight));
  // Primero las partes más restrictivas (menos tipos), para que no se queden sin elementos.
  const order = mix
    .map((part, i) => ({ part, quota: quotas[i] }))
    .sort((a, b) => a.part.types.length - b.part.types.length);
  let missing = 0;
  for (const { part, quota } of order) {
    if (quota > 0) missing += fill(part.types, quota);
  }
  if (missing > 0) fill(mixTypes(mix), missing);

  return spreadByElement(shuffle(collector.questions)).slice(0, count);
}
