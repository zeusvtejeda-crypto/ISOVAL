'use client';

import { vibrate, type HapticPattern } from '@/services/haptics';
import { progressStore } from '@/store/progress-store';

export interface HapticControls {
  success(): void;
  error(): void;
}

function buzz(pattern: HapticPattern): void {
  if (progressStore.getState().settings.haptics) vibrate(pattern);
}

const controls: HapticControls = {
  success: () => buzz('success'),
  error: () => buzz('error'),
};

/** Vibración en móviles compatibles. Respeta `settings.haptics`. Referencia estable. */
export function useHaptics(): HapticControls {
  return controls;
}
