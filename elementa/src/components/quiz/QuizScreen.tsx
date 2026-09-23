'use client';

import { useEffect, type ReactNode } from 'react';
import { useImmersive } from '@/components/layout';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import type { QuizSession } from '@/hooks/useQuizSession';
import type { SessionSummaryData } from '@/types';
import { FeedbackPanel } from './FeedbackPanel';
import { QuestionRenderer } from './QuestionRenderer';
import { QuizHeader, type QuizHeaderProps } from './QuizHeader';
import { SessionSummary } from './SessionSummary';
import { describeTableReview, reviewTableAnswer } from './table-review';

export interface QuizScreenProps {
  /** Resultado de `useQuizSession`. */
  session: QuizSession;
  /** Salir de la sesión (p. ej. `router.push('/jugar')`). */
  onExit: () => void;
  /**
   * Cabecera fija propia (p. ej. `GameHeader` con el marcador compacto de un modo). Por defecto
   * `QuizHeader`: salir, progreso, vidas, tiempo y racha.
   */
  renderHeader?: (session: QuizSession) => ReactNode;
  /** Contenido extra bajo la cabecera (marcador del modo, «Saltar»…). */
  renderTop?: (session: QuizSession) => ReactNode;
  /** Resumen personalizado; por defecto `SessionSummary` con «Repetir». */
  renderSummary?: (summary: SessionSummaryData, session: QuizSession) => ReactNode;
  /** Textos del aviso al salir a mitad (p. ej. si las respuestas no se guardan). */
  exitCopy?: QuizHeaderProps['exitCopy'];
}

function QuizSkeleton({ withHud }: { withHud: boolean }) {
  return (
    <div aria-busy="true" aria-label="Preparando preguntas" className="flex flex-1 flex-col gap-6 py-2">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11" rounded="2xl" />
        <Skeleton className="h-4 flex-1" rounded="full" />
        <Skeleton className="h-10 w-16" rounded="full" />
      </div>
      {withHud && <Skeleton className="-mt-1 h-24 [@media(max-height:700px)]:hidden" rounded="3xl" />}
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

/** Línea extra del feedback en selección múltiple: "Acertaste 2 de 7 · 2 sobraban". */
function feedbackDetail(session: QuizSession): string | undefined {
  const question = session.lastAnswer?.question;
  if (!question || question.kind !== 'table-multi-select' || !Array.isArray(session.response)) return undefined;
  return describeTableReview(reviewTableAnswer(question, session.response));
}

/**
 * Pantalla completa de pregunta usada por todos los modos (quiz, examen, práctica, juegos): cabecera
 * (propia o `QuizHeader`), marcador opcional, pregunta, feedback, confirmación de salida, atajos
 * 1–4/A–D y Enter, y el resumen al final. Oculta la navegación de la app.
 */
export function QuizScreen({ session, onExit, renderHeader, renderTop, renderSummary, exitCopy }: QuizScreenProps) {
  useImmersive();
  const { current, status, summary } = session;
  const screenKey = status === 'finished' ? 'summary' : (current?.id ?? null);

  // Cada pregunta nueva (y el resumen) empieza arriba: las de tabla pueden haber desplazado la página.
  useEffect(() => {
    if (screenKey !== null) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screenKey]);

  if (!session.ready) return <QuizSkeleton withHud={renderTop !== undefined} />;

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

  if (!current) return <QuizSkeleton withHud={renderTop !== undefined} />;
  const last = status === 'feedback' ? session.lastAnswer : null;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="sr-only">{session.title}</h1>
      {renderHeader ? (
        renderHeader(session)
      ) : (
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
          exitCopy={exitCopy}
        />
      )}
      {renderTop?.(session)}
      <div
        key={current.id}
        className="flex flex-1 flex-col pt-4 pb-6 animate-slide-up sm:pt-6 [@media(max-height:700px)]:pt-2 [@media(max-height:700px)]:pb-3"
      >
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
          bonusXp={session.lastXp?.bonus ?? 0}
          multiplier={session.lastXp?.multiplier ?? 1}
          correctAnswer={last.question.correctAnswer}
          detail={feedbackDetail(session)}
          explanation={last.question.explanation}
          onContinue={session.next}
          continueLabel={session.willFinish ? 'Ver resultados' : 'Continuar'}
          autoAdvanceMs={session.autoAdvanceMs}
        />
      )}
    </div>
  );
}
