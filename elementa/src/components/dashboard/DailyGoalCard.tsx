'use client';

import { SlidersHorizontal } from 'lucide-react';
import { DailyGoalRing, StreakCalendar } from '@/components/gamification';
import { Card, IconLink, cn } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { pluralize } from '@/utils/format';
import { dailyGoalStatus } from './daily-goal';

/** Meta diaria (anillo + texto) y la semana actual con los días cumplidos ✅. */
export function DailyGoalCard({ className }: { className?: string }) {
  const { today, state, streak } = useProgress();
  const { done, goal, met, remaining, nextGoal } = dailyGoalStatus(today, state.settings.dailyGoal);

  let message: string;
  if (met)
    message =
      streak.current > 1 ? `¡Llevas ${streak.current} días seguidos! Vuelve mañana.` : '¡Primer día de racha! Vuelve mañana para seguir.';
  else if (streak.atRisk)
    message = `¡Tu racha de ${streak.current} ${pluralize(streak.current, 'día', 'días')} está en peligro! Te faltan ${remaining}.`;
  else message = `Te ${remaining === 1 ? 'falta' : 'faltan'} ${remaining} ${pluralize(remaining, 'pregunta', 'preguntas')} para sumar un día a tu racha.`;

  return (
    <Card as="section" aria-labelledby="daily-goal-title" className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="daily-goal-title" className="text-lg leading-tight font-black">
          Meta diaria
        </h2>
        <IconLink
          href="/ajustes"
          label="Cambiar meta diaria"
          icon={<SlidersHorizontal />}
          variant="ghost"
          size="sm"
          className="-my-1 -mr-1.5"
        />
      </div>
      <div className="flex items-center gap-4">
        <DailyGoalRing size={84} showLabel={false} done={done} goal={goal} />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">
            <span className="text-xl font-black tabular">
              {done} / {goal}
            </span>{' '}
            <span className="text-muted">preguntas hoy</span>
          </p>
          {met && <p className="mt-0.5 text-sm font-black text-success animate-pop">¡Meta cumplida! 🎉</p>}
          {nextGoal !== null && (
            <p className="mt-0.5 text-sm font-bold text-muted">
              Meta de {goal} cumplida · la nueva meta ({nextGoal}) empieza mañana
            </p>
          )}
          <p className={cn('mt-1 text-sm font-semibold', streak.atRisk && !met ? 'text-streak' : 'text-muted')}>{message}</p>
        </div>
      </div>
      <div className="mt-1">
        <h3 className="mb-2 text-xs font-black tracking-wider text-muted uppercase">Esta semana</h3>
        <StreakCalendar />
      </div>
    </Card>
  );
}
