import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SessionSummaryData } from '@/types';
import { createInitialState } from '@/utils/engine';
import { planStudySession } from '@/utils/planner';
import { fittingCount } from '../chip-fit';
import { ElementChips } from '../ElementChips';
import { StudyPlanView } from '../StudyPlanView';
import { StudySummary } from '../StudySummary';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('fichas en una sola fila', () => {
  it('caben todas: sin «+N»', () => {
    expect(fittingCount([40, 40, 40], 44, 6, 132)).toBe(3);
  });
  it('si no caben, deja sitio para «+N»', () => {
    // 3 fichas de 100 + huecos de 6 = 312 > 250; con «+N» (44) caben 2: 44 + 6 + 100 + 6 + 100 = 256 > 250 → 1.
    expect(fittingCount([100, 100, 100], 44, 6, 250)).toBe(1);
    expect(fittingCount([100, 100, 100], 44, 6, 260)).toBe(2);
    expect(fittingCount([300], 44, 6, 200)).toBe(0);
    expect(fittingCount([], 44, 6, 200)).toBe(0);
  });
  it('la fila única pinta todas en el servidor y una regla oculta para medir', () => {
    const html = renderToStaticMarkup(h(ElementChips, { atomicNumbers: [8, 6, 19], showNames: true, singleRow: true, label: 'Mejoraste' }));
    expect(html).toContain('aria-label="Mejoraste"');
    expect(html).toContain('aria-hidden="true"');
    expect(text(html)).toContain('Oxígeno');
  });
});

describe('resumen de «Estudiar ahora»', () => {
  const summary: SessionSummaryData = {
    mode: 'study',
    title: 'Estudiar ahora',
    total: 20,
    correct: 18,
    xpGained: 200,
    durationMs: 300_000,
    improved: [8, 26],
    toReview: [26, 19],
    unlockedAchievements: [],
  };

  it('ningún elemento aparece en «Hoy mejoraste» y en «Para repasar» a la vez', () => {
    const html = renderToStaticMarkup(h(StudySummary, { summary, learned: [], learnXp: 0, onAnother: () => {} }));
    const improvedList = html.match(/aria-label="Elementos que mejoraste"[\s\S]*?<\/ul>/)?.[0] ?? '';
    expect(improvedList).toContain('Oxígeno');
    expect(improvedList).not.toContain('Hierro');
    expect(text(html)).toContain('Para repasar');
    expect(text(html)).toContain('Practicar mis errores');
    expect(text(html)).toContain('Otra sesión');
  });

  it('sin errores, la acción fija es «Otra sesión»', () => {
    const html = text(
      renderToStaticMarkup(h(StudySummary, { summary: { ...summary, toReview: [], correct: 20 }, learned: [1], learnXp: 5, onAnother: () => {} })),
    );
    expect(html).not.toContain('Practicar mis errores');
    expect(html).toContain('Otra sesión');
    expect(html).toContain('+205');
  });
});

describe('plan de «Estudiar ahora»', () => {
  it('«difíciles» son los fallados que aún no dominas; preguntas y minutos salen del plan', () => {
    const state = createInitialState(new Date(2026, 0, 15, 12));
    const plan = { ...planStudySession(state, new Date(2026, 0, 15, 12)), hard: [19], estimatedMinutes: 5 };
    const html = text(renderToStaticMarkup(h(StudyPlanView, { plan, onStart: () => {} })));
    expect(html).toContain('Los que has fallado y aún no dominas.');
    expect(html).toContain('5 minutos');
    expect(html).toContain(`${plan.questions.length} preguntas`);
  });
});
