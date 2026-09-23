import type { ReactNode } from 'react';
import { cn } from './cn';
import { TONE_FILL, type Tone } from './tones';

export type ProgressBarSize = 'sm' | 'md' | 'lg';

export interface ProgressBarProps {
  /** Progreso 0–1 (se recorta a ese rango). */
  value: number;
  tone?: Tone;
  size?: ProgressBarSize;
  /** Etiqueta visible sobre la barra (también se usa como nombre accesible). */
  label?: ReactNode;
  /** Muestra el porcentaje (o `valueText`) a la derecha de la etiqueta. */
  showValue?: boolean;
  /** Texto a mostrar en lugar del porcentaje, p. ej. "840 / 1000 XP". */
  valueText?: string;
  /** Nombre accesible cuando `label` no es texto. */
  ariaLabel?: string;
  className?: string;
}

const HEIGHTS: Record<ProgressBarSize, string> = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

export function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export function ProgressBar({
  value,
  tone = 'brand',
  size = 'md',
  label,
  showValue = false,
  valueText,
  ariaLabel,
  className,
}: ProgressBarProps) {
  const ratio = clamp01(value);
  const pct = Math.round(ratio * 100);
  const text = valueText ?? `${pct}%`;
  const name = ariaLabel ?? (typeof label === 'string' ? label : 'Progreso');
  const hasHeader = label !== undefined || showValue;

  return (
    <div className={cn('w-full', className)}>
      {hasHeader && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          {label !== undefined && <span className="min-w-0 truncate font-bold text-fg">{label}</span>}
          {showValue && <span className="ml-auto shrink-0 font-extrabold tabular text-muted">{text}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={valueText}
        className={cn('relative w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-border/70 ring-inset', HEIGHTS[size])}
      >
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-snappy',
            TONE_FILL[tone],
            ratio === 0 && 'opacity-0',
          )}
          style={{ width: ratio > 0 ? `max(${pct}%, 0.625rem)` : '0%' }}
        >
          {size !== 'sm' && (
            <span aria-hidden className="absolute inset-x-1.5 top-[22%] h-[26%] rounded-full bg-white/35" />
          )}
        </div>
      </div>
    </div>
  );
}
