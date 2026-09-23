import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Question } from '@/types';
import { generateQuestion } from '@/utils/questions';
import { revealScrollDelta } from '../feedback-reveal';
import { FeedbackPanel } from '../FeedbackPanel';
import { hasShortOptions } from '../QuestionCard';
import { describeTableReview, reviewTableAnswer } from '../table-review';

describe('selección múltiple: tres estados', () => {
  // Metaloides: B, Si, Ge, As, Sb, Te obligatorios; los de clasificación discutida (Po…) son opcionales.
  const metalloids = generateQuestion('table-select-category', 5) as Question;
  const targets = metalloids.targetAtomicNumbers ?? [];
  const optional = metalloids.optionalAtomicNumbers ?? [];
  const required = targets.filter((z) => !optional.includes(z));

  it('los datos de la prueba tienen obligatorios y opcionales', () => {
    expect(required).toEqual(expect.arrayContaining([5, 14, 32, 33, 51, 52]));
    expect(optional).toContain(84);
  });

  it('acertadas, las que faltaron y las que sobraban; las opcionales ni faltan ni sobran', () => {
    const [first, second, ...rest] = required;
    const review = reviewTableAnswer(metalloids, [first, second, second, 1, 26]);
    expect(review.correct).toEqual([first, second]);
    expect(review.missed).toEqual(rest);
    expect(review.incorrect).toEqual([1, 26]);
    expect(review.optional).toEqual(optional);
    expect(review).toMatchObject({ hits: 2, required: required.length });
    expect(describeTableReview(review)).toBe(`Acertaste 2 de ${required.length} · 2 sobraban`);
  });

  it('una opcional marcada cuenta como acertada', () => {
    const review = reviewTableAnswer(metalloids, [...required, 84]);
    expect(review).toMatchObject({ missed: [], incorrect: [], hits: required.length });
    expect(review.correct).toContain(84);
    expect(review.optional).not.toContain(84);
    expect(describeTableReview(review)).toBe(`Acertaste ${required.length} de ${required.length}`);
    expect(describeTableReview(reviewTableAnswer(metalloids, [5, 1]))).toBe(`Acertaste 1 de ${required.length} · 1 sobraba`);
  });

  it('casilla única: revela el objetivo y la tocada si era otra', () => {
    const find = generateQuestion('table-find-element', 8) as Question;
    expect(reviewTableAnswer(find, [9])).toMatchObject({ correct: [8], incorrect: [9], missed: [] });
    expect(reviewTableAnswer(find, [8])).toMatchObject({ correct: [8], incorrect: [] });
  });
});

describe('revealScrollDelta', () => {
  const visible = { top: 60, bottom: 500 };
  it('no se mueve si ya se ve', () => {
    expect(revealScrollDelta([{ top: 100, bottom: 160 }], visible)).toBe(0);
    expect(revealScrollDelta([], visible)).toBe(0);
  });
  it('baja lo justo para dejar la más baja sobre el panel', () => {
    expect(revealScrollDelta([{ top: 300, bottom: 360 }, { top: 480, bottom: 540 }], visible)).toBe(40);
  });
  it('sube si queda bajo la cabecera', () => {
    expect(revealScrollDelta([{ top: 20, bottom: 80 }], visible)).toBe(-40);
  });
  it('si no caben juntas, alinea la primera arriba', () => {
    expect(revealScrollDelta([{ top: 100, bottom: 160 }, { top: 700, bottom: 760 }], visible)).toBe(40);
  });
});

describe('opciones en rejilla 2 × 2', () => {
  it('símbolos, números y nombres cortos sí; frases largas no', () => {
    const opt = (label: string, sublabel?: string) => ({ id: label, label, sublabel, correct: false });
    expect(hasShortOptions([opt('Na'), opt('K'), opt('Li'), opt('Rb')])).toBe(true);
    expect(hasShortOptions([opt('Praseodimio', 'Pr'), opt('Sodio', 'Na')])).toBe(true);
    expect(hasShortOptions([opt('Rutherfordio', 'Rf'), opt('Sodio', 'Na')])).toBe(false);
    expect(hasShortOptions([opt('Metal de transición'), opt('Gas noble')])).toBe(false);
    expect(hasShortOptions([])).toBe(false);
  });
});

describe('FeedbackPanel', () => {
  const base = { correctAnswer: 'Na', onContinue: () => {} };
  it('pantallas bajas: la explicación queda tras «Ver por qué»', () => {
    const html = renderToStaticMarkup(
      h(FeedbackPanel, { ...base, correct: false, explanation: 'El símbolo Na proviene del latín Natrium.' }),
    );
    expect(html).toContain('Respuesta correcta:');
    expect(html).toContain('Ver por qué');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('[@media(max-height:700px)]:hidden');
    expect(html).toContain('data-feedback-panel');
    // Espera antes de deslizarse para que se vea la animación de la respuesta.
    expect(html).toContain('animation-delay:350ms');
  });
  it('sin explicación no hay «Ver por qué»; con avance automático no hay espera', () => {
    const html = renderToStaticMarkup(h(FeedbackPanel, { ...base, correct: true, xpGained: 10, autoAdvanceMs: 600 }));
    expect(html).not.toContain('Ver por qué');
    expect(html).not.toContain('animation-delay');
    expect(html).toContain('+10 XP');
  });
  it('línea de detalle de la selección múltiple', () => {
    const html = renderToStaticMarkup(h(FeedbackPanel, { ...base, correct: false, detail: 'Acertaste 2 de 7 · 2 sobraban' }));
    expect(html).toContain('Acertaste 2 de 7 · 2 sobraban');
  });
});
