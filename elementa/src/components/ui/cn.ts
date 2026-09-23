import { extendTailwindMerge } from 'tailwind-merge';

export type ClassValue = string | number | false | null | undefined;

/** Colores propios de `globals.css` (`@theme`). tailwind-merge ya acepta cualquier nombre de color; se listan para documentarlos. */
const COLORS = [
  'bg',
  'surface',
  'surface-2',
  'border',
  'border-strong',
  'fg',
  'muted',
  'overlay',
  (value: string) => /^(brand|accent|success|danger|warning|xp|streak|cat|tier|on)(-|$)/.test(value),
];

/**
 * `twMerge` con los tokens y utilidades de Elementa, para que no se mezclen mal:
 * - sombras `shadow-card|float|glow` (sin esto serían "colores de sombra" y chocarían con `shadow-brand/20`),
 *   animaciones `animate-*` y curvas `ease-spring|snappy` propias;
 * - `bg-brand-gradient` es una imagen de fondo (convive con `bg-surface`); `text-brand-gradient`, su propio grupo;
 * - `pt/pb/pl/pr/px-safe`, `top-safe`, `bottom-safe` son rellenos/posiciones (`pt-safe pt-4` → `pt-4`);
 * - `tabular` equivale a `tabular-nums`; `pressable`, `no-scrollbar`, `scroll-contained`… son grupos propios.
 * En Tailwind v4 `text-sm` no pisa a `leading-*` (usa `var(--tw-leading)`), así que no se consideran en conflicto.
 */
/** Grupos nuevos (utilidades `@utility` de globals.css sin equivalente en Tailwind). */
type CustomClassGroup =
  | 'text-gradient'
  | 'pressable'
  | 'no-scrollbar'
  | 'scroll-contained'
  | 'shimmer'
  | 'perspective-card'
  | 'preserve-3d'
  | 'face-hidden'
  | 'flip-y';

const merge = extendTailwindMerge<CustomClassGroup>({
  extend: {
    theme: {
      color: COLORS,
      shadow: ['card', 'float', 'glow'],
      animate: [
        'pop',
        'shake',
        'fade-in',
        'fade-out',
        'slide-up',
        'slide-down',
        'sheet-up',
        'sheet-down',
        'zoom-in',
        'zoom-out',
        'bounce-in',
        'pulse-ring',
        'float',
        'float-up',
        'wiggle',
        'shimmer',
        'confetti-fall',
      ],
      ease: ['spring', 'snappy'],
    },
    classGroups: {
      'bg-image': ['bg-brand-gradient'],
      'fvn-spacing': ['tabular'],
      pt: [{ pt: ['safe'] }],
      pb: [{ pb: ['safe'] }],
      pl: [{ pl: ['safe'] }],
      pr: [{ pr: ['safe'] }],
      px: [{ px: ['safe'] }],
      top: [{ top: ['safe'] }],
      bottom: [{ bottom: ['safe'] }],
      'text-gradient': ['text-brand-gradient'],
      pressable: ['pressable'],
      'no-scrollbar': ['no-scrollbar'],
      'scroll-contained': ['scroll-contained'],
      shimmer: ['shimmer'],
      'perspective-card': ['perspective-card'],
      'preserve-3d': ['preserve-3d'],
      'face-hidden': ['face-hidden'],
      'flip-y': ['flip-y'],
    },
  },
  override: {
    conflictingClassGroups: {
      'font-size': [],
    },
  },
});

/**
 * Une clases condicionales y resuelve los conflictos de Tailwind: la última gana.
 * `cn('px-4 mb-5', cond && 'mb-0', undefined)` → "px-4 mb-0". Así `className` sí sobrescribe
 * las clases base de un componente (`<Badge className="hidden sm:inline-flex">`).
 */
export function cn(...classes: ClassValue[]): string {
  let out = '';
  for (const c of classes) {
    if (!c) continue;
    out = out ? `${out} ${c}` : String(c);
  }
  return merge(out);
}
