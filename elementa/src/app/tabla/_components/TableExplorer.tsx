'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Gamepad2, Target } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import {
  ALL_ATOMIC_NUMBERS,
  CategoryLegend,
  ElementSearch,
  FitToggle,
  MasteryLegend,
  PeriodicTable,
} from '@/components/periodic';
import { ButtonLink, Chip } from '@/components/ui';
import type { ElementCategory } from '@/types';
import { ElementParamModal } from './ElementParamModal';
import { FamilyParam } from './FamilyParam';
import { FamilyInfo } from './FamilyInfo';
import { TableGuide } from './TableGuide';

/**
 * Tabla periódica interactiva: buscador, filtro por familias, capa de dominio, ajuste a pantalla
 * y ficha de cada elemento en un modal. La URL (`?e=<Z>`) es la fuente de verdad del elemento
 * abierto: se puede compartir y el botón «atrás» cierra la ficha. `?family=<categoría>` abre la
 * tabla con esa familia filtrada.
 */
export function TableExplorer() {
  const [family, setFamily] = useState<ElementCategory | null>(null);
  const [showMastery, setShowMastery] = useState(false);
  const [compact, setCompact] = useState(false);
  const [hits, setHits] = useState<number[]>([]);
  /** La ficha se abrió desde esta página (hay una entrada del historial que deshacer al cerrar). */
  const pushedEntry = useRef(false);
  const pathname = usePathname();

  const openElement = useCallback((z: number) => {
    window.history.pushState(null, '', `?e=${z}`);
    pushedEntry.current = true;
  }, []);

  const showElement = useCallback((z: number) => {
    window.history.replaceState(null, '', `?e=${z}`);
  }, []);

  const closeElement = useCallback(() => {
    if (pushedEntry.current) {
      pushedEntry.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, '', pathname);
    }
  }, [pathname]);

  const toggleFamily = useCallback((category: ElementCategory) => {
    setFamily((current) => (current === category ? null : category));
  }, []);

  const dimmed = useMemo(
    () => (hits.length > 0 ? ALL_ATOMIC_NUMBERS.filter((z) => !hits.includes(z)) : undefined),
    [hits],
  );
  const searching = hits.length > 0;

  return (
    <>
      <PageHeader
        title="Tabla periódica"
        subtitle="Toca un elemento para ver su ficha completa."
        actions={
          <ButtonLink href="/visual" size="sm" variant="secondary" leftIcon={<Gamepad2 aria-hidden />}>
            Jugar
          </ButtonLink>
        }
      />

      <div className="flex flex-col gap-4">
        <ElementSearch onSelect={openElement} onResultsChange={setHits} className="z-20" />

        <CategoryLegend active={family} onToggle={toggleFamily} />

        <div className="flex flex-wrap items-center gap-2">
          <FitToggle compact={compact} onChange={setCompact} />
          <Chip
            selected={showMastery}
            onClick={() => setShowMastery((v) => !v)}
            icon={<Target aria-hidden />}
          >
            Mostrar dominio
          </Chip>
        </div>

        {family && !searching && <FamilyInfo category={family} onClear={() => setFamily(null)} />}
        {showMastery && <MasteryLegend />}

        <div>
          <PeriodicTable
            onSelect={openElement}
            highlighted={searching ? hits : undefined}
            dimmed={dimmed}
            filterCategory={searching ? null : family}
            showMastery={showMastery}
            compact={compact}
          />
          {!compact && (
            <p className="mt-1 text-xs font-bold text-muted lg:hidden">
              Desliza la tabla hacia los lados para verla completa, o pulsa «Ajustar a pantalla».
            </p>
          )}
        </div>

        <TableGuide />
      </div>

      <Suspense fallback={null}>
        <FamilyParam onFamily={setFamily} />
        <ElementParamModal onClose={closeElement} onNavigate={showElement} />
      </Suspense>
    </>
  );
}
