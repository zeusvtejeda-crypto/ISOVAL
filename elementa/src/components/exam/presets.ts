import type { Tone } from '@/components/ui';
import { FAMILY_GROUPS, getFamilyGroup, getStudyBlock, STUDY_BLOCKS } from '@/data/blocks';
import type { ElementCategory, ExamTopic, QuestionType } from '@/types';
import { typesForTopics } from '@/utils/questions';
import { ALL_ATOMIC_NUMBERS } from '@/utils/selection';
import type { ExamMixPart, ExamSpec } from './build-exam';

export type ExamPresetId = 'quick' | 'normal' | 'complete';

export interface ExamPreset {
  id: ExamPresetId;
  emoji: string;
  title: string;
  description: string;
  count: number;
  tone: Tone;
  mix: readonly ExamMixPart[];
}

const SYMBOLS: QuestionType[] = ['symbol-to-name', 'name-to-symbol'];
const NUMBERS: QuestionType[] = ['element-to-number', 'number-to-element'];
const FAMILIES: QuestionType[] = ['element-to-category', 'classification'];
const POSITION: QuestionType[] = ['element-to-group', 'element-to-period', 'location'];
const STATE_PROPS: QuestionType[] = ['element-to-phase', 'property'];

/** Segundos estimados por pregunta (lectura + respuesta + feedback). */
const SECONDS_PER_QUESTION = 16;

/**
 * Exámenes predefinidos. El rápido se queda en lo esencial (sin masa, configuración ni
 * propiedades); el completo cubre todos los temas.
 */
export const EXAM_PRESETS: readonly ExamPreset[] = [
  {
    id: 'quick',
    emoji: '⚡',
    title: 'Examen rápido',
    description: 'Lo esencial: símbolos, números y familias.',
    count: 10,
    tone: 'streak',
    mix: [
      { types: SYMBOLS, weight: 4 },
      { types: NUMBERS, weight: 2 },
      { types: FAMILIES, weight: 2 },
      { types: ['element-to-group', 'element-to-period', 'element-to-phase'], weight: 1 },
      { types: ['table-find-element'], weight: 1 },
    ],
  },
  {
    id: 'normal',
    emoji: '📝',
    title: 'Examen normal',
    description: 'Un poco de todo, con preguntas en la tabla.',
    count: 20,
    tone: 'brand',
    mix: [
      { types: SYMBOLS, weight: 5 },
      { types: NUMBERS, weight: 4 },
      { types: FAMILIES, weight: 3 },
      { types: POSITION, weight: 3 },
      { types: STATE_PROPS, weight: 2 },
      { types: ['element-to-mass'], weight: 1 },
      { types: ['table-find-element', 'table-find-number', 'table-group-member'], weight: 2 },
    ],
  },
  {
    id: 'complete',
    emoji: '🏆',
    title: 'Examen completo',
    description: 'Todos los temas, hasta la configuración electrónica.',
    count: 50,
    tone: 'xp',
    mix: [
      { types: SYMBOLS, weight: 10 },
      { types: NUMBERS, weight: 8 },
      { types: FAMILIES, weight: 7 },
      { types: POSITION, weight: 7 },
      { types: STATE_PROPS, weight: 5 },
      { types: ['element-to-mass'], weight: 4 },
      { types: ['element-to-configuration'], weight: 3 },
      {
        types: ['table-find-element', 'table-find-number', 'table-group-member', 'table-select-category'],
        weight: 6,
      },
    ],
  },
];

export function getExamPreset(id: ExamPresetId): ExamPreset {
  return EXAM_PRESETS.find((p) => p.id === id) ?? EXAM_PRESETS[0];
}

/** Minutos aproximados para `count` preguntas (mínimo 1). */
export function estimatedMinutes(count: number): number {
  return Math.max(1, Math.round((count * SECONDS_PER_QUESTION) / 60));
}

export function presetSpec(preset: ExamPreset): ExamSpec {
  return { title: preset.title, count: preset.count, mix: preset.mix };
}

// ---------------------------------------------------------------------------------------------
// Examen personalizado
// ---------------------------------------------------------------------------------------------

/** `/examen?tipo=personalizado` abre el examen personalizado (así «atrás» vuelve al selector). */
export const CUSTOM_EXAM_PARAM = { name: 'tipo', value: 'personalizado' } as const;
export const CUSTOM_EXAM_HREF = `/examen?${CUSTOM_EXAM_PARAM.name}=${CUSTOM_EXAM_PARAM.value}`;

export type ExamScope =
  | { kind: 'all' }
  | { kind: 'block'; id: string }
  | { kind: 'family'; id: ElementCategory };

export const CUSTOM_COUNTS = [10, 20, 30, 50] as const;
export type CustomCount = (typeof CUSTOM_COUNTS)[number];

export interface CustomExamConfig {
  topics: ExamTopic[];
  scope: ExamScope;
  count: CustomCount;
}

export const DEFAULT_BLOCK_ID = STUDY_BLOCKS[0].id;
export const DEFAULT_FAMILY_ID: ElementCategory = FAMILY_GROUPS[0].id;

/** Elementos del alcance elegido. */
export function scopePool(scope: ExamScope): number[] {
  if (scope.kind === 'block') return getStudyBlock(scope.id)?.atomicNumbers ?? [...ALL_ATOMIC_NUMBERS];
  if (scope.kind === 'family') return getFamilyGroup(scope.id)?.atomicNumbers ?? [...ALL_ATOMIC_NUMBERS];
  return [...ALL_ATOMIC_NUMBERS];
}

/** "Todos los elementos", "Bloque 3 · 21–30", "Gases nobles". */
export function scopeLabel(scope: ExamScope): string {
  if (scope.kind === 'block') {
    const block = getStudyBlock(scope.id);
    return block ? `${block.title} · ${block.range}` : 'Todos los elementos';
  }
  if (scope.kind === 'family') return getFamilyGroup(scope.id)?.title ?? 'Todos los elementos';
  return 'Todos los elementos';
}

/** Una parte por tema, con el mismo peso: los temas salen equilibrados aunque tengan más o menos tipos. */
export function customMix(topics: readonly ExamTopic[]): ExamMixPart[] {
  return Array.from(new Set(topics)).map((topic) => ({ types: typesForTopics([topic]), weight: 1 }));
}

export function customSpec(config: CustomExamConfig): ExamSpec {
  return {
    title: 'Examen personalizado',
    count: config.count,
    mix: customMix(config.topics),
    pool: scopePool(config.scope),
  };
}
