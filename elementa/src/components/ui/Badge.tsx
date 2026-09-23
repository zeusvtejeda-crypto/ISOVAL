import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { TONE_SOFT, TONE_SOLID, type Tone } from './tones';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  variant?: 'soft' | 'solid';
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

const SIZES = {
  sm: 'h-6 gap-1 px-2 text-xs [&_svg]:size-3.5',
  md: 'h-7 gap-1.5 px-2.5 text-sm [&_svg]:size-4',
} as const;

/** Etiqueta informativa pequeña (no interactiva). */
export function Badge({ tone = 'neutral', variant = 'soft', size = 'sm', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-extrabold leading-none tabular',
        variant === 'soft' ? TONE_SOFT[tone] : TONE_SOLID[tone],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
