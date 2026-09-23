import type { ReactNode } from 'react';
import { Card, cn } from '@/components/ui';

export interface ChartCardProps {
  id: string;
  emoji: string;
  title: string;
  /** Resumen en una línea bajo el título ("42 esta semana · mejor día: 12"). */
  summary?: ReactNode;
  /** Mensaje cuando aún no hay datos (se superpone al gráfico vacío). */
  emptyText?: string | null;
  children: ReactNode;
  className?: string;
}

/** Tarjeta de un gráfico: título, resumen, el gráfico y (si no hay datos) un aviso amable. */
export function ChartCard({ id, emoji, title, summary, emptyText, children, className }: ChartCardProps) {
  const titleId = `${id}-title`;
  return (
    <Card as="section" aria-labelledby={titleId} className={cn('flex flex-col gap-3', className)}>
      <div>
        <h3 id={titleId} className="text-lg leading-tight font-black">
          <span aria-hidden className="mr-1.5">
            {emoji}
          </span>
          {title}
        </h3>
        {summary && <p className="mt-0.5 text-sm font-semibold text-muted">{summary}</p>}
      </div>
      <div className="relative">
        <div className={cn(emptyText && 'opacity-50')}>{children}</div>
        {emptyText && (
          <p className="absolute inset-x-0 top-1/3 mx-auto w-fit max-w-[85%] -translate-y-1/2 rounded-2xl border border-border bg-surface px-4 py-2 text-center text-sm font-bold text-muted shadow-card">
            {emptyText}
          </p>
        )}
      </div>
    </Card>
  );
}
