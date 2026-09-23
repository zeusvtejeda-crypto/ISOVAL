import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: 'md' | 'xl' | '2xl' | '3xl' | 'full';
}

const ROUNDED = {
  md: 'rounded-md',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
  full: 'rounded-full',
} as const;

/** Marcador de carga con brillo. Dale tamaño con `className` (p. ej. "h-6 w-24"). */
export function Skeleton({ rounded = 'xl', className, ...rest }: SkeletonProps) {
  return <div aria-hidden className={cn('shimmer', ROUNDED[rounded], className)} {...rest} />;
}
