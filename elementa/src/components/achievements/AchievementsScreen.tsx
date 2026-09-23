'use client';

import { useEffect, useMemo, useState } from 'react';
import { AchievementCard, Confetti } from '@/components/gamification';
import { PageHeader } from '@/components/layout';
import { Badge, Card, EmptyState, ProgressRing, SegmentedControl, cn } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import { achievementStatuses, type AchievementStatus } from '@/utils/achievements';
import { pluralize } from '@/utils/format';
import { AchievementsSkeleton } from './AchievementsSkeleton';
import {
  filterStatuses,
  isRecent,
  nextAchievement,
  sortStatuses,
  type AchievementFilter,
} from './achievements-view';
import { readCelebrated, writeCelebrated } from './celebrated';

function Count({ n }: { n: number }) {
  return <span className="ml-0.5 hidden tabular opacity-70 min-[400px]:inline">{n}</span>;
}

function AchievementItem({ status, recent, index }: { status: AchievementStatus; recent: boolean; index: number }) {
  return (
    <li className="relative animate-slide-up" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
      <AchievementCard
        {...status.def}
        unlocked={status.unlocked}
        unlockedAt={status.unlockedAt}
        current={status.current}
        target={status.target}
        className={cn('h-full', recent && 'ring-2 ring-xp-glow')}
      />
      {recent && (
        <Badge tone="xp" variant="solid" className="absolute -top-2.5 right-4 animate-bounce-in shadow-card">
          <span aria-hidden>✨</span> ¡Nuevo!
        </Badge>
      )}
    </li>
  );
}

/** /logros: cuántos llevas, el próximo al alcance y todos los logros (conseguidos primero). */
export function AchievementsScreen() {
  const { state, ready } = useProgress();
  const now = useNow();
  const [filter, setFilter] = useState<AchievementFilter>('all');
  const [confetti, setConfetti] = useState(0);

  const statuses = useMemo(() => sortStatuses(achievementStatuses(state, now)), [state, now]);
  const unlocked = statuses.filter((s) => s.unlocked).length;
  const total = statuses.length;
  const next = nextAchievement(statuses);
  const recentIds = statuses.filter((s) => isRecent(s, now)).map((s) => s.def.id);
  const recentKey = ready ? recentIds.join(',') : '';

  // Confeti la primera vez que ves aquí un logro recién conseguido (una vez por logro y navegador).
  useEffect(() => {
    if (!recentKey) return;
    const ids = recentKey.split(',');
    const celebrated = readCelebrated();
    if (ids.every((id) => celebrated.has(id))) return;
    const timer = window.setTimeout(() => {
      writeCelebrated([...celebrated, ...ids]);
      setConfetti((n) => n + 1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [recentKey]);

  if (!ready) return <AchievementsSkeleton />;

  const recent = new Set(recentIds);
  const shown = filterStatuses(statuses, filter);
  const ratio = total > 0 ? unlocked / total : 0;

  return (
    <>
      {confetti > 0 && <Confetti key={confetti} pieces={120} />}
      <PageHeader back eyebrow="Tu progreso" title="Logros" subtitle="Cada meta superada deja huella. ¿Los consigues todos?" />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card className="flex items-center gap-4 sm:gap-5">
            <ProgressRing
              value={ratio}
              size={92}
              stroke={10}
              tone="xp"
              label={`Logros desbloqueados: ${unlocked} de ${total}`}
            >
              <span aria-hidden className="text-3xl">
                {unlocked === total && total > 0 ? '👑' : '🏆'}
              </span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-wider text-muted uppercase">Desbloqueados</p>
              <p className="text-3xl leading-tight font-black">
                {unlocked}
                <span className="text-lg font-extrabold text-muted"> / {total}</span>
              </p>
              <p className="text-sm font-semibold text-muted">
                {unlocked === total
                  ? '¡Los tienes todos! Eres leyenda.'
                  : unlocked === 0
                    ? 'Tu primer logro está a un paso.'
                    : `Te ${pluralize(total - unlocked, 'falta', 'faltan')} ${total - unlocked}. ¡A por ellos!`}
              </p>
            </div>
          </Card>

          {next && (
            <section aria-labelledby="next-achievement-title" className="flex flex-col gap-2">
              <h2 id="next-achievement-title" className="text-xs font-black tracking-wider text-muted uppercase">
                <span aria-hidden>🎯 </span>
                {next.ratio > 0 ? 'Tu próximo logro' : 'Empieza por aquí'}
              </h2>
              <div className="flex flex-1 rounded-3xl ring-2 ring-brand/35">
                <AchievementCard
                  {...next.def}
                  unlocked={false}
                  current={next.current}
                  target={next.target}
                  className="flex-1"
                />
              </div>
            </section>
          )}
        </div>

        <section aria-labelledby="all-achievements-title" className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="all-achievements-title" className="text-xl font-black sm:text-2xl">
              Todos los logros
            </h2>
            <SegmentedControl<AchievementFilter>
              label="Mostrar logros"
              value={filter}
              onChange={setFilter}
              size="sm"
              block
              className="sm:w-auto sm:min-w-80"
              options={[
                { value: 'all', label: <>Todos<Count n={total} /></> },
                { value: 'unlocked', label: <>Logrados<Count n={unlocked} /></> },
                { value: 'locked', label: <>Pendientes<Count n={total - unlocked} /></> },
              ]}
            />
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={filter === 'unlocked' ? '🏁' : '👑'}
              title={filter === 'unlocked' ? 'Aún no tienes logros' : '¡No te queda ninguno!'}
              description={
                filter === 'unlocked'
                  ? 'Aprende tu primer elemento o cumple tu meta diaria para estrenar la vitrina.'
                  : 'Has desbloqueado todos los logros. Impresionante.'
              }
            />
          ) : (
            <ul key={filter} className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
              {shown.map((s, i) => (
                <AchievementItem key={s.def.id} status={s} recent={recent.has(s.def.id)} index={i} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
