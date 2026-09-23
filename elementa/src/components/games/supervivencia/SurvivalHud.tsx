'use client';

import { Badge, cn } from '@/components/ui';
import type { QuizSession } from '@/hooks/useQuizSession';
import { formatNumber } from '@/utils/format';
import { GameKeyframes } from '../shared/GameKeyframes';
import { DIFFICULTY_LABEL } from '../shared/game-questions';
import { SURVIVAL_LIVES, survivalTier } from './survival';

const HEART = 'relative inline-block leading-none';
const HEART_SIZE = { md: 'text-3xl sm:text-4xl', sm: 'text-2xl' } as const;
/** Grieta en zigzag compartida por las dos mitades del corazón. */
const LEFT_HALF = '[clip-path:polygon(0_0,56%_0,44%_34%,60%_56%,44%_100%,0_100%)]';
const RIGHT_HALF = '[clip-path:polygon(56%_0,100%_0,100%_100%,44%_100%,60%_56%,44%_34%)]';

/** Corazón que se parte en dos y cae; debajo queda el hueco vacío. */
function BreakingHeart({ size }: { size: keyof typeof HEART_SIZE }) {
  return (
    <span className={cn(HEART, HEART_SIZE[size])}>
      <span className="inline-block opacity-30 grayscale">🖤</span>
      <span className={cn('absolute inset-0 origin-bottom [animation:eg-heart-left_900ms_ease-in_both]', LEFT_HALF)}>❤️</span>
      <span className={cn('absolute inset-0 origin-bottom [animation:eg-heart-right_900ms_ease-in_both]', RIGHT_HALF)}>❤️</span>
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm font-black text-danger animate-float-up">−1</span>
    </span>
  );
}

interface HeartsProps {
  lives: number;
  max: number;
  breaking: boolean;
  breakKey: number;
  size?: keyof typeof HEART_SIZE;
}

function Hearts({ lives, max, breaking, breakKey, size = 'md' }: HeartsProps) {
  const lastLife = lives === 1;
  return (
    <div role="img" aria-label={`Vidas: ${lives} de ${max}`} className={cn('flex items-center', size === 'md' ? 'gap-1.5 sm:gap-2' : 'gap-1')}>
      {Array.from({ length: max }, (_, i) => {
        if (i < lives) {
          return (
            <span key={i} aria-hidden className={cn(HEART, HEART_SIZE[size])}>
              <span className={cn('inline-block', lastLife && '[animation:eg-heartbeat_1.2s_ease-in-out_infinite]')}>❤️</span>
            </span>
          );
        }
        if (breaking && i === lives) {
          return (
            <span key={`break-${breakKey}`} aria-hidden>
              <BreakingHeart size={size} />
            </span>
          );
        }
        return (
          <span key={i} aria-hidden className={cn(HEART, HEART_SIZE[size], 'opacity-30 grayscale')}>
            🖤
          </span>
        );
      })}
    </div>
  );
}

/** Estado de las vidas tras la última respuesta. */
function livesState(session: QuizSession) {
  const lives = session.lives ?? 0;
  const max = session.maxLives ?? SURVIVAL_LIVES;
  const lostNow = session.status === 'feedback' && session.lastAnswer?.correct === false;
  return { lives, max, lostNow };
}

function DifficultyMeter({ tier }: { tier: 1 | 2 | 3 }) {
  return (
    <span
      key={tier}
      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-sm font-extrabold text-muted animate-bounce-in"
    >
      <span aria-hidden className="flex h-3.5 items-end gap-0.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn('w-1 rounded-full', n === 1 ? 'h-1.5' : n === 2 ? 'h-2.5' : 'h-3.5', n <= tier ? 'bg-danger' : 'bg-border-strong')}
          />
        ))}
      </span>
      <span className="sr-only">Dificultad: </span>
      {DIFFICULTY_LABEL[tier]}
    </span>
  );
}

export interface SurvivalHudProps {
  session: QuizSession;
  /** Récord antes de esta partida. */
  best: number;
}

/**
 * Vidas grandes (con corazón que se rompe), puntos, racha, récord y dificultad actual. En pantallas
 * bajas se oculta: allí se ve `SurvivalHudCompact` en la cabecera.
 */
export function SurvivalHud({ session, best }: SurvivalHudProps) {
  const { lives, max, lostNow } = livesState(session);
  const tier = survivalTier(session.index);
  const beatingRecord = best > 0 && session.correctCount > best;

  return (
    <>
      <GameKeyframes />
      <section
        aria-label="Marcador"
        className={cn(
          'mt-1 rounded-3xl border px-4 py-3 transition-colors duration-300 sm:px-5 [@media(max-height:700px)]:hidden',
          lives === 1 ? 'border-danger/40 bg-danger-soft' : 'border-border bg-surface shadow-card',
        )}
      >
        <div className="flex items-center gap-3">
          <div key={lostNow ? `lost-${session.answered.length}` : 'ok'} className={cn(lostNow && 'animate-shake')}>
            <Hearts lives={lives} max={max} breaking={lostNow} breakKey={session.answered.length} />
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs font-black tracking-[0.18em] text-muted uppercase">Puntos</p>
            <p className="text-4xl leading-none font-black tabular sm:text-5xl">
              <span key={session.correctCount} className="inline-block animate-pop">
                {formatNumber(session.correctCount)}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="streak" size="md" icon={<span aria-hidden>🔥</span>}>
            Racha {formatNumber(session.streak)}
          </Badge>
          <Badge tone={beatingRecord ? 'xp' : 'neutral'} size="md" icon={<span aria-hidden>🏆</span>}>
            {beatingRecord ? '¡Nuevo récord!' : best > 0 ? `Récord ${formatNumber(best)}` : 'Sin récord aún'}
          </Badge>
          <DifficultyMeter tier={tier} />
          {lives === 1 && !lostNow && (
            <span className="ml-auto text-sm font-black text-danger animate-pulse">¡Última vida!</span>
          )}
        </div>
      </section>

      {/* Fuera de la tarjeta: se anuncia también cuando la tarjeta está oculta (pantallas bajas). */}
      <p role="status" className="sr-only">
        {lostNow ? (lives > 0 ? `Pierdes una vida. Te ${lives === 1 ? 'queda 1' : `quedan ${lives}`}.` : 'Sin vidas.') : ''}
      </p>
    </>
  );
}

/** «❤️❤️🖤 🔥 3 · Puntos 12» en una fila, para la cabecera en pantallas bajas. */
export function SurvivalHudCompact({ session }: { session: QuizSession }) {
  const { lives, max, lostNow } = livesState(session);
  return (
    <div role="group" aria-label="Marcador" className="flex min-w-0 flex-1 items-center gap-2">
      <GameKeyframes />
      <div key={lostNow ? `lost-${session.answered.length}` : 'ok'} className={cn(lostNow && 'animate-shake')}>
        <Hearts lives={lives} max={max} breaking={lostNow} breakKey={session.answered.length} size="sm" />
      </div>
      <Badge tone="streak" size="md" icon={<span aria-hidden>🔥</span>}>
        <span className="sr-only">Racha </span>
        {formatNumber(session.streak)}
      </Badge>
      <p className="ml-auto flex flex-col items-end leading-none">
        <span className="text-[0.625rem] font-black tracking-[0.14em] text-muted uppercase">Puntos</span>
        <span key={session.correctCount} className="inline-block text-2xl font-black tabular animate-pop">
          {formatNumber(session.correctCount)}
        </span>
      </p>
    </div>
  );
}
