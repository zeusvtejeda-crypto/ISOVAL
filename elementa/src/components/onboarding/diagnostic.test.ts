import { describe, expect, it } from 'vitest';
import { elementOfTheDay } from '@/components/dashboard/element-of-the-day';
import type { ExperienceLevel, Question } from '@/types';
import { addDays } from '@/utils/dates';
import { DIAGNOSTIC_LENGTH, DIAGNOSTIC_PROFILES, buildDiagnostic, splitByResult } from './diagnostic';

const LEVELS: ExperienceLevel[] = ['beginner', 'some', 'chemistry', 'master'];

function assertValid(q: Question) {
  expect(q.kind).toBe('multiple-choice');
  expect(q.options).toHaveLength(4);
  expect(q.options?.filter((o) => o.correct)).toHaveLength(1);
  expect(new Set(q.options?.map((o) => o.label)).size).toBe(4);
}

describe('buildDiagnostic', () => {
  for (const level of LEVELS) {
    it(`${level}: 10 preguntas válidas, sin repetir elemento, dentro del perfil y de fácil a difícil`, () => {
      const profile = DIAGNOSTIC_PROFILES[level];
      for (let run = 0; run < 25; run++) {
        const qs = buildDiagnostic(level);
        expect(qs).toHaveLength(DIAGNOSTIC_LENGTH);
        expect(new Set(qs.map((q) => q.atomicNumber)).size).toBe(qs.length);
        for (const q of qs) {
          assertValid(q);
          expect(profile.pool).toContain(q.atomicNumber);
          expect(profile.types).toContain(q.type);
          expect(q.difficulty).toBeLessThanOrEqual(profile.maxDifficulty);
        }
        for (let i = 1; i < qs.length; i++) expect(qs[i].difficulty).toBeGreaterThanOrEqual(qs[i - 1].difficulty);
        for (const type of profile.required) expect(qs.map((q) => q.type)).toContain(type);
      }
    });
  }

  it('principiante: solo elementos 1–20 y preguntas fáciles', () => {
    for (const q of buildDiagnostic('beginner')) {
      expect(q.atomicNumber).toBeLessThanOrEqual(20);
      expect(q.difficulty).toBe(1);
    }
  });

  it('dominarla: incluye masa atómica y configuración electrónica', () => {
    const types = buildDiagnostic('master').map((q) => q.type);
    expect(types).toContain('element-to-mass');
    expect(types).toContain('element-to-configuration');
  });
});

describe('splitByResult', () => {
  it('separa conocidos y por aprender sin duplicados', () => {
    const [a, b, c] = buildDiagnostic('beginner');
    const answered = [
      { question: a, correct: true },
      { question: b, correct: false },
      { question: { ...a, id: 'x' }, correct: false },
      { question: c, correct: true },
    ];
    expect(splitByResult(answered)).toEqual({
      known: [a.atomicNumber, c.atomicNumber],
      toLearn: [b.atomicNumber],
    });
  });
});

describe('elementOfTheDay', () => {
  it('es determinista y está entre 1 y 118', () => {
    expect(elementOfTheDay('2026-09-23')).toBe(elementOfTheDay('2026-09-23'));
    expect(elementOfTheDay('2026-09-23')).toBeGreaterThanOrEqual(1);
    expect(elementOfTheDay('2026-09-23')).toBeLessThanOrEqual(118);
  });

  it('recorre los 118 elementos en 118 días seguidos sin repetir', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 118; i++) seen.add(elementOfTheDay(addDays('2026-01-01', i)));
    expect(seen.size).toBe(118);
  });

  it('devuelve un elemento válido para claves anteriores a la época o inválidas', () => {
    expect(elementOfTheDay('1999-12-31')).toBeGreaterThanOrEqual(1);
    expect(elementOfTheDay('no-es-fecha')).toBe(1);
  });
});
