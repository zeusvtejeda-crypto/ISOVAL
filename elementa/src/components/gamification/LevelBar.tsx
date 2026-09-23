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
  /** Versión de una línea (barras laterales, tarjetas pequeñas). */
  compact?: boolean;
  className?: string;
}

/** Nivel, título, barra de XP y "840 / 1000 XP". */
export function LevelBar({ level: levelProp, compact = false, className }: LevelBarProps) {
  const { level: current, ready } = useProgress();
  const level = levelProp ?? (ready ? current : null);

  if (!level) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Skeleton className={compact ? 'size-9' : 'size-14'} rounded="2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className={compact ? 'h-2' : 'h-3'} rounded="full" />
        </div>
      </div>
    );
  }

  const into = formatNumber(level.xpIntoLevel);
  const next = formatNumber(level.xpForNext);
  const remaining = Math.max(0, level.xpForNext - level.xpIntoLevel);
  const valueText = `${into} / ${next} XP`;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <LevelEmblem level={level.level} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-black">{level.title}</p>
            <p className="shrink-0 text-xs font-extrabold tabular text-muted">{valueText}</p>
          </div>
          <ProgressBar
            value={level.progress}
            tone="xp"
            size="sm"
            ariaLabel={`Nivel ${level.level}: ${valueText}`}
            valueText={valueText}
            className="mt-1.5"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <LevelEmblem level={level.level} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-lg font-black leading-tight">
            <span aria-hidden className="mr-1.5">
              {levelEmoji(level.level)}
            </span>
            {level.title}
          </p>
          <p className="shrink-0 text-sm font-extrabold tabular text-muted">{valueText}</p>
        </div>
        <ProgressBar
          value={level.progress}
          tone="xp"
          size="md"
          ariaLabel={`Nivel ${level.level}: ${valueText}`}
          valueText={valueText}
          className="mt-2"
        />
        <p className="mt-1.5 text-xs font-bold text-muted">
          {remaining > 0
            ? `Te faltan ${formatNumber(remaining)} XP para el nivel ${level.level + 1}`
            : `¡Listo para el nivel ${level.level + 1}!`}
        </p>
      </div>
    </div>
  );
}
