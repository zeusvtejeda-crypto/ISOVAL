import { FAMILY_GROUPS, STUDY_BLOCKS } from '@/data/blocks';
import type { ElementCategory, ProgressState } from '@/types';

/** Datos derivados que reciben las funciones `progress` de los logros. */
export interface AchievementContext {
  state: ProgressState;
  now: Date;
  /** Dominio 0–100 de los 118 elementos. */
  mastery: Record<number, number>;
  /** Elementos con dominio ≥ 85. */
  masteredCount: number;
  learnedCount: number;
  level: number;
  /** Mejor racha de días con la meta cumplida (histórica, incluye la actual). */
  bestDayStreak: number;
}

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  progress: (ctx: AchievementContext) => AchievementProgress;
}

/** Umbral de dominio para considerar un elemento dominado (coincide con utils/mastery). */
const MASTERED = 85;

function count(current: number, target: number): AchievementProgress {
  return { current: Math.max(0, Math.min(current, target)), target };
}

function familyMastered(ctx: AchievementContext, category: ElementCategory): AchievementProgress {
  const members = FAMILY_GROUPS.find((f) => f.category === category)?.atomicNumbers ?? [];
  return count(members.filter((z) => (ctx.mastery[z] ?? 0) >= MASTERED).length, members.length);
}

/** Progreso del bloque con mayor proporción de elementos aprendidos. */
function bestBlockLearned(ctx: AchievementContext): AchievementProgress {
  const scores = STUDY_BLOCKS.map((block) => ({
    learned: block.atomicNumbers.filter((z) => ctx.state.elements[z]?.learned).length,
    size: block.atomicNumbers.length,
  }));
  const best = scores.reduce((a, b) => (b.learned / b.size > a.learned / a.size ? b : a));
  return count(best.learned, best.size);
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-element',
    emoji: '🏆',
    title: 'Primer elemento',
    description: 'Aprende tu primer elemento.',
    progress: (ctx) => count(ctx.learnedCount, 1),
  },
  {
    id: 'ten-learned',
    emoji: '📚',
    title: 'Coleccionista',
    description: 'Aprende 10 elementos.',
    progress: (ctx) => count(ctx.learnedCount, 10),
  },
  {
    id: 'first-block',
    emoji: '🧱',
    title: 'Primer bloque',
    description: 'Aprende los 10 elementos de un bloque.',
    progress: bestBlockLearned,
  },
  {
    id: 'first-goal',
    emoji: '🎯',
    title: 'Meta cumplida',
    description: 'Cumple tu meta diaria por primera vez.',
    progress: (ctx) => count(ctx.bestDayStreak, 1),
  },
  {
    id: 'on-fire',
    emoji: '🔥',
    title: 'En llamas',
    description: 'Mantén una racha de 7 días.',
    progress: (ctx) => count(ctx.bestDayStreak, 7),
  },
  {
    id: 'unstoppable',
    emoji: '🌋',
    title: 'Imparable',
    description: 'Mantén una racha de 30 días.',
    progress: (ctx) => count(ctx.bestDayStreak, 30),
  },
  {
    id: 'ten-mastered',
    emoji: '🌟',
    title: 'Primeros dominios',
    description: 'Domina 10 elementos.',
    progress: (ctx) => count(ctx.masteredCount, 10),
  },
  {
    id: 'half-way',
    emoji: '⚛️',
    title: 'Medio camino',
    description: 'Domina 59 elementos: ¡la mitad de la tabla!',
    progress: (ctx) => count(ctx.masteredCount, 59),
  },
  {
    id: 'table-master',
    emoji: '👑',
    title: 'Maestro de la tabla',
    description: 'Domina los 118 elementos.',
    progress: (ctx) => count(ctx.masteredCount, 118),
  },
  {
    id: 'atomic-memory',
    emoji: '🧠',
    title: 'Memoria atómica',
    description: 'Encadena 50 aciertos seguidos.',
    progress: (ctx) => count(ctx.state.records.bestAnswerStreak, 50),
  },
  {
    id: 'chemical-speed',
    emoji: '⚡',
    title: 'Velocidad química',
    description: 'Logra 20 aciertos en una Contrarreloj de 60 s.',
    progress: (ctx) => count(ctx.state.records.timeAttackBest, 20),
  },
  {
    id: 'survivor',
    emoji: '🛡️',
    title: 'Superviviente',
    description: 'Llega a 25 aciertos en Supervivencia.',
    progress: (ctx) => count(ctx.state.records.survivalBest, 25),
  },
  {
    id: 'chain-reaction',
    emoji: '🔗',
    title: 'Reacción en cadena',
    description: 'Llega a una racha de 20 en el Modo Racha.',
    progress: (ctx) => count(ctx.state.records.streakModeBest, 20),
  },
  {
    id: 'first-exam',
    emoji: '📝',
    title: 'Primer examen',
    description: 'Termina tu primer examen.',
    progress: (ctx) => count(ctx.state.stats.examsCompleted, 1),
  },
  {
    id: 'ten-exams',
    emoji: '🎓',
    title: 'Examinador',
    description: 'Termina 10 exámenes.',
    progress: (ctx) => count(ctx.state.stats.examsCompleted, 10),
  },
  {
    id: 'perfect-exam',
    emoji: '💯',
    title: 'Examen perfecto',
    description: 'Termina un examen sin ningún error.',
    progress: (ctx) => count(ctx.state.stats.perfectExams, 1),
  },
  {
    id: 'noble-gases',
    emoji: '🎈',
    title: 'Nobleza obliga',
    description: 'Domina todos los gases nobles.',
    progress: (ctx) => familyMastered(ctx, 'noble-gas'),
  },
  {
    id: 'halogens',
    emoji: '🧂',
    title: 'Formador de sales',
    description: 'Domina todos los halógenos.',
    progress: (ctx) => familyMastered(ctx, 'halogen'),
  },
  {
    id: 'alkali-metals',
    emoji: '💥',
    title: 'Explosivo',
    description: 'Domina todos los metales alcalinos.',
    progress: (ctx) => familyMastered(ctx, 'alkali-metal'),
  },
  {
    id: 'level-5',
    emoji: '🔬',
    title: 'Experto',
    description: 'Alcanza el nivel 5.',
    progress: (ctx) => count(ctx.level, 5),
  },
  {
    id: 'level-9',
    emoji: '🌌',
    title: 'Mente cuántica',
    description: 'Alcanza el nivel 9.',
    progress: (ctx) => count(ctx.level, 9),
  },
  {
    id: 'questions-100',
    emoji: '❓',
    title: 'Curiosidad científica',
    description: 'Responde 100 preguntas.',
    progress: (ctx) => count(ctx.state.stats.totalQuestions, 100),
  },
  {
    id: 'questions-1000',
    emoji: '🏅',
    title: 'Incansable',
    description: 'Responde 1000 preguntas.',
    progress: (ctx) => count(ctx.state.stats.totalQuestions, 1000),
  },
  {
    id: 'flashcards-100',
    emoji: '🃏',
    title: 'Tarjetero',
    description: 'Repasa 100 flashcards.',
    progress: (ctx) => count(ctx.state.stats.flashcardsReviewed, 100),
  },
];

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);
