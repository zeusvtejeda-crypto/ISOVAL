import type { ComponentPropsWithRef, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { buttonClasses, type ButtonStyleOptions } from './button-styles';

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'className'>, ButtonStyleOptions {
  /** Muestra un indicador de carga y desactiva el botón. */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant,
  size,
  block,
  className,
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <LoaderCircle aria-hidden className="shrink-0 animate-spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
