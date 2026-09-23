import type { ExamTopic, QuestionKind, QuestionSkill, QuestionType } from '@/types';

export interface QuestionTypeMeta {
  label: string;
  skill: QuestionSkill;
  kind: QuestionKind;
  topic: ExamTopic;
}

export const QUESTION_TYPE_META: Record<QuestionType, QuestionTypeMeta> = {
  'symbol-to-name': { label: 'Símbolo → nombre', skill: 'symbol', kind: 'multiple-choice', topic: 'symbols' },
  'name-to-symbol': { label: 'Nombre → símbolo', skill: 'symbol', kind: 'multiple-choice', topic: 'symbols' },
  'number-to-element': {
    label: 'Número → elemento',
    skill: 'atomicNumber',
    kind: 'multiple-choice',
    topic: 'atomicNumbers',
  },
  'element-to-number': {
    label: 'Elemento → número',
    skill: 'atomicNumber',
    kind: 'multiple-choice',
    topic: 'atomicNumbers',
  },
  'element-to-mass': { label: 'Masa atómica', skill: 'atomicMass', kind: 'multiple-choice', topic: 'atomicMass' },
  'element-to-group': { label: 'Grupo', skill: 'group', kind: 'multiple-choice', topic: 'groups' },
  'element-to-period': { label: 'Periodo', skill: 'period', kind: 'multiple-choice', topic: 'periods' },
  'element-to-category': { label: 'Familia', skill: 'category', kind: 'multiple-choice', topic: 'families' },
  'element-to-phase': { label: 'Estado', skill: 'phase', kind: 'multiple-choice', topic: 'phase' },
  'element-to-configuration': {
    label: 'Configuración electrónica',
    skill: 'configuration',
    kind: 'multiple-choice',
    topic: 'configuration',
  },
  location: { label: 'Ubicación', skill: 'location', kind: 'multiple-choice', topic: 'location' },
  property: { label: 'Propiedades', skill: 'property', kind: 'multiple-choice', topic: 'properties' },
  classification: { label: 'Clasificación', skill: 'category', kind: 'multiple-choice', topic: 'families' },
  'table-find-element': { label: 'Encuentra en la tabla', skill: 'location', kind: 'table-select', topic: 'visual' },
  'table-find-number': { label: 'Busca por número', skill: 'atomicNumber', kind: 'table-select', topic: 'visual' },
  'table-select-category': {
    label: 'Selecciona la familia',
    skill: 'category',
    kind: 'table-multi-select',
    topic: 'visual',
  },
  'table-group-member': { label: 'Miembro del grupo', skill: 'group', kind: 'table-select', topic: 'visual' },
};

export const ALL_QUESTION_TYPES = Object.keys(QUESTION_TYPE_META) as QuestionType[];

/** Tipos de opción múltiple (4 opciones). */
export const MC_TYPES: QuestionType[] = ALL_QUESTION_TYPES.filter(
  (t) => QUESTION_TYPE_META[t].kind === 'multiple-choice',
);

/** Tipos que se responden tocando la tabla periódica. */
export const TABLE_TYPES: QuestionType[] = ALL_QUESTION_TYPES.filter(
  (t) => QUESTION_TYPE_META[t].kind !== 'multiple-choice',
);
