'use client';

import { useEffect, type ReactNode } from 'react';
import { useImmersive } from '@/components/layout';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import type { QuizSession } from '@/hooks/useQuizSession';
import type { SessionSummaryData } from '@/types';
import { FeedbackPanel } from './FeedbackPanel';
import { QuestionRenderer } from './QuestionRenderer';
import { QuizHeader } from './QuizHeader';
import { SessionSummary } from './SessionSummary';

export interface QuizScreenProps {
  /** Resultado de `useQuizSession`. */
  session: QuizSession;
  /** Salir de la sesión (p. ej. `router.push('/jugar')`). */
  onExit: () => void;
  /** Contenido extra bajo la cabecera (categoría de la ruleta, multiplicador…). */
  renderTop?: (session: QuizSession) => ReactNode;
  /** Resumen personalizado; por defecto `SessionSummary` con «Repetir». */
  renderSummary?: (summary: SessionSummaryData, session: QuizSession) => ReactNode;
}

function QuizSkeleton() {
  return (
    <div aria-busy="true" aria-label="Preparando preguntas" className="flex flex-1 flex-col gap-6 py-2">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11" rounded="2xl" />
        <Skeleton className="h-4 flex-1" rounded="full" />
        <Skeleton className="h-10 w-16" rounded="full" />
      </div>
      <Skeleton className="mx-auto h-8 w-3/4" />
      <Skeleton className="mx-auto h-24 w-40" rounded="3xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" rounded="2xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Pantalla completa de juego usada por todos los modos: cabecera (salir, progreso, vidas,
 * tiempo, racha), pregunta, panel de feedback y resumen final. Oculta la navegación de la app.
 */
export function QuizScreen({ session, onExit, renderTop, renderSummary }: QuizScreenProps) {
  useImmersive();
  const { current, status, summary } = session;
  const screenKey = status === 'finished' ? 'summary' : (current?.id ?? null);

  // Cada pregunta nueva (y el resumen) empieza arriba: las de tabla pueden haber desplazado la página.
  useEffect(() => {
    if (screenKey !== null) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screenKey]);

  if (!session.ready) return <QuizSkeleton />;

  if (status === 'finished') {
    if (!summary) {
      return (
        <EmptyState
          icon="🧪"
          title="No hay preguntas disponibles"
          description="No pudimos preparar preguntas con esta selección. Prueba con otros elementos o con otro modo."
          action={<Button onClick={onExit}>Volver</Button>}
          className="flex-1 justify-center"
        />
      );
    }
    return renderSummary ? <>{renderSummary(summary, session)}</> : <SessionSummary summary={summary} onRestart={session.restart} />;
  }

  if (!current) return <QuizSkeleton />;
  const last = status === 'feedback' ? session.lastAnswer : null;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="sr-only">{session.title}</h1>
      <QuizHeader
        onExit={onExit}
        confirmExit={session.answered.length > 0}
        answered={session.answered.length}
        total={session.total}
        lives={session.lives}
        maxLives={session.maxLives}
        remainingMs={session.remainingMs}
        timeLimitMs={session.timeLimitMs}
        streak={session.streak}
        title={session.title}
      />
      {renderTop?.(session)}
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
