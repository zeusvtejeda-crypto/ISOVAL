import type { FlashcardRating } from '@/types';

export interface RatingMeta {
  id: FlashcardRating;
  emoji: string;
  label: string;
  /** Tecla de atajo (1–4). */
  key: string;
  /** Clases del botón (fondo suave + borde del tono + sombra "presionable"). */
  buttonClass: string;
  /** Clases del contador en el resumen. */
  softClass: string;
  /** Relleno de la barra de distribución. */
  barClass: string;
}

export const RATINGS: readonly RatingMeta[] = [
  {
    id: 'again',
    emoji: '❌',
    label: 'No lo sabía',
    key: '1',
    buttonClass: 'border-danger/45 bg-danger-soft text-danger [--press-shade:color-mix(in_oklab,var(--color-danger)_45%,transparent)]',
    softClass: 'bg-danger-soft text-danger',
    barClass: 'bg-danger',
  },
  {
    id: 'hard',
    emoji: '😐',
    label: 'Casi',
    key: '2',
    buttonClass: 'border-warning/45 bg-warning-soft text-warning [--press-shade:color-mix(in_oklab,var(--color-warning)_45%,transparent)]',
    softClass: 'bg-warning-soft text-warning',
    barClass: 'bg-warning',
  },
  {
    id: 'good',
    emoji: '✅',
    label: 'Lo sabía',
    key: '3',
    buttonClass: 'border-success/45 bg-success-soft text-success [--press-shade:color-mix(in_oklab,var(--color-success)_45%,transparent)]',
    softClass: 'bg-success-soft text-success',
    barClass: 'bg-success',
  },
  {
    id: 'easy',
    emoji: '⚡',
    label: 'Muy fácil',
    key: '4',
    buttonClass: 'border-brand/45 bg-brand-soft text-brand [--press-shade:color-mix(in_oklab,var(--color-brand)_45%,transparent)]',
    softClass: 'bg-brand-soft text-brand',
    barClass: 'bg-brand',
  },
];

/** "1"–"4" → calificación; cualquier otra tecla → `null`. */
export function ratingFromKey(key: string): FlashcardRating | null {
  return RATINGS.find((r) => r.key === key)?.id ?? null;
}
