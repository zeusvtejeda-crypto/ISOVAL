'use client';

import { Check } from 'lucide-react';
import { cn } from '@/components/ui';
import { FLASHCARD_MODES, type FlashcardModeId } from './modes';

export interface ModePickerProps {
  value: FlashcardModeId;
  onChange: (id: FlashcardModeId) => void;
  /** Id del título de la sección (nombre accesible del grupo). */
  labelledBy: string;
}

/** Los 7 modos (anverso → reverso) con un ejemplo: "O → Oxígeno". */
export function ModePicker({ value, onChange, labelledBy }: ModePickerProps) {
  const selected = FLASHCARD_MODES.find((m) => m.id === value);
  return (
    <div role="group" aria-labelledby={labelledBy}>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {FLASHCARD_MODES.map((mode) => {
          const active = mode.id === value;
          return (
            <li key={mode.id} className="flex">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChange(mode.id)}
                className={cn(
                  'relative flex min-h-24 w-full flex-col items-start gap-1.5 rounded-3xl border-2 p-3 text-left sm:p-4',
                  'transition-[background-color,border-color,transform,box-shadow] duration-150 active:scale-[0.98]',
                  active
                    ? 'border-brand bg-brand-soft shadow-glow'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2',
                )}
              >
                <span aria-hidden className="text-2xl leading-none">
                  {mode.emoji}
                </span>
                <span className={cn('text-sm leading-tight font-black sm:text-base', active && 'text-brand')}>
                  {mode.title}
                </span>
                <span
                  aria-hidden
                  className="mt-auto inline-flex max-w-full items-center gap-1 truncate rounded-full bg-surface-2 px-2 py-0.5 text-xs font-extrabold text-muted"
                >
                  <span className="truncate">{mode.example[0]}</span>
                  <span>→</span>
                  <span className="truncate text-fg">{mode.example[1]}</span>
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full bg-brand text-on-brand animate-pop [&_svg]:size-4"
                  >
                    <Check strokeWidth={3} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {selected?.note && (
        <p className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold text-muted animate-fade-in">
          <span aria-hidden>ℹ️</span>
          {selected.note}
        </p>
      )}
    </div>
  );
}
