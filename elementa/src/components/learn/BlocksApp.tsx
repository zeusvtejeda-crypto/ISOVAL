'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Blocks, FlaskConical } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { ProgressBar, SegmentedControl } from '@/components/ui';
import { FAMILY_GROUPS, STUDY_BLOCKS } from '@/data/blocks';
import { TOTAL_ELEMENTS } from '@/data/elements';
import { useMasteryMap } from '@/hooks/useMasteryMap';
import { useProgress } from '@/hooks/useProgress';
import { pluralize } from '@/utils/format';
import { BlockCard } from './BlockCard';
import { FamilyCard } from './FamilyCard';
import { groupProgress, suggestNextBlock, type GroupProgress } from './group-progress';
import { BlocksSkeleton } from './LearnSkeletons';
import { MiniTileLegend } from './MiniTileStrip';
import { NextBlockCard } from './NextBlockCard';

type View = 'bloques' | 'familias';

const VIEW_OPTIONS = [
  { value: 'bloques', label: 'Bloques', icon: <Blocks aria-hidden /> },
  { value: 'familias', label: 'Familias', icon: <FlaskConical aria-hidden /> },
] as const;

function parseView(raw: string | null): View {
  return raw === 'familias' ? 'familias' : 'bloques';
}

/**
 * /bloques — aprender por bloques de 10 (con el siguiente sugerido) o por familias químicas.
 * La pestaña vive en `?vista=familias` (así «atrás» vuelve a ella). Debe ir dentro de `<Suspense>`.
 */
export function BlocksApp() {
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get('vista'));
  const { state, ready } = useProgress();
  const mastery = useMasteryMap();

  const blockProgress = useMemo(() => {
    const out: Record<string, GroupProgress> = {};
    for (const b of STUDY_BLOCKS) out[b.id] = groupProgress(b.atomicNumbers, state, mastery);
    return out;
  }, [state, mastery]);

  const familyProgress = useMemo(() => {
    const out: Record<string, GroupProgress> = {};
    for (const f of FAMILY_GROUPS) out[f.id] = groupProgress(f.atomicNumbers, state, mastery);
    return out;
  }, [state, mastery]);

  const totals = useMemo(() => {
    let learned = 0;
    let mastered = 0;
    for (const p of Object.values(blockProgress)) {
      learned += p.learned;
      mastered += p.mastered;
    }
    return { learned, mastered };
  }, [blockProgress]);

  const suggestion = useMemo(() => suggestNextBlock(STUDY_BLOCKS, blockProgress), [blockProgress]);

  const changeView = useCallback((next: View) => {
    const params = new URLSearchParams(window.location.search);
    if (next === 'familias') params.set('vista', 'familias');
    else params.delete('vista');
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, []);

  if (!ready) return <BlocksSkeleton />;

  return (
    <>
      <PageHeader
        title="Bloques y familias"
        subtitle="Aprende de 10 en 10 o por familias químicas."
        back="/"
        backLabel="Volver al inicio"
      />
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <ProgressBar
            className="sm:max-w-md"
            value={totals.learned / TOTAL_ELEMENTS}
            tone="success"
            label="Tu avance en la tabla"
            showValue
            valueText={`${totals.learned} / ${TOTAL_ELEMENTS}`}
          />
          <p className="shrink-0 text-sm font-bold text-muted">
            <span className="font-black text-success tabular">{totals.mastered}</span>{' '}
            {pluralize(totals.mastered, 'dominado', 'dominados')} <span aria-hidden>🟢</span>
          </p>
        </div>

        <SegmentedControl<View>
          options={VIEW_OPTIONS}
          value={view}
          onChange={changeView}
          label="Ver por"
          block
          className="sm:max-w-sm"
        />

        {view === 'bloques' ? (
          <div key="bloques" className="flex flex-col gap-5 animate-fade-in">
            {suggestion && (
              <NextBlockCard
                suggestion={suggestion}
                progress={blockProgress[suggestion.block.id]}
                state={state}
                mastery={mastery}
              />
            )}
            <section aria-labelledby="blocks-title" className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <h2 id="blocks-title" className="text-xl font-black">
                  Los 12 bloques
                </h2>
                <MiniTileLegend />
              </div>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {STUDY_BLOCKS.map((block) => (
                  <li key={block.id}>
                    <BlockCard
                      block={block}
                      progress={blockProgress[block.id]}
                      state={state}
                      mastery={mastery}
                      suggested={suggestion?.block.id === block.id && suggestion.reason !== 'review'}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <section key="familias" aria-labelledby="families-title" className="flex flex-col gap-3 animate-fade-in">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="families-title" className="text-xl font-black">
                  Las 10 familias
                </h2>
                <p className="text-sm font-semibold text-muted">Elementos que se parecen y se aprenden mejor juntos.</p>
              </div>
              <MiniTileLegend />
            </div>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {FAMILY_GROUPS.map((family) => (
                <li key={family.id}>
                  <FamilyCard family={family} progress={familyProgress[family.id]} state={state} mastery={mastery} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
