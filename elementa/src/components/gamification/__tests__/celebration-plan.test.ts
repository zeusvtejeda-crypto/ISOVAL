import { describe, expect, it } from 'vitest';
import { goalMetBody, planCelebration } from '../celebration-plan';

describe('planCelebration', () => {
  it('meta diaria + logro «Meta cumplida» del mismo cambio → un solo aviso', () => {
    const plan = planCelebration(
      [
        { type: 'xp', amount: 10 },
        { type: 'goalMet' },
        { type: 'achievement', id: 'first-goal' },
        { type: 'achievement', id: 'first-element' },
      ],
      { immersive: false, streak: 1 },
    );
    expect(plan.xp).toBe(10);
    expect(plan.toasts.map((t) => t.title)).toEqual(['¡Meta diaria cumplida!', 'Primer elemento']);
    expect(plan.toasts[0]).toMatchObject({ eyebrow: 'Meta diaria · Nuevo logro', href: '/logros' });
    expect(plan.sound).toBe(true);
    expect(plan.confetti).toBe(80);
  });

  it('el logro «Meta cumplida» sin meta en el mismo cambio sí tiene su aviso', () => {
    const plan = planCelebration([{ type: 'achievement', id: 'first-goal' }], { immersive: false, streak: 3 });
    expect(plan.toasts.map((t) => t.title)).toEqual(['Meta cumplida']);
  });

  it('el primer día no dice que la racha "sigue viva"', () => {
    expect(goalMetBody(1)).toBe('¡Primer día de racha! 🔥');
    expect(goalMetBody(0)).toBe('¡Primer día de racha! 🔥');
    expect(goalMetBody(6)).toContain('6 días');
    const plan = planCelebration([{ type: 'goalMet' }], { immersive: false, streak: 1 });
    expect(plan.toasts[0].body).toBe('¡Primer día de racha! 🔥');
  });

  it('subida de nivel: modal fuera del modo inmersivo, aviso dentro', () => {
    const events = [{ type: 'levelUp', level: 3 } as const, { type: 'levelUp', level: 4 } as const];
    const normal = planCelebration(events, { immersive: false, streak: 0 });
    expect(normal.levelModal).toBe(4);
    expect(normal.toasts).toEqual([]);
    expect(normal.confetti).toBe(170);
    const immersive = planCelebration(events, { immersive: true, streak: 0 });
    expect(immersive.levelModal).toBeNull();
    expect(immersive.toasts.map((t) => t.title)).toEqual(['¡Nivel 3!', '¡Nivel 4!']);
  });

  it('solo XP: sin avisos ni sonido', () => {
    const plan = planCelebration([{ type: 'xp', amount: 10 }, { type: 'xp', amount: 5 }], { immersive: true, streak: 2 });
    expect(plan).toEqual({ xp: 15, toasts: [], confetti: 0, levelModal: null, sound: false });
  });
});
