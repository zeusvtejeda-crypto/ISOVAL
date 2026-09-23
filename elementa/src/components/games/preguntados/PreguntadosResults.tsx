'use client';

import type { SessionSummaryData } from '@/types';
import { formatDuration, formatNumber, formatPercent } from '@/utils/format';
import { GameResults } from '../shared/GameResults';
import { BadgeRow } from './BadgeRow';
import { TRIVIA_CATEGORIES } from './categories';
import { CROWN_XP, TRIVIA_MAX_MISTAKES, TRIVIA_SPINS, type TriviaGame } from './use-trivia-game';

function headline(game: TriviaGame): { emoji: string; title: string; message: string } {
  const missing = TRIVIA_CATEGORIES.length - game.badges.length;
  if (game.endReason === 'crown') {
    return { emoji: '👑', title: '¡Corona química!', message: `Reuniste las 6 insignias y ganaste +${CROWN_XP} XP.` };
  }
  const near = missing === 1 ? '¡Te faltó solo 1 insignia!' : `Te faltaron ${missing} insignias para la corona.`;
  if (game.endReason === 'mistakes') {
    return { emoji: '💥', title: 'Se acabaron tus vidas', message: `${TRIVIA_MAX_MISTAKES} errores. ${near}` };
  }
  return { emoji: '🎡', title: '¡Partida terminada!', message: `Usaste tus ${TRIVIA_SPINS} giros. ${near}` };
}

/** Resultados de Preguntados: insignias, corona y métricas. */
export function PreguntadosResults({ game, summary }: { game: TriviaGame; summary: SessionSummaryData }) {
  const { emoji, title, message } = headline(game);
  const { correct, total } = summary;

  return (
    <GameResults
      mode="Preguntados"
      emoji={emoji}
      title={title}
      message={message}
      tone="xp"
      score={`${game.badges.length}/${TRIVIA_CATEGORIES.length}`}
      scoreLabel={game.badges.length === 1 ? 'insignia conseguida' : 'insignias conseguidas'}
      stats={[
        { icon: '✅', label: 'Correctas', value: `${formatNumber(correct)}/${formatNumber(total)}`, tone: 'success' },
        { icon: '🎯', label: 'Precisión', value: total > 0 ? formatPercent(correct / total) : '—', tone: 'brand' },
        { icon: '⚡', label: 'XP ganada', value: `+${formatNumber(summary.xpGained)}`, tone: 'xp' },
        { icon: '⏱', label: 'Tiempo', value: formatDuration(summary.durationMs), tone: 'accent' },
      ]}
      summary={summary}
      celebrate={game.endReason === 'crown'}
      onRestart={game.restart}
    >
      <section aria-labelledby="trivia-badges" className="rounded-3xl border border-border bg-surface p-4 shadow-card">
        <h2 id="trivia-badges" className="mb-3 text-center font-black">
          Tus insignias
        </h2>
        <BadgeRow badges={game.badges} size="lg" />
      </section>
    </GameResults>
  );
}
