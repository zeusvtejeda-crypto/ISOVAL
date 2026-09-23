import type { ReactNode } from 'react';
import { cn } from './cn';
import { TONE_SOFT, type Tone } from './tones';

export interface StatTileProps {
  /** Emoji o icono (lucide). */
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Color del fondo del icono. */
  tone?: Tone;
  className?: string;
}

/** Tarjeta compacta con una métrica: icono, valor grande, etiqueta y pista opcional. */
export function StatTile({ icon, label, value, hint, tone = 'brand', className }: StatTileProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-3xl border border-border bg-surface p-4 shadow-card', className)}>
      {icon !== undefined && (
        <span
          aria-hidden
          className={cn('grid size-10 place-items-center rounded-2xl text-xl leading-none [&_svg]:size-5', TONE_SOFT[tone])}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-2xl font-black leading-tight tabular sm:text-3xl">{value}</p>
        <p className="mt-0.5 text-sm font-bold text-muted">{label}</p>
        {hint && <p className="mt-1 text-xs font-semibold text-muted">{hint}</p>}
      </div>
    </div>
  );
}
