'use client';

import { useEffect, type ReactNode } from 'react';
import { useImmersive } from '@/components/layout';
import { FeedbackPanel, QuestionRenderer } from '@/components/quiz';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import type { QuizSession } from '@/hooks/useQuizSession';
import type { SessionSummaryData } from '@/types';
import { GameHeader, GameHeaderTitle } from './GameHeader';
import { GameKeyframes } from './GameKeyframes';

export interface GameScreenProps {
  /** Resultado de `useQuizSession`. */
  session: QuizSession;
  /** Salir de la partida (vuelve a la presentación del modo). */
  onExit: () => void;
  /** Centro de la cabecera; por defecto el título de la sesión. */
  headerCenter?: ReactNode;
  headerRight?: ReactNode;
  /** Marcador propio del modo, bajo la cabecera (solo durante el juego). */
  hud?: ReactNode;
  /** Pantalla de resultados. */
  renderSummary: (summary: SessionSummaryData) => ReactNode;
}

export function GameScreenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Preparando la partida" className="flex flex-1 flex-col gap-5 py-2">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11" rounded="2xl" />
        <Skeleton className="h-4 flex-1" rounded="full" />
        <Skeleton className="h-10 w-16" rounded="full" />
      </div>
      <Skeleton className="h-24" rounded="3xl" />
      <Skeleton className="mx-auto h-8 w-3/4" />
      <Skeleton className="mx-auto h-24 w-40" rounded="3xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" rounded="2xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Pantalla de juego inmersiva para los modos basados en `useQuizSession` (racha, contrarreloj,
 * supervivencia): cabecera propia, marcador del modo, pregunta (atajos 1–4 / A–D), feedback
 * (Enter para seguir) y resultados.
 */
export function GameScreen({ session, onExit, headerCenter, headerRight, hud, renderSummary }: GameScreenProps) {
  useImmersive();
  const { current, status, summary } = session;
  const screenKey = status === 'finished' ? 'summary' : (current?.id ?? null);

  // Cada pregunta nueva (y los resultados) empiezan arriba.
  useEffect(() => {
    if (screenKey !== null) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screenKey]);

  if (!session.ready) return <GameScreenSkeleton />;

  if (status === 'finished') {
    if (summary) return <>{renderSummary(summary)}</>;
    return (
      <EmptyState
        icon="🧪"
        title="No hay preguntas disponibles"
        description="No pudimos preparar la partida. Vuelve a intentarlo en un momento."
        action={<Button onClick={onExit}>Volver</Button>}
        className="flex-1 justify-center"
      />
    );
  }

  if (!current) return <GameScreenSkeleton />;
  const last = status === 'feedback' ? session.lastAnswer : null;

  return (
    <div className="flex flex-1 flex-col">
      <GameKeyframes />
      <h1 className="sr-only">{session.title}</h1>
      <GameHeader
        onExit={onExit}
        confirmExit={session.answered.length > 0}
        center={headerCenter ?? <GameHeaderTitle>{session.title}</GameHeaderTitle>}
        right={headerRight}
      />
      {hud}
      <div key={current.id} className="flex flex-1 flex-col pt-4 pb-6 animate-slide-up sm:pt-6">
        <QuestionRenderer
          question={current}
          locked={status !== 'playing'}
          response={session.response}
          onAnswer={session.answer}
        />
      </div>
      {last && (
        <FeedbackPanel
          key={session.answered.length}
          correct={last.correct}
          xpGained={session.lastOutcome ? session.lastOutcome.xpGained : null}
          bonusXp={session.lastOutcome?.bonusXp ?? 0}
          correctAnswer={last.question.correctAnswer}
          explanation={last.question.explanation}
          onContinue={session.next}
          continueLabel={session.willFinish ? 'Ver resultados' : 'Continuar'}
          autoAdvanceMs={session.autoAdvanceMs}
        />
      )}
    </div>
  );
}
