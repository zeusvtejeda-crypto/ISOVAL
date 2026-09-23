'use client';

import { useProgress } from '@/hooks/useProgress';
import { cn } from '@/components/ui/cn';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNumber } from '@/utils/format';
import { levelEmoji, type LevelInfo } from '@/utils/levels';
import { LevelEmblem } from './LevelEmblem';

export interface LevelBarProps {
  /** Nivel a mostrar; por defecto, el del usuario. */
  level?: LevelInfo;
  /** Versión estrecha (barra lateral): nivel y XP arriba, el título en su propia fila y la barra. */
  compact?: boolean;
  className?: string;
}

/** Nivel, título, barra de XP y "840 / 1000 XP". */
export function LevelBar({ level: levelProp, compact = false, className }: LevelBarProps) {
  const { level: current, ready } = useProgress();
  const level = levelProp ?? (ready ? current : null);

  if (!level && compact) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-9" rounded="xl" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-2" rounded="full" />
      </div>
    );
  }
  if (!level) {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <Skeleton className="size-14" rounded="2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-3" rounded="full" />
          <Skeleton className="h-3.5 w-1/3" />
        </div>
      </div>
    );
  }

  const into = formatNumber(level.xpIntoLevel);
  const next = formatNumber(level.xpForNext);
  const remaining = Math.max(0, level.xpForNext - level.xpIntoLevel);
  const valueText = `${into} / ${next} XP`;

  const hint =
    remaining > 0
      ? `Te faltan ${formatNumber(remaining)} XP para el nivel ${level.level + 1}`
      : `¡Listo para el nivel ${level.level + 1}!`;

  // Compacta (barra lateral): nivel y XP en la primera fila y el título en una fila propia a todo el
  // ancho, para que «Maestro de los Elementos» o «Gran Maestro» se lean enteros.
  if (compact) {
    return (
      <div className={cn('min-w-0', className)}>
        <div className="flex items-center gap-2.5">
          <LevelEmblem level={level.level} size="sm" />
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2">
            <p className="text-xs font-black tracking-wider text-muted uppercase">Nivel {level.level}</p>
            <p className="text-xs font-extrabold tabular text-muted">{valueText}</p>
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-snug font-black">
          <span aria-hidden className="mr-1">
            {levelEmoji(level.level)}
          </span>
          {level.title}
        </p>
        <ProgressBar
          value={level.progress}
          tone="xp"
          size="sm"
          ariaLabel={`Nivel ${level.level}: ${valueText}`}
          valueText={valueText}
          className="mt-1.5"
        />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <LevelEmblem level={level.level} size="md" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-lg leading-tight font-black">
          <span aria-hidden className="mr-1.5">
            {levelEmoji(level.level)}
          </span>
          {level.title}
        </p>
        <ProgressBar
          value={level.progress}
          tone="xp"
          size="md"
          ariaLabel={`Nivel ${level.level}: ${valueText}`}
          valueText={valueText}
          className="mt-2"
        />
        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-extrabold tabular text-muted">{valueText}</p>
          <p className="text-xs font-bold text-muted">{hint}</p>
        </div>
      </div>
    </div>
  );
}
