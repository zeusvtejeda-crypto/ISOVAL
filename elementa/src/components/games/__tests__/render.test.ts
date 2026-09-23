import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FeedbackPanel } from '@/components/quiz';
import type { QuizSession } from '@/hooks/useQuizSession';
import type { AnsweredQuestion, Question, SessionSummaryData } from '@/types';
import { generateQuestion } from '@/utils/questions';
import { TimerHud } from '../contrarreloj/TimerHud';
import { BadgeRow } from '../preguntados/BadgeRow';
import { RouletteWheel } from '../preguntados/RouletteWheel';
import { StreakHud, StreakHudCompact } from '../racha/StreakHud';
import { streakAward } from '../racha/streak-rules';
import { GameResults } from '../shared/GameResults';
import { SurvivalHud, SurvivalHudCompact } from '../supervivencia/SurvivalHud';
import { TimerHudCompact } from '../contrarreloj/TimerHud';

const question = generateQuestion('symbol-to-name', 11) as Question;

/** Texto visible, sin etiquetas ni espacios repetidos. */
function text(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

/** Panel de feedback de un acierto en Modo Racha, con la XP como la calcula `RachaGame`. */
function rachaPanel(streak: number, difficulty: 1 | 2 | 3): string {
  const award = streakAward(streak, difficulty);
  return text(
    renderToStaticMarkup(
      h(FeedbackPanel, {
        correct: true,
        xpGained: award.xp,
        bonusXp: award.bonus,
        multiplier: award.multiplier,
        correctAnswer: 'Sodio',
        explanation: 'El símbolo Na proviene del latín Natrium.',
        onContinue: () => {},
      }),
    ),
  );
}

function answer(correct: boolean): AnsweredQuestion {
  return { question, correct, givenAnswer: 'x', responseMs: 1200, xpGained: correct ? 10 : 0 };
}

function session(patch: Partial<QuizSession>): QuizSession {
  const noop = () => {};
  return {
    ready: true,
    status: 'playing',
    mode: 'streak',
    title: 'Prueba',
    current: question,
    index: 0,
    total: null,
    lives: null,
    maxLives: null,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    answered: [],
    remainingMs: null,
    timeLimitMs: null,
    autoAdvanceMs: null,
    lastOutcome: null,
    lastAnswer: null,
    lastXp: null,
    response: null,
    willFinish: false,
    answer: noop,
    next: noop,
    finish: noop,
    restart: noop,
    summary: null,
    ...patch,
  };
}

describe('componentes de juego (render en servidor)', () => {
  it('ruleta e insignias', () => {
    const wheel = renderToStaticMarkup(h(RouletteWheel, { rotation: 30, landed: 'mass', spinning: true, spinMs: 2000 }));
    expect(wheel).toContain('rotate(30deg)');
    expect(wheel).toContain('Propiedades');
    const badges = renderToStaticMarkup(h(BadgeRow, { badges: ['symbols', 'mass'], fresh: 'mass', size: 'lg' }));
    expect(badges).toContain('Insignias: 2 de 6');
    expect(badges).toContain('Masa: conseguida');
    expect(badges).toContain('Familias: pendiente');
  });

  it('marcador de racha: hito y récord', () => {
    const five = Array.from({ length: 5 }, () => answer(true));
    const milestone = renderToStaticMarkup(
      h(StreakHud, { session: session({ streak: 5, status: 'feedback', lastAnswer: five[4], answered: five }), best: 3 }),
    );
    expect(milestone).toContain('¡Racha 5! +25 XP');
    expect(milestone).toContain('<canvas');
    const running = renderToStaticMarkup(h(StreakHud, { session: session({ streak: 12, answered: five }), best: 30 }));
    expect(running).toContain('x12');
    expect(running).toContain('para racha 20');
  });

  it('Modo Racha: el panel muestra el mismo bonus que el marcador y el multiplicador aparte', () => {
    for (const [streak, bonus] of [
      [5, 25],
      [10, 50],
      [20, 150],
    ] as const) {
      const hits = Array.from({ length: streak }, () => answer(true));
      const hud = text(
        renderToStaticMarkup(
          h(StreakHud, { session: session({ streak, status: 'feedback', lastAnswer: hits[streak - 1], answered: hits }), best: 50 }),
        ),
      );
      expect(hud).toContain(`+${bonus} XP de bonus`);
      for (const difficulty of [1, 3] as const) {
        const panel = rachaPanel(streak, difficulty);
        expect(panel).toContain(`+${bonus} XP de bonus`);
        expect(panel).not.toMatch(/\+\d+ de bonus/);
      }
    }
    // x5: "+15 XP · x1.5" y "+25 XP de bonus" (antes: "+40 XP" y "+30 de bonus").
    const x5 = rachaPanel(5, 1);
    expect(x5).toContain('+15 XP · x1.5');
    expect(x5).not.toContain('+40 XP');
    // #11 (media) y #12 (difícil): solo multiplicador, sin «bonus» engañoso.
    expect(rachaPanel(11, 2)).toContain('+20 XP · x2');
    expect(rachaPanel(12, 3)).toContain('+30 XP · x2');
    expect(rachaPanel(12, 3)).not.toContain('bonus');
    // Sin racha: solo la XP.
    const first = rachaPanel(1, 1);
    expect(first).toContain('+10 XP');
    expect(first).not.toContain('· x');
  });

  it('marcadores compactos para pantallas bajas', () => {
    const five = Array.from({ length: 5 }, () => answer(true));
    const streak = text(
      renderToStaticMarkup(h(StreakHudCompact, { session: session({ streak: 5, status: 'feedback', lastAnswer: five[4], answered: five }), best: 3 })),
    );
    expect(streak).toContain('x5');
    expect(streak).toContain('+25 XP');
    const survival = text(
      renderToStaticMarkup(h(SurvivalHudCompact, { session: session({ lives: 2, maxLives: 3, correctCount: 7, streak: 2 }) })),
    );
    expect(survival).toContain('Puntos 7');
    expect(renderToStaticMarkup(h(SurvivalHudCompact, { session: session({ lives: 2, maxLives: 3 }) }))).toContain('Vidas: 2 de 3');
    const timer = renderToStaticMarkup(
      h(TimerHudCompact, { session: session({ remainingMs: 8200, timeLimitMs: 60_000, correctCount: 4 }) }),
    );
    expect(timer).toContain('Quedan 9 segundos');
    expect(text(timer)).toContain('4 aciertos');
  });

  it('reloj de contrarreloj en los últimos segundos', () => {
    const html = renderToStaticMarkup(
      h(TimerHud, { session: session({ remainingMs: 8200, timeLimitMs: 60_000, correctCount: 7, answered: [answer(true)] }), best: 5 }),
    );
    expect(html).toContain('Quedan 9 segundos');
    expect(html).toContain('¡Récord!');
  });

  it('supervivencia: corazón que se rompe y última vida', () => {
    const html = renderToStaticMarkup(
      h(SurvivalHud, {
        session: session({
          lives: 1,
          maxLives: 3,
          status: 'feedback',
          lastAnswer: answer(false),
          answered: [answer(true), answer(false)],
          index: 9,
          correctCount: 1,
        }),
        best: 0,
      }),
    );
    expect(html).toContain('Vidas: 1 de 3');
    expect(html).toContain('eg-heart-left');
    expect(html).toContain('Te queda 1');
  });

  it('resultados con récord por batir', () => {
    const summary: SessionSummaryData = {
      mode: 'survival',
      title: 'Supervivencia',
      total: 4,
      correct: 3,
      xpGained: 50,
      durationMs: 40_000,
      improved: [11],
      toReview: [11],
      unlockedAchievements: ['survivor'],
    };
    const html = renderToStaticMarkup(
      h(GameResults, {
        mode: 'Supervivencia',
        emoji: '💔',
        title: '¡Sin vidas!',
        tone: 'danger',
        score: 3,
        scoreLabel: 'puntos',
        record: { value: 3, previous: 5, isNew: false, format: String },
        stats: [{ icon: '⚡', label: 'XP ganada', value: '+50', tone: 'xp' }],
        summary,
        onRestart: () => {},
      }),
    );
    expect(html).toContain('Te faltaron 3 para superarlo');
    expect(html).toContain('/practicar?elements=11');
    expect(html).toContain('Jugar de nuevo');
  });
});
