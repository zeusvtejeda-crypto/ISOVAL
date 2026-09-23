/** Tonos semánticos compartidos por las primitivas (Badge, ProgressBar, ProgressRing, StatTile…). */
export type Tone = 'brand' | 'success' | 'danger' | 'warning' | 'xp' | 'streak' | 'accent' | 'neutral';

/** Texto con el color del tono (AA sobre bg/surface en ambos temas). */
export const TONE_TEXT: Record<Tone, string> = {
  brand: 'text-brand',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  xp: 'text-xp',
  streak: 'text-streak',
  accent: 'text-accent',
  neutral: 'text-muted',
};

/** Fondo suave + texto del tono (pastillas, iconos). */
export const TONE_SOFT: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  xp: 'bg-xp-soft text-xp',
  streak: 'bg-streak-soft text-streak',
  accent: 'bg-accent-soft text-fg',
  neutral: 'bg-surface-2 text-muted',
};

/** Fondo sólido + texto legible encima. */
export const TONE_SOLID: Record<Tone, string> = {
  brand: 'bg-brand text-on-brand',
  success: 'bg-success text-on-success',
  danger: 'bg-danger text-on-danger',
  warning: 'bg-warning text-on-warning',
  xp: 'bg-xp text-bg',
  streak: 'bg-streak text-bg',
  accent: 'bg-accent text-[#04121a]',
  neutral: 'bg-fg text-bg',
};

/**
 * Trazo de anillos y gráficos (elementos no textuales, ≥ 3:1): usa las variantes luminosas de XP y racha.
 * Se aplica como `text-*` porque los anillos pintan con `currentColor`.
 */
export const TONE_STROKE: Record<Tone, string> = {
  brand: 'text-brand',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  xp: 'text-xp-glow',
  streak: 'text-streak-glow',
  accent: 'text-accent',
  neutral: 'text-muted',
};

/** Relleno de barras de progreso. */
export const TONE_FILL: Record<Tone, string> = {
  brand: 'bg-brand-gradient',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  xp: 'bg-linear-to-r from-streak-glow to-xp-glow',
  streak: 'bg-linear-to-r from-streak to-streak-glow',
  accent: 'bg-accent',
  neutral: 'bg-muted',
};
