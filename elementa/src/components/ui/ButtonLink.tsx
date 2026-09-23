import type { ComponentPropsWithRef, ReactNode } from 'react';
import Link from 'next/link';
import { buttonClasses, type ButtonStyleOptions } from './button-styles';

export interface ButtonLinkProps extends Omit<ComponentPropsWithRef<typeof Link>, 'className'>, ButtonStyleOptions {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/** Enlace de navegación con el aspecto de `Button` (usa `next/link`). */
export function ButtonLink({ variant, size, block, className, leftIcon, rightIcon, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
