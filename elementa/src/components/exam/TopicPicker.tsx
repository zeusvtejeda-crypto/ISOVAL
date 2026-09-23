'use client';

import { Check } from 'lucide-react';
import { cn } from '@/components/ui';
import type { ExamTopic } from '@/types';
import { EXAM_TOPICS } from './topics';

export interface TopicPickerProps {
  selected: readonly ExamTopic[];
  onChange: (topics: ExamTopic[]) => void;
  /** Id del mensaje de error (para `aria-describedby`). */
  errorId?: string;
  invalid?: boolean;
}

/** Casillas de verificación de los temas del examen (tarjetas táctiles). */
export function TopicPicker({ selected, onChange, errorId, invalid = false }: TopicPickerProps) {
  const set = new Set(selected);

  const toggle = (topic: ExamTopic, checked: boolean) => {
    // Conserva el orden de EXAM_TOPICS.
    onChange(EXAM_TOPICS.map((t) => t.id).filter((id) => (id === topic ? checked : set.has(id))));
  };

  return (
    <fieldset aria-describedby={invalid ? errorId : undefined}>
      <legend className="sr-only">Temas del examen</legend>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {EXAM_TOPICS.map((topic) => {
          const checked = set.has(topic.id);
          return (
            <li key={topic.id} className="flex">
              <label className="relative flex w-full cursor-pointer">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  onChange={(e) => toggle(topic.id, e.target.checked)}
                />
                <span
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 select-none sm:min-h-16',
                    'transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]',
                    'peer-focus-visible:ring-4 peer-focus-visible:ring-brand/40',
                    checked
                      ? 'border-brand bg-brand-soft'
                      : cn('bg-surface hover:border-border-strong hover:bg-surface-2', invalid ? 'border-danger/50' : 'border-border'),
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-xl text-xl leading-none',
                      checked ? 'bg-surface' : 'bg-surface-2',
                    )}
                  >
                    {topic.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block leading-tight font-black hyphens-auto', checked && 'text-brand')}>{topic.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-bold text-muted">{topic.example}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-lg border-2 [&_svg]:size-4',
                      checked ? 'border-brand bg-brand text-on-brand' : 'border-border-strong bg-surface',
                    )}
                  >
                    {checked && <Check strokeWidth={3.5} className="animate-pop" />}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
