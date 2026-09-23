import { getFamilyGroup, getStudyBlock } from '@/data/blocks';
import { ELEMENTS_BY_NUMBER, TOTAL_ELEMENTS } from '@/data/elements';
import type { ProgressState, QuestionSkill, QuestionType } from '@/types';
import { dueReviews, weakElements } from '@/utils/planner';
import { ALL_QUESTION_TYPES, QUESTION_TYPE_META } from '@/utils/questions';
import type { PracticeParams } from './params';

export type PracticeSource = 'elements' | 'block' | 'family' | 'errores' | 'dificiles' | 'repaso' | 'none';

export interface PracticeTarget {
  source: PracticeSource;
  emoji: string;
  title: string;
  description: string;
  /** Elementos a practicar (vacío = nada que practicar). */
  elements: number[];
  types: QuestionType[];
  /** `errores` sin errores recientes: se usan los elementos que menos dominas. */
  fallback: boolean;
  /** El bloque/familia de la URL no existe. */
  invalid: boolean;
}

/** Máximo de elementos al practicar errores / difíciles / repasos (sesiones cortas y enfocadas). */
export const FOCUS_LIMIT = 12;
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

function weakNumbers(state: ProgressState, now: Date): number[] {
  return weakElements(state, now, FOCUS_LIMIT).map((w) => w.atomicNumber);
}

/** Resumen para `/practicar` sin parámetros. */
export function practiceCounts(state: ProgressState, now: Date): { mistakes: number; weak: number; due: number } {
  return {
    mistakes: recentMistakeElements(state, TOTAL_ELEMENTS).length,
    weak: weakElements(state, now, TOTAL_ELEMENTS).length,
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
      return {
        ...base,
        source: 'errores',
        emoji: '🎯',
        title: 'Mis errores',
        description: 'No tienes errores recientes: practica los que menos dominas.',
        elements: weakNumbers(state, now),
        types: types(DEFAULT_PRACTICE_TYPES),
        fallback: true,
      };
    }
    case 'dificiles':
      return {
        ...base,
        source: 'dificiles',
        emoji: '💪',
        title: 'Los difíciles',
        description: 'Los elementos que menos dominas.',
        elements: weakNumbers(state, now),
        types: types(DEFAULT_PRACTICE_TYPES),
      };
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
