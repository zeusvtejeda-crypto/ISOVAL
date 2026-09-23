'use client';

import { useMemo } from 'react';
import { TOTAL_ELEMENTS } from '@/data/elements';
import type { ProgressState } from '@/types';
import { addDays, lastNDays } from '@/utils/dates';
import { formatNumber, pluralize } from '@/utils/format';
import { ChartCard } from './ChartCard';
import { ChartTable, ColumnChart, LineChart, type ColumnDatum, type LinePoint } from './charts';
import { longDate, shortDate, weekdayShort } from './labels';
import { accuracyPerDay, accuracyTotals, activityPerDay, learnedCumulative, questionsPerDay, sum } from './stats-data';

interface ChartProps {
  state: ProgressState;
  /** Clave `YYYY-MM-DD` de hoy. */
  today: string;
}

const count = (n: number, one: string, many: string) => `${formatNumber(n)} ${pluralize(n, one, many)}`;

function dayLabel(key: string, today: string): string {
  return key === today ? `Hoy, ${longDate(key)}` : longDate(key);
}

/** Etiqueta del eje cada 7 días contando desde hoy (hoy = "Hoy"). */
function weeklyAxis(keys: readonly string[], today: string, i: number): string {
  const fromEnd = keys.length - 1 - i;
  if (keys[i] === today) return 'Hoy';
  return fromEnd % 7 === 0 && fromEnd < keys.length - 2 ? shortDate(keys[i]) : '';
}

/** «Preguntas y tarjetas»: lo que cuenta para la meta diaria. */
const activity = (n: number) => count(n, 'pregunta o tarjeta', 'preguntas y tarjetas');

/**
 * Progreso semanal: actividad por día en los últimos 7 días (preguntas + flashcards, lo que cuenta
 * para la meta), con la meta diaria como referencia.
 */
export function WeeklyChart({ state, today }: ChartProps) {
  const keys = useMemo(() => lastNDays(7, today), [today]);
  const values = useMemo(() => activityPerDay(state.daily, keys), [state.daily, keys]);
  const total = sum(values);
  const best = Math.max(...values);
  const goal = state.settings.dailyGoal;
  const goalDays = keys.filter((k) => state.daily[k]?.goalMet).length;

  const data: ColumnDatum[] = keys.map((key, i) => ({
    axisLabel: key === today ? 'Hoy' : weekdayShort(key),
    label: dayLabel(key, today),
    value: values[i],
    highlight: key === today,
  }));

  return (
    <ChartCard
      id="chart-weekly"
      emoji="📅"
      title="Progreso semanal"
      summary={
        total > 0
          ? `${activity(total)} en 7 días · meta cumplida ${goalDays} ${pluralize(goalDays, 'día', 'días')}`
          : `Tu meta: ${goal} preguntas o tarjetas al día`
      }
      emptyText={total === 0 ? 'Sin actividad esta semana. ¡Hoy es buen día para empezar!' : null}
    >
      <ColumnChart
        data={data}
        ariaLabel={`Preguntas y tarjetas por día en los últimos 7 días. Total: ${total}. Hoy: ${values[values.length - 1]}. Mejor día: ${best}.`}
        describe={activity}
        reference={{ value: goal, label: `Meta ${goal}` }}
      />
      <ChartTable
        caption="Preguntas y tarjetas por día, últimos 7 días"
        headers={['Día', 'Preguntas y tarjetas']}
        rows={data.map((d) => [d.label, String(d.value)] as const)}
      />
    </ChartCard>
  );
}

/**
 * Precisión diaria de los últimos 14 días, solo con preguntas de quiz (las flashcards no cuentan),
 * como «Precisión» y «Precisión general». Los días sin preguntas quedan como huecos.
 */
export function AccuracyChart({ state, today }: ChartProps) {
  const keys = useMemo(() => lastNDays(14, today), [today]);
  const values = useMemo(() => accuracyPerDay(state.daily, keys), [state.daily, keys]);
  const totals = useMemo(() => accuracyTotals(state.daily, keys), [state.daily, keys]);
  const activeDays = values.filter((v) => v !== null).length;
  const average = totals.answered > 0 ? Math.round((100 * totals.correct) / totals.answered) : null;

  const data: LinePoint[] = keys.map((key, i) => ({
    axisLabel: key === today ? 'Hoy' : i === 0 || i === 7 ? shortDate(key) : '',
    label: dayLabel(key, today),
    value: values[i],
  }));

  return (
    <ChartCard
      id="chart-accuracy"
      emoji="🎯"
      title="Precisión"
      summary={
        average !== null
          ? `Media de ${average}% en ${activeDays} ${pluralize(activeDays, 'día activo', 'días activos')} (últimas 2 semanas)`
          : 'Últimas 2 semanas'
      }
      emptyText={average === null ? 'Responde preguntas para ver tu precisión.' : null}
    >
      <LineChart
        data={data}
        ariaLabel={
          average !== null
            ? `Precisión diaria de las últimas 2 semanas. Media: ${average}%. Días con actividad: ${activeDays}.`
            : 'Precisión diaria de las últimas 2 semanas: sin preguntas.'
        }
        describe={(v) => `${v}%`}
        yMax={100}
        formatTick={(v) => `${v}%`}
      />
      <ChartTable
        caption="Precisión por día (preguntas, sin flashcards), últimas 2 semanas"
        headers={['Día', 'Precisión']}
        rows={data.map((d) => [d.label, d.value !== null ? `${d.value}%` : 'Sin preguntas'] as const)}
      />
    </ChartCard>
  );
}

/** Elementos aprendidos acumulados en los últimos 30 días. */
export function LearnedChart({ state, today }: ChartProps) {
  const keys = useMemo(() => lastNDays(30, today), [today]);
  // Un día más al principio: lo aprendido antes de la ventana.
  const series = useMemo(() => learnedCumulative(state, [addDays(keys[0], -1), ...keys]), [state, keys]);
  const values = series.slice(1);
  const total = values[values.length - 1] ?? 0;
  const gain = total - series[0];

  const data: LinePoint[] = keys.map((key, i) => ({
    axisLabel: key === today ? 'Hoy' : i === 0 || i === 15 ? shortDate(key) : '',
    label: dayLabel(key, today),
    value: values[i],
  }));
  const describe = (v: number) => count(v, 'elemento', 'elementos');

  return (
    <ChartCard
      id="chart-learned"
      emoji="🌱"
      title="Elementos aprendidos"
      summary={
        total > 0
          ? `${total} de ${TOTAL_ELEMENTS} · ${gain > 0 ? `+${gain} en los últimos 30 días` : 'sin nuevos este mes'}`
          : `0 de ${TOTAL_ELEMENTS}`
      }
      emptyText={total === 0 ? 'Aprende tus primeros elementos con «Aprende 5».' : null}
    >
      <LineChart
        data={data}
        ariaLabel={`Elementos aprendidos acumulados en los últimos 30 días: ${total} en total, ${gain} nuevos.`}
        describe={describe}
        dots="last"
      />
      <ChartTable
        caption="Elementos aprendidos acumulados, últimos 30 días"
        headers={['Día', 'Aprendidos']}
        rows={data.map((d) => [d.label, String(d.value ?? 0)] as const)}
      />
    </ChartCard>
  );
}

/** Preguntas de quiz respondidas por día en los últimos 30 días (sin flashcards, como el KPI). */
export function QuestionsChart({ state, today }: ChartProps) {
  const keys = useMemo(() => lastNDays(30, today), [today]);
  const values = useMemo(() => questionsPerDay(state.daily, keys), [state.daily, keys]);
  const total = sum(values);
  const activeDays = values.filter((v) => v > 0).length;
  const best = Math.max(...values);

  const data: ColumnDatum[] = keys.map((key, i) => ({
    axisLabel: weeklyAxis(keys, today, i),
    label: dayLabel(key, today),
    value: values[i],
    highlight: key === today,
  }));

  return (
    <ChartCard
      id="chart-questions"
      emoji="📊"
      title="Preguntas respondidas"
      summary={
        total > 0
          ? `${count(total, 'pregunta', 'preguntas')} en 30 días · ${activeDays} ${pluralize(activeDays, 'día activo', 'días activos')}`
          : 'Últimos 30 días (sin contar flashcards)'
      }
      emptyText={total === 0 ? 'Aquí verás tu constancia día a día.' : null}
    >
      <ColumnChart
        data={data}
        ariaLabel={`Preguntas respondidas por día en los últimos 30 días. Total: ${total}. Días activos: ${activeDays}. Mejor día: ${best}.`}
        describe={(v) => count(v, 'pregunta', 'preguntas')}
        valueLabels="key"
        grid
      />
      <ChartTable
        caption="Preguntas respondidas por día (sin flashcards), últimos 30 días"
        headers={['Día', 'Preguntas']}
        rows={data.map((d) => [d.label, String(d.value)] as const)}
      />
    </ChartCard>
  );
}
