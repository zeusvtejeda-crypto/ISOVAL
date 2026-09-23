import type { Tone } from '@/components/ui';
import type { AnsweredQuestion, ExamTopic, QuestionType } from '@/types';
import { QUESTION_TYPE_META } from '@/utils/questions';
import { EXAM_TOPICS } from './topics';

export interface ExamGrade {
  emoji: string;
  title: string;
  message: string;
  tone: Tone;
}

/** Porcentaje entero, igual que el que guarda el motor (`records.bestExamPct`). */
export function examPercent(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

export function examGrade(pct: number): ExamGrade {
  if (pct >= 100) return { emoji: '🏆', title: '¡Examen perfecto!', message: 'No fallaste ni una. ¡Eres una leyenda!', tone: 'xp' };
  if (pct >= 90) return { emoji: '🌟', title: '¡Sobresaliente!', message: 'Dominas estos elementos.', tone: 'success' };
  if (pct >= 75) return { emoji: '💪', title: '¡Muy bien!', message: 'Repasa tus errores y vas a por el 100%.', tone: 'success' };
  if (pct >= 60) return { emoji: '👍', title: '¡Aprobado!', message: 'Vas bien. Unos repasos más y lo bordas.', tone: 'brand' };
  if (pct >= 40) return { emoji: '📚', title: 'Casi lo tienes', message: 'Practica tus errores y vuelve a intentarlo.', tone: 'warning' };
  return { emoji: '🌱', title: 'A seguir practicando', message: 'Cada error te enseña algo. ¡Tú puedes!', tone: 'danger' };
}

export interface TopicScore {
  topic: ExamTopic;
  correct: number;
  total: number;
}

/** Aciertos por tema, en el orden de `EXAM_TOPICS` (solo temas preguntados). */
export function topicScores(answered: readonly AnsweredQuestion[]): TopicScore[] {
  const map = new Map<ExamTopic, TopicScore>();
  for (const a of answered) {
    const topic = QUESTION_TYPE_META[a.question.type].topic;
    const entry = map.get(topic) ?? { topic, correct: 0, total: 0 };
    entry.total += 1;
    if (a.correct) entry.correct += 1;
    map.set(topic, entry);
  }
  return EXAM_TOPICS.map((t) => map.get(t.id)).filter((s): s is TopicScore => s !== undefined);
}

/** Tipos básicos que siempre se añaden al practicar errores (hay preguntas para cualquier elemento). */
const CORE_TYPES: QuestionType[] = ['name-to-symbol', 'symbol-to-name', 'element-to-number', 'number-to-element'];

/**
 * Enlace a `/practicar` con los elementos fallados y los tipos de pregunta en los que fallaste
 * (más los básicos), o `null` si no hubo errores.
 */
export function practiceMistakesHref(answered: readonly AnsweredQuestion[]): string | null {
  const wrong = answered.filter((a) => !a.correct);
  if (wrong.length === 0) return null;
  const elements = Array.from(new Set(wrong.map((a) => a.question.atomicNumber)));
  const types = Array.from(new Set([...wrong.map((a) => a.question.type), ...CORE_TYPES]));
  return `/practicar?elements=${elements.join(',')}&types=${types.join(',')}`;
}
