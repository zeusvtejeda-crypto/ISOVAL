import type { ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  /** Emoji grande o icono. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Acción principal (p. ej. un `ButtonLink`). */
  action?: ReactNode;
  className?: string;
}

/** Estado vacío amable: ilustración con emoji, texto breve y una acción para salir de él. */
export function EmptyState({ icon = '🧪', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center animate-fade-in', className)}>
      <div
        aria-hidden
        className="mb-4 grid size-20 place-items-center rounded-[1.75rem] bg-brand-soft text-4xl text-brand animate-float [&_svg]:size-9"
      >
        {icon}
      </div>
      <h2 className="text-xl font-black">{title}</h2>
      {description && <p className="mt-1.5 max-w-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
