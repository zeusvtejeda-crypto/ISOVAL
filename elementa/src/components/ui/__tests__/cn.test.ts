import { describe, expect, it } from 'vitest';
import { cn } from '../cn';

describe('cn', () => {
  it('une clases condicionales', () => {
    expect(cn('a', false, null, undefined, 0, 'b')).toBe('a b');
    expect(cn()).toBe('');
  });

  it('la última clase en conflicto gana (className sobrescribe)', () => {
    expect(cn('inline-flex shrink-0 items-center', 'hidden min-[400px]:inline-flex')).toBe(
      'shrink-0 items-center hidden min-[400px]:inline-flex',
    );
    expect(cn('mb-5 px-4', 'mb-0')).toBe('px-4 mb-0');
    expect(cn('size-9', 'size-11')).toBe('size-11');
  });

  it('conoce los tokens y utilidades propios de globals.css', () => {
    const cases: Array<[string[], string]> = [
      [['shadow-card', 'shadow-brand/20'], 'shadow-card shadow-brand/20'],
      [['shadow-card', 'shadow-float'], 'shadow-float'],
      [['bg-brand-gradient', 'bg-surface'], 'bg-brand-gradient bg-surface'],
      [['bg-surface', 'bg-brand-soft'], 'bg-brand-soft'],
      [['bg-cat-halogen-soft', 'bg-tier-mastered'], 'bg-tier-mastered'],
      [['text-on-brand', 'text-fg'], 'text-fg'],
      [['text-on-brand', 'text-sm'], 'text-on-brand text-sm'],
      [['text-brand-gradient', 'text-fg'], 'text-brand-gradient text-fg'],
      [['border-2', 'border-border'], 'border-2 border-border'],
      [['border-border', 'border-border-strong'], 'border-border-strong'],
      [['pt-safe', 'pt-4'], 'pt-4'],
      [['pl-2', 'px-safe'], 'px-safe'],
      [['top-safe', 'top-0'], 'top-0'],
      [['tabular', 'proportional-nums'], 'proportional-nums'],
      [['animate-slide-up', 'animate-bounce-in'], 'animate-bounce-in'],
      [['pressable no-scrollbar scroll-contained shimmer'], 'pressable no-scrollbar scroll-contained shimmer'],
    ];
    for (const [input, expected] of cases) expect(cn(...input), input.join(' | ')).toBe(expected);
  });

  it('text-* no elimina leading-* (en Tailwind v4 el interlineado explícito siempre gana)', () => {
    expect(cn('leading-none', 'text-xs')).toBe('leading-none text-xs');
  });
});
