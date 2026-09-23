'use client';

import { useProgress } from '@/hooks/useProgress';
import { useQuizSession } from '@/hooks/useQuizSession';
import { formatNumber, pluralize } from '@/utils/format';
import { GameFlow } from '../shared/GameFlow';
import { GameIntro, RecordPill } from '../shared/GameIntro';
import { GameScreen } from '../shared/GameScreen';
import { gameQuestion } from '../shared/game-questions';
import { useRecordKeeper } from '../shared/use-record-keeper';
import { SupervivenciaResults } from './SupervivenciaResults';
import { SurvivalHud } from './SurvivalHud';
import { SURVIVAL_LIVES, survivalTier } from './survival';

function SupervivenciaIntro({ onPlay }: { onPlay: () => void }) {
  const { ready, state } = useProgress();
  const best = state.records.survivalBest;
  return (
    <GameIntro
      title="Supervivencia"
      emoji="❤️"
      tone="danger"
      tagline="3 vidas. ¿Cuánto aguantas?"
      ready={ready}
      onPlay={onPlay}
      visual={
        <span aria-hidden className="inline-flex gap-2 text-6xl leading-none sm:text-7xl">
          <span className="inline-block [animation:eg-heartbeat_1.4s_ease-in-out_infinite]">❤️</span>
          <span className="inline-block [animation:eg-heartbeat_1.4s_ease-in-out_0.15s_infinite]">❤️</span>
          <span className="inline-block [animation:eg-heartbeat_1.4s_ease-in-out_0.3s_infinite]">❤️</span>
        </span>
      }
      record={
        best > 0 ? (
          <RecordPill>
            Récord: <strong className="font-black tabular">{formatNumber(best)}</strong>{' '}
            {pluralize(best, 'acierto', 'aciertos')}
          </RecordPill>
        ) : (
          <RecordPill empty>Aún sin récord: ¡estrénalo!</RecordPill>
        )
      }
      rules={[
        { icon: '❤️', title: 'Empiezas con 3 vidas', text: 'Las preguntas no se acaban nunca.' },
        { icon: '💔', title: 'Cada error cuesta una vida', text: 'Sin vidas, se acabó la partida.' },
        { icon: '📈', title: 'Cada vez más difícil', text: 'Fácil, luego media y después difícil.' },
        { icon: '🎯', title: 'Te conoce', text: 'Te pregunta más los elementos que te cuestan.' },
      ]}
    />
  );
}

function SupervivenciaPlay({ onExit }: { onExit: () => void }) {
  const { state } = useProgress();
  const records = useRecordKeeper('survival');

  const session = useQuizSession({
    mode: 'survival',
    title: 'Supervivencia',
    lives: SURVIVAL_LIVES,
    nextQuestion: ({ index, asked }) => gameQuestion(state, { tier: survivalTier(index), asked }),
    onFinish: ({ correct }) => records.submit(correct, 'Supervivencia'),
  });

  const exit = () => {
    if (session.status !== 'finished') records.saveOnExit(session.correctCount);
    onExit();
  };

  return (
    <GameScreen
      session={session}
      onExit={exit}
      hud={<SurvivalHud session={session} best={records.best} />}
      renderSummary={(summary) => (
        <SupervivenciaResults
          summary={summary}
          session={session}
          previousBest={records.previousBest}
        />
      )}
    />
  );
}

/** «/supervivencia»: preguntas infinitas y cada vez más difíciles con 3 vidas. */
export function SupervivenciaGame() {
  return (
    <GameFlow
      renderIntro={(play) => <SupervivenciaIntro onPlay={play} />}
      renderPlay={(exit) => <SupervivenciaPlay onExit={exit} />}
    />
  );
}
