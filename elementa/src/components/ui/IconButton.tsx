import type { ComponentPropsWithRef, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from './cn';

export type IconButtonVariant = 'ghost' | 'soft' | 'secondary' | 'primary';
export type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonStyle {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  className?: string;
}

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: 'text-fg hover:bg-surface-2 active:bg-border/70',
  soft: 'bg-surface-2 text-fg hover:bg-border/70',
  secondary: 'border-2 border-border bg-surface text-fg hover:bg-surface-2',
  primary: 'bg-brand text-on-brand hover:brightness-[1.06]',
};

/** `sm` mide 36 px pero amplía su zona táctil a 44 px con un pseudo-elemento. */
const SIZES: Record<IconButtonSize, string> = {
  sm: 'size-9 rounded-xl [&_svg]:size-[1.125rem] before:absolute before:-inset-1 before:content-[""]',
  md: 'size-11 rounded-2xl [&_svg]:size-5',
  lg: 'size-13 rounded-2xl [&_svg]:size-6',
};

function iconButtonClasses({ variant = 'ghost', size = 'md', className }: IconButtonStyle): string {
  return cn(
    'relative inline-grid shrink-0 select-none place-items-center transition-[background-color,transform,filter] duration-150',
    'active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'className' | 'children' | 'aria-label'>, IconButtonStyle {
  /** Nombre accesible (obligatorio: el botón solo muestra un icono). */
  label: string;
  icon: ReactNode;
}

/** Botón cuadrado con solo un icono. */
export function IconButton({ label, icon, variant, size, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} className={iconButtonClasses({ variant, size, className })} {...rest}>
      {icon}
    </button>
  );
}

export interface IconLinkProps extends Omit<ComponentPropsWithRef<typeof Link>, 'className' | 'children' | 'aria-label'>, IconButtonStyle {
  label: string;
  icon: ReactNode;
}

/** Igual que `IconButton` pero navega con `next/link`. */
export function IconLink({ label, icon, variant, size, className, ...rest }: IconLinkProps) {
  return (
    <Link aria-label={label} className={iconButtonClasses({ variant, size, className })} {...rest}>
      {icon}
    </Link>
  );
}
