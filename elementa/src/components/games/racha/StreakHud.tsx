'use client';

import { Confetti } from '@/components/gamification';
import { ProgressBar, cn } from '@/components/ui';
import type { QuizSession } from '@/hooks/useQuizSession';
import { streakModeXp } from '@/utils/xp';
import { currentMultiplier, formatMultiplier, isBonusMilestone, lastMilestone, nextMilestone } from './streak-rules';

export interface StreakHudProps {
  session: QuizSession;
  /** Mejor racha guardada antes de esta partida. */
  best: number;
}

/** Contador gigante «🔥 RACHA x12» con llama que crece, multiplicador y próximo bonus. */
export function StreakHud({ session, best }: StreakHudProps) {
  const { streak, status, lastAnswer, answered } = session;
  const scored = status === 'feedback' && lastAnswer?.correct === true;
  const milestoneNow = scored && isBonusMilestone(streak);
  const milestoneBonus = milestoneNow ? streakModeXp(streak).bonus : 0;
  const multiplier = currentMultiplier(streak);
  const next = nextMilestone(streak);
  const remaining = next.at - streak;
  const heat = Math.min(streak, 30) / 30;
  const beatingRecord = best > 0 && streak > best;
  const celebration = lastMilestone(answered);

  return (
    <>
      {/* Fuera de la tarjeta (que aísla su apilamiento) para caer por encima del panel de feedback. */}
      {celebration && (
        <Confetti
          key={celebration.index}
          origin="center"
          pieces={celebration.streak >= 20 ? 180 : celebration.streak >= 10 ? 120 : 70}
        />
      )}
      <section
        aria-label="Tu racha"
        className={cn(
          'relative isolate mt-1 overflow-hidden rounded-3xl border px-4 py-2.5 transition-colors duration-500 sm:px-5 sm:py-3',
          streak > 0 ? 'border-streak/35 bg-streak-soft' : 'border-border bg-surface shadow-card',
        )}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Llama: crece y brilla más cuanto más larga es la racha. */}
          <div aria-hidden className="relative grid size-14 shrink-0 place-items-center sm:size-20">
            <span
              className="absolute inset-1 -z-10 rounded-full bg-streak-glow blur-xl transition-opacity duration-500 [animation:eg-glow_1.6s_ease-in-out_infinite]"
              style={{ opacity: streak > 0 ? 0.25 + heat * 0.65 : 0 }}
            />
            <span
              className="inline-block origin-bottom text-5xl leading-none transition-transform duration-500 ease-spring sm:text-6xl"
              style={{ transform: `scale(${1 + heat * 0.55})` }}
            >
              <span
                className={cn(
                  'inline-block origin-bottom',
                  streak > 0 ? '[animation:eg-flicker_1.1s_ease-in-out_infinite]' : 'opacity-50 grayscale',
                )}
              >
                🔥
              </span>
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-black tracking-[0.2em] text-streak uppercase">Racha</p>
            <p className="text-5xl leading-none font-black text-streak tabular sm:text-6xl" aria-live="polite">
              <span key={streak} className="inline-block animate-pop">
                x{streak}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              key={multiplier}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-streak px-3 text-base font-black text-bg tabular animate-bounce-in"
            >
              <span aria-hidden>⚡</span>
              {formatMultiplier(multiplier)}
            </span>
            <span className="text-xs font-bold text-muted">XP por acierto</span>
          </div>
        </div>

        <div className="mt-2 min-h-10 sm:mt-3">
          {milestoneNow ? (
            <p
              role="status"
              className="flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-streak px-3 py-1.5 text-center font-black text-bg animate-bounce-in"
            >
              <span aria-hidden>{streak >= 20 ? '🌟' : '🎉'}</span>
              ¡Racha {streak}! +{milestoneBonus} XP {streak === 20 ? 'de bonus especial' : 'de bonus'}
            </p>
          ) : (
            <>
              <ProgressBar
                value={(streak - next.from) / (next.at - next.from)}
                tone="streak"
                size="sm"
                ariaLabel={`Progreso hasta la racha ${next.at}`}
              />
              <p className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs font-bold text-muted sm:text-sm">
                <span>
                  {remaining === 1 ? 'Falta 1' : `Faltan ${remaining}`} para racha {next.at}:{' '}
                  <span className="font-black text-streak">
                    +{next.bonus} XP{next.special ? ' · bonus especial' : ''}
                  </span>
                </span>
                <span className={cn('tabular', beatingRecord && 'font-black text-xp')}>
                  {beatingRecord ? '🏆 ¡Nuevo récord!' : best > 0 ? `🏆 Récord: ${best}` : '🏆 Sin récord aún'}
                </span>
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
