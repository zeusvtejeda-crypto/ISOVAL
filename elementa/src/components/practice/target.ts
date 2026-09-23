import { getFamilyGroup, getStudyBlock } from '@/data/blocks';
import { ELEMENTS_BY_NUMBER, TOTAL_ELEMENTS } from '@/data/elements';
import type { ProgressState, QuestionSkill, QuestionType } from '@/types';
import { ALL_QUESTION_TYPES, QUESTION_TYPE_META } from '@/utils/question-gen/meta';
import { difficultElements, dueReviews, weakElements } from '@/utils/selection';
import type { PracticeParams } from './params';

export type PracticeSource = 'elements' | 'block' | 'family' | 'errores' | 'dificiles' | 'repaso' | 'none';

/**
 * Fuentes «enfocadas» (errores, difíciles, repasos): la sesión se concentra en los elementos de más
 * prioridad y los repite (ver `buildPracticeQuestions`), en lugar de repartir una pregunta por elemento.
 */
export function isFocusSource(source: PracticeSource): boolean {
  return source === 'errores' || source === 'dificiles' || source === 'repaso';
}

export interface PracticeTarget {
  source: PracticeSource;
  emoji: string;
  title: string;
  description: string;
  /** Elementos a practicar (vacío = nada que practicar). */
  elements: number[];
  types: QuestionType[];
  /** `errores` sin errores recientes: se usan tus elementos difíciles. */
  fallback: boolean;
  /** El bloque/familia de la URL no existe. */
  invalid: boolean;
}

/** Máximo de elementos al practicar errores / difíciles / repasos (sesiones cortas y enfocadas). */
export const FOCUS_LIMIT = 12;
/**
 * «Los difíciles» con menos elementos fallados que esto se completan con los que menos dominas
 * (intentados y no dominados), para que la sesión no se reduzca a uno o dos elementos.
 */
export const MIN_FOCUS = 4;
const REVIEW_LIMIT = 20;

/** Tipos básicos: sirven para cualquier elemento. */
export const CORE_PRACTICE_TYPES: readonly QuestionType[] = [
  'name-to-symbol',
  'symbol-to-name',
  'element-to-number',
  'number-to-element',
];

/** Mezcla por defecto: lo esencial (símbolo y número pesan más) + familia y ubicación. */
export const DEFAULT_PRACTICE_TYPES: readonly QuestionType[] = [
  ...CORE_PRACTICE_TYPES,
  'element-to-category',
  'classification',
  'element-to-group',
  'element-to-period',
  'location',
  'table-find-element',
];

/** Elementos de los errores más recientes, sin repetir. */
export function recentMistakeElements(state: ProgressState, limit = FOCUS_LIMIT): number[] {
  const out: number[] = [];
  for (const m of state.mistakes) {
    if (out.length >= limit) break;
    if (!out.includes(m.atomicNumber) && ELEMENTS_BY_NUMBER[m.atomicNumber]) out.push(m.atomicNumber);
  }
  return out;
}

/** Tipos básicos + los que evalúan las habilidades en las que fallaste. */
export function typesForMistakes(state: ProgressState, elements: readonly number[]): QuestionType[] {
  const set = new Set(elements);
  const skills = new Set<QuestionSkill>(state.mistakes.filter((m) => set.has(m.atomicNumber)).map((m) => m.skill));
  const extra = ALL_QUESTION_TYPES.filter(
    (t) => skills.has(QUESTION_TYPE_META[t].skill) && !CORE_PRACTICE_TYPES.includes(t),
  );
  return [...CORE_PRACTICE_TYPES, ...extra];
}

export interface FocusElement {
  atomicNumber: number;
  /** Dominio actual 0–100. */
  mastery: number;
  /** `true` si lo has fallado alguna vez (`difficultElements`); `false` si solo completa la lista. */
  failed: boolean;
}

/**
 * Elementos de «Los difíciles» (`/practicar?focus=dificiles`): los que has fallado y aún no dominas
 * (`difficultElements`, la misma definición que «Mis errores»), el menor dominio primero. Solo si
 * son menos de `MIN_FOCUS` se completan con los intentados que menos dominas (`weakElements`).
 */
export function difficultFocus(state: ProgressState, now: Date, limit = FOCUS_LIMIT): FocusElement[] {
  const difficult: FocusElement[] = difficultElements(state, now, limit).map(({ atomicNumber, mastery }) => ({
    atomicNumber,
    mastery,
    failed: true,
  }));
  const room = Math.min(limit, MIN_FOCUS) - difficult.length;
  if (room <= 0) return difficult;
  const taken = new Set(difficult.map((d) => d.atomicNumber));
  const extra = weakElements(state, now, TOTAL_ELEMENTS)
    .filter((w) => !taken.has(w.atomicNumber))
    .slice(0, room)
    .map(({ atomicNumber, mastery }) => ({ atomicNumber, mastery, failed: false }));
  return [...difficult, ...extra];
}

/** Descripción de «Los difíciles» según de dónde salen sus elementos. */
function difficultDescription(focus: readonly FocusElement[]): string {
  const failed = focus.filter((f) => f.failed).length;
  if (failed === focus.length) return 'Los que has fallado y aún no dominas.';
  if (failed > 0) return 'Los que has fallado y, para completar, los que menos dominas.';
  return 'Aún no has fallado ninguno: practica los que menos dominas.';
}

/** Resumen para `/practicar` sin parámetros. `difficult` es el mismo número que «Mis errores». */
export function practiceCounts(state: ProgressState, now: Date): { mistakes: number; difficult: number; due: number } {
  return {
    mistakes: recentMistakeElements(state, TOTAL_ELEMENTS).length,
    difficult: difficultElements(state, now).length,
    due: dueReviews(state, now, TOTAL_ELEMENTS).length,
  };
}

/**
 * Qué se practica según la URL. Prioridad: `elements` > `block` > `family` > `focus`.
 * Sin ninguno → `source: 'none'` (se muestra el menú de práctica).
 */
export function resolvePracticeTarget(params: PracticeParams, state: ProgressState, now: Date): PracticeTarget {
  const base = { fallback: false, invalid: false };
  const types = (fallback: readonly QuestionType[]) => params.types ?? [...fallback];

  if (params.elements !== null) {
    const single = params.elements.length === 1 ? ELEMENTS_BY_NUMBER[params.elements[0]] : undefined;
    return {
      ...base,
      source: 'elements',
      emoji: '✨',
      title: single ? `${single.symbol} — ${single.name}` : 'Tu selección',
      description: single ? 'Repasa este elemento desde varios ángulos.' : 'Los elementos que elegiste, a fondo.',
      elements: params.elements,
      types: types(DEFAULT_PRACTICE_TYPES),
      invalid: params.elements.length === 0,
    };
  }

  if (params.block !== null) {
    const block = getStudyBlock(params.block);
    return {
      ...base,
      source: 'block',
      emoji: '📦',
      title: block ? `${block.title} · ${block.range}` : 'Bloque',
      description: block ? `Los elementos del ${block.from} al ${block.to}.` : '',
      elements: block?.atomicNumbers ?? [],
      types: types(DEFAULT_PRACTICE_TYPES),
      invalid: !block,
    };
  }

  if (params.family !== null) {
    const family = getFamilyGroup(params.family);
    return {
      ...base,
      source: 'family',
      emoji: family?.emoji ?? '🧪',
      title: family?.title ?? 'Familia',
      description: family?.blurb ?? '',
      elements: family?.atomicNumbers ?? [],
      types: types(DEFAULT_PRACTICE_TYPES),
      invalid: !family,
    };
  }

  switch (params.focus) {
    case 'errores': {
      const mistakes = recentMistakeElements(state);
      if (mistakes.length > 0) {
        return {
          ...base,
          source: 'errores',
          emoji: '🎯',
          title: 'Mis errores',
          description: 'Los elementos que fallaste hace poco.',
          elements: mistakes,
          types: types(typesForMistakes(state, mistakes)),
        };
      }
      const focus = difficultFocus(state, now);
      return {
        ...base,
        source: 'errores',
        emoji: '🎯',
        title: 'Mis errores',
        description: focus.some((f) => f.failed)
          ? 'No tienes errores recientes: practica tus elementos difíciles.'
          : 'No tienes errores recientes: practica los que menos dominas.',
        elements: focus.map((f) => f.atomicNumber),
        types: types(DEFAULT_PRACTICE_TYPES),
        fallback: true,
      };
    }
    case 'dificiles': {
      const focus = difficultFocus(state, now);
      return {
        ...base,
        source: 'dificiles',
        emoji: '💪',
        title: 'Los difíciles',
        description: difficultDescription(focus),
        elements: focus.map((f) => f.atomicNumber),
        types: types(DEFAULT_PRACTICE_TYPES),
      };
    }
    case 'repaso':
      return {
        ...base,
        source: 'repaso',
        emoji: '🔁',
        title: 'Repaso pendiente',
        description: 'Toca repasarlos para que no se te olviden.',
        elements: dueReviews(state, now, REVIEW_LIMIT),
        types: types(DEFAULT_PRACTICE_TYPES),
      };
    default:
      return {
        ...base,
        source: 'none',
        emoji: '🎯',
        title: 'Practicar',
        description: 'Elige qué quieres reforzar.',
        elements: [],
        types: types(DEFAULT_PRACTICE_TYPES),
      };
  }
}
