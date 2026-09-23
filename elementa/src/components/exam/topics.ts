import type { ExamTopic, QuestionType } from '@/types';
import { QUESTION_TYPE_META } from '@/utils/questions';

export interface TopicMeta {
  id: ExamTopic;
  label: string;
  emoji: string;
  /** Ejemplo corto de lo que se pregunta. */
  example: string;
}

/** Temas del examen personalizado, en el orden en que se muestran. */
export const EXAM_TOPICS: readonly TopicMeta[] = [
  { id: 'symbols', label: 'Símbolos', emoji: '🔤', example: 'Na → Sodio' },
  { id: 'atomicNumbers', label: 'Números atómicos', emoji: '🔢', example: 'Fe → 26' },
  { id: 'atomicMass', label: 'Masa atómica', emoji: '⚖️', example: 'O → 15.999' },
  { id: 'families', label: 'Familias', emoji: '🧪', example: 'Ne → Gas noble' },
  { id: 'configuration', label: 'Configuración electrónica', emoji: '🌀', example: 'C → [He] 2s² 2p²' },
  { id: 'groups', label: 'Grupos', emoji: '↕️', example: 'K → Grupo 1' },
  { id: 'periods', label: 'Periodos', emoji: '↔️', example: 'Mg → Periodo 3' },
  { id: 'phase', label: 'Estado', emoji: '💧', example: 'Hg → Líquido' },
  { id: 'location', label: 'Ubicación', emoji: '📍', example: '¿Qué hay bajo el O?' },
  { id: 'properties', label: 'Propiedades', emoji: '🔬', example: '¿Cuál es un gas?' },
  { id: 'visual', label: 'Visual', emoji: '🗺️', example: 'Tócalo en la tabla' },
];

export const TOPIC_META: Record<ExamTopic, TopicMeta> = Object.fromEntries(
  EXAM_TOPICS.map((t) => [t.id, t]),
) as Record<ExamTopic, TopicMeta>;

/** Temas marcados al abrir el examen personalizado. */
export const DEFAULT_CUSTOM_TOPICS: readonly ExamTopic[] = ['symbols', 'atomicNumbers', 'families'];

/** Temas distintos que cubren unos tipos de pregunta, en el orden de `EXAM_TOPICS`. */
export function topicsOfTypes(types: readonly QuestionType[]): ExamTopic[] {
  const set = new Set(types.map((t) => QUESTION_TYPE_META[t].topic));
  return EXAM_TOPICS.map((t) => t.id).filter((id) => set.has(id));
}
