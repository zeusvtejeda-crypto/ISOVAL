'use client';

import type { QuizSession } from '@/hooks/useQuizSession';
import type { SessionSummaryData } from '@/types';
import { formatDuration, formatNumber, pluralize } from '@/utils/format';
import { GameResults } from '../shared/GameResults';
import { DIFFICULTY_LABEL } from '../shared/game-questions';
import { survivalTier } from './survival';

export interface SupervivenciaResultsProps {
  summary: SessionSummaryData;
  session: QuizSession;
  previousBest: number;
}

function message(correct: number): string {
  if (correct === 0) return 'Las tres vidas se fueron rápido. ¡La próxima aguantas más!';
  if (correct >= 25) return `¡${correct} aciertos! Eres un auténtico superviviente.`;
  return `Aguantaste ${correct} ${pluralize(correct, 'acierto', 'aciertos')} con 3 vidas.`;
}

const aciertos = (n: number) => `${formatNumber(n)} ${pluralize(n, 'acierto', 'aciertos')}`;

/** Resultados de Supervivencia: puntos, récord, mejor racha y dificultad alcanzada. */
export function SupervivenciaResults({ summary, session, previousBest }: SupervivenciaResultsProps) {
  const { correct } = summary;
  const isNew = Boolean(summary.newRecord);
  const reachedTier = survivalTier(Math.max(0, session.answered.length - 1));

  return (
    <GameResults
      mode="Supervivencia"
      emoji={isNew && correct > 0 ? '🏆' : '💔'}
      title={isNew && correct > 0 ? '¡Nuevo récord de supervivencia!' : '¡Sin vidas!'}
      message={message(correct)}
      tone="danger"
      score={formatNumber(correct)}
      scoreLabel={correct === 1 ? 'punto' : 'puntos'}
      record={{ value: correct, previous: previousBest, isNew, format: aciertos }}
      stats={[
        { icon: '🔥', label: 'Mejor racha', value: formatNumber(session.bestStreak), tone: 'streak' },
        { icon: '📈', label: 'Dificultad alcanzada', value: DIFFICULTY_LABEL[reachedTier], tone: 'danger' },
        { icon: '⚡', label: 'XP ganada', value: `+${formatNumber(summary.xpGained)}`, tone: 'xp' },
        { icon: '⏱', label: 'Tiempo', value: formatDuration(summary.durationMs), tone: 'accent' },
      ]}
      summary={summary}
      celebrate={isNew && correct > 0}
      onRestart={session.restart}
    />
  );
}
