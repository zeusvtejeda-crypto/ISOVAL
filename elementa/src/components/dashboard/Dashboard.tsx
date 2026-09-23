'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { InstallPrompt } from '@/components/pwa';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import { todayKey } from '@/utils/dates';
import { difficultElements } from '@/utils/selection';
import { ContinueCard } from './ContinueCard';
import { DailyGoalCard } from './DailyGoalCard';
import { DashboardSkeleton } from './DashboardSkeleton';
import { ElementOfTheDay } from './ElementOfTheDay';
import { HeroStats } from './HeroStats';
import { MoreModes } from './MoreModes';
import { QuickAccess } from './QuickAccess';
import { TableProgressCard } from './TableProgressCard';

/**
 * Inicio: si el usuario aún no hizo la bienvenida lo lleva a `/bienvenida`; si no, muestra su
 * progreso (nivel, racha, XP, precisión, meta diaria), la sesión de hoy y los accesos a cada modo.
 */
export function Dashboard() {
  const router = useRouter();
  const { ready, state } = useProgress();
  const needsOnboarding = ready && !state.profile.onboarded;

  useEffect(() => {
    if (needsOnboarding) router.replace('/bienvenida');
  }, [needsOnboarding, router]);

  if (!ready || needsOnboarding) return <DashboardSkeleton />;
  return <DashboardContent />;
}

function DashboardContent() {
  const { state } = useProgress();
  const now = useNow();
  // Mismo número que «Elementos difíciles» en /errores.
  const difficultCount = useMemo(() => difficultElements(state, now).length, [state, now]);
  const name = state.profile.name.trim();

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="animate-fade-in">
        <p className="text-sm font-extrabold text-muted sm:text-base">
          {name ? `¡Hola, ${name}!` : '¡Hola!'} <span aria-hidden>👋</span>
        </p>
        <h1 className="mt-1 text-[1.65rem] leading-[1.12] font-black sm:text-4xl">
          ¿Cuánto de la tabla periódica <span className="text-brand-gradient">puedes dominar?</span>
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <HeroStats className="animate-slide-up lg:col-span-3" />
        <div className="flex flex-col gap-4 lg:col-span-2">
          <ContinueCard className="animate-slide-up [animation-delay:60ms]" />
          <DailyGoalCard className="animate-slide-up [animation-delay:120ms]" />
        </div>
      </div>

      <QuickAccess difficultCount={difficultCount} className="animate-slide-up [animation-delay:180ms]" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-start">
        <TableProgressCard className="lg:col-span-3" />
        <div className="flex flex-col gap-6 lg:col-span-2">
          <ElementOfTheDay dayKey={todayKey(now)} />
          <MoreModes />
        </div>
      </div>

      <InstallPrompt variant="card" />
    </div>
  );
}
