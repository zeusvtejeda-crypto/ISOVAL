import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';
import type { ProgressEvent } from '@/store/progress-store';
import { levelEmoji, levelTitle } from '@/utils/levels';

export type CelebrationKind = 'achievement' | 'goal' | 'level';

export interface CelebrationToastData {
  kind: CelebrationKind;
  emoji: string;
  title: string;
  body?: string;
  href?: string;
  /** Sustituye la etiqueta pequeña del tipo ("Logro desbloqueado", "Meta diaria"…). */
  eyebrow?: string;
}

export interface CelebrationPlan {
  /** XP ganada en el lote (para el "+N XP" flotante). */
  xp: number;
  toasts: CelebrationToastData[];
  /** Piezas de confeti (0 = sin confeti). */
  confetti: number;
  /** Nivel para el modal de subida de nivel (fuera del modo inmersivo), o `null`. */
  levelModal: number | null;
  /** Sonar la fanfarria. */
  sound: boolean;
}

export interface CelebrationContext {
  /** Pantalla de enfoque: la subida de nivel es un aviso en lugar de un modal. */
  immersive: boolean;
  /** Racha de días actual (tras el evento). */
  streak: number;
}

const FIRST_GOAL_ID = 'first-goal';

/** Texto del aviso de meta diaria: el primer día no hay racha que "siga viva". */
export function goalMetBody(streak: number): string {
  return streak <= 1 ? '¡Primer día de racha! 🔥' : `Tu racha sigue viva: ${streak} días 🔥`;
}

/**
 * Convierte los eventos de un mismo cambio del progreso (llegan juntos, en el mismo tick) en lo que
 * hay que celebrar. La meta diaria y el logro «Meta cumplida» del mismo cambio son UN solo aviso.
 */
export function planCelebration(events: readonly ProgressEvent[], ctx: CelebrationContext): CelebrationPlan {
  const plan: CelebrationPlan = { xp: 0, toasts: [], confetti: 0, levelModal: null, sound: false };
  const goalMet = events.some((e) => e.type === 'goalMet');
  const achievementIds = events.flatMap((e) => (e.type === 'achievement' ? [e.id] : []));
  const firstGoalToo = goalMet && achievementIds.includes(FIRST_GOAL_ID);

  for (const event of events) {
    switch (event.type) {
      case 'xp':
        if (event.amount > 0) plan.xp += event.amount;
        break;
      case 'goalMet':
        plan.sound = true;
        plan.confetti = Math.max(plan.confetti, 80);
        plan.toasts.push({
          kind: 'goal',
          emoji: '🎯',
          title: '¡Meta diaria cumplida!',
          body: goalMetBody(ctx.streak),
          ...(firstGoalToo ? { eyebrow: 'Meta diaria · Nuevo logro', href: '/logros' } : {}),
        });
        break;
      case 'achievement': {
        if (firstGoalToo && event.id === FIRST_GOAL_ID) break;
        const def = ACHIEVEMENTS_BY_ID[event.id];
        plan.sound = true;
        plan.toasts.push({
          kind: 'achievement',
          emoji: def?.emoji ?? '🏅',
          title: def?.title ?? '¡Nuevo logro!',
          body: def?.description,
          href: '/logros',
        });
        break;
      }
      case 'levelUp':
        plan.sound = true;
        plan.confetti = Math.max(plan.confetti, 170);
        if (ctx.immersive) {
          plan.toasts.push({
            kind: 'level',
            emoji: levelEmoji(event.level),
            title: `¡Nivel ${event.level}!`,
            body: `Ahora eres ${levelTitle(event.level)}.`,
          });
        } else {
          plan.levelModal = Math.max(plan.levelModal ?? 0, event.level);
        }
        break;
    }
  }
  return plan;
}
