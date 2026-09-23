'use client';

import { Badge, cn } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { useQuizSession } from '@/hooks/useQuizSession';
import { formatNumber } from '@/utils/format';
import { streakModeXp } from '@/utils/xp';
import { GameFlow } from '../shared/GameFlow';
import { GameIntro, RecordPill } from '../shared/GameIntro';
import { GameScreen } from '../shared/GameScreen';
import { gameQuestion } from '../shared/game-questions';
import { useRecordKeeper } from '../shared/use-record-keeper';
import { RachaResults } from './RachaResults';
import { StreakHud } from './StreakHud';
import { STREAK_LADDER, formatMultiplier, streakTier } from './streak-rules';

function StreakLadder() {
  return (
    <section aria-labelledby="racha-ladder">
      <h2 id="racha-ladder" className="text-xl font-black">
        Multiplicadores y bonus
      </h2>
      <p className="mt-0.5 text-sm font-semibold text-muted">Cuanto más larga la racha, más XP por acierto.</p>
      <ol className="mt-3 flex flex-col gap-2">
        {STREAK_LADDER.map((step, i) => (
          <li
            key={step.range}
            className={cn(
              'flex min-h-14 items-center gap-3 rounded-2xl border p-2.5 pr-3.5 animate-slide-up',
              step.special ? 'border-streak/40 bg-streak-soft' : 'border-border bg-surface',
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span
              className="grid h-10 min-w-16 shrink-0 place-items-center rounded-xl bg-streak px-2 font-black text-bg tabular"
            >
              {formatMultiplier(step.multiplier)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-black">Racha {step.range}</span>
              <span className="block text-sm font-semibold text-muted">
                {step.xp} XP por acierto{step.special ? ' · bonus especial' : ''}
              </span>
            </span>
            {step.bonus !== null && (
              <Badge tone={step.special ? 'streak' : 'xp'} size="md" icon={<span aria-hidden>{step.special ? '🌟' : '🎁'}</span>}>
                +{step.bonus} XP
              </Badge>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs font-semibold text-muted">
        Después de 20: +{streakModeXp(30).bonus} XP extra cada 10 aciertos seguidos.
      </p>
    </section>
  );
}

function RachaIntro({ onPlay }: { onPlay: () => void }) {
  const { ready, state } = useProgress();
  const best = state.records.streakModeBest;
  return (
    <GameIntro
      title="Modo Racha"
      emoji="🔥"
      tone="streak"
      tagline="¿Hasta dónde llega tu racha?"
      ready={ready}
      onPlay={onPlay}
      visual={
        <span aria-hidden className="inline-block text-7xl leading-none sm:text-8xl">
          <span className="inline-block origin-bottom [animation:eg-flicker_1.1s_ease-in-out_infinite]">🔥</span>
        </span>
      }
      record={
        best > 0 ? (
          <RecordPill>
            Mejor racha: <strong className="font-black tabular">{formatNumber(best)}</strong>
          </RecordPill>
        ) : (
          <RecordPill empty>Aún sin récord: ¡estrénalo!</RecordPill>
        )
      }
      rules={[
        { icon: '🔥', title: 'Responde sin fallar', text: 'Un solo error y la racha se acaba.' },
        { icon: '⚡', title: 'Tu XP se multiplica', text: 'x1 → x1.5 → x2 → x3 según tu racha.' },
        { icon: '🎁', title: 'Bonus en 5 y 10', text: `Racha 5: +${streakModeXp(5).bonus} XP · Racha 10: +${streakModeXp(10).bonus} XP.` },
        { icon: '🌟', title: 'Bonus especial en 20', text: `+${streakModeXp(20).bonus} XP y preguntas cada vez más difíciles.` },
      ]}
    >
      <StreakLadder />
    </GameIntro>
  );
}

function RachaPlay({ onExit }: { onExit: () => void }) {
  const { state } = useProgress();
  const records = useRecordKeeper('streakMode');

  const session = useQuizSession({
    mode: 'streak',
    title: 'Modo Racha',
    // Una sola vida: la racha termina al primer error.
    lives: 1,
    nextQuestion: ({ streak, asked }) => gameQuestion(state, { tier: streakTier(streak), asked }),
    xpFor: ({ correct, streak }) => (correct ? streakModeXp(streak).xp : 0),
    onFinish: ({ bestStreak }) => records.submit(bestStreak, 'Mejor racha'),
  });

  const exit = () => {
    if (session.status !== 'finished') records.saveOnExit(session.bestStreak);
    onExit();
  };

  return (
    <GameScreen
      session={session}
      onExit={exit}
      hud={<StreakHud session={session} best={records.best} />}
      renderSummary={(summary) => (
        <RachaResults
          summary={summary}
          session={session}
          previousBest={records.previousBest}
        />
      )}
    />
  );
}

/** «/racha»: preguntas encadenadas; el primer error termina la partida. */
export function RachaGame() {
  return <GameFlow renderIntro={(play) => <RachaIntro onPlay={play} />} renderPlay={(exit) => <RachaPlay onExit={exit} />} />;
}
