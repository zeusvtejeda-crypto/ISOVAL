'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Badge, Button, cn, useReducedMotion } from '@/components/ui';
import { isActivationTarget, useQuizKeys } from './use-quiz-keys';

export interface FeedbackPanelProps {
  correct: boolean;
  /** XP ganada con esta respuesta; `null`/`undefined` si no se registra (no se muestra). */
  xpGained?: number | null;
  /** Parte de `xpGained` que es bonus (racha). */
  bonusXp?: number;
  /** Respuesta correcta legible ("Na"). Se muestra al fallar. */
  correctAnswer: string;
  explanation?: string;
  onContinue: () => void;
  /** Por defecto "Continuar". */
  continueLabel?: string;
  /** Avance automático: muestra una barra que se vacía durante este tiempo. */
  autoAdvanceMs?: number | null;
}

function AutoAdvanceBar({ ms }: { ms: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const animation = barRef.current?.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
      duration: ms,
      easing: 'linear',
      fill: 'forwards',
    });
    return () => animation?.cancel();
  }, [ms]);
  return (
    <div aria-hidden className="h-1 w-full bg-fg/10">
      <div ref={barRef} className="h-full origin-left bg-current" />
    </div>
  );
}

/**
 * Panel inferior tras responder: "¡Correcto!" con la XP ganada, o "Incorrecto" con la respuesta
 * correcta y la explicación. «Continuar» recibe el foco (Enter para seguir). Reserva su altura
 * en el flujo para no tapar el contenido.
 */
export function FeedbackPanel({
  correct,
  xpGained,
  bonusXp = 0,
  correctAnswer,
  explanation,
  onContinue,
  continueLabel = 'Continuar',
  autoAdvanceMs,
}: FeedbackPanelProps) {
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [height, setHeight] = useState(0);
  const reducedMotion = useReducedMotion();
  const xp = xpGained ?? 0;
  const bonus = Math.min(bonusXp, xp);
  const note = explanation?.trim();

  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(panel.offsetHeight));
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useQuizKeys((event) => {
    if (event.key !== 'Enter') return false;
    if (isActivationTarget(event.target)) return false;
    onContinue();
    return true;
  });

  return (
    <>
      <div aria-hidden className="shrink-0" style={{ height }} />
      <section
        ref={panelRef}
        aria-labelledby={titleId}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t-2 shadow-float animate-sheet-up',
          correct ? 'border-success/40 bg-success-soft text-success' : 'border-danger/40 bg-danger-soft text-danger',
        )}
      >
        {autoAdvanceMs && !reducedMotion ? <AutoAdvanceBar ms={autoAdvanceMs} /> : null}
        <div
          className={cn(
            'mx-auto flex w-full max-w-3xl flex-col gap-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
            'pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]',
            'sm:flex-row sm:items-end sm:pt-5 sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))]',
          )}
        >
          <div className="flex min-w-0 flex-1 gap-3">
            <span
              aria-hidden
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-full animate-bounce-in [&_svg]:size-6',
                correct ? 'bg-success text-on-success' : 'bg-danger text-on-danger',
              )}
            >
              {correct ? <Check strokeWidth={3.5} /> : <X strokeWidth={3.5} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={titleId} className="text-2xl leading-tight font-black">
                  {correct ? '¡Correcto!' : 'Incorrecto'}
                </h2>
                {xp > 0 && (
                  <Badge tone="xp" variant="solid" size="md" className="animate-pop">
                    {`+${xp} XP`}
                  </Badge>
                )}
                {bonus > 0 && (
                  <Badge tone="streak" size="md" icon={<span aria-hidden>🔥</span>}>
                    {`+${bonus} de bonus`}
                  </Badge>
                )}
              </div>
              <div id={bodyId} className="text-fg">
                {!correct && (
                  <p className="mt-1 font-bold">
                    Respuesta correcta: <span className="font-black break-words">{correctAnswer}</span>
                  </p>
                )}
                {note && <p className="mt-1 text-sm leading-relaxed text-fg/85">{note}</p>}
              </div>
            </div>
          </div>
          <Button
            ref={buttonRef}
            variant={correct ? 'success' : 'danger'}
            size="lg"
            className="w-full shrink-0 sm:w-auto sm:min-w-44"
            aria-describedby={`${titleId} ${bodyId}`}
            onClick={onContinue}
          >
            {continueLabel}
          </Button>
        </div>
      </section>
    </>
  );
}
