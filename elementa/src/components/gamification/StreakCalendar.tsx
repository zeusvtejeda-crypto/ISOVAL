'use client';

import { useProgress } from '@/hooks/useProgress';
import { useHydrated } from '@/hooks/useHydrated';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import type { DailyActivity } from '@/types';
import { todayKey } from '@/utils/dates';
import { weekActivity, type WeekDay } from '@/utils/streak';

export interface StreakCalendarProps {
  /** Actividad diaria; por defecto, la del usuario. */
  daily?: Record<string, DailyActivity>;
  /** Día de referencia (YYYY-MM-DD); por defecto, hoy en hora local. */
  today?: string;
  className?: string;
}

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

function describe(day: WeekDay): string {
  if (day.goalMet) return 'meta cumplida';
  if (day.isFuture) return 'aún no llega';
  if (day.isToday) return day.active ? 'hoy, meta en progreso' : 'hoy, meta pendiente';
  return day.active ? 'practicaste, sin completar la meta' : 'sin actividad';
}

/** Semana actual (L M M J V S D) con ✅ en los días en que se cumplió la meta. */
export function StreakCalendar({ daily, today, className }: StreakCalendarProps) {
  const { state, ready } = useProgress();
  const hydrated = useHydrated();
  const map = daily ?? (ready ? state.daily : null);
  const key = today ?? (hydrated ? todayKey() : null);

  if (!map || !key) {
    return (
      <div aria-hidden className={cn('grid grid-cols-7 gap-1 min-[400px]:gap-1.5 sm:gap-2', className)}>
        {DAY_NAMES.map((name) => (
          <div key={name} className="flex min-w-0 flex-col items-center gap-1.5">
            <Skeleton className="h-3 w-3" rounded="md" />
            <Skeleton className="aspect-square w-full max-w-10" rounded="full" />
          </div>
        ))}
      </div>
    );
  }

  const week = weekActivity(map, key);

  return (
    <ol aria-label="Actividad de esta semana" className={cn('grid grid-cols-7 gap-1 min-[400px]:gap-1.5 sm:gap-2', className)}>
      {week.map((day, i) => (
        <li key={day.key} className="flex min-w-0 flex-col items-center gap-1.5">
          <span aria-hidden className={cn('text-xs font-black', day.isToday ? 'text-brand' : 'text-muted')}>
            {day.letter}
          </span>
          <span
            aria-hidden
            className={cn(
              'grid aspect-square w-full max-w-10 place-items-center rounded-full text-sm leading-none min-[400px]:text-base sm:text-lg',
              day.goalMet && 'bg-streak-soft ring-2 ring-streak/35 animate-pop',
              !day.goalMet && day.isToday && 'border-2 border-dashed border-brand bg-brand-soft',
              !day.goalMet && !day.isToday && day.isFuture && 'border border-dashed border-border bg-transparent',
              !day.goalMet && !day.isToday && !day.isFuture && 'bg-surface-2',
            )}
          >
            {day.goalMet ? '✅' : day.active ? <span className="size-2 rounded-full bg-streak" /> : null}
          </span>
          <span className="sr-only">{`${DAY_NAMES[i]}: ${describe(day)}`}</span>
        </li>
      ))}
    </ol>
  );
}
