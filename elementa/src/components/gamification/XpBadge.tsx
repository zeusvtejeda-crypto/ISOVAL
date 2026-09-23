'use client';

import { useProgress } from '@/hooks/useProgress';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNumber } from '@/utils/format';

export interface XpBadgeProps {
  /** XP a mostrar; por defecto, la XP total del usuario. */
  value?: number;
  /** Antepone "+" (ganancias: "+10 XP"). */
  plus?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'soft' | 'solid';
  className?: string;
}

const SIZES = {
  sm: 'h-7 gap-1 px-2.5 text-xs',
  md: 'h-9 gap-1.5 px-3 text-sm',
  lg: 'h-12 gap-2 px-4 text-lg',
} as const;

/** ⚡ XP total o ganada. */
export function XpBadge({ value, plus = false, size = 'md', variant = 'soft', className }: XpBadgeProps) {
  const { state, ready } = useProgress();
  const amount = value ?? (ready ? state.xp : null);

  if (amount === null) {
    return <Skeleton rounded="full" className={cn(SIZES[size], 'w-20', className)} />;
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full font-black leading-none tabular',
        variant === 'soft' ? 'bg-xp-soft text-xp' : 'bg-xp text-bg',
        SIZES[size],
        className,
      )}
    >
      <span aria-hidden>⚡</span>
      {plus && amount > 0 ? '+' : ''}
      {formatNumber(amount)} XP
    </span>
  );
}
