'use client';

import { useId, useMemo } from 'react';
import { Play } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, cn, SegmentedControl, Skeleton } from '@/components/ui';
import { StickyActions } from '@/components/ui/StickyActions';
import { CATEGORY_ORDER } from '@/data/categories';
import { STUDY_BLOCKS } from '@/data/blocks';
import { TOTAL_ELEMENTS } from '@/data/elements';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import { formatNumber, pluralize } from '@/utils/format';
import { dueReviews } from '@/utils/selection';
import { DeckPicker } from './DeckPicker';
import { DECK_SIZES, deckCount, deckPool, deckTitle, mistakeNumbers, type DeckSelection, type DeckSize } from './deck';
import { ModePicker } from './ModePicker';
import { getFlashcardMode, type FlashcardModeId } from './modes';

export interface FlashcardsSetupProps {
  modeId: FlashcardModeId;
  onModeChange: (id: FlashcardModeId) => void;
  selection: DeckSelection;
  onSelectionChange: (selection: DeckSelection) => void;
  size: DeckSize;
  onSizeChange: (size: DeckSize) => void;
  /** Elementos de `?elements=`. */
  custom: readonly number[] | null;
  onStart: () => void;
}

const SIZE_OPTIONS = DECK_SIZES.map((n) => ({ value: n, label: `${n}`, ariaLabel: `${n} tarjetas` }));

export function FlashcardsSetupSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando flashcards" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-24" rounded="3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" rounded="3xl" />
        ))}
      </div>
    </div>
  );
}

function Stat({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <li className="flex min-w-0 flex-1 flex-col items-start gap-1.5 rounded-2xl bg-surface-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2.5">
      <span aria-hidden className="text-xl leading-none">
        {emoji}
      </span>
      <span className="min-w-0">
        <span className="block text-lg leading-none font-black tabular">{formatNumber(value)}</span>
        <span className="block truncate text-xs font-bold text-muted">{label}</span>
      </span>
    </li>
  );
}

/** Configuración: modo, mazo y tamaño; «Empezar» genera el mazo. */
export function FlashcardsSetup({
  modeId,
  onModeChange,
  selection,
  onSelectionChange,
  size,
  onSizeChange,
  custom,
  onStart,
}: FlashcardsSetupProps) {
  const { state, ready } = useProgress();
  const now = useNow();
  const modeTitleId = useId();
  const deckTitleId = useId();
  const mode = getFlashcardMode(modeId);

  const info = useMemo(() => {
    const dueCount = dueReviews(state, now, TOTAL_ELEMENTS).length;
    // Mismo número que «Elementos difíciles» en /errores (sin filtrar por modo).
    const mistakeCount = mistakeNumbers(state, now).length;
    const defaultBlock =
      STUDY_BLOCKS.find((b) => b.atomicNumbers.some((z) => !state.elements[z]?.learned))?.id ?? STUDY_BLOCKS[0].id;
    return { dueCount, mistakeCount, defaultBlock };
  }, [state, now]);

  const poolSize = useMemo(() => deckPool(selection, state, now, mode).length, [selection, state, now, mode]);

  if (!ready) return <FlashcardsSetupSkeleton />;

  const count = deckCount(selection, poolSize, size);
  const isCustom = selection.kind === 'custom';
  const emptyHint =
    selection.kind === 'mistakes'
      ? 'Aún no tienes errores para repasar.'
      : mode.note
        ? `Ningún elemento de este mazo tiene tarjeta en este modo. ${mode.note}`
        : 'Este mazo no tiene tarjetas.';

  return (
    <>
      <PageHeader
        title="Flashcards"
        eyebrow="Repetición espaciada"
        subtitle="Gira la tarjeta, recuerda y califícate. Lo que te cuesta vuelve a salir."
      />

      <ul aria-label="Tu repaso" className="mb-6 flex gap-2">
        <Stat emoji="🔁" value={info.dueCount} label="Pendientes" />
        <Stat emoji="🎯" value={info.mistakeCount} label="Por reforzar" />
        <Stat emoji="🃏" value={state.stats.flashcardsReviewed} label="Repasadas" />
      </ul>

      <div className="flex flex-col gap-7">
        <section aria-labelledby={modeTitleId}>
          <h2 id={modeTitleId} className="mb-3 text-lg font-black sm:text-xl">
            ¿Qué quieres practicar?
          </h2>
          <ModePicker value={modeId} onChange={onModeChange} labelledBy={modeTitleId} />
        </section>

        <section aria-labelledby={deckTitleId}>
          <h2 id={deckTitleId} className="mb-3 text-lg font-black sm:text-xl">
            Elige tu mazo
          </h2>
          <DeckPicker
            selection={selection}
            onChange={onSelectionChange}
            custom={custom}
            dueCount={info.dueCount}
            mistakeCount={info.mistakeCount}
            defaultBlock={info.defaultBlock}
            defaultFamily={CATEGORY_ORDER[0]}
            labelledBy={deckTitleId}
          />
        </section>

        {!isCustom && (
          <section className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black sm:text-xl">¿Cuántas tarjetas?</h2>
            <SegmentedControl label="Número de tarjetas" options={SIZE_OPTIONS} value={size} onChange={onSizeChange} />
            {poolSize > 0 && poolSize < size && (
              <p className="w-full text-sm font-semibold text-muted">
                Este mazo tiene {poolSize} {pluralize(poolSize, 'tarjeta', 'tarjetas')}: las verás todas.
              </p>
            )}
          </section>
        )}
      </div>

      <StickyActions className="mt-6">
        <Button size="lg" block disabled={count === 0} onClick={onStart} leftIcon={<Play aria-hidden />}>
          {count === 0 ? 'Sin tarjetas' : `Empezar · ${count} ${pluralize(count, 'tarjeta', 'tarjetas')}`}
        </Button>
        <p className={cn('mt-2 text-center text-sm font-bold text-muted', count > 0 && 'truncate')} aria-live="polite">
          {count === 0 ? emptyHint : `${mode.title} · ${deckTitle(selection)}`}
        </p>
      </StickyActions>
    </>
  );
}
