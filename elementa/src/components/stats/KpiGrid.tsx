import type { ReactNode } from 'react';
import { TONE_SOFT, cn, type Tone } from '@/components/ui';

export interface Kpi {
  key: string;
  emoji: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone: Tone;
}

/** Métrica clave: emoji, valor grande (que nunca se corta) y etiqueta. */
function KpiTile({ emoji, label, value, hint, tone }: Omit<Kpi, 'key'>) {
  return (
    <div className="flex min-w-0 flex-col-reverse justify-end gap-2 rounded-3xl border border-border bg-surface p-4 shadow-card">
      <dt className="min-w-0">
        <span className="block text-sm font-bold text-muted">{label}</span>
        {hint && <span className="mt-0.5 block text-xs font-semibold text-muted">{hint}</span>}
      </dt>
      <dd className="flex min-w-0 flex-col gap-2">
        <span aria-hidden className={cn('grid size-10 place-items-center rounded-2xl text-xl leading-none', TONE_SOFT[tone])}>
          {emoji}
        </span>
        <span className="text-xl leading-tight font-black break-words min-[380px]:text-2xl sm:text-3xl">{value}</span>
      </dd>
    </div>
  );
}

/** Rejilla de métricas clave (lista de definiciones: etiqueta → valor). */
export function KpiGrid({ items, className }: { items: readonly Kpi[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-3 lg:grid-cols-3', className)}>
      {items.map(({ key, ...kpi }) => (
        <KpiTile key={key} {...kpi} />
      ))}
    </dl>
  );
}
