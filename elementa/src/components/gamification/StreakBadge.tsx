'use client';

import { useProgress } from '@/hooks/useProgress';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/Skeleton';

export interface StreakBadgeProps {
  /** Días de racha; por defecto, la racha actual del usuario. */
  count?: number;
  /** Meta de hoy cumplida (llama encendida). Por defecto, el estado del usuario. */
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Añade "días" tras el número. */
  showLabel?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'h-8 gap-1 px-2.5 text-sm',
  md: 'h-10 gap-1.5 px-3.5 text-base',
  lg: 'h-14 gap-2 px-5 text-2xl',
} as const;

/** 🔥 + días de racha. La llama se apaga (gris) mientras la meta de hoy no se cumple. */
export function StreakBadge({ count, active, size = 'md', showLabel = false, className }: StreakBadgeProps) {
  const { streak, ready } = useProgress();
  const days = count ?? (ready ? streak.current : null);
  const lit = active ?? (ready ? streak.todayMet : false);

  if (days === null) {
    return <Skeleton rounded="full" className={cn(SIZES[size], 'w-16', className)} />;
  }

  const unit = days === 1 ? 'día' : 'días';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full font-black leading-none tabular transition-colors',
        SIZES[size],
        lit ? 'bg-streak-soft text-streak' : 'bg-surface-2 text-muted',
        className,
      )}
    >
      <span
        key={lit ? `on-${days}` : 'off'}
        aria-hidden
        className={cn('inline-block', lit ? 'animate-wiggle' : 'opacity-60 grayscale')}
      >
        🔥
      </span>
      <span aria-hidden>
        {days}
        {showLabel && <span className="ml-1 font-extrabold">{unit}</span>}
      </span>
      <span className="sr-only">
        {`Racha de ${days} ${unit}${lit ? ', meta de hoy cumplida' : ', meta de hoy pendiente'}`}
      </span>
    </span>
  );
}
