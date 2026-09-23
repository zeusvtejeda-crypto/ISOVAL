import { describe, expect, it } from 'vitest';
import { FAMILY_GROUPS, STUDY_BLOCKS } from '@/data/blocks';
import { getElement } from '@/data/elements';
import { addDays, dateKey, daysBetween, lastNDays, weekdayLetter, weekKeys } from '@/utils/dates';
import {
  formatConfig,
  formatDuration,
  formatMass,
  formatNumber,
  formatPercent,
  groupLabel,
  normalizeText,
  pluralize,
} from '@/utils/format';
import { levelFromXp, levelTitle, xpAtLevelStart, xpToNext } from '@/utils/levels';
import { shuffle, sample, weightedSample } from '@/utils/random';
import { searchElements } from '@/utils/search';
import { getGridPosition, getNeighbor } from '@/utils/table-layout';
import { streakModeXp, xpForAnswer, XP_RULES } from '@/utils/xp';

describe('dates', () => {
  it('claves locales y aritmética de días', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-10', 1)).toBe('2024-03-11');
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30);
  });

  it('lastNDays va del más antiguo al más reciente', () => {
    expect(lastNDays(3, '2026-01-02')).toEqual(['2025-12-31', '2026-01-01', '2026-01-02']);
  });

  it('weekKeys empieza en lunes y weekdayLetter usa L M M J V S D', () => {
    // 2026-01-15 es jueves.
    const week = weekKeys('2026-01-15');
    expect(week[0]).toBe('2026-01-12');
    expect(week[6]).toBe('2026-01-18');
    expect(week.map(weekdayLetter).join('')).toBe('LMMJVSD');
  });
});

describe('format', () => {
  it('masa y configuración', () => {
    expect(formatMass(getElement(8))).toBe('15.999');
    expect(formatMass(getElement(43))).toBe('[97]');
    expect(formatConfig('[He] 2s2 2p4')).toBe('[He] 2s² 2p⁴');
    expect(formatConfig('[Xe] 6s2 4f14 5d10')).toBe('[Xe] 6s² 4f¹⁴ 5d¹⁰');
  });

  it('números, porcentajes y duraciones', () => {
    expect(formatNumber(1482)).toBe('1,482');
    expect(formatPercent(0.82)).toBe('82%');
    expect(formatPercent(Number.NaN)).toBe('0%');
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(200_000)).toBe('3 min 20 s');
    expect(formatDuration((7 * 60 + 32) * 60_000)).toBe('7 h 32 min');
  });

  it('etiquetas y texto', () => {
    expect(groupLabel(getElement(11))).toBe('Grupo 1');
    expect(groupLabel(getElement(60))).toBe('Bloque f');
    expect(normalizeText('  Oxígeno ')).toBe('oxigeno');
    expect(pluralize(1, 'elemento', 'elementos')).toBe('elemento');
    expect(pluralize(3, 'elemento', 'elementos')).toBe('elementos');
  });
});

describe('random', () => {
  it('shuffle devuelve una copia con los mismos elementos', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src);
    expect(out).not.toBe(src);
    expect([...out].sort()).toEqual(src);
    expect(sample(src, 3)).toHaveLength(3);
  });

  it('weightedSample no repite y prioriza pesos altos', () => {
    const picks = weightedSample(['a', 'b', 'c'], [1, 1, 1], 3);
    expect(new Set(picks).size).toBe(3);
    let heavy = 0;
    for (let i = 0; i < 200; i++) if (weightedSample(['a', 'b'], [9, 1], 1)[0] === 'a') heavy++;
    expect(heavy).toBeGreaterThan(150);
    expect(weightedSample(['a', 'b'], [0, 0], 2)).toHaveLength(2);
  });
});

describe('table-layout', () => {
  it('posiciones en la cuadrícula', () => {
    expect(getGridPosition(getElement(1))).toEqual({ col: 1, row: 1 });
    expect(getGridPosition(getElement(2))).toEqual({ col: 18, row: 1 });
    expect(getGridPosition(getElement(57))).toEqual({ col: 3, row: 9 });
    expect(getGridPosition(getElement(71))).toEqual({ col: 17, row: 9 });
    expect(getGridPosition(getElement(89))).toEqual({ col: 3, row: 10 });
    expect(getGridPosition(getElement(103))).toEqual({ col: 17, row: 10 });
    expect(getGridPosition(getElement(72))).toEqual({ col: 4, row: 6 });
    expect(getGridPosition(getElement(118))).toEqual({ col: 18, row: 7 });
  });

  it('vecinos reales de la tabla principal', () => {
    expect(getNeighbor(getElement(8), 'down')?.symbol).toBe('S');
    expect(getNeighbor(getElement(8), 'left')?.symbol).toBe('N');
    expect(getNeighbor(getElement(8), 'up')).toBeNull();
    expect(getNeighbor(getElement(56), 'right')).toBeNull(); // casilla 57–71
    expect(getNeighbor(getElement(72), 'left')).toBeNull();
    expect(getNeighbor(getElement(39), 'down')).toBeNull();
    expect(getNeighbor(getElement(60), 'left')).toBeNull(); // bloque f
    expect(getNeighbor(getElement(1), 'right')).toBeNull();
    expect(getNeighbor(getElement(4), 'right')).toBeNull(); // hueco entre los grupos 2 y 13
    expect(getNeighbor(getElement(20), 'right')?.symbol).toBe('Sc');
    expect(getNeighbor(getElement(30), 'right')?.symbol).toBe('Ga');
  });
});

describe('search', () => {
  it('símbolo exacto sin distinguir mayúsculas', () => {
    expect(searchElements('Au')[0].symbol).toBe('Au');
    expect(searchElements('au')[0].symbol).toBe('Au');
    expect(searchElements('C')[0].symbol).toBe('C');
  });

  it('número atómico', () => {
    expect(searchElements('79')[0].symbol).toBe('Au');
    expect(searchElements('7')[0].symbol).toBe('N');
  });

  it('nombre y nombres alternativos sin acentos', () => {
    expect(searchElements('oro')[0].symbol).toBe('Au');
    expect(searchElements('Oro')[0].symbol).toBe('Au');
    expect(searchElements('tungsteno')[0].symbol).toBe('W');
    expect(searchElements('sodio')[0].symbol).toBe('Na');
    expect(searchElements('oxigeno')[0].symbol).toBe('O');
  });

  it('prefijo antes que subcadena, límite y vacío', () => {
    const res = searchElements('bor');
    expect(res[0].symbol).toBe('B');
    expect(searchElements('io', 3)).toHaveLength(3);
    expect(searchElements('   ')).toEqual([]);
    expect(searchElements('zzz')).toEqual([]);
  });
});

describe('levels y XP', () => {
  it('XP por nivel: 100 + (n − 1) × 150', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(250);
    expect(xpToNext(7)).toBe(1000);
    expect(xpAtLevelStart(1)).toBe(0);
    expect(xpAtLevelStart(2)).toBe(100);
    expect(xpAtLevelStart(3)).toBe(350);
    expect(xpAtLevelStart(4)).toBe(750);
  });

  it('levelFromXp en los límites', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForNext: 100, progress: 0, title: 'Aprendiz' });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, xpIntoLevel: 0, title: 'Explorador' });
    expect(levelFromXp(349).level).toBe(2);
    expect(levelFromXp(350).level).toBe(3);
    expect(levelFromXp(225).progress).toBeCloseTo(0.5);
    expect(levelFromXp(-50).level).toBe(1);
    const l7 = levelFromXp(xpAtLevelStart(7));
    expect(l7).toMatchObject({ level: 7, xpForNext: 1000, title: 'Gran Maestro' });
  });

  it('levelFromXp en forma cerrada coincide con el cálculo nivel a nivel', () => {
    const reference = (xp: number) => {
      let level = 1;
      while (xpAtLevelStart(level + 1) <= xp) level++;
      return level;
    };
    expect(levelFromXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0 });
    expect(levelFromXp(99)).toMatchObject({ level: 1, xpIntoLevel: 99 });
    expect(levelFromXp(100)).toMatchObject({ level: 2, xpIntoLevel: 0 });
    expect(levelFromXp(249)).toMatchObject({ level: 2, xpIntoLevel: 149 });
    expect(levelFromXp(250)).toMatchObject({ level: 2, xpIntoLevel: 150 });
    expect(levelFromXp(1e7).level).toBe(reference(1e7));
    for (let xp = 0; xp <= 60_000; xp += 7) expect(levelFromXp(xp).level).toBe(reference(xp));
    for (let level = 2; level <= 400; level++) {
      const start = xpAtLevelStart(level);
      expect(levelFromXp(start - 1).level).toBe(level - 1);
      expect(levelFromXp(start)).toMatchObject({ level, xpIntoLevel: 0 });
    }
  });

  it('levelFromXp es inmediato incluso con XP enorme', () => {
    const t0 = performance.now();
    const info = levelFromXp(1e15);
    expect(performance.now() - t0).toBeLessThan(5);
    expect(xpAtLevelStart(info.level)).toBeLessThanOrEqual(1e15);
    expect(xpAtLevelStart(info.level + 1)).toBeGreaterThan(1e15);
    expect(info.progress).toBeGreaterThanOrEqual(0);
    expect(info.progress).toBeLessThan(1);
    expect(Number.isFinite(levelFromXp(1e20).level)).toBe(true);
    expect(levelFromXp(Number.POSITIVE_INFINITY).level).toBe(1);
  });

  it('títulos (9+ Mente Cuántica)', () => {
    expect(levelTitle(3)).toBe('Químico Junior');
    expect(levelTitle(6)).toBe('Maestro de los Elementos');
    expect(levelTitle(9)).toBe('Mente Cuántica');
    expect(levelTitle(15)).toBe('Mente Cuántica');
  });

  it('XP por respuesta y Modo Racha', () => {
    expect(xpForAnswer(false, 3)).toBe(0);
    expect(xpForAnswer(true, 1)).toBe(XP_RULES.correct);
    expect(xpForAnswer(true, 3)).toBe(XP_RULES.hardCorrect);
    expect(streakModeXp(0)).toEqual({ xp: 0, base: 0, multiplier: 1, multiplied: 0, bonus: 0, milestone: null });
    expect(streakModeXp(1)).toEqual({ xp: 10, base: 10, multiplier: 1, multiplied: 10, bonus: 0, milestone: null });
    expect(streakModeXp(4)).toMatchObject({ xp: 10, bonus: 0, milestone: null });
    expect(streakModeXp(5)).toEqual({ xp: 15 + 25, base: 10, multiplier: 1.5, multiplied: 15, bonus: 25, milestone: 5 });
    expect(streakModeXp(10)).toMatchObject({ xp: 20 + 50, multiplied: 20, bonus: 50, milestone: 10 });
    expect(streakModeXp(20)).toMatchObject({ xp: 30 + 150, multiplied: 30, bonus: 150, milestone: 20 });
    expect(streakModeXp(30)).toMatchObject({ xp: 30 + 100, multiplied: 30, bonus: 100, milestone: null });
    expect(streakModeXp(31)).toMatchObject({ xp: 30, bonus: 0 });
  });

  it('Modo Racha respeta la dificultad (+15 base en difíciles)', () => {
    expect(streakModeXp(1, 3)).toEqual({ xp: 15, base: 15, multiplier: 1, multiplied: 15, bonus: 0, milestone: null });
    expect(streakModeXp(1, 2)).toMatchObject({ xp: 10, base: 10 });
    // x1.5 sobre 15 = 22.5 → 23; el bonus del hito va aparte.
    expect(streakModeXp(5, 3)).toEqual({ xp: 23 + 25, base: 15, multiplier: 1.5, multiplied: 23, bonus: 25, milestone: 5 });
    expect(streakModeXp(10, 3)).toMatchObject({ xp: 30 + 50, multiplied: 30, bonus: 50 });
    expect(streakModeXp(20, 3)).toMatchObject({ xp: 45 + 150, multiplied: 45, bonus: 150, milestone: 20 });
    expect(streakModeXp(0, 3)).toMatchObject({ xp: 0, base: 0, multiplied: 0 });
    // El panel puede separar el extra del multiplicador del bonus del hito.
    const x5 = streakModeXp(5);
    expect(x5.multiplied - x5.base).toBe(5);
    expect(x5.bonus).toBe(25);
  });
});

describe('bloques y familias', () => {
  it('12 bloques de 10 que cubren los 118 (el último 111–118)', () => {
    expect(STUDY_BLOCKS).toHaveLength(12);
    expect(STUDY_BLOCKS[0]).toMatchObject({ id: 'b1', title: 'Bloque 1', from: 1, to: 10 });
    expect(STUDY_BLOCKS[11]).toMatchObject({ id: 'b12', from: 111, to: 118 });
    const all = STUDY_BLOCKS.flatMap((b) => b.atomicNumbers);
    expect(all).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
  });

  it('las familias cubren los 118 elementos una sola vez', () => {
    const all = FAMILY_GROUPS.flatMap((f) => f.atomicNumbers).sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
    expect(FAMILY_GROUPS.find((f) => f.id === 'noble-gas')?.atomicNumbers).toEqual([2, 10, 18, 36, 54, 86, 118]);
  });
});
