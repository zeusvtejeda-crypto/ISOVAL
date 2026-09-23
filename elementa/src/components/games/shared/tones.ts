/** Tono de color de cada modo (tarjeta de presentación y resultados). */
export type GameTone = 'xp' | 'streak' | 'danger' | 'accent';

export interface GameToneClasses {
  /** Tarjeta principal: borde + fondo suave. */
  hero: string;
  /** Manchas de luz decorativas. */
  glowA: string;
  glowB: string;
  /** Fondo del icono de cada regla. */
  icon: string;
}

export const GAME_TONES: Record<GameTone, GameToneClasses> = {
  xp: { hero: 'border-xp/25 bg-xp-soft', glowA: 'bg-xp-glow', glowB: 'bg-brand', icon: 'bg-xp-soft' },
  streak: { hero: 'border-streak/25 bg-streak-soft', glowA: 'bg-streak-glow', glowB: 'bg-xp-glow', icon: 'bg-streak-soft' },
  danger: { hero: 'border-danger/25 bg-danger-soft', glowA: 'bg-danger', glowB: 'bg-cat-lanthanide', icon: 'bg-danger-soft' },
  accent: { hero: 'border-accent/30 bg-accent-soft', glowA: 'bg-accent', glowB: 'bg-brand', icon: 'bg-accent-soft' },
};
