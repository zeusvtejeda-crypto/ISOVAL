'use client';

import { memo, type CSSProperties } from 'react';
import { cn } from '@/components/ui';
import { CATEGORIES } from '@/data/categories';
import type { ChemicalElement } from '@/types';
import { masteryTier, TIER_META } from '@/utils/mastery';
import { positionLabel } from './table-geometry';

export type TileSize = 'xs' | 'sm' | 'md' | 'lg';
export type TileStatus = 'default' | 'selected' | 'correct' | 'incorrect' | 'dimmed' | 'highlight';

export interface ElementTileProps {
  element: ChemicalElement;
  /** Tamaño fijo. Se ignora con `fluid`. */
  size?: TileSize;
  status?: TileStatus;
  /** Muestra una barra fina con el dominio (color por nivel). */
  showMastery?: boolean;
  /** Dominio 0–100. */
  mastery?: number;
  /** Con `onClick` la casilla es un `<button>`; si no, una figura estática. */
  onClick?: (atomicNumber: number) => void;
  /** Ocupa el ancho de su celda (cuadrada). La tipografía escala con el tamaño (container queries). */
  fluid?: boolean;
  /** Oculta número, símbolo y nombre (preguntas "¿dónde está…?"). El nombre accesible pasa a ser la posición. */
  blind?: boolean;
  /** Sin color de familia (preguntas en las que el color delataría la respuesta). */
  neutral?: boolean;
  /** Estado de conmutador (`aria-pressed`) en selección múltiple. */
  pressed?: boolean;
  /** Oculta la casilla a los lectores de pantalla (cuando el texto de al lado ya la describe). */
  decorative?: boolean;
  tabIndex?: number;
  style?: CSSProperties;
  className?: string;
}

const SIZES: Record<TileSize, string> = {
  xs: 'size-10 rounded-[0.625rem] border-[1.5px]',
  sm: 'size-14 rounded-xl border-2',
  md: 'size-20 rounded-2xl border-2',
  lg: 'size-28 rounded-3xl border-[3px] shadow-card sm:size-32',
};

const FLUID = 'aspect-square w-full rounded-[14%] border-[1.5px]';

/** Colores sólidos que sustituyen al color de la familia. */
const SOLID: Partial<Record<TileStatus, string>> = {
  selected: 'border-brand-shade bg-brand text-on-brand',
  correct: 'border-success-shade bg-success text-on-success',
  incorrect: 'border-danger-shade bg-danger text-on-danger',
};

const EFFECTS: Record<TileStatus, string> = {
  default: '',
  selected: 'z-10 shadow-card animate-pop',
  correct: 'z-10 shadow-card animate-pop',
  incorrect: 'z-10 animate-shake',
  highlight: 'z-10 scale-110 shadow-float ring-[3px] ring-brand animate-pop',
  dimmed: 'opacity-30 saturate-50',
};

const STATUS_SPEECH: Partial<Record<TileStatus, string>> = {
  correct: ', correcto',
  incorrect: ', incorrecto',
};

function clampMastery(m: number): number {
  return Number.isFinite(m) ? Math.round(Math.min(100, Math.max(0, m))) : 0;
}

/**
 * Casilla de un elemento: número (arriba a la izquierda), símbolo grande y nombre.
 * Con `fluid` la tipografía se adapta al ancho: por debajo de ~40 px solo se ve el símbolo y
 * por debajo de ~60 px se oculta el nombre.
 */
export const ElementTile = memo(function ElementTile({
  element,
  size = 'md',
  status = 'default',
  showMastery = false,
  mastery = 0,
  onClick,
  fluid = false,
  blind = false,
  neutral = false,
  pressed,
  decorative = false,
  tabIndex,
  style,
  className,
}: ElementTileProps) {
  const z = element.atomicNumber;
  const value = clampMastery(mastery);
  const hasMastery = showMastery && !blind && value > 0;
  const color = SOLID[status] ?? (neutral ? 'border-border bg-surface-2 text-fg' : CATEGORIES[element.category].tileClass);
  const interactive = onClick !== undefined;

  const label =
    (blind ? positionLabel(element) : `${element.name}, ${element.symbol}, número atómico ${z}`) +
    (hasMastery ? `, dominio ${value}%` : '') +
    (STATUS_SPEECH[status] ?? '');

  const classes = cn(
    '@container relative block shrink-0 select-none overflow-hidden text-left',
    'transition-[translate,scale,opacity,filter,background-color,border-color,box-shadow] duration-150 ease-out',
    fluid ? FLUID : SIZES[size],
    color,
    EFFECTS[status],
    interactive &&
      'focus-visible:z-20 hover:z-10 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 active:scale-95 motion-reduce:hover:translate-y-0',
    interactive && status === 'dimmed' && 'hover:opacity-80 hover:saturate-100',
    className,
  );

  const content = (
    <>
      {!blind && (
        <span
          aria-hidden
          className="absolute top-[6%] left-[9%] hidden text-[length:19cqw] leading-none font-extrabold tabular opacity-80 @min-[2.5rem]:block"
        >
          {z}
        </span>
      )}
      {!blind && (
        <span
          aria-hidden
          className="absolute inset-0 flex flex-col items-center justify-center @min-[2.5rem]:pt-[13cqw]"
        >
          <span className="text-[length:46cqw] leading-none font-black tracking-tight @min-[2.5rem]:text-[length:40cqw]">
            {element.symbol}
          </span>
          <span className="mt-[5cqw] hidden w-full truncate px-[7%] text-center text-[length:13.5cqw] leading-tight font-bold @min-[3.75rem]:block">
            {element.name}
          </span>
        </span>
      )}
      {hasMastery && (
        <span aria-hidden className="absolute inset-x-[12%] bottom-[6%] h-[7%] min-h-0.5 overflow-hidden rounded-full bg-fg/15">
          <span
            className={cn('block h-full rounded-full', TIER_META[masteryTier(value)].barClass)}
            style={{ width: `${value}%` }}
          />
        </span>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        data-z={z}
        aria-label={label}
        aria-pressed={pressed}
        tabIndex={tabIndex}
        onClick={() => onClick(z)}
        className={classes}
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      data-z={z}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={classes}
      style={style}
    >
      {content}
    </div>
  );
});
