'use client';

import type { ReactNode } from 'react';
import { cn } from '@/components/ui';
import type { DailyGoal } from '@/types';
import { GOAL_OPTIONS, goalMinutes, goalOption } from './goal-options';

export interface GoalPickerProps {
  value: DailyGoal;
  onChange: (goal: DailyGoal) => void;
  /** Título del grupo (leyenda). */
  legend: ReactNode;
  /** Oculta la leyenda visualmente (sigue disponible para lectores de pantalla). */
  hideLegend?: boolean;
  /** `name` de los radios (único por formulario). */
  name?: string;
  className?: string;
}

/** Selector de la meta diaria (5/10/20/50 preguntas) con tarjetas-radio accesibles. */
export function GoalPicker({ value, onChange, legend, hideLegend = false, name = 'daily-goal', className }: GoalPickerProps) {
  const current = goalOption(value);

  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className={cn('mb-2 font-extrabold', hideLegend && 'sr-only')}>{legend}</legend>
      <div className="grid grid-cols-4 gap-2">
        {GOAL_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-2 text-center select-none',
                'transition-[border-color,background-color,transform] duration-150 active:scale-[0.96]',
                'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand/75',
                selected ? 'border-brand bg-brand-soft' : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span aria-hidden key={selected ? 'on' : 'off'} className={cn('text-lg leading-none', selected && 'animate-pop')}>
                {option.emoji}
              </span>
              <span className={cn('text-2xl leading-none font-black tabular', selected && 'text-brand')}>{option.value}</span>
              <span className="sr-only"> preguntas al día, meta</span>
              <span className="text-xs font-extrabold text-muted">{option.label}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-sm font-semibold text-muted">
        {current.value} preguntas al día · unos {goalMinutes(current.value)} min
      </p>
    </fieldset>
  );
}
