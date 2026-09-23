'use client';

import { Confetti } from '@/components/gamification';
import { Badge, ProgressBar, cn } from '@/components/ui';
import type { QuizSession } from '@/hooks/useQuizSession';
import { streakModeXp } from '@/utils/xp';
import { GameKeyframes } from '../shared/GameKeyframes';
import { currentMultiplier, formatMultiplier, isBonusMilestone, lastMilestone, nextMilestone } from './streak-rules';

export interface StreakHudProps {
  session: QuizSession;
  /** Mejor racha guardada antes de esta partida. */
  best: number;
}

/** Hito con bonus alcanzado con la última respuesta (y su bonus), o `null`. */
function milestoneNow(session: QuizSession): { streak: number; bonus: number } | null {
  const { streak, status, lastAnswer } = session;
  if (status !== 'feedback' || lastAnswer?.correct !== true || !isBonusMilestone(streak)) return null;
  return { streak, bonus: streakModeXp(streak).bonus };
}

function recordLabel(streak: number, best: number): string {
  if (best > 0 && streak > best) return '🏆 ¡Nuevo récord!';
  return best > 0 ? `🏆 Récord: ${best}` : '🏆 Sin récord aún';
}

/** Llama que parpadea (más viva con racha). */
function Flame({ active, className }: { active: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block origin-bottom',
        active ? '[animation:eg-flicker_1.1s_ease-in-out_infinite]' : 'opacity-50 grayscale',
        className,
      )}
    >
      🔥
    </span>
  );
}

/**
 * Contador gigante «🔥 RACHA x12» con llama que crece, multiplicador y próximo bonus. En pantallas
 * bajas se oculta: allí se ve `StreakHudCompact` en la cabecera.
 */
export function StreakHud({ session, best }: StreakHudProps) {
  const { streak, answered } = session;
  const milestone = milestoneNow(session);
  const multiplier = currentMultiplier(streak);
  const next = nextMilestone(streak);
  const remaining = next.at - streak;
  const heat = Math.min(streak, 30) / 30;
  const beatingRecord = best > 0 && streak > best;
  const celebration = lastMilestone(answered);

  return (
    <>
      <GameKeyframes />
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
          '[@media(max-height:700px)]:hidden',
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
              <Flame active={streak > 0} />
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
          {milestone ? (
            <p
              role="status"
              className="flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-streak px-3 py-1.5 text-center font-black text-bg animate-bounce-in"
            >
              <span aria-hidden>{streak >= 20 ? '🌟' : '🎉'}</span>
              ¡Racha {streak}! +{milestone.bonus} XP {streak === 20 ? 'de bonus especial' : 'de bonus'}
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
                <span className={cn('tabular', beatingRecord && 'font-black text-xp')}>{recordLabel(streak, best)}</span>
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}

/** «🔥 x12 ⚡x1.5 · 🏆 18» en una fila, para la cabecera en pantallas bajas. */
export function StreakHudCompact({ session, best }: StreakHudProps) {
  const { streak } = session;
  const milestone = milestoneNow(session);
  const multiplier = currentMultiplier(streak);
  const beatingRecord = best > 0 && streak > best;

  return (
    <div role="group" aria-label="Tu racha" className="flex min-w-0 flex-1 items-center gap-2">
      <GameKeyframes />
      <p className="inline-flex items-center gap-1 text-2xl leading-none font-black text-streak tabular" aria-live="polite">
        <Flame active={streak > 0} className="text-xl" />
        <span key={streak} className="inline-block animate-pop">
          <span className="sr-only">Racha </span>x{streak}
        </span>
      </p>
      <span
        key={multiplier}
        className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full bg-streak px-2 text-sm font-black text-bg tabular animate-bounce-in"
      >
        <span aria-hidden>⚡</span>
        {formatMultiplier(multiplier)}
        <span className="sr-only"> XP por acierto</span>
      </span>
      {milestone ? (
        <Badge role="status" tone="streak" variant="solid" size="md" className="ml-auto animate-bounce-in">
          <span aria-hidden>{milestone.streak >= 20 ? '🌟' : '🎉'}</span>+{milestone.bonus} XP
          <span className="sr-only"> de bonus</span>
        </Badge>
      ) : (
        <span className={cn('ml-auto truncate text-sm font-bold text-muted tabular', beatingRecord && 'font-black text-xp')}>
          {recordLabel(streak, best)}
        </span>
      )}
    </div>
  );
}
