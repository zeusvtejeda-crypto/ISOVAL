'use client';

import { useMemo, type ReactNode } from 'react';
import { ContinueCard } from '@/components/dashboard/ContinueCard';
import { PageHeader } from '@/components/layout';
import { Badge, Skeleton } from '@/components/ui';
import { TOTAL_ELEMENTS } from '@/data/elements';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import type { ProgressState } from '@/types';
import { formatNumber } from '@/utils/format';
import { weakElements } from '@/utils/planner';
import { ModeCard } from './ModeCard';
import { LEARN_MODES, MODES, PLAY_MODES, type ModeId, type ModeInfo } from './modes';

interface FooterContext {
  ready: boolean;
  state: ProgressState;
  weakCount: number;
}

function modeFooter(mode: ModeInfo, { ready, state, weakCount }: FooterContext): ReactNode {
  if (mode.id === 'errores') {
    if (!ready) return <Skeleton rounded="full" className="h-6 w-32" />;
    return weakCount > 0 ? (
      <Badge tone="danger" icon={<span aria-hidden>🎯</span>}>
        {formatNumber(weakCount)} por reforzar
      </Badge>
    ) : (
      <Badge tone="success" icon={<span aria-hidden>✅</span>}>
        Nada pendiente
      </Badge>
    );
  }
  if (!mode.record) return null;
  if (!ready) return <Skeleton rounded="full" className="h-6 w-28" />;
  const text = mode.record(state.records);
  return text ? (
    <Badge tone="xp" icon={<span aria-hidden>🏆</span>}>
      {text}
    </Badge>
  ) : (
    <span className="text-xs font-bold text-muted">Aún sin récord: ¡estrénalo!</span>
  );
}

function ModeSection({ id, title, subtitle, modes, ctx }: { id: string; title: string; subtitle: string; modes: readonly ModeId[]; ctx: FooterContext }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xl font-black">
        {title}
      </h2>
      <p className="mt-0.5 text-sm font-semibold text-muted">{subtitle}</p>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modes.map((modeId, i) => {
          const mode = MODES[modeId];
          return (
            <li key={modeId} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
              <ModeCard mode={mode} footer={modeFooter(mode, ctx)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Centro de juego: la sesión inteligente destacada y todos los modos con tus récords. */
export function GameHub() {
  const { ready, state } = useProgress();
  const now = useNow();
  const weakCount = useMemo(
    () => (ready ? weakElements(state, now, TOTAL_ELEMENTS).length : 0),
    [ready, state, now],
  );
  const ctx: FooterContext = { ready, state, weakCount };

  return (
    <>
      <PageHeader title="Jugar" subtitle="Elige un modo y a practicar." />
      <div className="flex flex-col gap-8">
        <ContinueCard cta="Estudiar ahora" className="animate-slide-up" />
        <ModeSection
          id="hub-play"
          title="Retos y juegos"
          subtitle="Partidas rápidas para ganar XP y batir tus récords."
          modes={PLAY_MODES}
          ctx={ctx}
        />
        <ModeSection
          id="hub-learn"
          title="Aprende y repasa"
          subtitle="A tu ritmo: elementos nuevos, tarjetas y tus puntos débiles."
          modes={LEARN_MODES}
          ctx={ctx}
        />
      </div>
    </>
  );
}
