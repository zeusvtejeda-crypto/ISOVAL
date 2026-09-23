/**
 * Efectos de sonido sintetizados con WebAudio (sin archivos). Nunca lanzan: si el navegador no
 * tiene AudioContext o está bloqueado, simplemente no suenan.
 */

export type SoundName = 'correct' | 'wrong' | 'levelUp' | 'tick';

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!context) {
      const w = window as Window & { webkitAudioContext?: AudioContextCtor };
      const Ctor: AudioContextCtor | undefined = window.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    return context;
  } catch {
    return null;
  }
}

interface ToneOptions {
  /** Hz al inicio. */
  freq: number;
  /** Hz al final (glissando opcional). */
  endFreq?: number;
  /** Segundos desde ahora. */
  start: number;
  /** Segundos. */
  duration: number;
  type?: OscillatorType;
  /** Volumen máximo (0–1). */
  gain?: number;
}

function tone(ctx: AudioContext, { freq, endFreq, start, duration, type = 'sine', gain = 0.15 }: ToneOptions): void {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const PATTERNS: Record<SoundName, ToneOptions[]> = {
  // Dos tonos ascendentes (Mi5 → La5).
  correct: [
    { freq: 659.25, start: 0, duration: 0.12, type: 'triangle', gain: 0.18 },
    { freq: 880, start: 0.1, duration: 0.2, type: 'triangle', gain: 0.18 },
  ],
  // Zumbido grave y suave.
  wrong: [{ freq: 180, endFreq: 120, start: 0, duration: 0.28, type: 'sawtooth', gain: 0.06 }],
  // Arpegio Do–Mi–Sol–Do.
  levelUp: [
    { freq: 523.25, start: 0, duration: 0.14, type: 'triangle', gain: 0.16 },
    { freq: 659.25, start: 0.11, duration: 0.14, type: 'triangle', gain: 0.16 },
    { freq: 783.99, start: 0.22, duration: 0.14, type: 'triangle', gain: 0.16 },
    { freq: 1046.5, start: 0.33, duration: 0.35, type: 'triangle', gain: 0.18 },
  ],
  // Clic corto para cuentas atrás.
  tick: [{ freq: 1200, start: 0, duration: 0.04, type: 'square', gain: 0.04 }],
};

export function playSound(name: SoundName): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    for (const t of PATTERNS[name]) tone(ctx, t);
  } catch {
    // Silencio si el navegador rechaza la reproducción.
  }
}
