import type { MasteryTier } from '@/types';

/**
 * Textura de la barra de dominio por nivel, para no depender solo del color (daltonismo):
 * "Necesita práctica" se dibuja rayada; el resto, lisa (su longitud ya indica el porcentaje).
 * Se combina con `TIER_META[tier].barClass` (color de fondo); la misma en las casillas y en la leyenda.
 */
export const TIER_TEXTURE: Record<MasteryTier, string> = {
  practice: 'bg-[repeating-linear-gradient(-45deg,transparent_0_2px,var(--color-surface)_2px_3.5px)]',
  learning: '',
  almost: '',
  mastered: '',
};
