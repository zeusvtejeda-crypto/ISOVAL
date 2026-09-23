import { describe, expect, it } from 'vitest';
import {
  buildSessionSummary,
  describeOption,
  EMPTY_TALLY,
  evaluateResponse,
  failedElements,
  improvedElements,
  tallyAnswer,
  toAnswerInput,
  type TallyEntry,
} from '@/components/quiz/session-tally';
import type { AnswerOutcome, AnsweredQuestion, Question } from '@/types';
import { generateQuestion } from '@/utils/questions';

const entry = (atomicNumber: number, correct: boolean): TallyEntry => ({ atomicNumber, correct });

function outcome(masteryBefore: number, masteryAfter: number, unlocked: string[] = []): AnswerOutcome {
  return {
    xpGained: 10,
    bonusXp: 0,
    masteryBefore,
    masteryAfter,
    answerStreak: 1,
    leveledUp: false,
    newLevel: 1,
    unlockedAchievements: unlocked,
  };
}

function answered(question: Question, correct: boolean, xpGained = correct ? 10 : 0): AnsweredQuestion {
  return { question, correct, givenAnswer: 'x', responseMs: 1500, xpGained };
}

describe('session-tally: elementos fallados', () => {
  it('sin repetir y en el orden del primer fallo', () => {
    expect(failedElements([entry(8, true), entry(26, false), entry(19, false), entry(26, false), entry(8, false)])).toEqual([
      26, 19, 8,
    ]);
    expect(failedElements([entry(1, true)])).toEqual([]);
    expect(failedElements([])).toEqual([]);
  });
});

describe('session-tally: «Hoy mejoraste»', () => {
  it('un fallo nunca cuenta como mejora (práctica de 1 pregunta sobre K respondida mal)', () => {
    const entries = [entry(19, false)];
    // Aunque el dominio suba (p. ej. por la confianza de una respuesta más), un fallo no es «mejorar».
    expect(improvedElements(entries, { 19: 20 }, { 19: 24 })).toEqual([]);
    expect(failedElements(entries)).toEqual([19]);
  });

  it('un elemento con aciertos y fallos va solo a «debes repasar» (antes salía en las dos listas)', () => {
    const entries = [entry(101, true), entry(105, false), entry(101, false), entry(105, true), entry(8, true)];
    const start = { 101: 10, 105: 5, 8: 40 };
    const end = { 101: 30, 105: 25, 8: 55 };
    const improved = improvedElements(entries, start, end);
    const failed = failedElements(entries);
    expect(improved).toEqual([8]);
    expect(failed).toEqual([105, 101]);
    expect(improved.filter((z) => failed.includes(z))).toEqual([]);
  });

  it('exige al menos un acierto y que el dominio suba; mayor mejora primero', () => {
    const entries = [entry(1, true), entry(6, true), entry(8, true), entry(7, true), entry(2, true)];
    const start = { 1: 50, 6: 10, 8: 20, 7: 60, 2: 30 };
    const end = { 1: 60, 6: 40, 8: 40, 7: 60, 2: 25 };
    // 6 (+30) antes que 8 (+20) y 1 (+10); 7 no cambió y 2 bajó.
    expect(improvedElements(entries, start, end)).toEqual([6, 8, 1]);
  });

  it('a igual mejora, en orden de aparición; sin dominio registrado no hay mejora', () => {
    const entries = [entry(3, true), entry(4, true), entry(5, true)];
    expect(improvedElements(entries, { 3: 0, 4: 0 }, { 3: 10, 4: 10 })).toEqual([3, 4]);
    expect(improvedElements([entry(3, true)], {}, { 3: 10 })).toEqual([]);
  });
});

describe('session-tally: corrección y atribución', () => {
  it('opción múltiple: texto de la opción elegida y el elemento de la pregunta', () => {
    const q = generateQuestion('name-to-symbol', 11) as Question;
    const right = q.options!.find((o) => o.correct)!;
    const wrong = q.options!.find((o) => !o.correct)!;
    expect(evaluateResponse(q, right.id)).toEqual({
      atomicNumber: 11,
      trackElement: true,
      correct: true,
      givenAnswer: describeOption(right),
    });
    expect(evaluateResponse(q, wrong.id)).toMatchObject({ correct: false, atomicNumber: 11 });
    expect(evaluateResponse(q, 'zz')).toMatchObject({ correct: false, givenAnswer: '—' });
    expect(describeOption({ label: 'Na', sublabel: 'Sodio' })).toBe('Na (Sodio)');
    expect(describeOption({ label: 'Na' })).toBe('Na');
  });

  it('«Toca un elemento del grupo 1» generada con Fr: tocar Na acredita al Sodio, no al Francio', () => {
    const q = generateQuestion('table-group-member', 87) as Question;
    const evaluation = evaluateResponse(q, [11]);
    expect(evaluation).toEqual({ atomicNumber: 11, trackElement: true, correct: true, givenAnswer: 'Na' });
    const input = toAnswerInput(q, evaluation, { mode: 'visual', responseMs: 2000 });
    expect(input).toMatchObject({ atomicNumber: 11, trackElement: true, correct: true, givenAnswer: 'Na', mode: 'visual' });
    expect(input.prompt).toBe(q.prompt);
  });

  it('familias: sin seguimiento por elemento', () => {
    const q = generateQuestion('table-select-category', 54) as Question;
    const evaluation = evaluateResponse(q, [2, 10, 18]);
    expect(evaluation).toMatchObject({ correct: false, trackElement: false, atomicNumber: 36 });
    expect(toAnswerInput(q, evaluation, { mode: 'visual', responseMs: 1, xpOverride: 0 })).toMatchObject({
      trackElement: false,
      xpOverride: 0,
    });
  });
});

describe('session-tally: acumulado y resumen', () => {
  it('el dominio solo se anota con respuesta registrada y atribuida a un elemento', () => {
    let tally = tallyAnswer(EMPTY_TALLY, { atomicNumber: 11, correct: true, trackElement: true }, outcome(20, 30, ['first-element']));
    tally = tallyAnswer(tally, { atomicNumber: 11, correct: true, trackElement: true }, outcome(30, 38));
    tally = tallyAnswer(tally, { atomicNumber: 54, correct: false, trackElement: false }, outcome(60, 60));
    tally = tallyAnswer(tally, { atomicNumber: 8, correct: true, trackElement: true }, null);
    expect(tally.masteryStart).toEqual({ 11: 20 });
    expect(tally.masteryEnd).toEqual({ 11: 38 });
    expect(tally.entries).toEqual([entry(11, true), entry(11, true), entry(54, false), entry(8, true)]);
    expect(tally.unlocked).toEqual(['first-element']);
    expect(EMPTY_TALLY.entries).toEqual([]);
  });

  it('resumen: XP, logros sin repetir y listas disjuntas', () => {
    const na = generateQuestion('name-to-symbol', 11) as Question;
    const fe = generateQuestion('name-to-symbol', 26) as Question;
    let tally = tallyAnswer(EMPTY_TALLY, { atomicNumber: 11, correct: true, trackElement: true }, outcome(10, 25, ['a']));
    tally = tallyAnswer(tally, { atomicNumber: 26, correct: false, trackElement: true }, outcome(40, 30));
    tally = tallyAnswer(tally, { atomicNumber: 26, correct: true, trackElement: true }, outcome(30, 45));
    const summary = buildSessionSummary({
      mode: 'practice',
      title: 'Práctica',
      answered: [answered(na, true), answered(fe, false), answered(fe, true)],
      tally,
      durationMs: 60_000,
      extraXp: 20,
      unlocked: ['a', 'b'],
    });
    expect(summary).toMatchObject({ total: 3, correct: 2, xpGained: 40, improved: [11], toReview: [26] });
    expect(summary.unlockedAchievements).toEqual(['a', 'b']);
  });
});
