import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { Question } from '@/types';

// Corrección y atribución de respuestas de tabla. Sin generadores de preguntas: lo importan
// las pantallas que solo corrigen (flashcards, resúmenes) sin cargar `questions.ts`.

/**
 * Corrige una pregunta de tabla.
 * - `table-select`: se debe tocar exactamente UNA casilla y debe estar en `targetAtomicNumbers`.
 *   Normalmente hay un solo objetivo; en `table-group-member` ("Toca un elemento del grupo 1")
 *   los objetivos son todos los miembros del grupo y cualquiera cuenta como acierto.
 * - `table-multi-select`: la selección S (sin orden ni duplicados) debe cumplir
 *   obligatorios ⊆ S ⊆ objetivos, donde obligatorios = objetivos − `optionalAtomicNumbers`
 *   (sin opcionales, el conjunto exacto).
 * Para preguntas de opción múltiple devuelve `false`.
 */
export function checkTableAnswer(q: Question, selected: number[]): boolean {
  const targets = q.targetAtomicNumbers ?? [];
  const picked = Array.from(new Set(selected));
  if (q.kind === 'table-select') return picked.length === 1 && targets.includes(picked[0]);
  if (q.kind === 'table-multi-select') {
    const optional = new Set(q.optionalAtomicNumbers ?? []);
    const chosen = new Set(picked);
    return targets.every((z) => optional.has(z) || chosen.has(z)) && picked.every((z) => targets.includes(z));
  }
  return false;
}

export interface AnswerAttribution {
  /** Elemento al que se atribuye la respuesta (dominio, errores, repaso). */
  atomicNumber: number;
  /**
   * `false`: la respuesta es sobre una familia o un grupo, no sobre un elemento concreto
   * (sin progreso ni repetición espaciada por elemento).
   */
  trackElement: boolean;
}

/**
 * A qué elemento se atribuye una respuesta:
 * - opción múltiple, `table-find-element` y `table-find-number`: el elemento de la pregunta.
 * - `table-group-member`: si se tocó exactamente un elemento, ese (un acierto suma al elemento
 *   tocado; un fallo anota el error de grupo en el elemento que el usuario creyó del grupo).
 *   Si no, el de la pregunta, sin seguimiento por elemento.
 * - `table-select-category`: respuesta de familia (`trackElement: false`) anotada en el primer
 *   obligatorio que faltó, o si no en el primero marcado por error, o en el de la pregunta.
 */
export function answerAttribution(question: Question, response: string | number[]): AnswerAttribution {
  const picked = Array.isArray(response)
    ? Array.from(new Set(response)).filter((z) => ELEMENTS_BY_NUMBER[z] !== undefined)
    : [];
  switch (question.type) {
    case 'table-group-member':
      return picked.length === 1
        ? { atomicNumber: picked[0], trackElement: true }
        : { atomicNumber: question.atomicNumber, trackElement: false };
    case 'table-select-category': {
      const targets = question.targetAtomicNumbers ?? [];
      const optional = new Set(question.optionalAtomicNumbers ?? []);
      const chosen = new Set(picked);
      const missed = targets.find((z) => !optional.has(z) && !chosen.has(z));
      const wrong = picked.find((z) => !targets.includes(z));
      return { atomicNumber: missed ?? wrong ?? question.atomicNumber, trackElement: false };
    }
    default:
      return { atomicNumber: question.atomicNumber, trackElement: true };
  }
}

/** Texto legible de una selección en la tabla (para `givenAnswer`): "Na, K" o "—". */
export function describeTableSelection(selected: number[]): string {
  const symbols = Array.from(new Set(selected))
    .map((z) => ELEMENTS_BY_NUMBER[z]?.symbol)
    .filter((s): s is string => Boolean(s));
  return symbols.length > 0 ? symbols.join(', ') : '—';
}
