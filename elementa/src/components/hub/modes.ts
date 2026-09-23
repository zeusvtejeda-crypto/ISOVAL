import type { Tone } from '@/components/ui';
import type { PersonalRecords } from '@/types';
import { formatNumber, pluralize } from '@/utils/format';

export type ModeId =
  | 'estudiar'
  | 'aprende'
  | 'flashcards'
  | 'bloques'
  | 'errores'
  | 'preguntados'
  | 'examen'
  | 'contrarreloj'
  | 'supervivencia'
  | 'racha'
  | 'visual';

export interface ModeInfo {
  id: ModeId;
  href: string;
  emoji: string;
  title: string;
  /** Una línea: qué haces en este modo. */
  description: string;
  tone: Tone;
  /** Récord personal a mostrar en la tarjeta (`null` = aún no hay). */
  record?: (records: PersonalRecords) => string | null;
}

function countRecord(value: number, singular: string, plural: string, prefix = 'Récord'): string | null {
  return value > 0 ? `${prefix}: ${formatNumber(value)} ${pluralize(value, singular, plural)}` : null;
}

export const MODES: Record<ModeId, ModeInfo> = {
  estudiar: {
    id: 'estudiar',
    href: '/estudiar',
    emoji: '🧠',
    title: 'Estudiar ahora',
    description: 'Tu sesión inteligente: nuevos, repasos y difíciles.',
    tone: 'brand',
  },
  aprende: {
    id: 'aprende',
    href: '/aprende',
    emoji: '🌱',
    title: 'Aprende 5',
    description: '5 elementos nuevos, uno por uno.',
    tone: 'success',
  },
  flashcards: {
    id: 'flashcards',
    href: '/flashcards',
    emoji: '🃏',
    title: 'Flashcards',
    description: 'Voltea, recuerda y repasa justo a tiempo.',
    tone: 'brand',
  },
  bloques: {
    id: 'bloques',
    href: '/bloques',
    emoji: '🧱',
    title: 'Bloques y familias',
    description: 'Aprende de 10 en 10 o por familias.',
    tone: 'accent',
  },
  errores: {
    id: 'errores',
    href: '/errores',
    emoji: '🎯',
    title: 'Mis errores',
    description: 'Refuerza los elementos que más te cuestan.',
    tone: 'danger',
  },
  preguntados: {
    id: 'preguntados',
    href: '/preguntados',
    emoji: '🎡',
    title: 'Preguntados',
    description: 'Gira la ruleta y responde por categorías.',
    tone: 'xp',
  },
  examen: {
    id: 'examen',
    href: '/examen',
    emoji: '📝',
    title: 'Mini examen',
    description: '10, 20 o 50 preguntas con calificación.',
    tone: 'accent',
    record: (r) => (r.bestExamPct > 0 ? `Mejor examen: ${Math.round(r.bestExamPct)}%` : null),
  },
  contrarreloj: {
    id: 'contrarreloj',
    href: '/contrarreloj',
    emoji: '⏱️',
    title: 'Contrarreloj',
    description: '60 segundos: ¿cuántas aciertas?',
    tone: 'streak',
    record: (r) => countRecord(r.timeAttackBest, 'acierto', 'aciertos'),
  },
  supervivencia: {
    id: 'supervivencia',
    href: '/supervivencia',
    emoji: '❤️',
    title: 'Supervivencia',
    description: '3 vidas. Cada error te cuesta una.',
    tone: 'danger',
    record: (r) => countRecord(r.survivalBest, 'acierto', 'aciertos'),
  },
  racha: {
    id: 'racha',
    href: '/racha',
    emoji: '🔥',
    title: 'Racha',
    description: 'Encadena aciertos y multiplica tu XP.',
    tone: 'streak',
    record: (r) => (r.streakModeBest > 0 ? `Mejor racha: ${formatNumber(r.streakModeBest)}` : null),
  },
  visual: {
    id: 'visual',
    href: '/visual',
    emoji: '🗺️',
    title: 'Visual',
    description: 'Encuentra los elementos en la tabla.',
    tone: 'success',
  },
};

/** Retos y juegos rápidos. */
export const PLAY_MODES: readonly ModeId[] = [
  'preguntados',
  'examen',
  'contrarreloj',
  'supervivencia',
  'racha',
  'visual',
];

/** Aprender y repasar a tu ritmo. */
export const LEARN_MODES: readonly ModeId[] = ['aprende', 'flashcards', 'bloques', 'errores'];
