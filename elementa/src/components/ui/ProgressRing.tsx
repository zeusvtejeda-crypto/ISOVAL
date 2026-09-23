import type { ReactNode } from 'react';
import { cn } from './cn';
import { clamp01 } from './ProgressBar';
import { TONE_STROKE, type Tone } from './tones';

export interface ProgressRingProps {
  /** Progreso 0–1. */
  value: number;
  /** Diámetro en px. */
  size?: number;
  /** Grosor del trazo en px. */
  stroke?: number;
  tone?: Tone;
  /** Si se indica, el anillo se expone como `progressbar` con este nombre. */
  label?: string;
  children?: ReactNode;
  className?: string;
  /** Clase del trazo de fondo (por defecto `stroke-surface-2`). */
  trackClassName?: string;
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  tone = 'brand',
  label,
  children,
  className,
  trackClassName = 'stroke-surface-2',
}: ProgressRingProps) {
  const ratio = clamp01(value);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);

  return (
    <div
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
      {...(label
        ? {
            role: 'progressbar',
            'aria-label': label,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round(ratio * 100),
          }
        : {})}
    >
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke="currentColor"
          className={cn(
            'transition-[stroke-dashoffset] duration-700 ease-snappy',
            TONE_STROKE[tone],
            ratio === 0 && 'opacity-0',
          )}
        />
      </svg>
      {children !== undefined && <div className="relative grid place-items-center text-center leading-none">{children}</div>}
    </div>
  );
}
