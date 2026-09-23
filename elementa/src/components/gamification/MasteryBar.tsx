import { cn } from '@/components/ui/cn';
import { TIER_META, masteryTier } from '@/utils/mastery';

export interface MasteryBarProps {
  /** Dominio 0–100. */
  value: number;
  /** Número de segmentos (por defecto 10: ████████░░). */
  segments?: number;
  /** Muestra el porcentaje. Por defecto `true`. */
  showValue?: boolean;
  /** Muestra la etiqueta del nivel ("Casi dominado"). */
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Barra segmentada de dominio con el color del nivel (🔴 🟠 🟡 🟢). */
export function MasteryBar({ value, segments = 10, showValue = true, showLabel = false, size = 'md', className }: MasteryBarProps) {
  const pct = Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
  const count = Math.max(1, Math.floor(segments));
  const filled = Math.round((pct / 100) * count);
  const tier = masteryTier(pct);
  const meta = TIER_META[tier];

  return (
    <div role="img" aria-label={`Dominio: ${pct}% (${meta.label})`} className={cn('flex items-center gap-2.5', className)}>
      <div aria-hidden className={cn('flex flex-1 gap-[3px]', size === 'sm' ? 'h-2' : 'h-3')}>
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={cn(
              'flex-1 transition-colors duration-500 first:rounded-l-full last:rounded-r-full',
              size === 'sm' ? 'rounded-[2px]' : 'rounded-[3px]',
              i < filled ? meta.barClass : 'bg-surface-2 ring-1 ring-border/70 ring-inset',
            )}
          />
        ))}
      </div>
      {(showValue || showLabel) && (
        <span aria-hidden className={cn('shrink-0 font-black tabular', size === 'sm' ? 'text-xs' : 'text-sm', meta.textClass)}>
          {showValue && `${pct}%`}
          {showValue && showLabel && ' · '}
          {showLabel && meta.label}
        </span>
      )}
    </div>
  );
}
