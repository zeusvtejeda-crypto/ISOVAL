import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProgressState, QuestionSkill } from '@/types';
import { addDays, lastNDays, todayKey } from '@/utils/dates';
import { applyAnswer, applyLearned, type AnswerInput } from '@/utils/engine';
import { masteryMap } from '@/utils/mastery';
import { createInitialState } from '@/utils/state';
import { BestFamilies } from '../BestFamilies';
import {
  ColumnChartPlot,
  LineChartPlot,
  StackedBarPlot,
  layoutColumns,
  layoutLine,
  layoutStack,
  roundedRectPath,
  segments,
  type ColumnDatum,
  type LinePoint,
} from '../charts';
import { KpiGrid } from '../KpiGrid';
import { longDate, shortDate, typesForSkill, weekdayShort } from '../labels';
import { MasteryOverview } from '../MasteryOverview';
import { PracticeFocus } from '../PracticeFocus';
import { RecordsGrid } from '../RecordsGrid';
import {
  accuracyPerDay,
  bestFamilies,
  familyStats,
  learnedCumulative,
  masteryDistribution,
  niceMax,
  questionsPerDay,
  skillAccuracy,
  skillTotals,
  skillWeakElements,
  weakestFamilies,
} from '../stats-data';

const NOW = new Date(2026, 8, 23, 12, 0, 0); // miércoles 23 sep 2026
const TODAY = todayKey(NOW);

function answer(z: number, correct: boolean, skill: QuestionSkill = 'symbol'): AnswerInput {
  return {
    atomicNumber: z,
    skill,
    correct,
    responseMs: 3000,
    mode: 'practice',
    prompt: `Pregunta ${z}`,
    correctAnswer: 'A',
    givenAnswer: correct ? 'A' : 'B',
  };
}

/** Estado con actividad en varios días: gases nobles bien, alcalinos regular, algo de fallos. */
function buildState(): ProgressState {
  let state = createInitialState(addDaysDate(NOW, -40));
  const days: Array<[number, Array<[number, boolean, QuestionSkill?]>]> = [
    [-20, [[2, true], [10, true], [18, true]]],
    [-3, [[2, true], [10, true], [3, false], [3, true], [11, false, 'category']]],
    [-1, [[18, true], [36, true], [3, false], [11, true, 'category'], [19, false, 'location']]],
    [0, [[2, true], [10, true], [18, true], [36, true], [54, true], [19, false], [19, true]]],
  ];
  for (const [offset, answers] of days) {
    const at = addDaysDate(NOW, offset);
    for (const [z, correct, skill] of answers) state = applyAnswer(state, answer(z, correct, skill), at).state;
  }
  state = applyLearned(state, [1], addDaysDate(NOW, -60)).state;
  return state;
}

function addDaysDate(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

describe('stats-data', () => {
  const state = buildState();
  const mastery = masteryMap(state, NOW);

  it('actividad y precisión por día (huecos sin actividad)', () => {
    const keys = lastNDays(7, TODAY);
    const q = questionsPerDay(state.daily, keys);
    expect(q).toEqual([0, 0, 0, 5, 0, 5, 7]);
    expect(accuracyPerDay(state.daily, keys)).toEqual([null, null, null, 60, null, 60, 86]);
  });

  it('aprendidos acumulados por día (incluye los anteriores a la ventana)', () => {
    const keys = [addDays(TODAY, -61), addDays(TODAY, -21), addDays(TODAY, -20), addDays(TODAY, -1), TODAY];
    const series = learnedCumulative(state, keys);
    expect(series[0]).toBe(0);
    expect(series[1]).toBe(1); // H (aprendido hace 60 días)
    expect(series[2]).toBe(4); // + He, Ne, Ar
    expect(series[series.length - 1]).toBe(Object.values(state.elements).filter((p) => p.learned).length);
    for (let i = 1; i < series.length; i++) expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
  });

  it('distribución de dominio suma 118 y separa los no empezados', () => {
    const dist = masteryDistribution(state, mastery);
    const total = dist.unseen + dist.practice + dist.learning + dist.almost + dist.mastered;
    expect(total).toBe(118);
    expect(dist.unseen).toBe(118 - Object.values(state.elements).filter((p) => p.correct + p.incorrect > 0).length);
  });

  it('familias: mejores y más flojas sin solaparse', () => {
    const families = familyStats(state, mastery);
    expect(families).toHaveLength(10);
    const best = bestFamilies(families);
    expect(best.length).toBeGreaterThan(0);
    expect(best[0].group.id).toBe('noble-gas');
    const weakest = weakestFamilies(families, best);
    const bestIds = new Set(best.map((f) => f.group.id));
    expect(weakest.every((f) => !bestIds.has(f.group.id))).toBe(true);
    for (let i = 1; i < best.length; i++) expect(best[i].average).toBeLessThanOrEqual(best[i - 1].average);
  });

  it('precisión por habilidad y elementos a practicar', () => {
    const skills = skillAccuracy(state);
    expect(skills[0].accuracy).toBeLessThanOrEqual(skills[skills.length - 1].accuracy);
    const location = skills.find((s) => s.skill === 'location');
    expect(location).toMatchObject({ correct: 0, total: 1, accuracy: 0 });
    expect(skillTotals(state, 'category')).toEqual({ correct: 1, total: 2 });
    expect(skillWeakElements(state, 'symbol')).toEqual([3, 19]);
    expect(skillWeakElements(state, 'phase')).toEqual([]);
    expect(typesForSkill('location')).toEqual(['location', 'table-find-element']);
  });

  it('niceMax redondea a 1, 2, 5 × 10ⁿ', () => {
    expect([0, 1, 3, 7, 12, 20, 51, 480].map(niceMax)).toEqual([1, 1, 5, 10, 20, 20, 100, 500]);
  });

  it('etiquetas de fecha en español', () => {
    expect(shortDate('2026-09-23')).toBe('23 sep');
    expect(weekdayShort('2026-09-23')).toBe('mié');
    expect(longDate('2026-09-21')).toBe('lunes 21 sep');
  });
});

describe('geometría de los gráficos', () => {
  it('roundedRectPath y segments', () => {
    expect(roundedRectPath(0, 0, 10, 20, 4, 'top')).toMatch(/^M4,0 H6 Q10,0 10,4 V20 H0 V4 Q0,0 4,0 Z$/);
    expect(roundedRectPath(0, 0, 0, 0, 4, 'all')).not.toContain('NaN');
    expect(segments([1, 2, null, 3, null, null, 4, 5]).map((r) => r.map((p) => p.index))).toEqual([[0, 1], [3], [6, 7]]);
  });

  const week: ColumnDatum[] = [3, 0, 12, 7, 0, 5, 9].map((value, i) => ({
    axisLabel: `d${i}`,
    label: `Día ${i}`,
    value,
    highlight: i === 6,
  }));

  it('columnas: escala, barras dentro del área y etiquetas clave', () => {
    const layout = layoutColumns(week, 300, { reference: { value: 10, label: 'Meta 10' } });
    expect(layout.yMax).toBe(20);
    expect(layout.barWidth).toBeLessThanOrEqual(24);
    for (const b of layout.bars) {
      expect(b.cx).toBeGreaterThan(0);
      expect(b.cx).toBeLessThan(300);
      expect(b.top).toBeGreaterThanOrEqual(0);
      expect(b.top + b.h).toBeCloseTo(layout.baseline);
    }
    expect(layout.bars[1].h).toBe(0);
    expect(layout.reference?.label).toBe('Meta 10');
    const key = layoutColumns(week, 300, { valueLabels: 'key' });
    expect(key.bars.filter((b) => b.labelled).map((b) => b.value)).toEqual([12, 9]);
    expect(layoutColumns(week.map((d) => ({ ...d, value: 0 })), 300).yMax).toBe(1);
  });

  it('línea: huecos, último dato e índice bajo el cursor', () => {
    const data: LinePoint[] = [50, null, 80, 90, null, 100].map((value, i) => ({ axisLabel: '', label: `D${i}`, value }));
    const layout = layoutLine(data, 320, { yMax: 100 });
    expect(layout.runs).toHaveLength(1); // 80→90 (50 y 100 quedan aislados)
    expect(layout.lastIndex).toBe(5);
    expect(layout.points[1].y).toBeNull();
    expect(layout.ticks.map((t) => t.value)).toEqual([0, 50, 100]);
    expect(layout.indexAt(-50)).toBe(0);
    expect(layout.indexAt(10_000)).toBe(5);
    expect(layout.points[5].y).toBeCloseTo(layout.baseline - 132);
  });

  it('barra apilada: tramos visibles dentro del ancho', () => {
    const parts = layoutStack(
      [
        { key: 'a', label: 'A', value: 100, fillClass: '' },
        { key: 'b', label: 'B', value: 0, fillClass: '' },
        { key: 'c', label: 'C', value: 1, fillClass: '' },
        { key: 'd', label: 'D', value: 17, fillClass: '' },
      ],
      280,
    );
    expect(parts.map((p) => p.key)).toEqual(['a', 'c', 'd']);
    expect(parts[1].w).toBeGreaterThanOrEqual(2);
    const end = parts[parts.length - 1].x + parts[parts.length - 1].w;
    expect(end).toBeCloseTo(280);
    expect(parts.map((p) => p.corners)).toEqual(['left', 'none', 'right']);
  });

  it('los gráficos se dibujan sin NaN, con nombre accesible y en cualquier ancho', () => {
    const noop = () => {};
    for (const width of [240, 320, 720]) {
      const columns = renderToStaticMarkup(
        h(ColumnChartPlot, { data: week, width, active: 2, onActive: noop, ariaLabel: 'Semana', describe: String, grid: true }),
      );
      expect(columns).toContain('role="img"');
      expect(columns).toContain('aria-label="Semana"');
      expect(columns).not.toContain('NaN');
      expect(columns).toContain('Día 2'); // tooltip activo

      const line = renderToStaticMarkup(
        h(LineChartPlot, {
          data: [null, 40, 60, null, 90].map((value, i) => ({ axisLabel: i === 4 ? 'Hoy' : '', label: `D${i}`, value })),
          width,
          active: null,
          onActive: noop,
          ariaLabel: 'Precisión',
          describe: (v: number) => `${v}%`,
          yMax: 100,
        }),
      );
      expect(line).not.toContain('NaN');
      expect(line).toContain('90%');
      expect(line).toContain('Hoy');

      const stack = renderToStaticMarkup(
        h(StackedBarPlot, { width, ariaLabel: 'Dominio', segments: [{ key: 'x', label: 'X', value: 3, fillClass: 'fill-success' }] }),
      );
      expect(stack).not.toContain('NaN');
    }
    const empty = renderToStaticMarkup(h(LineChartPlot, { data: [], width: 300, active: null, onActive: noop, ariaLabel: 'x', describe: String }));
    expect(empty).not.toContain('NaN');
  });
});

describe('tarjetas de estadísticas', () => {
  const state = buildState();
  const mastery = masteryMap(state, NOW);
  const families = familyStats(state, mastery);

  it('MasteryOverview: tabla accesible con los 5 niveles y mini tabla enlazada', () => {
    const html = renderToStaticMarkup(h(MasteryOverview, { state, mastery }));
    expect(html).toContain('Dominio de la tabla');
    expect(html).toContain('<caption>Elementos por nivel de dominio</caption>');
    expect(html).toContain('Sin empezar');
    expect(html).toContain('href="/tabla"');
  });

  it('BestFamilies: medallas y enlace a practicar la familia; vacío amable', () => {
    const html = renderToStaticMarkup(h(BestFamilies, { families: bestFamilies(families) }));
    expect(html).toContain('🥇');
    expect(html).toContain('/practicar?family=noble-gas');
    expect(renderToStaticMarkup(h(BestFamilies, { families: [] }))).toContain('href="/bloques"');
  });

  it('PracticeFocus: elementos, familias y habilidades con enlaces reales', () => {
    const html = renderToStaticMarkup(
      h(PracticeFocus, {
        state,
        families: weakestFamilies(families, bestFamilies(families)),
        weakElements: [{ atomicNumber: 3, mastery: 30 }],
        skills: skillAccuracy(state),
      }),
    );
    expect(html).toContain('/practicar?elements=3');
    expect(html).toContain('/practicar?focus=dificiles');
    expect(html).toContain('/practicar?elements=19&amp;types=location,table-find-element');
    const empty = renderToStaticMarkup(h(PracticeFocus, { state: createInitialState(NOW), families: [], weakElements: [], skills: [] }));
    expect(empty).toContain('Cuando respondas algunas preguntas');
  });

  it('RecordsGrid y KpiGrid', () => {
    const records = renderToStaticMarkup(
      h(RecordsGrid, { records: { ...state.records, timeAttackBest: 21, bestExamPct: 95 }, bestDayStreak: 4 }),
    );
    expect(records).toContain('href="/contrarreloj"');
    expect(records).toContain('95%');
    expect(records).toContain('¡Estrénalo!');
    const kpis = renderToStaticMarkup(
      h(KpiGrid, { items: [{ key: 'a', emoji: '🎯', label: 'Precisión', value: '87%', tone: 'brand' }] }),
    );
    expect(kpis).toContain('<dt');
    expect(kpis).toContain('87%');
  });
});
