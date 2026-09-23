'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { useProgress } from '@/hooks/useProgress';
import { useSound } from '@/hooks/useSound';
import type { AnswerOutcome, AnsweredQuestion, GameMode, Question } from '@/types';
import { evaluateResponse, toAnswerInput, type AnswerEvaluation, type AnswerResponse } from './session-tally';

export interface RecordedAnswer extends AnswerEvaluation {
  /** Resultado de `recordAnswer`; `null` si la sesión no se registra. */
  outcome: AnswerOutcome | null;
  /** Entrada para la lista de respuestas de la sesión. */
  entry: AnsweredQuestion;
}

export interface SubmitOptions {
  responseMs: number;
  /** XP en lugar de la regla por defecto, según si acertó (p. ej. Modo Racha). */
  xpFor?: (correct: boolean) => number | undefined;
}

export interface AnswerRecorder {
  /**
   * Corrige la respuesta, la registra en el progreso (atribuida con `answerAttribution`) y da el
   * feedback de sonido y vibración. Devuelve `null` si esa pregunta ya se respondió (doble toque).
   */
  submit(question: Question, response: AnswerResponse, options: SubmitOptions): RecordedAnswer | null;
  /** Olvida la última pregunta respondida (nueva partida). */
  reset(): void;
}

/** Sonido y vibración de acierto o fallo (respetan los ajustes). */
export function useAnswerFeedback(): (correct: boolean) => void {
  const sound = useSound();
  const haptics = useHaptics();
  return useCallback(
    (correct: boolean) => {
      if (correct) {
        sound.correct();
        haptics.success();
      } else {
        sound.wrong();
        haptics.error();
      }
    },
    [sound, haptics],
  );
}

/**
 * Registro de respuestas compartido por los motores de quiz (`useQuizSession`, Preguntados):
 * corrección, atribución, `recordAnswer`, sonido/vibración y protección contra respuestas dobles.
 * Referencia estable.
 */
export function useAnswerRecorder(mode: GameMode, { record = true }: { record?: boolean } = {}): AnswerRecorder {
  const { recordAnswer } = useProgress();
  const feedback = useAnswerFeedback();
  const answeredId = useRef<string | null>(null);

  const submit = useCallback(
    (question: Question, response: AnswerResponse, { responseMs, xpFor }: SubmitOptions): RecordedAnswer | null => {
      if (answeredId.current === question.id) return null;
      answeredId.current = question.id;

      const evaluation = evaluateResponse(question, response);
      const xpOverride = xpFor?.(evaluation.correct);
      const outcome = record ? recordAnswer(toAnswerInput(question, evaluation, { mode, responseMs, xpOverride })) : null;
      feedback(evaluation.correct);

      const entry: AnsweredQuestion = {
        question,
        correct: evaluation.correct,
        givenAnswer: evaluation.givenAnswer,
        responseMs,
        xpGained: outcome?.xpGained ?? 0,
      };
      return { ...evaluation, outcome, entry };
    },
    [mode, record, recordAnswer, feedback],
  );

  const reset = useCallback(() => {
    answeredId.current = null;
  }, []);

  return useMemo(() => ({ submit, reset }), [submit, reset]);
}
