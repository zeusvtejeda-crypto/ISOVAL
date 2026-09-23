import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** Estado seleccionado (se expone como `aria-pressed`). */
  selected?: boolean;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZES = {
  sm: 'min-h-9 gap-1.5 px-3 text-sm [&_svg]:size-4',
  md: 'min-h-11 gap-2 px-4 text-sm [&_svg]:size-4',
} as const;

/**
 * Pastilla seleccionable (filtros, temas, opciones). Con `onClick` es un botón conmutador;
 * sin él se muestra como etiqueta estática.
 */
export function Chip({ selected = false, icon, size = 'md', className, children, onClick, type = 'button', ...rest }: ChipProps) {
  const classes = cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-full border-2 font-bold',
    'transition-[background-color,border-color,color,transform] duration-150',
    SIZES[size],
    selected ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-fg',
    className,
  );

  if (!onClick) {
    return (
      <span className={classes}>
        {icon}
        {children}
      </span>
    );
  }

  return (
    <button
      type={type}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        classes,
        'active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50',
        !selected && 'hover:border-border-strong hover:bg-surface-2',
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
