import type { ReactNode } from 'react';
import { cn } from '@/components/ui';

export interface SettingsSectionProps {
  id: string;
  title: string;
  emoji: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Tarjeta de un grupo de ajustes con su título (h2). */
export function SettingsSection({ id, title, emoji, description, children, className }: SettingsSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn('rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-5', className)}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl leading-none">
          {emoji}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-lg leading-tight font-black">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm font-semibold text-muted">{description}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
