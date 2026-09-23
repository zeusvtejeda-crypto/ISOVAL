'use client';

import { QuizScreen } from '@/components/quiz';
import { ProgressBar } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { useQuizSession } from '@/hooks/useQuizSession';
import { formatNumber, pluralize } from '@/utils/format';
import { GameFlow } from '../shared/GameFlow';
import { GameHeader } from '../shared/GameHeader';
import { GameIntro, RecordPill } from '../shared/GameIntro';
import { gameQuestion } from '../shared/game-questions';
import { useRecordKeeper } from '../shared/use-record-keeper';
import { ContrarrelojResults } from './ContrarrelojResults';
import { TimerHud, TimerHudCompact } from './TimerHud';
import {
  LOW_TIME_SECONDS,
  TIME_ATTACK_ADVANCE_MS,
  TIME_ATTACK_MS,
  TIME_ATTACK_TYPES,
  timeAttackTier,
} from './time-attack';

function ContrarrelojIntro({ onPlay }: { onPlay: () => void }) {
  const { ready, state } = useProgress();
  const best = state.records.timeAttackBest;
  return (
    <GameIntro
      title="Contrarreloj"
      emoji="⏱️"
      tone="accent"
      tagline="¿Cuántos elementos puedes identificar en 60 segundos?"
      ready={ready}
      onPlay={onPlay}
      record={
        best > 0 ? (
          <RecordPill>
            Récord: <strong className="font-black tabular">{formatNumber(best)}</strong>{' '}
            {pluralize(best, 'respuesta correcta', 'respuestas correctas')}
          </RecordPill>
        ) : (
          <RecordPill empty>Aún sin récord: ¡estrénalo!</RecordPill>
        )
      }
      rules={[
        { icon: '⏱️', title: '60 segundos en total', text: 'El reloj no se detiene: responde rápido.' },
        { icon: '⚡', title: 'Preguntas relámpago', text: 'Símbolos, nombres y números atómicos.' },
        { icon: '✅', title: 'Cada acierto suma', text: 'Fallar no resta, pero te cuesta tiempo.' },
        { icon: '📈', title: 'Cada vez más difícil', text: 'Empiezas con los elementos más conocidos.' },
      ]}
    />
  );
}

function ContrarrelojPlay({ onExit }: { onExit: () => void }) {
  const { state } = useProgress();
  const records = useRecordKeeper('timeAttack');

  const session = useQuizSession({
    mode: 'timeAttack',
    title: 'Contrarreloj',
    timeLimitMs: TIME_ATTACK_MS,
    autoAdvanceMs: TIME_ATTACK_ADVANCE_MS,
    nextQuestion: ({ index, asked }) =>
      gameQuestion(state, { tier: timeAttackTier(index), asked, types: TIME_ATTACK_TYPES, avoidLast: 12 }),
    onFinish: ({ correct }) => records.submit(correct, 'Contrarreloj'),
  });

  const exit = () => {
    if (session.status !== 'finished') records.saveOnExit(session.correctCount);
    onExit();
  };

  const remaining = session.remainingMs ?? TIME_ATTACK_MS;
  const low = remaining <= LOW_TIME_SECONDS * 1000;

  return (
    <QuizScreen
      session={session}
      onExit={exit}
      renderHeader={(s) => (
        <GameHeader
          onExit={exit}
          confirmExit={s.answered.length > 0}
          center={
            <ProgressBar value={remaining / TIME_ATTACK_MS} size="md" tone={low ? 'danger' : 'accent'} ariaLabel="Tiempo restante" />
          }
          compact={<TimerHudCompact session={s} />}
        />
      )}
      renderTop={(s) => <TimerHud session={s} best={records.best} />}
      renderSummary={(summary, s) => (
        <ContrarrelojResults summary={summary} session={s} previousBest={records.previousBest} />
      )}
    />
  );
}

/** «/contrarreloj»: 60 segundos para acertar tantas preguntas rápidas como puedas. */
export function ContrarrelojGame() {
  return (
    <GameFlow
      renderIntro={(play) => <ContrarrelojIntro onPlay={play} />}
      renderPlay={(exit) => <ContrarrelojPlay onExit={exit} />}
    />
  );
}
