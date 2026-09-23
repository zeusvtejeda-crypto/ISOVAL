'use client';

import { useProgress } from '@/hooks/useProgress';
import { cn } from '@/components/ui/cn';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';

export interface DailyGoalRingProps {
  /** Diámetro en px. */
  size?: number;
  stroke?: number;
  /** Texto bajo el anillo ("Faltan 3" / "¡Meta cumplida!"). */
  showLabel?: boolean;
  /** Preguntas hechas hoy; por defecto, las del usuario. */
  done?: number;
  /** Meta diaria; por defecto, la de los ajustes. */
  goal?: number;
  className?: string;
}

/** Anillo de la meta diaria: preguntas de hoy / meta. Se vuelve verde con ✅ al cumplirla. */
export function DailyGoalRing({ size = 88, stroke, showLabel = true, done, goal, className }: DailyGoalRingProps) {
  const { today, state, ready } = useProgress();
  const count = done ?? (ready ? today.questions : null);
  const target = goal ?? (ready ? state.settings.dailyGoal : null);
  const width = stroke ?? Math.max(4, Math.round(size / 10));

  if (count === null || target === null) {
    return (
      <div className={cn('inline-flex flex-col items-center gap-2', className)}>
        <Skeleton rounded="full" style={{ width: size, height: size }} />
        {showLabel && <Skeleton className="h-4 w-16" />}
      </div>
    );
  }

  const safeTarget = Math.max(1, target);
  const met = count >= safeTarget;
  const remaining = Math.max(0, safeTarget - count);
  const large = size >= 72;

  return (
    <div className={cn('inline-flex flex-col items-center gap-2', className)}>
      <ProgressRing
        value={count / safeTarget}
        size={size}
        stroke={width}
        tone={met ? 'success' : 'streak'}
        label={`Meta diaria: ${Math.min(count, safeTarget)} de ${safeTarget} preguntas`}
      >
        {met ? (
          <span aria-hidden className={cn('animate-pop leading-none', large ? 'text-3xl' : 'text-lg')}>
            ✅
          </span>
        ) : (
          <span aria-hidden className="flex flex-col items-center leading-none">
            <span className={cn('font-black tabular', large ? 'text-2xl' : 'text-sm')}>{count}</span>
            {large && <span className="mt-1 text-[0.7rem] font-extrabold text-muted">de {safeTarget}</span>}
          </span>
        )}
      </ProgressRing>
      {showLabel && (
        <p className={cn('text-sm font-extrabold', met ? 'text-success' : 'text-muted')}>
          {met ? '¡Meta cumplida!' : `Faltan ${remaining}`}
        </p>
      )}
    </div>
  );
}
