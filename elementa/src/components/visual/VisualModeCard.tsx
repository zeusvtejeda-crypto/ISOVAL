import { Play } from 'lucide-react';
import { Badge, TONE_SOFT, cn } from '@/components/ui';
import { formatPercent, pluralize } from '@/utils/format';
import type { VisualMode } from './modes';

export interface VisualModeCardProps {
  mode: VisualMode;
  onStart: (mode: VisualMode) => void;
  /** Tu precisión (0–1) en la habilidad que entrena, o `null` si aún no hay datos. */
  accuracy?: number | null;
  /** Tarjeta destacada (ocupa todo el ancho). */
  featured?: boolean;
}

const CARD =
  'group relative flex w-full items-center gap-3 rounded-3xl border-2 border-border bg-surface p-4 text-left shadow-card ' +
  'transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-float ' +
  'active:translate-y-0 active:scale-[0.98] motion-reduce:hover:translate-y-0 sm:gap-4 sm:p-5';

/** Tarjeta de un reto visual: emoji, título, descripción, ejemplo y botón de jugar. */
export function VisualModeCard({ mode, onStart, accuracy = null, featured = false }: VisualModeCardProps) {
  return (
    <button type="button" onClick={() => onStart(mode)} className={cn(CARD, featured && 'sm:p-6')}>
      <span
        aria-hidden
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-2xl text-2xl leading-none min-[380px]:size-14 min-[380px]:text-3xl',
          'transition-transform duration-200 ease-spring group-hover:scale-110 group-hover:-rotate-6',
          featured && 'sm:size-16 sm:text-4xl',
          TONE_SOFT[mode.tone],
        )}
      >
        {mode.emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg leading-tight font-black">{mode.title}</span>
        <span className="mt-0.5 text-sm leading-snug font-semibold text-muted">{mode.description}</span>
        <span className="mt-1.5 text-xs font-bold text-fg/75 italic">«{mode.example}»</span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone={mode.tone}>
            {mode.count} {pluralize(mode.count, 'pregunta', 'preguntas')}
          </Badge>
          <Badge tone="neutral">{mode.answerHint}</Badge>
          {accuracy !== null && (
            <Badge tone="neutral" icon={<span aria-hidden>🎯</span>}>
              {formatPercent(accuracy)} de aciertos
            </Badge>
          )}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand shadow-card [&_svg]:size-4 min-[380px]:size-11 min-[380px]:[&_svg]:size-5',
          'transition-transform duration-200 ease-spring group-hover:scale-110',
        )}
      >
        <Play fill="currentColor" />
      </span>
    </button>
  );
}
