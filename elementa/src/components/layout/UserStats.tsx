'use client';

import Link from 'next/link';
import { useProgress } from '@/hooks/useProgress';
import { cn } from '@/components/ui/cn';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { StreakBadge } from '@/components/gamification/StreakBadge';
import { formatNumber } from '@/utils/format';

/** Amplía la zona táctil de las pastillas de 40 px a 48 px. */
const HIT = 'relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-[""]';

/** Pastillas de racha 🔥 y nivel/XP para la barra superior. */
export function UserStats({ className }: { className?: string }) {
  const { ready, streak, level } = useProgress();

  if (!ready) {
    return (
      <div className={cn('flex items-center gap-1.5', className)} aria-hidden>
        <Skeleton rounded="full" className="h-10 w-14" />
        <Skeleton rounded="full" className="h-10 w-10 sm:w-28" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Link href="/estadisticas" className={cn(HIT, 'rounded-full transition-transform active:scale-95')}>
        <StreakBadge count={streak.current} active={streak.todayMet} size="md" className="h-10 max-[359px]:px-2.5" />
      </Link>
      <Link
        href="/logros"
        aria-label={`Nivel ${level.level}, ${level.title}: ${formatNumber(level.totalXp)} XP`}
        className={cn(
          HIT,
          'inline-flex h-10 items-center gap-2 rounded-full bg-brand-soft pr-1 pl-1 text-brand transition-transform active:scale-95 sm:pr-3.5',
        )}
      >
        <ProgressRing value={level.progress} size={32} stroke={3.5} tone="brand" trackClassName="stroke-surface">
          <span className="text-[0.8rem] font-black tabular">{level.level}</span>
        </ProgressRing>
        <span className="hidden text-sm font-black tabular sm:inline">{formatNumber(level.totalXp)} XP</span>
      </Link>
    </div>
  );
}
