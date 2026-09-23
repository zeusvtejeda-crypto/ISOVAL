import type { Question } from '@/types';
import { pluralize } from '@/utils/format';

/** Corrección de una pregunta de tabla, casilla por casilla. */
export interface TableReview {
  /** Marcadas y correctas (✓). En `table-select`, las casillas objetivo. */
  correct: number[];
  /** Obligatorias que faltó marcar (contorno discontinuo). Solo selección múltiple. */
  missed: number[];
  /** Marcadas que no correspondían (✗). */
  incorrect: number[];
  /** Opcionales que no se marcaron: ni faltan ni sobran (se resaltan de forma neutra). */
  optional: number[];
  /** Obligatorias acertadas y total de obligatorias ("Acertaste 2 de 7"). */
  hits: number;
  required: number;
}

function unique(list: readonly number[]): number[] {
  return Array.from(new Set(list));
}

/**
 * Corrige una pregunta de tabla. `table-select`: las casillas objetivo se revelan como correctas y la
 * tocada, si no era objetivo, como incorrecta. `table-multi-select`: tres estados (marcada y
 * correcta, faltó, sobraba); las opcionales (`optionalAtomicNumbers`) nunca faltan ni sobran.
 */
export function reviewTableAnswer(question: Question, response: readonly number[]): TableReview {
  const targets = question.targetAtomicNumbers ?? [];
  const picked = unique(response);
  const incorrect = picked.filter((z) => !targets.includes(z));
  if (question.kind !== 'table-multi-select') {
    const hits = picked.filter((z) => targets.includes(z)).length;
    return { correct: [...targets], missed: [], incorrect, optional: [], hits, required: Math.min(1, targets.length) };
  }
  const optionalSet = new Set(question.optionalAtomicNumbers ?? []);
  const required = targets.filter((z) => !optionalSet.has(z));
  return {
    correct: picked.filter((z) => targets.includes(z)),
    missed: required.filter((z) => !picked.includes(z)),
    incorrect,
    optional: targets.filter((z) => optionalSet.has(z) && !picked.includes(z)),
    hits: required.filter((z) => picked.includes(z)).length,
    required: required.length,
  };
}

/**
 * Resumen de una selección múltiple para el feedback: "Acertaste 2 de 7 · 2 sobraban". Las
 * opcionales no cuentan (la respuesta correcta ya dice "también vale Po").
 */
export function describeTableReview(review: TableReview): string {
  const extra = review.incorrect.length;
  const hits = `Acertaste ${review.hits} de ${review.required}`;
  return extra > 0 ? `${hits} · ${extra} ${pluralize(extra, 'sobraba', 'sobraban')}` : hits;
}
