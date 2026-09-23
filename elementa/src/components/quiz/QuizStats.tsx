import { cn } from '@/components/ui';

const CHIP = 'inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm font-black leading-none tabular sm:px-3 sm:text-base';

/** Vidas: ❤️❤️🖤 (o "❤️ ×N" si son muchas). Se sacude al perder una. */
export function LivesIndicator({ lives, maxLives }: { lives: number; maxLives: number | null }) {
  const max = maxLives ?? lives;
  const lost = lives < max;
  const label = `Vidas: ${lives} de ${max}`;
  return (
    <span role="img" aria-label={label} className={cn(CHIP, 'bg-danger-soft text-danger')}>
      <span key={lives} aria-hidden className={cn('inline-flex items-center gap-0.5', lost && 'animate-shake')}>
        {max <= 5 ? (
          Array.from({ length: max }, (_, i) => (
            <span key={i} className={cn('text-[1.05em] transition-[filter,opacity]', i >= lives && 'opacity-40 grayscale')}>
              {i < lives ? '❤️' : '🖤'}
            </span>
          ))
        ) : (
          <>
            <span>❤️</span>
            <span>×{lives}</span>
          </>
        )}
      </span>
    </span>
  );
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** ⏱ Tiempo restante; en rojo y parpadeando en los últimos 10 s. */
export function TimeChip({ remainingMs }: { remainingMs: number }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const low = seconds <= 10;
  return (
    <span
      role="timer"
      aria-label={`Tiempo restante: ${seconds} segundos`}
      className={cn(CHIP, low ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-fg')}
    >
      <span aria-hidden>⏱</span>
      <span aria-hidden className={cn('min-w-[2.6em] text-center', low && seconds > 0 && 'animate-pulse')}>
        {formatClock(remainingMs)}
      </span>
    </span>
  );
}

/** Hitos que merecen celebración: 5, 10, 20 y cada 10 a partir de ahí. */
export function isStreakMilestone(streak: number): boolean {
  return streak === 5 || streak === 10 || (streak >= 20 && streak % 10 === 0);
}

/** 🔥 Racha de aciertos de la sesión; pulso al alcanzar un hito. */
export function StreakChip({ streak }: { streak: number }) {
  const active = streak > 0;
  const milestone = isStreakMilestone(streak);
  return (
    <span
      role="img"
      aria-label={`Racha de aciertos: ${streak}`}
      className={cn(
        CHIP,
        active ? 'bg-streak-soft text-streak' : 'bg-surface-2 text-muted',
        milestone && 'animate-pulse-ring [--pulse-color:var(--color-streak-glow)]',
      )}
    >
      <span key={streak} aria-hidden className={cn('inline-block', active ? 'animate-bounce-in' : 'opacity-60 grayscale')}>
        🔥
      </span>
      <span aria-hidden>{streak}</span>
    </span>
  );
}
