'use client';

import { playSound, type SoundName } from '@/services/sound';
import { progressStore } from '@/store/progress-store';

export interface SoundControls {
  /** Dos tonos ascendentes. */
  correct(): void;
  /** Zumbido grave y suave. */
  wrong(): void;
  /** Arpegio de celebración. */
  levelUp(): void;
  /** Clic corto (cuenta atrás). */
  tick(): void;
}

function play(name: SoundName): void {
  if (progressStore.getState().settings.sound) playSound(name);
}

const controls: SoundControls = {
  correct: () => play('correct'),
  wrong: () => play('wrong'),
  levelUp: () => play('levelUp'),
  tick: () => play('tick'),
};

/** Efectos de sonido (WebAudio). Respetan `settings.sound` y nunca lanzan. Referencia estable. */
export function useSound(): SoundControls {
  return controls;
}
