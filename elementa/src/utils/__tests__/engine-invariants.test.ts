import { describe, expect, it } from 'vitest';
import type { FlashcardRating, ProgressState } from '@/types';
import { applyAnswer, applyFlashcard } from '@/utils/engine';
import { computeMastery, countMastered, MASTERED_THRESHOLD, masteryTier } from '@/utils/mastery';
import { createInitialState } from '@/utils/state';

/**
 * Invariantes del motor de dominio (§13): un fallo nunca sube el dominio de un elemento, sea cual
 * sea el historial previo y el tiempo transcurrido.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const Z = 26;
const START = new Date(2026, 0, 1, 12, 0, 0);

function answer(state: ProgressState, correct: boolean, responseMs: number, at: Date) {
  return applyAnswer(
    state,
    {
      atomicNumber: Z,
      skill: 'symbol',
      correct,
      responseMs,
      mode: 'practice',
      prompt: '¿Cuál es el símbolo del Hierro?',
      correctAnswer: 'Fe',
      givenAnswer: correct ? 'Fe' : 'F',
    },
    at,
  );
}

/** `n` aciertos siguiendo el calendario SRS (cada uno justo cuando toca repasar). */
function scheduledHistory(n: number, responseMs: number): { state: ProgressState; lastAt: Date; due: Date } {
  let state = createInitialState(START);
  let at = START;
  for (let i = 0; i < n; i++) {
    state = answer(state, true, responseMs, at).state;
    if (i < n - 1) at = new Date(Date.parse(state.elements[Z].due as string));
  }
  return { state, lastAt: at, due: new Date(Date.parse(state.elements[Z].due as string)) };
}

/** Comprueba el invariante para un fallo en `now` y devuelve el dominio antes y después. */
function expectWrongDoesNotRaise(state: ProgressState, now: Date, responseMs: number): { before: number; after: number } {
  const before = computeMastery(state.elements[Z], now);
  const { state: next, outcome } = answer(state, false, responseMs, now);
  const after = next.elements[Z];
  expect(outcome.masteryBefore).toBe(before);
  expect(outcome.masteryAfter).toBeLessThanOrEqual(outcome.masteryBefore);
  expect(computeMastery(after, now)).toBeLessThanOrEqual(before);
  expect(computeMastery(after, new Date(now.getTime() + HOUR))).toBeLessThanOrEqual(before);
  return { before, after: outcome.masteryAfter };
}

describe('un fallo nunca sube el dominio', () => {
  const GAPS_DAYS = [0, 1, 10, 90, 200, 400];
  const CORRECT_MS = [2_000, 3_500, 12_000]; // easy, good y hard en el SRS
  const WRONG_MS = [1_000, 15_000];

  it('rejilla: 1–10 aciertos espaciados, pausas de 0 a 400 días y un fallo rápido o lento', () => {
    let checks = 0;
    for (let n = 1; n <= 10; n++) {
      for (const correctMs of CORRECT_MS) {
        const { state, lastAt, due } = scheduledHistory(n, correctMs);
        for (const gap of GAPS_DAYS) {
          // Pausa contada desde la fecha de repaso (atrasado) y desde el último acierto (quizá sin tocar).
          for (const anchor of [due, lastAt]) {
            const now = new Date(anchor.getTime() + gap * DAY);
            for (const wrongMs of WRONG_MS) {
              expectWrongDoesNotRaise(state, now, wrongMs);
              checks++;
            }
          }
        }
      }
    }
    expect(checks).toBe(10 * CORRECT_MS.length * GAPS_DAYS.length * 2 * WRONG_MS.length);
  });

  it('casos de la auditoría: el olvido acumulado no se borra al fallar', () => {
    // 8 aciertos en 8 días seguidos (3,5 s) y 200 días de retraso: 57. Antes, fallar daba 85 («Dominado»).
    let state = createInitialState(START);
    for (let i = 0; i < 8; i++) state = answer(state, true, 3_500, new Date(START.getTime() + i * DAY)).state;
    let now = new Date(Date.parse(state.elements[Z].due as string) + 200 * DAY);
    const dominatedBefore = countMastered(state, now);
    const r = expectWrongDoesNotRaise(state, now, 1_000);
    expect(r.before).toBe(57);
    expect(r.after).toBeLessThan(57);
    expect(masteryTier(r.after)).not.toBe('mastered');
    expect(countMastered(answer(state, false, 1_000, now).state, now)).toBe(dominatedBefore);

    // 5 aciertos en calendario, 90 días de retraso: 63 (antes → 79). 3 aciertos: 37 (antes → 55).
    for (const [n, expected] of [
      [5, 63],
      [3, 37],
    ] as const) {
      const h = scheduledHistory(n, 3_500);
      now = new Date(h.due.getTime() + 90 * DAY);
      const res = expectWrongDoesNotRaise(h.state, now, 1_000);
      expect(res.before).toBe(expected);
      expect(res.after).toBeLessThan(expected);
    }
  });

  it('fallos seguidos siguen bajando (o igualan) y el olvido continúa después', () => {
    const h = scheduledHistory(6, 3_500);
    let state = h.state;
    let now = new Date(h.due.getTime() + 30 * DAY);
    let prev = computeMastery(state.elements[Z], now);
    for (let i = 0; i < 5; i++) {
      const r = answer(state, false, 1_000, now);
      expect(r.outcome.masteryAfter).toBeLessThanOrEqual(prev);
      state = r.state;
      prev = r.outcome.masteryAfter;
      now = new Date(now.getTime() + 5 * 60_000);
    }
    expect(computeMastery(state.elements[Z], new Date(now.getTime() + 30 * DAY))).toBeLessThanOrEqual(prev);
  });

  it('sin ningún acierto el dominio es 0 (un fallo en un elemento nuevo no «mejora» nada)', () => {
    const r = answer(createInitialState(START), false, 2_000, START);
    expect(r.outcome).toMatchObject({ masteryBefore: 0, masteryAfter: 0 });
    expect(computeMastery(r.state.elements[Z], START)).toBe(0);
  });

  it('un fallo rápido no mejora la velocidad (la media de tiempo solo usa aciertos)', () => {
    const slow = answer(createInitialState(START), true, 12_000, START).state;
    const avg = slow.elements[Z].avgResponseMs;
    const r = answer(slow, false, 500, new Date(START.getTime() + 60_000));
    expect(r.state.elements[Z].avgResponseMs).toBe(avg);
    const first = answer(createInitialState(START), false, 500, START).state;
    expect(first.elements[Z].avgResponseMs).toBeNull();
  });

  it('historiales aleatorios (quiz y flashcards): ningún fallo sube el dominio', () => {
    // PRNG determinista (mulberry32) para que la prueba sea reproducible.
    let seed = 20260115;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const gaps = [0, 1 / 1440, 1 / 24, 0.5, 1, 3, 10, 30, 90, 200, 400];
    const times = [800, 2_000, 5_000, 9_000, 15_000, 25_000];
    const ratings: FlashcardRating[] = ['hard', 'good', 'easy'];
    let wrongs = 0;
    for (let run = 0; run < 300; run++) {
      let t = START.getTime();
      let state = createInitialState(START);
      const length = 1 + Math.floor(rnd() * 20);
      for (let i = 0; i < length; i++) {
        t += gaps[Math.floor(rnd() * gaps.length)] * DAY;
        const now = new Date(t);
        const wrong = rnd() < 0.35;
        const ms = times[Math.floor(rnd() * times.length)];
        const before = computeMastery(state.elements[Z], now);
        const r =
          rnd() < 0.3
            ? applyFlashcard(
                state,
                { atomicNumber: Z, skill: 'symbol', rating: wrong ? 'again' : ratings[Math.floor(rnd() * 3)], responseMs: ms },
                now,
              )
            : answer(state, !wrong, ms, now);
        if (wrong) {
          wrongs++;
          expect(r.outcome.masteryAfter).toBeLessThanOrEqual(before);
          expect(computeMastery(r.state.elements[Z], new Date(t + HOUR))).toBeLessThanOrEqual(before);
        }
        state = r.state;
      }
    }
    expect(wrongs).toBeGreaterThan(500);
  });

  it('el olvido se mide desde el último acierto, no desde el repaso programado', () => {
    const h = scheduledHistory(6, 3_500);
    const fresh = computeMastery(h.state.elements[Z], h.due);
    expect(fresh).toBeGreaterThanOrEqual(MASTERED_THRESHOLD);
    const later = computeMastery(h.state.elements[Z], new Date(h.due.getTime() + 60 * DAY));
    expect(later).toBeLessThan(fresh);
    // Un acierto tras la pausa recupera el dominio.
    const back = answer(h.state, true, 3_500, new Date(h.due.getTime() + 60 * DAY));
    expect(back.outcome.masteryAfter).toBeGreaterThan(later);
  });
});
