'use client';

import { useId } from 'react';
import { MasteryBadge, MasteryBar } from '@/components/gamification';
import { Skeleton, cn } from '@/components/ui';
import { useElementMastery } from '@/hooks/useElementMastery';
import { useProgress } from '@/hooks/useProgress';
import { formatNumber, formatPercent } from '@/utils/format';

interface StatProps {
  label: string;
  value: string;
  tone?: string;
}

function Stat({ label, value, tone }: StatProps) {
  return (
    <div className="flex min-w-0 flex-col-reverse rounded-2xl bg-surface-2 px-3 py-2.5 text-center">
      <dt className="text-xs font-extrabold text-muted">{label}</dt>
      <dd className={cn('text-xl leading-tight font-black tabular', tone)}>{value}</dd>
    </div>
  );
}

/** "Dominio del elemento": barra de dominio, nivel y aciertos/fallos del usuario. */
export function ElementMasteryPanel({ atomicNumber, className }: { atomicNumber: number; className?: string }) {
  const { ready } = useProgress();
  const { mastery, tier, progress } = useElementMastery(atomicNumber);
  const correct = progress?.correct ?? 0;
  const incorrect = progress?.incorrect ?? 0;
  const answers = correct + incorrect;
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn('rounded-3xl border border-border bg-surface p-4 shadow-card', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-black">
          Dominio del elemento
        </h3>
        {ready ? <MasteryBadge tier={tier} /> : <Skeleton rounded="full" className="h-7 w-28" />}
      </div>

      {ready ? (
        <>
          <MasteryBar value={mastery} className="mt-3" />
          {answers === 0 ? (
            <p className="mt-3 text-sm font-semibold text-muted">
              Aún no has practicado este elemento. ¡Empieza ahora y sube tu dominio!
            </p>
          ) : (
            <dl className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Aciertos" value={formatNumber(correct)} tone="text-success" />
              <Stat label="Fallos" value={formatNumber(incorrect)} tone="text-danger" />
              <Stat label="Precisión" value={formatPercent(correct / answers)} />
            </dl>
          )}
        </>
      ) : (
        <>
          <Skeleton className="mt-3 h-3 w-full" rounded="full" />
          <Skeleton className="mt-3 h-14 w-full" rounded="2xl" />
        </>
      )}
    </section>
  );
}
