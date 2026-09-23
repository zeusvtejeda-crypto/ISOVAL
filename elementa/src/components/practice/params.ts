import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import type { QuestionType } from '@/types';
import { ALL_QUESTION_TYPES } from '@/utils/question-gen/meta';

export type PracticeFocus = 'errores' | 'dificiles' | 'repaso';

export const PRACTICE_FOCUSES: readonly PracticeFocus[] = ['errores', 'dificiles', 'repaso'];

export const DEFAULT_PRACTICE_COUNT = 10;
export const MAX_PRACTICE_COUNT = 50;

export interface PracticeParams {
  /** `?focus=errores|dificiles|repaso`. */
  focus: PracticeFocus | null;
  /** `?elements=19,26,47`: válidos y sin repetir, en su orden; `[]` si venía pero ninguno es válido. */
  elements: number[] | null;
  /** `?block=b1`. */
  block: string | null;
  /** `?family=<categoría>`. */
  family: string | null;
  /** `?n=10` (1–50). */
  count: number;
  /** `?types=symbol-to-name,…` (solo los tipos válidos; `null` si no hay ninguno). */
  types: QuestionType[] | null;
}

interface ParamSource {
  get(name: string): string | null;
}

const TYPE_SET = new Set<string>(ALL_QUESTION_TYPES);

function isFocus(value: string | null): value is PracticeFocus {
  return value !== null && (PRACTICE_FOCUSES as readonly string[]).includes(value);
}

function list(raw: string | null): string[] {
  return raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function parseCount(raw: string | null): number {
  if (!raw || !/^\d{1,3}$/.test(raw.trim())) return DEFAULT_PRACTICE_COUNT;
  const n = Number(raw.trim());
  return n >= 1 ? Math.min(MAX_PRACTICE_COUNT, n) : DEFAULT_PRACTICE_COUNT;
}

/** Lee los parámetros de `/practicar`, ignorando valores inválidos. */
export function parsePracticeParams(params: ParamSource): PracticeParams {
  const rawElements = params.get('elements');
  const elements =
    rawElements === null
      ? null
      : Array.from(
          new Set(
            list(rawElements)
              .filter((s) => /^\d{1,3}$/.test(s))
              .map(Number)
              .filter((z) => ELEMENTS_BY_NUMBER[z] !== undefined),
          ),
        );
  const types = Array.from(new Set(list(params.get('types')).filter((t) => TYPE_SET.has(t)))) as QuestionType[];
  const focus = params.get('focus');
  return {
    focus: isFocus(focus) ? focus : null,
    elements,
    block: params.get('block')?.trim() || null,
    family: params.get('family')?.trim() || null,
    count: parseCount(params.get('n')),
    types: types.length > 0 ? types : null,
  };
}
