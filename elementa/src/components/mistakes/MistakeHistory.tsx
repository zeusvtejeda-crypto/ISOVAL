'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Target, Trash2 } from 'lucide-react';
import { Button, ButtonLink, Chip } from '@/components/ui';
import { getElement } from '@/data/elements';
import type { MistakeRecord } from '@/types';
import { formatNumber, pluralize } from '@/utils/format';
import { ClearMistakesModal } from './ClearMistakesModal';
import { MistakeCard } from './MistakeCard';
import { mistakeGroups, relativeTime } from './mistakes-data';

/** Preguntas por "página". */
const PAGE_SIZE = 12;
/** Chips de elementos antes de «+N más». */
const MAX_CHIPS = 12;
/** Tiempo que se muestra el aviso tras borrar. */
const NOTICE_MS = 4_000;

export interface MistakeHistoryProps {
  mistakes: readonly MistakeRecord[];
  now: Date;
  onClear: (atomicNumber?: number) => void;
}

/** "Preguntas falladas": filtro por elemento, lista paginada, práctica y borrado con confirmación. */
export function MistakeHistory({ mistakes, now, onClear }: MistakeHistoryProps) {
  const [filter, setFilter] = useState<number | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [confirming, setConfirming] = useState(false);
  /** Qué se va a borrar (se conserva mientras el diálogo se cierra). */
  const [target, setTarget] = useState<{ z: number | null; name: string | null; count: number }>({
    z: null,
    name: null,
    count: 0,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [allChips, setAllChips] = useState(false);

  const groups = useMemo(() => mistakeGroups(mistakes), [mistakes]);
  // Si se borraron los errores del elemento filtrado, se vuelve a "Todos".
  const active = filter !== null && groups.some((g) => g.atomicNumber === filter) ? filter : null;
  const list = useMemo(
    () => (active === null ? mistakes : mistakes.filter((m) => m.atomicNumber === active)),
    [mistakes, active],
  );
  const shown = list.slice(0, visible);
  const remaining = list.length - shown.length;
  const activeEl = active !== null ? getElement(active) : null;
  // Chips visibles: los elementos con más errores (y siempre el seleccionado).
  const chipGroups =
    allChips || groups.length <= MAX_CHIPS
      ? groups
      : groups.filter((g, i) => i < MAX_CHIPS - 1 || g.atomicNumber === active);
  const hiddenChips = groups.length - chipGroups.length;

  useEffect(() => {
    if (notice === null) return;
    const id = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

  const choose = (z: number | null) => {
    setFilter(z);
    setVisible(PAGE_SIZE);
  };

  const askClear = () => {
    setTarget({ z: active, name: activeEl?.name ?? null, count: list.length });
    setConfirming(true);
  };

  const confirmClear = () => {
    onClear(target.z ?? undefined);
    setConfirming(false);
    setFilter(null);
    setVisible(PAGE_SIZE);
    const what = target.name ? `los errores de ${target.name}` : 'tus errores';
    setNotice(`Listo: borramos ${what} (${target.count} ${pluralize(target.count, 'pregunta', 'preguntas')}).`);
  };

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <div>
        <h2 id="history-title" className="text-xl font-black sm:text-2xl">
          Preguntas falladas
        </h2>
        <p className="text-sm font-semibold text-muted">
          {mistakes.length > 0
            ? `${formatNumber(mistakes.length)} ${pluralize(mistakes.length, 'pregunta guardada', 'preguntas guardadas')}, la más reciente primero.`
            : 'Aquí verás cada pregunta que falles, con la respuesta correcta.'}
        </p>
        <div role="status" aria-live="polite">
          {notice && (
            <p className="mt-3 flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 font-bold text-fg animate-slide-down">
              <span aria-hidden>🧹</span>
              {notice}
            </p>
          )}
        </div>
      </div>

      {mistakes.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border p-6 text-center">
          <p aria-hidden className="text-4xl">
            ✨
          </p>
          <p className="mt-2 font-black">No hay preguntas falladas guardadas</p>
          <p className="mt-0.5 text-sm font-semibold text-muted">Cuando falles una, aparecerá aquí para que la repases.</p>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Filtrar por elemento" className="flex flex-wrap gap-2">
              <Chip size="md" selected={active === null} onClick={() => choose(null)}>
                Todos
                <span className="text-muted tabular">{mistakes.length}</span>
              </Chip>
              {chipGroups.map((g) => {
                const el = getElement(g.atomicNumber);
                return (
                  <Chip
                    key={g.atomicNumber}
                    size="md"
                    selected={active === g.atomicNumber}
                    onClick={() => choose(active === g.atomicNumber ? null : g.atomicNumber)}
                    aria-label={`${el.name}: ${g.count} ${pluralize(g.count, 'error', 'errores')}`}
                    title={el.name}
                  >
                    <span className="font-black">{el.symbol}</span>
                    <span className="text-muted tabular">{g.count}</span>
                  </Chip>
                );
              })}
              {hiddenChips > 0 && (
                <Chip size="md" onClick={() => setAllChips(true)} aria-label={`Ver ${hiddenChips} elementos más`}>
                  +{hiddenChips} más
                </Chip>
              )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ButtonLink
              href={activeEl ? `/practicar?elements=${activeEl.atomicNumber}` : '/practicar?focus=errores'}
              leftIcon={<Target aria-hidden />}
              className="sm:flex-1 md:flex-none"
            >
              {activeEl ? `Practicar ${activeEl.name}` : 'Practicar estas preguntas'}
            </ButtonLink>
            <Button
              variant="ghost"
              leftIcon={<Trash2 aria-hidden className="text-danger" />}
              className="sm:ml-auto"
              onClick={askClear}
            >
              <span className="text-danger">{activeEl ? `Borrar errores de ${activeEl.symbol}` : 'Borrar todos'}</span>
            </Button>
          </div>

          <ul aria-label={activeEl ? `Errores de ${activeEl.name}` : 'Todas las preguntas falladas'} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {shown.map((m) => (
              <li key={m.id} className="animate-fade-in">
                <MistakeCard mistake={m} when={relativeTime(m.at, now)} />
              </li>
            ))}
          </ul>

          {remaining > 0 && (
            <Button
              variant="secondary"
              rightIcon={<ChevronDown aria-hidden />}
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="self-center"
            >
              Ver más ({remaining})
            </Button>
          )}
        </>
      )}

      <ClearMistakesModal
        open={confirming}
        elementName={target.name}
        count={target.count}
        onConfirm={confirmClear}
        onClose={() => setConfirming(false)}
      />
    </section>
  );
}
