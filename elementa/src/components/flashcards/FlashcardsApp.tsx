'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useImmersive } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { shuffle } from '@/utils/random';
import { applicableNumbers, buildDeck, DEFAULT_DECK_SIZE, deckTitle, type DeckSelection, type DeckSize } from './deck';
import { FlashcardsSetup } from './FlashcardsSetup';
import { FlashcardsSummary } from './FlashcardsSummary';
import { DEFAULT_MODE_ID, getFlashcardMode, type FlashcardModeId } from './modes';
import { parseFlashcardParams, type FlashcardParams } from './params';
import type { FlashcardSessionResult, StudyDeck } from './session';
import { StudySession } from './StudySession';

type Phase =
  | { kind: 'setup' }
  | { kind: 'study'; deck: StudyDeck }
  | { kind: 'summary'; result: FlashcardSessionResult };

const CUSTOM_TITLE = 'Tu selección';
const DIFFICULT_TITLE = 'Las difíciles';

export function StudySkeleton() {
  return (
    <div aria-busy="true" aria-label="Preparando tarjetas" className="flex flex-1 flex-col gap-4 py-2">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11" rounded="2xl" />
        <Skeleton className="h-4 flex-1" rounded="full" />
        <Skeleton className="h-10 w-16" rounded="full" />
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <Skeleton className="h-72 w-full sm:h-80" rounded="3xl" />
      </div>
      <Skeleton className="h-14 w-full" rounded="2xl" />
    </div>
  );
}

/** Con `?elements=` se entra directo a estudiar (si el modo tiene tarjetas para esos elementos). */
function initialPhase(params: FlashcardParams): Phase {
  if (!params.elements) return { kind: 'setup' };
  const modeId = params.mode ?? DEFAULT_MODE_ID;
  const elements = applicableNumbers(getFlashcardMode(modeId), params.elements);
  if (elements.length === 0) return { kind: 'setup' };
  return { kind: 'study', deck: { id: 0, modeId, elements, title: CUSTOM_TITLE } };
}

function FlashcardsFlow({ params }: { params: FlashcardParams }) {
  const { state, ready } = useProgress();
  const [modeId, setModeId] = useState<FlashcardModeId>(params.mode ?? DEFAULT_MODE_ID);
  const [selection, setSelection] = useState<DeckSelection>(() =>
    params.elements ? { kind: 'custom', elements: params.elements, title: CUSTOM_TITLE } : { kind: 'smart' },
  );
  const [size, setSize] = useState<DeckSize>(DEFAULT_DECK_SIZE);
  const [phase, setPhase] = useState<Phase>(() => initialPhase(params));
  const deckIds = useRef(0);

  useImmersive(phase.kind !== 'setup');

  // Cada pantalla (configuración, mazo nuevo, resumen) empieza arriba.
  const screenKey = phase.kind === 'study' ? `study-${phase.deck.id}` : phase.kind;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screenKey]);

  const startDeck = (deck: Omit<StudyDeck, 'id'>) => {
    if (deck.elements.length === 0) return;
    deckIds.current += 1;
    setPhase({ kind: 'study', deck: { ...deck, id: deckIds.current } });
  };

  const start = () => {
    const elements = buildDeck(selection, state, new Date(), getFlashcardMode(modeId), size);
    startDeck({ modeId, elements, title: deckTitle(selection) });
  };

  const backToSetup = () => setPhase({ kind: 'setup' });

  if (phase.kind === 'setup') {
    return (
      <FlashcardsSetup
        modeId={modeId}
        onModeChange={setModeId}
        selection={selection}
        onSelectionChange={setSelection}
        size={size}
        onSizeChange={setSize}
        custom={params.elements}
        onStart={start}
      />
    );
  }

  if (phase.kind === 'summary') {
    const { result } = phase;
    return (
      <FlashcardsSummary
        result={result}
        onRetryDifficult={() =>
          startDeck({ modeId: result.deck.modeId, elements: shuffle(result.difficult), title: DIFFICULT_TITLE })
        }
        onNewDeck={backToSetup}
      />
    );
  }

  if (!ready) return <StudySkeleton />;

  return (
    <StudySession
      key={phase.deck.id}
      deck={phase.deck}
      onFinish={(result) => setPhase({ kind: 'summary', result })}
      onExit={backToSetup}
    />
  );
}

/**
 * /flashcards: configuración → estudio → resumen. Lee `?elements=1,2,3` (mazo propio: entra
 * directo a estudiar) y `?mode=<id>`. Un cambio de parámetros reinicia el flujo.
 * Debe renderizarse dentro de `<Suspense>` (usa `useSearchParams`).
 */
export function FlashcardsApp() {
  const searchParams = useSearchParams();
  return <FlashcardsFlow key={searchParams.toString()} params={parseFlashcardParams(searchParams)} />;
}
