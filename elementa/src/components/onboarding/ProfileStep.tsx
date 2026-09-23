'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { GoalPicker } from '@/components/settings/GoalPicker';
import { NAME_MAX_LENGTH, TEXT_INPUT } from '@/components/settings/styles';
import { Button, cn } from '@/components/ui';
import type { DailyGoal, ExperienceLevel } from '@/types';
import { DIAGNOSTIC_LENGTH } from './diagnostic';
import { EXPERIENCE_OPTIONS } from './experience';
import { STEP_TITLE_ID, StepHeader } from './StepHeader';

export interface ProfileAnswers {
  experience: ExperienceLevel | null;
  name: string;
  goal: DailyGoal;
}

export interface ProfileStepProps {
  initial: ProfileAnswers;
  onBack: () => void;
  /** Continuar al diagnóstico (con una experiencia elegida). */
  onStart: (answers: ProfileAnswers & { experience: ExperienceLevel }) => void;
  onSkip: (answers: ProfileAnswers) => void;
}

/** Paso 2: nivel de experiencia (4 tarjetas), nombre opcional y meta diaria. */
export function ProfileStep({ initial, onBack, onStart, onSkip }: ProfileStepProps) {
  const [experience, setExperience] = useState<ExperienceLevel | null>(initial.experience);
  const [name, setName] = useState(initial.name);
  const [goal, setGoal] = useState<DailyGoal>(initial.goal);
  const [attempts, setAttempts] = useState(0);
  const optionsRef = useRef<HTMLDivElement>(null);
  const nameId = useId();
  const errorId = useId();
  const showError = attempts > 0 && experience === null;

  // Al intentar continuar sin elegir: lleva el foco a las opciones.
  useEffect(() => {
    if (attempts > 0) optionsRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
  }, [attempts]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (experience === null) {
      setAttempts((n) => n + 1);
      return;
    }
    onStart({ experience, name, goal });
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-xl flex-col gap-7 pb-4">
      <StepHeader step={2} onBack={onBack} />

      <fieldset aria-describedby={showError ? errorId : undefined} className="min-w-0">
        <legend className="w-full">
          <h1 id={STEP_TITLE_ID} tabIndex={-1} className="text-[1.7rem] leading-tight font-black outline-none sm:text-3xl">
            ¿Qué tanto conoces la tabla periódica?
          </h1>
          <span className="mt-1 block font-semibold text-muted">Así adaptamos el diagnóstico a ti.</span>
        </legend>

        <div
          key={attempts}
          ref={optionsRef}
          className={cn('mt-4 grid gap-3 sm:grid-cols-2', showError && 'animate-shake')}
        >
          {EXPERIENCE_OPTIONS.map((option) => {
            const selected = experience === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  'relative flex min-h-20 cursor-pointer items-center gap-3.5 rounded-3xl border-2 p-4 text-left select-none',
                  'transition-[border-color,background-color,box-shadow,transform] duration-150 active:scale-[0.98]',
                  'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand/75',
                  selected
                    ? 'border-brand bg-brand-soft shadow-glow'
                    : showError
                      ? 'border-danger/60 bg-surface shadow-card'
                      : 'border-border bg-surface shadow-card hover:border-border-strong',
                )}
              >
                <input
                  type="radio"
                  name="experience"
                  value={option.value}
                  checked={selected}
                  onChange={() => setExperience(option.value)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  key={selected ? 'on' : 'off'}
                  className={cn(
                    'grid size-12 shrink-0 place-items-center rounded-2xl text-3xl leading-none',
                    selected ? 'bg-surface animate-pop' : 'bg-surface-2',
                  )}
                >
                  {option.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-tight font-black">{option.title}</span>
                  <span className="mt-0.5 block text-sm font-semibold text-muted">{option.hint}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors',
                    selected ? 'border-brand bg-brand text-on-brand' : 'border-border-strong',
                  )}
                >
                  {selected && <Check className="size-3.5" strokeWidth={3.5} />}
                </span>
              </label>
            );
          })}
        </div>
        {showError && (
          <p id={errorId} role="alert" className="mt-3 text-sm font-extrabold text-danger">
            Elige la opción que más se parezca a ti para continuar.
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor={nameId} className="font-extrabold">
          ¿Cómo te llamamos? <span className="font-semibold text-muted">(opcional)</span>
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="given-name"
          enterKeyHint="next"
          placeholder="Tu nombre"
          className={cn(TEXT_INPUT, 'mt-2')}
        />
      </div>

      <GoalPicker
        name="onboarding-goal"
        legend={
          <>
            Tu meta diaria <span className="font-semibold text-muted">(puedes cambiarla luego)</span>
          </>
        }
        value={goal}
        onChange={setGoal}
      />

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" block rightIcon={<ArrowRight aria-hidden />}>
          Empezar diagnóstico
        </Button>
        <p className="text-center text-sm font-semibold text-muted">
          {DIAGNOSTIC_LENGTH} preguntas rápidas para saber desde dónde empiezas.
        </p>
        <Button type="button" variant="ghost" block onClick={() => onSkip({ experience, name, goal })}>
          Saltar diagnóstico
        </Button>
      </div>
    </form>
  );
}
