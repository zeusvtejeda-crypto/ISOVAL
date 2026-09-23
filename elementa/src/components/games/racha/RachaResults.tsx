'use client';

import type { QuizSession } from '@/hooks/useQuizSession';
import type { AnsweredQuestion, SessionSummaryData } from '@/types';
import { formatDuration, formatNumber, pluralize } from '@/utils/format';
import { GameResults } from '../shared/GameResults';
import { currentMultiplier, formatMultiplier, totalStreakBonus } from './streak-rules';

export interface RachaResultsProps {
  summary: SessionSummaryData;
  session: QuizSession;
  /** Mejor racha antes de esta partida. */
  previousBest: number;
}

function BrokenAt({ answer }: { answer: AnsweredQuestion }) {
  const { question } = answer;
  return (
    <section aria-labelledby="racha-broken" className="rounded-3xl border border-danger/30 bg-danger-soft p-4">
      <h2 id="racha-broken" className="flex items-center gap-2 font-black text-danger">
        <span aria-hidden>💔</span> Aquí se rompió tu racha
      </h2>
      <p className="mt-2 leading-snug font-bold">{question.prompt}</p>
      <dl className="mt-2 grid gap-1 text-sm">
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="font-semibold text-muted">Tu respuesta:</dt>
          <dd className="font-black break-words">{answer.givenAnswer}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="font-semibold text-muted">Correcta:</dt>
          <dd className="font-black break-words text-success">{question.correctAnswer}</dd>
        </div>
      </dl>
      {question.explanation && <p className="mt-2 text-sm leading-relaxed text-fg/85">{question.explanation}</p>}
    </section>
  );
}

function headline(reached: number): { emoji: string; title: string; message: string } {
  if (reached === 0) {
    return { emoji: '🧯', title: '¡Uy, a la primera!', message: 'No pasa nada: la próxima racha empieza ahora.' };
  }
  const message = `Encadenaste ${reached} ${pluralize(reached, 'acierto', 'aciertos')} seguidos.`;
  if (reached >= 20) return { emoji: '🏆', title: '¡Reacción en cadena!', message };
  if (reached >= 10) return { emoji: '🔥', title: '¡Racha imparable!', message };
  return { emoji: '💥', title: '¡Racha rota!', message };
}

/** Resultados del Modo Racha: racha lograda, récord, bonus, pregunta que la rompió. */
export function RachaResults({ summary, session, previousBest }: RachaResultsProps) {
  const reached = session.bestStreak;
  const isNew = Boolean(summary.newRecord);
  const breaker = session.answered.findLast((a) => !a.correct) ?? null;
  const { emoji, title, message } = headline(reached);

  return (
    <GameResults
      mode="Modo Racha"
      emoji={emoji}
      title={title}
      message={message}
      tone="streak"
      score={
        <>
          <span aria-hidden>🔥 </span>
          {reached}
        </>
      }
      scoreLabel={reached === 1 ? 'acierto seguido' : 'aciertos seguidos'}
      record={{ value: reached, previous: previousBest, isNew, format: (n) => `racha de ${formatNumber(n)}` }}
      stats={[
        { icon: '⚡', label: 'XP ganada', value: `+${formatNumber(summary.xpGained)}`, tone: 'xp' },
        { icon: '🎁', label: 'Bonus de racha', value: `+${formatNumber(totalStreakBonus(reached))}`, tone: 'streak' },
        { icon: '✖️', label: 'Multiplicador máx.', value: formatMultiplier(currentMultiplier(reached)), tone: 'brand' },
        { icon: '⏱', label: 'Tiempo', value: formatDuration(summary.durationMs), tone: 'accent' },
      ]}
      summary={summary}
      celebrate={isNew && reached > 0}
      onRestart={session.restart}
    >
      {breaker && <BrokenAt answer={breaker} />}
    </GameResults>
  );
}
