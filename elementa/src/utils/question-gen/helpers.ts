import { ELEMENTS, ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { ChemicalElement, Question, QuestionOption, QuestionType } from '@/types';
import type { Difficulty } from '../difficulty';
import { normalizeText } from '../format';
import { randomInt, shuffle, uid } from '../random';
import { QUESTION_TYPE_META } from './meta';

export const OPTION_IDS = ['a', 'b', 'c', 'd'] as const;

export interface OptionSpec {
  label: string;
  sublabel?: string;
  atomicNumber?: number;
}

export interface MultipleChoiceSpec {
  type: QuestionType;
  el: ChemicalElement;
  prompt: string;
  subject?: string;
  correct: OptionSpec;
  /** Distractores candidatos en orden de preferencia; se toman los 3 primeros válidos y únicos. */
  candidates: OptionSpec[];
  explanation: string;
  difficulty: Difficulty;
}

/** Arma una pregunta de 4 opciones únicas con una sola correcta, o `null` si no hay distractores suficientes. */
export function buildMultipleChoice(spec: MultipleChoiceSpec): Question | null {
  const correctKey = normalizeText(spec.correct.label);
  if (!correctKey) return null;
  const used = new Set([correctKey]);
  const distractors: OptionSpec[] = [];
  for (const c of spec.candidates) {
    if (distractors.length === 3) break;
    const key = normalizeText(c.label);
    if (!key || used.has(key)) continue;
    if (c.atomicNumber !== undefined && c.atomicNumber === spec.correct.atomicNumber) continue;
    used.add(key);
    distractors.push(c);
  }
  if (distractors.length < 3) return null;

  const options: QuestionOption[] = shuffle([
    { ...spec.correct, correct: true },
    ...distractors.map((d) => ({ ...d, correct: false })),
  ]).map((o, i) => {
    const option: QuestionOption = { id: OPTION_IDS[i], label: o.label, correct: o.correct };
    if (o.sublabel) option.sublabel = o.sublabel;
    if (o.atomicNumber !== undefined) option.atomicNumber = o.atomicNumber;
    return option;
  });

  const question: Question = {
    id: uid(),
    kind: 'multiple-choice',
    type: spec.type,
    skill: QUESTION_TYPE_META[spec.type].skill,
    atomicNumber: spec.el.atomicNumber,
    prompt: spec.prompt,
    options,
    correctAnswer: spec.correct.label,
    explanation: spec.explanation,
    difficulty: spec.difficulty,
  };
  if (spec.subject) question.subject = spec.subject;
  return question;
}

// ---------- Artículos ("el Sodio", "la Plata") ----------

/** Único nombre de elemento femenino en español. */
const FEMININE = new Set([47]);

/** "el Sodio" / "la Plata". */
export function withArticle(el: ChemicalElement): string {
  return `${FEMININE.has(el.atomicNumber) ? 'la' : 'el'} ${el.name}`;
}

/** "El Sodio" / "La Plata" (inicio de frase). */
export function withArticleCap(el: ChemicalElement): string {
  const s = withArticle(el);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "del Sodio" / "de la Plata". */
export function ofElement(el: ChemicalElement): string {
  return FEMININE.has(el.atomicNumber) ? `de la ${el.name}` : `del ${el.name}`;
}

/** "al Sodio" / "a la Plata". */
export function toElement(el: ChemicalElement): string {
  return FEMININE.has(el.atomicNumber) ? `a la ${el.name}` : `al ${el.name}`;
}

// ---------- Candidatos ----------

export function elementOption(el: ChemicalElement, withSymbol = true): OptionSpec {
  return withSymbol
    ? { label: el.name, sublabel: el.symbol, atomicNumber: el.atomicNumber }
    : { label: el.name, atomicNumber: el.atomicNumber };
}

/** Elementos a distancia |Δz| = 1..maxOffset, más cercanos primero (barajados por anillo). */
export function nearbyElements(z: number, maxOffset: number): ChemicalElement[] {
  const out: ChemicalElement[] = [];
  for (let d = 1; d <= maxOffset; d++) {
    const ring = [ELEMENTS_BY_NUMBER[z - d], ELEMENTS_BY_NUMBER[z + d]].filter(
      (e): e is ChemicalElement => e !== undefined,
    );
    out.push(...shuffle(ring));
  }
  return out;
}

/** Valores enteros cercanos a `value` dentro de [min, max], más cercanos primero (barajados por anillo). */
export function nearbyValues(value: number, min: number, max: number, maxOffset: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= maxOffset; d++) {
    out.push(...shuffle([value - d, value + d].filter((v) => v >= min && v <= max)));
  }
  return out;
}

/**
 * Los otros `size − 1` valores de una ventana contigua de tamaño `size` que contiene `value`,
 * colocada al azar dentro de [min, max]. Así la respuesta correcta puede quedar en cualquier
 * posición (no siempre "en medio" de los distractores).
 */
export function windowValues(value: number, min: number, max: number, size = 4): number[] {
  const span = Math.min(size, max - min + 1);
  const lowest = Math.max(min, value - span + 1);
  const highest = Math.min(value, max - span + 1);
  const start = randomInt(lowest, highest);
  const out: number[] = [];
  for (let v = start; v < start + span; v++) if (v !== value) out.push(v);
  return shuffle(out);
}

/** Elementos de una ventana aleatoria de números atómicos que contiene a `z` (sin incluirlo). */
export function windowElements(z: number, size = 4): ChemicalElement[] {
  return windowValues(z, 1, ELEMENTS.length, size)
    .map((n) => ELEMENTS_BY_NUMBER[n])
    .filter((e): e is ChemicalElement => e !== undefined);
}

/**
 * Ordena candidatos por puntuación (desc.), toma los `top` mejores barajados y
 * añade el resto barajado como respaldo.
 */
export function rankCandidates<T>(items: readonly T[], score: (item: T) => number, top: number): T[] {
  const scored = items.map((item) => ({ item, s: score(item) })).filter((x) => x.s > 0);
  scored.sort((a, b) => b.s - a.s);
  const best = shuffle(scored.slice(0, top).map((x) => x.item));
  const rest = shuffle(scored.slice(top).map((x) => x.item));
  return [...best, ...rest];
}

/** Todos los elementos excepto `el`, barajados (respaldo final). */
export function fallbackElements(el: ChemicalElement): ChemicalElement[] {
  return shuffle(ELEMENTS.filter((e) => e.atomicNumber !== el.atomicNumber));
}

/** Frase con la posición: "periodo 3, grupo 1" o "periodo 6 (fila de los lantánidos)". */
export function positionPhrase(el: ChemicalElement): string {
  if (el.group !== null) return `periodo ${el.period}, grupo ${el.group}`;
  const row = el.category === 'actinide' ? 'actínidos' : 'lantánidos';
  return `periodo ${el.period} (fila de los ${row})`;
}
