import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui';
import { getElement } from '@/data/elements';
import type { MistakeRecord } from '@/types';
import { MODE_LABELS, SKILL_META } from '@/components/stats/labels';

export interface MistakeCardProps {
  mistake: MistakeRecord;
  /** Fecha relativa ya calculada ("hace 5 min"). */
  when: string;
}

/** Una pregunta fallada: enunciado, tu respuesta ✗, la correcta ✓, modo y cuándo. */
export function MistakeCard({ mistake, when }: MistakeCardProps) {
  const el = getElement(mistake.atomicNumber);
  const skill = SKILL_META[mistake.skill];

  return (
    <article className="rounded-3xl border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="brand" size="sm">
          <span className="font-black">{el.symbol}</span>
          <span className="font-bold">· {el.name}</span>
        </Badge>
        <Badge tone="neutral" size="sm">
          {MODE_LABELS[mistake.mode] ?? 'Práctica'}
        </Badge>
        {skill && (
          <Badge tone="neutral" size="sm" className="hidden min-[400px]:inline-flex">
            <span aria-hidden>{skill.emoji}</span>
            {skill.label}
          </Badge>
        )}
        <time dateTime={mistake.at} className="ml-auto text-xs font-bold text-muted">
          {when}
        </time>
      </div>
      <p className="mt-2.5 leading-snug font-black">{mistake.prompt}</p>
      <div className="mt-3 grid gap-1.5 text-sm">
        <p className="flex items-start gap-2 rounded-2xl bg-danger-soft px-3 py-2">
          <X aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={3} />
          <span className="min-w-0 break-words">
            <span className="font-bold">Tu respuesta: </span>
            <span className="font-black">{mistake.givenAnswer || '—'}</span>
          </span>
        </p>
        <p className="flex items-start gap-2 rounded-2xl bg-success-soft px-3 py-2">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} />
          <span className="min-w-0 break-words">
            <span className="font-bold">Correcta: </span>
            <span className="font-black">{mistake.correctAnswer}</span>
          </span>
        </p>
      </div>
    </article>
  );
}
