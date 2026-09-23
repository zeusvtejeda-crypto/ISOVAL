import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardTone = 'default' | 'soft' | 'brand';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Efecto de elevación al pasar el cursor y hundimiento al pulsar (para tarjetas envueltas en enlaces/botones). */
  interactive?: boolean;
  padding?: CardPadding;
  tone?: CardTone;
  as?: 'div' | 'section' | 'article' | 'aside' | 'li';
}

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-7',
};

const TONES: Record<CardTone, string> = {
  default: 'border border-border bg-surface shadow-card',
  soft: 'border border-transparent bg-surface-2',
  brand: 'border border-transparent bg-brand-gradient text-on-brand shadow-card',
};

export function Card({ interactive = false, padding = 'md', tone = 'default', as: Tag = 'div', className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        'relative rounded-3xl',
        TONES[tone],
        PADDING[padding],
        interactive &&
          'cursor-pointer transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-float active:translate-y-0 active:scale-[0.99] motion-reduce:hover:translate-y-0',
        interactive && tone === 'default' && 'hover:border-border-strong',
        className,
      )}
      {...rest}
    />
  );
}
