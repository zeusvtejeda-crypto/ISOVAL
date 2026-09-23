'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Badge, Button, cn, useReducedMotion } from '@/components/ui';
import { isActivationTarget, useQuizKeys } from './use-quiz-keys';

export interface FeedbackPanelProps {
  correct: boolean;
  /** XP ganada con esta respuesta; `null`/`undefined` si no se registra (no se muestra). */
  xpGained?: number | null;
  /** Parte de `xpGained` que es bonus por hito (Modo Racha): se muestra aparte, "+25 XP de bonus". */
  bonusXp?: number;
  /** Multiplicador aplicado a la XP (Modo Racha): "+15 XP · x1.5". */
  multiplier?: number;
  /** Respuesta correcta legible ("Na"). Se muestra al fallar. */
  correctAnswer: string;
  /** Línea extra bajo el título (p. ej. "Acertaste 2 de 7 · 2 sobraban"). */
  detail?: ReactNode;
  explanation?: string;
  onContinue: () => void;
  /** Por defecto "Continuar". */
  continueLabel?: string;
  /** Avance automático: muestra una barra que se vacía durante este tiempo. */
  autoAdvanceMs?: number | null;
  /**
   * Espera antes de deslizarse (ms) para que se vea la animación de la opción (pop/sacudida).
   * Por defecto 350; 0 con avance automático. Con movimiento reducido aparece al instante.
   */
  delayMs?: number;
}

/** Espera por defecto antes de mostrar el panel. */
export const FEEDBACK_DELAY_MS = 350;

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

function formatMultiplier(multiplier: number): string {
  return `x${multiplier}`;
}

/**
 * Panel inferior tras responder: "¡Correcto!" con la XP ganada, o "Incorrecto" con la respuesta
 * correcta y la explicación. «Continuar» recibe el foco (Enter para seguir). Reserva su altura
 * en el flujo para no tapar el contenido, aparece tras una breve pausa (se ve la animación de la
 * respuesta) y en pantallas bajas es compacto: la explicación queda tras «Ver por qué».
 */
export function FeedbackPanel({
  correct,
  xpGained,
  bonusXp = 0,
  multiplier = 1,
  correctAnswer,
  detail,
  explanation,
  onContinue,
  continueLabel = 'Continuar',
  autoAdvanceMs,
  delayMs,
}: FeedbackPanelProps) {
  const titleId = useId();
  const bodyId = useId();
  const noteId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [height, setHeight] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const reducedMotion = useReducedMotion();
  const xp = xpGained ?? 0;
  const bonus = Math.min(Math.max(0, bonusXp), xp);
  const note = explanation?.trim();
  const delay = delayMs ?? (autoAdvanceMs ? 0 : FEEDBACK_DELAY_MS);
  // El panel y sus animaciones de entrada esperan juntos (con movimiento reducido, CSS anula la espera).
  const delayStyle = delay > 0 ? { animationDelay: `${delay}ms` } : undefined;

  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true });
  }, []);

  // El hueco reservado se mide antes de pintar: quien revele opciones sobre el panel ya puede desplazarse.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    setHeight(panel.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
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
        // FEEDBACK_PANEL_ATTR: `revealAboveFeedback` mide el panel para dejar a la vista lo que tapa.
        data-feedback-panel=""
        style={delayStyle}
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
            // Pantallas bajas (≤ 700 px de alto): panel compacto; la explicación queda tras «Ver por qué».
            '[@media(max-height:700px)]:gap-2.5 [@media(max-height:700px)]:pt-2.5 [@media(max-height:700px)]:pb-[max(0.625rem,env(safe-area-inset-bottom))]',
          )}
        >
          <div className="flex min-w-0 flex-1 gap-3">
            <span
              aria-hidden
              style={delayStyle}
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-full animate-bounce-in [&_svg]:size-6',
                '[@media(max-height:700px)]:size-9 [@media(max-height:700px)]:[&_svg]:size-5',
                correct ? 'bg-success text-on-success' : 'bg-danger text-on-danger',
              )}
            >
              {correct ? <Check strokeWidth={3.5} /> : <X strokeWidth={3.5} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 id={titleId} className="text-2xl leading-tight font-black [@media(max-height:700px)]:text-xl">
                  {correct ? '¡Correcto!' : 'Incorrecto'}
                </h2>
                {xp > 0 && (
                  <Badge tone="xp" variant="solid" size="md" className="animate-pop" style={delayStyle}>
                    {`+${xp - bonus} XP`}
                    {multiplier > 1 && <span className="font-extrabold opacity-85">{` · ${formatMultiplier(multiplier)}`}</span>}
                  </Badge>
                )}
                {bonus > 0 && (
                  <Badge tone="streak" size="md" icon={<span aria-hidden>🔥</span>} className="animate-pop" style={delayStyle}>
                    {`+${bonus} XP de bonus`}
                  </Badge>
                )}
              </div>
              <div id={bodyId} className="text-fg">
                {!correct && (
                  <p className="mt-1 font-bold [@media(max-height:700px)]:mt-0.5 [@media(max-height:700px)]:leading-snug">
                    Respuesta correcta: <span className="font-black break-words">{correctAnswer}</span>
                  </p>
                )}
                {detail && <p className="mt-1 text-sm font-bold text-fg/85 [@media(max-height:700px)]:mt-0.5">{detail}</p>}
                {note && (
                  <p
                    id={noteId}
                    className={cn('mt-1 text-sm leading-relaxed text-fg/85', !showWhy && '[@media(max-height:700px)]:hidden')}
                  >
                    {note}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {note && (
              <div className="hidden shrink-0 [@media(max-height:700px)]:block">
                <Button
                  variant="ghost"
                  size="md"
                  aria-expanded={showWhy}
                  aria-controls={noteId}
                  rightIcon={<ChevronDown aria-hidden className={cn('transition-transform', showWhy && 'rotate-180')} />}
                  onClick={() => setShowWhy((v) => !v)}
                  className="px-3"
                >
                  {showWhy ? 'Ocultar' : 'Ver por qué'}
                </Button>
              </div>
            )}
            <Button
              ref={buttonRef}
              variant={correct ? 'success' : 'danger'}
              size="lg"
              className="min-w-0 flex-1 sm:min-w-44 sm:flex-none [@media(max-height:700px)]:min-h-12 [@media(max-height:700px)]:text-base"
              aria-describedby={`${titleId} ${bodyId}`}
              onClick={onContinue}
            >
              {continueLabel}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
