import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ocupa todo el ancho disponible. */
  block?: boolean;
  className?: string;
}

const BASE =
  'relative inline-flex select-none items-center justify-center whitespace-nowrap font-extrabold tracking-tight ' +
  'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

/** Los botones "presionables" tienen una sombra inferior sólida que se hunde al pulsar. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'pressable bg-brand text-on-brand [--press-shade:var(--color-brand-shade)] hover:brightness-[1.06]',
  success: 'pressable bg-success text-on-success [--press-shade:var(--color-success-shade)] hover:brightness-[1.06]',
  danger: 'pressable bg-danger text-on-danger [--press-shade:var(--color-danger-shade)] hover:brightness-[1.06]',
  secondary:
    'pressable border-2 border-border bg-surface text-fg [--press-shade:var(--color-border)] hover:bg-surface-2',
  outline:
    'border-2 border-brand/40 bg-transparent text-brand transition-[transform,background-color,border-color] duration-150 hover:border-brand hover:bg-brand-soft active:scale-[0.97]',
  ghost:
    'bg-transparent text-fg transition-[transform,background-color] duration-150 hover:bg-surface-2 active:scale-[0.97] active:bg-border/70',
};

/** Alturas ≥ 44 px (objetivo táctil mínimo). */
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-11 gap-1.5 rounded-xl px-4 text-sm [&_svg]:size-4',
  md: 'min-h-12 gap-2 rounded-2xl px-5 text-base [&_svg]:size-5',
  lg: 'min-h-14 gap-2.5 rounded-2xl px-7 text-lg [&_svg]:size-6',
};

/** Clases de un botón; compartidas por `Button` y `ButtonLink`. */
export function buttonClasses({ variant = 'primary', size = 'md', block = false, className }: ButtonStyleOptions = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], block && 'flex w-full', className);
}
