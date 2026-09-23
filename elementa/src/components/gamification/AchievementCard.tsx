import { Lock } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatNumber } from '@/utils/format';

export interface AchievementCardProps {
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
  /** ISO de desbloqueo (se muestra la fecha). */
  unlockedAt?: string | null;
  /** Progreso actual hacia el logro (solo si está bloqueado). */
  current?: number;
  target?: number;
  className?: string;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

function formatUnlockDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Tarjeta de logro. Admite `{...def}` de `ACHIEVEMENTS` más `unlocked`, `unlockedAt`, `current` y `target`.
 */
export function AchievementCard({
  emoji,
  title,
  description,
  unlocked,
  unlockedAt,
  current,
  target,
  className,
}: AchievementCardProps) {
  const hasProgress = !unlocked && typeof target === 'number' && target > 0 && typeof current === 'number';
  const shown = hasProgress ? Math.min(current, target) : 0;
  const date = unlocked && unlockedAt ? formatUnlockDate(unlockedAt) : null;

  return (
    <article
      className={cn(
        'relative flex items-start gap-4 rounded-3xl border p-4 transition-colors',
        unlocked ? 'border-xp/35 bg-surface shadow-card' : 'border-border bg-surface-2/60',
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          'relative grid size-14 shrink-0 place-items-center rounded-2xl text-3xl leading-none',
          unlocked ? 'bg-xp-soft ring-2 ring-xp/40' : 'bg-surface-2',
        )}
      >
        <span className={cn(!unlocked && 'opacity-45 grayscale')}>{emoji}</span>
        {!unlocked && (
          <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full border-2 border-bg bg-muted text-bg">
            <Lock className="size-3" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={cn('font-black leading-tight', !unlocked && 'text-fg/80')}>{title}</h3>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
        <span className="sr-only">{unlocked ? 'Logro desbloqueado' : 'Logro bloqueado'}</span>
        {unlocked && date && (
          <p className="mt-2 text-xs font-extrabold text-xp">
            <span aria-hidden>🏆 </span>
            Desbloqueado el {date}
          </p>
        )}
        {hasProgress && (
          <ProgressBar
            value={shown / target}
            tone="brand"
            size="sm"
            showValue
            valueText={`${formatNumber(shown)} / ${formatNumber(target)}`}
            ariaLabel={`Progreso de ${title}`}
            className="mt-2.5"
          />
        )}
      </div>
    </article>
  );
}
