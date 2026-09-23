'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { ALL_ATOMIC_NUMBERS, FitToggle, PeriodicTable } from '@/components/periodic';
import type { Question, QuestionType } from '@/types';
import { pluralize } from '@/utils/format';
import { QuestionPrompt } from './QuestionPrompt';

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

/** Espacio que tapa el panel de feedback al pie de la pantalla. */
const FEEDBACK_ALLOWANCE_PX = 240;

/**
 * Pregunta sobre la tabla periódica. `table-select` responde al tocar; `table-multi-select`
 * alterna casillas y se envía con «Comprobar». Tras responder revela la solución.
 */
export function TableQuestion({ question, locked, response, onAnswer }: TableQuestionProps) {
  const multi = question.kind === 'table-multi-select';
  const view = PRESENTATION[question.type] ?? DEFAULT_PRESENTATION;
  const [picked, setPicked] = useState<number[]>([]);
  const [compact, setCompact] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const reveal = useMemo(() => {
    if (!locked) return null;
    const targets = question.targetAtomicNumbers ?? [];
    const given = response ?? [];
    const wrong = given.filter((z) => !targets.includes(z));
    const shown = new Set([...targets, ...wrong]);
    return { correct: targets, incorrect: wrong, dimmed: ALL_ATOMIC_NUMBERS.filter((z) => !shown.has(z)) };
  }, [locked, question, response]);

  const toggle = useCallback((z: number) => {
    setPicked((list) => (list.includes(z) ? list.filter((x) => x !== z) : [...list, z]));
  }, []);
  const pickOne = useCallback((z: number) => onAnswer([z]), [onAnswer]);

  // Tras corregir, asegura que la primera casilla correcta quede visible sobre el panel de feedback.
  const firstTarget = reveal?.correct[0] ?? null;
  useEffect(() => {
    if (firstTarget === null) return;
    const frame = window.requestAnimationFrame(() => {
      const tile = rootRef.current?.querySelector<HTMLElement>(`[data-z="${firstTarget}"]`);
      if (!tile) return;
      const rect = tile.getBoundingClientRect();
      const visibleBottom = window.innerHeight - FEEDBACK_ALLOWANCE_PX;
      if (rect.top >= 72 && rect.bottom <= visibleBottom) return;
      window.scrollBy({ top: rect.top - Math.max(72, (visibleBottom - rect.height) / 2) });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [firstTarget]);

  const onSelect = locked ? undefined : multi ? toggle : pickOne;

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      <QuestionPrompt question={question} hint={view.hint} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-muted lg:invisible">{compact ? '' : 'Desliza la tabla para ver todas las casillas.'}</p>
        <FitToggle compact={compact} onChange={setCompact} size="sm" />
      </div>

      <PeriodicTable
        label={question.prompt}
        onSelect={onSelect}
        selectable={question.selectableAtomicNumbers ?? true}
        selected={multi && !locked ? picked : undefined}
        correct={reveal?.correct}
        incorrect={reveal?.incorrect}
        dimmed={reveal?.dimmed}
        blind={view.blind}
        neutral={view.neutral}
        hideLabels={view.hideLabels}
        compact={compact}
      />

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
