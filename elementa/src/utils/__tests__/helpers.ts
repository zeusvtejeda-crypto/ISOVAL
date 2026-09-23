import type { ElementProgress } from '@/types';
import { createElementProgress } from '@/utils/srs';

/** Fecha fija (hora local) para pruebas deterministas. */
export const NOW = new Date(2026, 0, 15, 12, 0, 0);

export function daysFrom(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

export function progress(z: number, patch: Partial<ElementProgress> = {}): ElementProgress {
  return { ...createElementProgress(z), ...patch };
}
