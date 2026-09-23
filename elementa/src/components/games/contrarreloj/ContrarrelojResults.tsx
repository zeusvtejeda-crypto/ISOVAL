'use client';

import type { QuizSession } from '@/hooks/useQuizSession';
import type { SessionSummaryData } from '@/types';
import { formatNumber, formatPercent, pluralize } from '@/utils/format';
import { GameResults } from '../shared/GameResults';
import { averageResponseMs, formatSeconds } from '../shared/game-questions';

export interface ContrarrelojResultsProps {
  summary: SessionSummaryData;
  session: QuizSession;
  previousBest: number;
}

function message(correct: number, answered: number): string {
  if (answered === 0) return 'Se acabó el tiempo sin respuestas. ¡A por ello!';
  if (correct === 0) return 'Hoy no entró ninguna: calienta con unas flashcards y vuelve.';
  return `Identificaste ${correct} ${pluralize(correct, 'elemento', 'elementos')} en 60 segundos.`;
}

const aciertos = (n: number) => `${formatNumber(n)} ${pluralize(n, 'acierto', 'aciertos')}`;

/** Resultados de Contrarreloj: aciertos, precisión, ritmo y récord. */
export function ContrarrelojResults({ summary, session, previousBest }: ContrarrelojResultsProps) {
  const { correct, total } = summary;
  const isNew = Boolean(summary.newRecord);

  return (
    <GameResults
      mode="Contrarreloj"
      emoji={isNew && correct > 0 ? '🏆' : '⏱️'}
      title={isNew && correct > 0 ? '¡Récord de velocidad!' : '¡Tiempo!'}
      message={message(correct, total)}
      tone="accent"
      score={formatNumber(correct)}
      scoreLabel={correct === 1 ? 'respuesta correcta' : 'respuestas correctas'}
      record={{ value: correct, previous: previousBest, isNew, format: aciertos }}
      stats={[
        { icon: '🎯', label: 'Precisión', value: total > 0 ? formatPercent(correct / total) : '—', tone: 'brand' },
        { icon: '📝', label: 'Respondidas', value: formatNumber(total), tone: 'accent' },
        { icon: '⚡', label: 'Ritmo por respuesta', value: formatSeconds(averageResponseMs(session.answered)), tone: 'streak' },
        { icon: '✨', label: 'XP ganada', value: `+${formatNumber(summary.xpGained)}`, tone: 'xp' },
      ]}
      summary={summary}
      celebrate={isNew && correct > 0}
      onRestart={session.restart}
      restartLabel="Otra vez"
    />
  );
}
