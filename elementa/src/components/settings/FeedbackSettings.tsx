'use client';

import { Switch } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useProgress } from '@/hooks/useProgress';
import { useSound } from '@/hooks/useSound';

/** Interruptores de sonido y vibración. Al activarlos se reproduce una muestra. */
export function FeedbackSettings() {
  const { state, updateSettings } = useProgress();
  const sound = useSound();
  const haptics = useHaptics();

  return (
    <div className="-my-1 divide-y divide-border">
      <Switch
        checked={state.settings.sound}
        onChange={(on) => {
          updateSettings({ sound: on });
          if (on) sound.correct();
        }}
        label={
          <>
            <span aria-hidden className="mr-1.5">
              🔊
            </span>
            Sonidos
          </>
        }
        description="Efectos al acertar, fallar y subir de nivel."
      />
      <Switch
        checked={state.settings.haptics}
        onChange={(on) => {
          updateSettings({ haptics: on });
          if (on) haptics.success();
        }}
        label={
          <>
            <span aria-hidden className="mr-1.5">
              📳
            </span>
            Vibración
          </>
        }
        description="Un toque suave al responder (en móviles compatibles)."
      />
    </div>
  );
}
