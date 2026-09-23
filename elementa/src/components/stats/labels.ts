import type { GameMode, QuestionSkill, QuestionType } from '@/types';
import { keyToDate } from '@/utils/dates';
import { ALL_QUESTION_TYPES, QUESTION_TYPE_META } from '@/utils/questions';

export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

/** "16 sep" a partir de una clave `YYYY-MM-DD`. */
export function shortDate(key: string): string {
  const d = keyToDate(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "lun", "mar", "mié"… */
export function weekdayShort(key: string): string {
  return WEEKDAYS_SHORT[keyToDate(key).getDay()];
}

/** "lunes 16 sep". */
export function longDate(key: string): string {
  const d = keyToDate(key);
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export interface SkillMeta {
  label: string;
  emoji: string;
}

/** Nombre corto de cada habilidad evaluada. */
export const SKILL_META: Record<QuestionSkill, SkillMeta> = {
  symbol: { label: 'Símbolos', emoji: '🔤' },
  atomicNumber: { label: 'Números atómicos', emoji: '🔢' },
  atomicMass: { label: 'Masa atómica', emoji: '⚖️' },
  group: { label: 'Grupos', emoji: '↕️' },
  period: { label: 'Periodos', emoji: '↔️' },
  category: { label: 'Familias', emoji: '🧬' },
  phase: { label: 'Estado', emoji: '🧊' },
  location: { label: 'Ubicación', emoji: '📍' },
  configuration: { label: 'Configuración', emoji: '🌀' },
  property: { label: 'Propiedades', emoji: '💡' },
};

/** Tipos de pregunta que evalúan una habilidad (para practicarla en `/practicar?types=…`). */
export function typesForSkill(skill: QuestionSkill): QuestionType[] {
  return ALL_QUESTION_TYPES.filter((t) => QUESTION_TYPE_META[t].skill === skill);
}

/** Nombre del modo en que se originó una respuesta. */
export const MODE_LABELS: Record<GameMode, string> = {
  diagnostic: 'Diagnóstico',
  study: 'Estudiar',
  learn5: 'Aprende 5',
  flashcards: 'Flashcards',
  trivia: 'Preguntados',
  exam: 'Examen',
  timeAttack: 'Contrarreloj',
  survival: 'Supervivencia',
  streak: 'Racha',
  visual: 'Visual',
  practice: 'Práctica',
};
