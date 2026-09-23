/** Vibración corta (móviles compatibles). Nunca lanza. */

export type HapticPattern = 'success' | 'error';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  success: 18,
  error: [35, 45, 35],
};

export function vibrate(pattern: HapticPattern): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Sin soporte o bloqueado por el navegador.
  }
}
