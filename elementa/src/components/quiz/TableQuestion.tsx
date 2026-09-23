'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Button, useReducedMotion } from '@/components/ui';
import { ALL_ATOMIC_NUMBERS, FitToggle, PeriodicTable } from '@/components/periodic';
import type { Question, QuestionType } from '@/types';
import { pluralize } from '@/utils/format';
import { revealAboveFeedback } from './feedback-reveal';
import { QuestionPrompt } from './QuestionPrompt';
import { reviewTableAnswer } from './table-review';

export interface TableQuestionProps {
  question: Question;
  /** Pregunta ya respondida: revela casillas correctas (verde) y erróneas (rojo). */
  locked: boolean;
  /** Casillas enviadas como respuesta (durante la corrección). */
  response: number[] | null;
  onAnswer: (selected: number[]) => void;
}

interface Presentation {
  /** Casillas sin texto: se busca por posición. */
  blind?: boolean;
  /** Sin colores de familia: el color delataría la respuesta. */
  neutral?: boolean;
  /** Sin números de grupo/periodo. */
  hideLabels?: boolean;
  hint: string;
}

const PRESENTATION: Partial<Record<QuestionType, Presentation>> = {
  'table-find-element': { blind: true, hint: 'Las casillas no muestran su símbolo: guíate por el grupo, el periodo y los colores.' },
  'table-find-number': { blind: true, hint: 'Los números crecen de izquierda a derecha y de arriba abajo.' },
  'table-select-category': { neutral: true, hint: 'Toca todas las casillas que correspondan y pulsa «Comprobar».' },
  'table-group-member': { neutral: true, hideLabels: true, hint: 'Los números de grupo están ocultos.' },
};

const DEFAULT_PRESENTATION: Presentation = { hint: 'Toca la casilla correcta.' };

/** Casilla mínima (px) con la que la tabla ajustada al ancho sigue siendo cómoda de tocar. */
const MIN_FIT_TILE_PX = 38;

interface TableFit {
  /** Ajuste al ancho elegido automáticamente. */
  auto: boolean;
  /** La tabla desliza en horizontal (hay casillas fuera de la vista). */
  overflows: boolean;
}

/**
 * «Ajustar a pantalla» automático: la tabla se ajusta al ancho cuando desliza pero, ajustada, sus
 * casillas siguen midiendo al menos `MIN_FIT_TILE_PX` (tabletas); deja de ajustarse si al estrecharse
 * la ventana dejan de hacerlo. `choice` (el conmutador) manda sobre lo automático. Se mide antes de
 * pintar y al cambiar el tamaño (giro de pantalla, ventana).
 */
function useTableFit(choice: boolean | null): { wrapperRef: RefObject<HTMLDivElement | null>; compact: boolean; overflows: boolean } {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<TableFit>({ auto: false, overflows: false });
  const compact = choice ?? fit.auto;

  useLayoutEffect(() => {
    const scroller = wrapperRef.current?.firstElementChild;
    const grid = scroller?.firstElementChild;
    if (!(scroller instanceof HTMLElement) || !(grid instanceof HTMLElement)) return;
    const measure = () => {
      const tileWidth = grid.querySelector<HTMLElement>('[data-z]')?.offsetWidth ?? 0;
      const overflows = !compact && scroller.scrollWidth > scroller.clientWidth + 1;
      let auto: boolean;
      if (compact) {
        // Ya ajustada: las casillas miden lo que miden.
        auto = tileWidth >= MIN_FIT_TILE_PX;
      } else {
        // Sin ajustar: lo que no son casillas (ejes y huecos) se mantiene y las casillas se reparten el resto.
        const style = getComputedStyle(scroller);
        const available = scroller.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const overhead = grid.scrollWidth - 18 * tileWidth;
        auto = overflows && (available - overhead) / 18 >= MIN_FIT_TILE_PX;
      }
      setFit((prev) => (prev.auto === auto && prev.overflows === overflows ? prev : { auto, overflows }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [compact]);

  return { wrapperRef, compact, overflows: fit.overflows };
}

/**
 * Pregunta sobre la tabla periódica. `table-select` responde al tocar; `table-multi-select`
 * alterna casillas y se envía con «Comprobar». Tras responder revela la solución (en selección
 * múltiple: acertadas ✓, las que faltaron y las que sobraban ✗) y la deja a la vista sobre el
 * panel de feedback. En tabletas la tabla se ajusta sola al ancho si sus casillas siguen siendo
 * cómodas; si desliza, lo avisa.
 */
export function TableQuestion({ question, locked, response, onAnswer }: TableQuestionProps) {
  const multi = question.kind === 'table-multi-select';
  const view = PRESENTATION[question.type] ?? DEFAULT_PRESENTATION;
  const reducedMotion = useReducedMotion();
  const [picked, setPicked] = useState<number[]>([]);
  /** Elección explícita de «Ajustar a pantalla»; `null` = automático. */
  const [fitChoice, setFitChoice] = useState<boolean | null>(null);
  const { wrapperRef, compact, overflows } = useTableFit(fitChoice);

  const review = useMemo(() => (locked ? reviewTableAnswer(question, response ?? []) : null), [locked, question, response]);

  const reveal = useMemo(() => {
    if (!review) return null;
    const shown = new Set([...review.correct, ...review.incorrect, ...review.missed, ...review.optional]);
    // PeriodicTable desplaza a la vista (en horizontal) la primera casilla de `highlighted`. La primera
    // ya está marcada (✓/✗/faltó), así que no cambia de aspecto; el resto son las opcionales sin marcar,
    // resaltadas de forma neutra.
    const focus = multi ? (review.incorrect[0] ?? review.missed[0] ?? review.correct[0]) : review.correct[0];
    return {
      correct: review.correct,
      incorrect: review.incorrect,
      missed: review.missed,
      highlighted: focus === undefined ? review.optional : [focus, ...review.optional],
      dimmed: ALL_ATOMIC_NUMBERS.filter((z) => !shown.has(z)),
    };
  }, [review, multi]);

  // Tras corregir, lo relevante queda a la vista sobre el panel de feedback: en selección múltiple las
  // que sobraban y la primera que faltó; si no, la casilla tocada y la correcta.
  const revealTargets = useMemo(() => {
    if (!review) return [];
    const list = multi
      ? [...review.incorrect, ...review.missed.slice(0, 1)]
      : [...(response ?? []).slice(0, 1), ...review.correct.slice(0, 1)];
    return list.length > 0 ? list : review.correct.slice(0, 1);
  }, [review, multi, response]);
  const revealKey = revealTargets.join(',');
  useEffect(() => {
    if (!revealKey) return;
    const frame = window.requestAnimationFrame(() => {
      const root = wrapperRef.current;
      revealAboveFeedback(
        revealKey.split(',').map((z) => root?.querySelector(`[data-z="${z}"]`)),
        !reducedMotion,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [revealKey, reducedMotion, wrapperRef]);

  const toggle = useCallback((z: number) => {
    setPicked((list) => (list.includes(z) ? list.filter((x) => x !== z) : [...list, z]));
  }, []);
  const pickOne = useCallback((z: number) => onAnswer([z]), [onAnswer]);

  const onSelect = locked ? undefined : multi ? toggle : pickOne;
  const showFitToggle = compact || overflows;

  return (
    <div className="flex flex-col gap-4">
      <QuestionPrompt question={question} hint={view.hint} />

      {showFitToggle && (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <p className="text-xs font-bold text-muted">{overflows ? 'Desliza la tabla para ver todas las casillas.' : ''}</p>
          <FitToggle compact={compact} onChange={setFitChoice} size="sm" />
        </div>
      )}

      {/* En tabletas y escritorio la tabla sale de la columna inmersiva (máx. 60rem) para verse entera. */}
      <div ref={wrapperRef} className="sm:mx-[calc((100%_-_min(100vw_-_1rem,60rem))_/_2)]">
        <PeriodicTable
          label={question.prompt}
          onSelect={onSelect}
          selectable={question.selectableAtomicNumbers ?? true}
          selected={multi && !locked ? picked : undefined}
          correct={reveal?.correct}
          incorrect={reveal?.incorrect}
          missed={reveal?.missed}
          highlighted={reveal?.highlighted}
          dimmed={reveal?.dimmed}
          blind={view.blind}
          neutral={view.neutral}
          hideLabels={view.hideLabels}
          compact={compact}
        />
      </div>

      {multi && !locked && (
        <div className="sticky bottom-0 z-20 -mx-4 flex items-center gap-2 border-t border-border bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6">
          <p aria-live="polite" className="min-w-0 flex-1 text-sm font-bold text-muted tabular">
            {picked.length} {pluralize(picked.length, 'seleccionada', 'seleccionadas')}
          </p>
          <Button variant="ghost" size="sm" disabled={picked.length === 0} onClick={() => setPicked([])}>
            Borrar
          </Button>
          <Button size="lg" disabled={picked.length === 0} onClick={() => onAnswer(picked)}>
            Comprobar
          </Button>
        </div>
      )}
    </div>
  );
}
