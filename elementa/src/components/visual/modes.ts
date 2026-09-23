import type { Tone } from '@/components/ui';
import type { QuestionSkill, QuestionType } from '@/types';
import { SELECTABLE_CATEGORIES } from '@/utils/question-gen/table';
import { TABLE_TYPES } from '@/utils/questions';

export type VisualModeId = 'donde' | 'numero' | 'familia' | 'grupo' | 'mixto';

export interface VisualMode {
  id: VisualModeId;
  emoji: string;
  title: string;
  /** Una línea: qué haces en este reto. */
  description: string;
  /** Ejemplo de enunciado. */
  example: string;
  types: QuestionType[];
  tone: Tone;
  /** Preguntas por sesión. */
  count: number;
  /** Cómo se responde (pastilla de la tarjeta). */
  answerHint: string;
  /** Habilidad que entrena (para mostrar tu precisión); `null` en el mixto. */
  skill: QuestionSkill | null;
}

/** Preguntas por sesión (las familias seleccionables son menos: una pregunta por familia). */
export const VISUAL_SESSION_SIZE = 10;

export const VISUAL_MODES: readonly VisualMode[] = [
  {
    id: 'donde',
    emoji: '📍',
    title: '¿Dónde está…?',
    description: 'Te damos un elemento: toca su casilla en la tabla.',
    example: 'Toca la casilla del Oxígeno.',
    types: ['table-find-element'],
    tone: 'brand',
    count: VISUAL_SESSION_SIZE,
    answerHint: 'Toca 1 casilla',
    skill: 'location',
  },
  {
    id: 'numero',
    emoji: '🔢',
    title: 'Encuentra el número',
    description: 'Busca el elemento por su número atómico.',
    example: 'Encuentra el elemento con número atómico 79.',
    types: ['table-find-number'],
    tone: 'accent',
    count: VISUAL_SESSION_SIZE,
    answerHint: 'Toca 1 casilla',
    skill: 'atomicNumber',
  },
  {
    id: 'familia',
    emoji: '🎯',
    title: 'Selecciona la familia',
    description: 'Marca todos los miembros de una familia.',
    example: 'Selecciona todos los gases nobles.',
    types: ['table-select-category'],
    tone: 'success',
    count: Math.min(VISUAL_SESSION_SIZE, SELECTABLE_CATEGORIES.length),
    answerHint: 'Selección múltiple',
    skill: 'category',
  },
  {
    id: 'grupo',
    emoji: '1️⃣',
    title: '¿Quién es del grupo…?',
    description: 'Toca cualquier elemento del grupo que te pidamos.',
    example: 'Toca un elemento del grupo 17.',
    types: ['table-group-member'],
    tone: 'xp',
    count: VISUAL_SESSION_SIZE,
    answerHint: 'Toca 1 casilla',
    skill: 'group',
  },
  {
    id: 'mixto',
    emoji: '🎲',
    title: 'Mixto',
    description: 'Un poco de todo para ponerte a prueba.',
    example: 'Ubicación, números, familias y grupos.',
    types: [...TABLE_TYPES],
    tone: 'streak',
    count: VISUAL_SESSION_SIZE,
    answerHint: 'Todos los retos',
    skill: null,
  },
];

export function getVisualMode(id: string | null | undefined): VisualMode | null {
  return VISUAL_MODES.find((m) => m.id === id) ?? null;
}
