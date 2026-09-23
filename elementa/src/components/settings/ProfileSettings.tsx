'use client';

import { useId, useState, type FormEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { experienceOption } from '@/components/onboarding/experience';
import { Button, ButtonLink } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { StatusMessage, type Status } from './StatusMessage';
import { NAME_MAX_LENGTH, TEXT_INPUT, cleanName } from './styles';

/** Nombre del perfil, punto de partida y acceso a repetir el diagnóstico. */
export function ProfileSettings() {
  const { state, updateProfile } = useProgress();
  const inputId = useId();
  const saved = state.profile.name;
  const [draft, setDraft] = useState(saved);
  const [prevSaved, setPrevSaved] = useState(saved);
  const [status, setStatus] = useState<Status | null>(null);

  // Si el nombre cambia desde fuera (importar progreso, otra pestaña), el campo lo refleja.
  if (saved !== prevSaved) {
    setPrevSaved(saved);
    setDraft(saved);
  }

  const next = cleanName(draft);
  const dirty = next !== saved;
  const experience = experienceOption(state.profile.experience);

  const save = () => {
    if (!dirty) return;
    updateProfile({ name: next });
    setStatus({ tone: 'success', text: next ? `¡Listo, ${next}! Guardamos tu nombre.` : 'Quitamos tu nombre.' });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    save();
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor={inputId} className="font-extrabold">
          Tu nombre
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id={inputId}
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setStatus(null);
            }}
            onBlur={save}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="given-name"
            enterKeyHint="done"
            placeholder="¿Cómo te llamamos?"
            className={TEXT_INPUT}
          />
          <Button type="submit" variant="secondary" disabled={!dirty} className="shrink-0">
            Guardar
          </Button>
        </div>
        <StatusMessage status={status} />
      </form>

      <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3.5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">Tu punto de partida</p>
          <p className="mt-0.5 text-sm font-semibold text-muted">
            {experience ? (
              <>
                <span aria-hidden>{experience.emoji} </span>
                {experience.title}
              </>
            ) : (
              'Aún no hiciste el diagnóstico.'
            )}
          </p>
        </div>
        <ButtonLink href="/bienvenida?repetir=1" variant="secondary" size="sm" leftIcon={<RotateCcw aria-hidden />}>
          Repetir diagnóstico
        </ButtonLink>
      </div>
    </div>
  );
}
