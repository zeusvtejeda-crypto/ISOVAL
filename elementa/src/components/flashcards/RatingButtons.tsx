'use client';

import { useId, type Ref } from 'react';
import { cn } from '@/components/ui';
import type { FlashcardRating } from '@/types';
import { RATINGS } from './ratings';

export interface RatingButtonsProps {
  onRate: (rating: FlashcardRating) => void;
  /** Calificación recién elegida: se resalta y el resto se atenúa (los botones quedan desactivados). */
  selected?: FlashcardRating | null;
  /** Id de la respuesta (el grupo la usa como descripción). */
  describedBy?: string;
  /** El grupo recibe el foco al girar la tarjeta (anuncia la pregunta y la respuesta). */
  groupRef?: Ref<HTMLDivElement>;
  className?: string;
}

/** ❌ No lo sabía · 😐 Casi · ✅ Lo sabía · ⚡ Muy fácil (teclas 1–4). */
export function RatingButtons({ onRate, selected = null, describedBy, groupRef, className }: RatingButtonsProps) {
  const titleId = useId();
  return (
    <div
      ref={groupRef}
      role="group"
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      className={cn('outline-none', className)}
    >
      <p id={titleId} className="mb-2.5 text-center text-sm font-black text-muted">
        ¿Qué tal te fue?
      </p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {RATINGS.map((r, i) => (
          <button
            key={r.id}
            type="button"
            disabled={selected !== null}
            onClick={() => onRate(r.id)}
            aria-keyshortcuts={r.key}
            style={selected === null ? { animationDelay: `${i * 45}ms` } : undefined}
            className={cn(
              'pressable relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-2 text-center',
              'font-extrabold leading-tight hover:brightness-[1.03] disabled:cursor-default',
              r.buttonClass,
              selected === null && 'animate-slide-up',
              selected === r.id && 'animate-pop border-current',
              selected !== null && selected !== r.id && 'opacity-45',
            )}
          >
            <span aria-hidden className="text-2xl leading-none">
              {r.emoji}
            </span>
            <span className="text-xs sm:text-sm">{r.label}</span>
            <kbd
              aria-hidden
              className="absolute top-1.5 right-2 hidden font-sans text-[0.65rem] font-black opacity-60 sm:block"
            >
              {r.key}
            </kbd>
          </button>
        ))}
      </div>
    </div>
  );
}
