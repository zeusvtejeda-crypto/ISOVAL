'use client';

import { RotateCw } from 'lucide-react';
import { cn } from '@/components/ui';
import { ElementTile } from '@/components/periodic/ElementTile';
import { CATEGORIES } from '@/data/categories';
import type { ChemicalElement } from '@/types';
import { categoryLabel, formatMass } from '@/utils/format';
import type { FlashcardFace, FlashcardMode } from './modes';

export interface FlashcardProps {
  element: ChemicalElement;
  mode: FlashcardMode;
  flipped: boolean;
  /** Tocar la tarjeta la gira. */
  onFlip: () => void;
  /** Repetición dentro de la sesión (muestra «Otra vez»). */
  repeat?: boolean;
  /** Ids para describir la tarjeta desde los botones. */
  frontId?: string;
  answerId?: string;
  className?: string;
}

/** Tamaño del texto grande según su longitud (cabe en 320 px sin cortar palabras). */
function mainTextClass(text: string): string {
  const n = text.length;
  if (n <= 3) return 'text-7xl sm:text-8xl';
  if (n <= 6) return 'text-5xl sm:text-6xl';
  if (n <= 9) return 'text-[2.75rem] sm:text-6xl';
  if (n <= 12) return 'text-[2rem] sm:text-5xl';
  return 'text-3xl sm:text-4xl';
}

function BigText({ face, className, id }: { face: FlashcardFace; className?: string; id?: string }) {
  return (
    <p id={id} className={cn('flex flex-col items-center', className)}>
      <span
        className={cn(
          'max-w-full leading-[1.05] font-black tracking-tight wrap-break-word hyphens-auto',
          mainTextClass(face.main),
        )}
      >
        {face.emoji && (
          <span aria-hidden className="mr-2 inline-block text-[0.8em]">
            {face.emoji}
          </span>
        )}
        {face.main}
      </span>
      {face.sub && <span className="mt-2 text-lg font-extrabold text-muted sm:text-xl">{face.sub}</span>}
    </p>
  );
}

const FACE =
  'relative [grid-area:1/1] face-hidden flex min-h-[16rem] flex-col overflow-hidden rounded-[2rem] border border-border bg-surface shadow-float sm:min-h-[20rem]';

/**
 * Tarjeta con giro 3D: el anverso muestra la pregunta y el reverso la respuesta con los datos
 * del elemento y un truco para recordarlo. Las dos caras comparten celda de la rejilla, así que
 * la tarjeta mide lo que la cara más alta. La cara oculta queda `inert` (fuera del foco y de los
 * lectores de pantalla).
 */
export function Flashcard({ element, mode, flipped, onFlip, repeat = false, frontId, answerId, className }: FlashcardProps) {
  const front = mode.front(element);
  const back = mode.back(element);
  const category = CATEGORIES[element.category];

  return (
    <div className={cn('perspective-card w-full', className)}>
      {/* El clic es un atajo táctil; con teclado se gira con el botón «Mostrar respuesta» o Espacio/Enter. */}
      <div
        onClick={onFlip}
        className={cn(
          'relative grid cursor-pointer preserve-3d select-none transition-transform duration-500 ease-snappy',
          flipped && 'flip-y',
        )}
      >
        {/* --- Anverso --- */}
        <div
          inert={flipped}
          className={cn(
            FACE,
            '[transform:rotateY(0deg)] bg-[radial-gradient(120%_65%_at_50%_0%,var(--color-brand-soft)_0%,transparent_70%)]',
          )}
        >
          <div className="relative flex items-center justify-between gap-2 px-5 pt-4">
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-black tracking-wide text-muted uppercase">
              {mode.frontLabel}
            </span>
            {repeat && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-black text-warning">
                <span aria-hidden>🔁</span> Otra vez
              </span>
            )}
          </div>
          <div id={frontId} className="relative flex flex-1 flex-col items-center justify-center gap-4 px-5 py-6 text-center">
            <p className="font-bold text-muted sm:text-lg">{mode.prompt}</p>
            <BigText face={front} />
          </div>
          <p className="relative flex items-center justify-center gap-1.5 pb-4 text-sm font-bold text-muted">
            <RotateCw aria-hidden className="size-4" />
            Toca para girar
          </p>
        </div>

        {/* --- Reverso --- */}
        <div inert={!flipped} className={cn(FACE, 'flip-y')}>
          <div aria-hidden className={cn('h-1.5 w-full shrink-0', category.solidClass)} />
          <div className="flex flex-1 flex-col gap-4 p-5 [@media(max-height:700px)]:gap-2.5 [@media(max-height:700px)]:p-3.5">
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-black tracking-wide text-success uppercase">
                {mode.backLabel}
              </span>
              <BigText id={answerId} face={back} className="mt-1 text-brand" />
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <ElementTile element={element} size="sm" decorative />
              <div className="min-w-0 flex-1">
                <p className="truncate font-black">
                  {element.name} <span className="text-muted">· {element.symbol}</span>
                </p>
                <p className="text-sm font-bold text-muted tabular">
                  Número atómico: <span className="text-fg">{element.atomicNumber}</span>
                  <span aria-hidden> · </span>
                  <span className="whitespace-nowrap">
                    Masa: <span className="text-fg">{formatMass(element)}</span>
                  </span>
                </p>
                <span
                  className={cn(
                    'mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2.5 py-0.5 text-xs font-extrabold',
                    category.tileClass,
                  )}
                >
                  <span aria-hidden>{category.emoji}</span>
                  {categoryLabel(element.category)}
                </span>
              </div>
            </div>

            {element.memoryTip && (
              <div className="rounded-2xl border border-xp/30 bg-xp-soft/70 p-3 text-left">
                <p className="text-xs font-black tracking-wide text-xp uppercase">
                  <span aria-hidden>💡 </span>Truco
                </p>
                <p className="mt-0.5 text-sm leading-snug font-semibold">{element.memoryTip}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
