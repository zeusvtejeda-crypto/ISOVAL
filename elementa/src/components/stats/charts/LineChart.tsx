'use client';

import { useState, type PointerEvent } from 'react';
import { cn } from '@/components/ui';
import { niceMax } from '../stats-data';
import { ChartTooltip } from './ChartTooltip';
import { segments } from './geometry';
import { useMeasuredWidth } from './use-measured-width';

export interface LinePoint {
  /** Etiqueta del eje (corta). Vacía = sin etiqueta. */
  axisLabel: string;
  /** Etiqueta completa (tooltip). */
  label: string;
  /** `null` = sin dato (hueco en la línea). */
  value: number | null;
}

export interface LineChartProps {
  data: readonly LinePoint[];
  ariaLabel: string;
  /** Texto del valor: "87%", "32 elementos". */
  describe: (value: number) => string;
  /** Texto del tooltip para un punto sin dato. */
  emptyPointText?: string;
  /** Máximo fijo del eje (100 para porcentajes); por defecto se redondea el máximo de los datos. */
  yMax?: number;
  /** Formato de las marcas del eje ("50%"). */
  formatTick?: (value: number) => string;
  /** Puntos en cada dato (pocos datos) o solo en el último. */
  dots?: 'all' | 'last';
  plotHeight?: number;
  className?: string;
}

const TOP = 26;
const AXIS = 24;
const GUTTER = 36;
const RIGHT = 10;

export function lineChartHeight(plotHeight: number): number {
  return TOP + plotHeight + AXIS;
}

export interface LineLayout {
  height: number;
  baseline: number;
  yMax: number;
  ticks: Array<{ value: number; y: number }>;
  /** Tramos continuos: trazado de la línea y del área. */
  runs: Array<{ key: number; line: string; area: string }>;
  points: Array<{ index: number; x: number; y: number | null; value: number | null }>;
  /** Índice del último dato no nulo (-1 si no hay). */
  lastIndex: number;
  /** Índice más cercano a una posición horizontal. */
  indexAt: (x: number) => number;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Geometría de la línea para un ancho dado (función pura). */
export function layoutLine(
  data: readonly LinePoint[],
  width: number,
  opts: Pick<LineChartProps, 'yMax' | 'plotHeight'> = {},
): LineLayout {
  const plotHeight = opts.plotHeight ?? 132;
  const n = data.length;
  const values = data.map((d) => d.value);
  const maxValue = values.reduce<number>((m, v) => (v !== null && v > m ? v : m), 0);
  const yMax = opts.yMax !== undefined && opts.yMax > 0 ? opts.yMax : niceMax(maxValue);
  const plotW = Math.max(0, width - GUTTER - RIGHT);
  const step = n > 1 ? plotW / (n - 1) : 0;
  const baseline = TOP + plotHeight;
  const xOf = (i: number) => r2(GUTTER + (n > 1 ? i * step : plotW / 2));
  const yOf = (v: number) => r2(baseline - (Math.max(0, Math.min(v, yMax)) / yMax) * plotHeight);

  const runs = segments(values)
    .filter((run) => run.length >= 2)
    .map((run) => {
      const line = run.map((p, k) => `${k === 0 ? 'M' : 'L'}${xOf(p.index)},${yOf(p.value)}`).join(' ');
      const first = run[0];
      const last = run[run.length - 1];
      return { key: first.index, line, area: `${line} L${xOf(last.index)},${baseline} L${xOf(first.index)},${baseline} Z` };
    });

  return {
    height: lineChartHeight(plotHeight),
    baseline,
    yMax,
    ticks: [0, yMax / 2, yMax].filter((t) => Number.isInteger(t)).map((value) => ({ value, y: yOf(value) })),
    runs,
    points: values.map((value, index) => ({ index, x: xOf(index), y: value === null ? null : yOf(value), value })),
    lastIndex: values.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1),
    indexAt: (x: number) => (n <= 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round((x - GUTTER) / step)))),
  };
}

export interface LineChartPlotProps extends LineChartProps {
  width: number;
  active: number | null;
  onActive: (index: number | null) => void;
}

/** El gráfico ya medido: SVG + tooltip. */
export function LineChartPlot({
  width,
  active,
  onActive,
  data,
  ariaLabel,
  describe,
  emptyPointText = 'Sin actividad',
  formatTick = (v) => String(v),
  dots = 'all',
  yMax,
  plotHeight,
}: LineChartPlotProps) {
  const layout = layoutLine(data, width, { yMax, plotHeight });
  const { height, baseline, points, lastIndex } = layout;
  const n = data.length;

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onActive(layout.indexAt(event.clientX - rect.left));
  };

  const activePoint = active !== null ? points[active] : undefined;
  const last = lastIndex >= 0 ? points[lastIndex] : undefined;
  const nearEnd = lastIndex >= n - 2 && n > 2;

  return (
    <>
      <svg
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block touch-pan-y overflow-visible"
        onPointerMove={onMove}
        onPointerDown={onMove}
      >
        {layout.ticks.map((t) => (
          <g key={t.value}>
            <line
              x1={GUTTER}
              x2={width - RIGHT}
              y1={t.value === 0 ? t.y + 0.5 : t.y}
              y2={t.value === 0 ? t.y + 0.5 : t.y}
              className={t.value === 0 ? 'stroke-border-strong' : 'stroke-border'}
              strokeWidth={1}
            />
            <text x={GUTTER - 6} y={t.y} dy="0.35em" textAnchor="end" className="fill-muted text-[10px] font-bold tabular">
              {formatTick(t.value)}
            </text>
          </g>
        ))}

        {layout.runs.map((run) => (
          <g key={run.key}>
            <path d={run.area} className="fill-brand/10" />
            <path d={run.line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-brand" />
          </g>
        ))}

        {activePoint && (
          <line x1={activePoint.x} x2={activePoint.x} y1={TOP - 8} y2={baseline} strokeWidth={1} className="stroke-border-strong" />
        )}

        {points.map((p) => {
          if (p.y === null) return null;
          const i = p.index;
          const isolated = (i === 0 || points[i - 1].y === null) && (i === n - 1 || points[i + 1].y === null);
          if (dots === 'last' && i !== lastIndex && active !== i && !isolated) return null;
          const emphasized = i === lastIndex || i === active;
          return (
            <circle key={i} cx={p.x} cy={p.y} r={emphasized ? 5 : 4} strokeWidth={2} className="fill-brand stroke-surface" />
          );
        })}

        {last && last.value !== null && last.y !== null && active === null && (
          <text
            x={last.x}
            y={last.y - 11}
            textAnchor={nearEnd ? 'end' : 'middle'}
            dx={nearEnd ? 6 : 0}
            className="fill-fg text-xs font-black tabular"
          >
            {describe(last.value)}
          </text>
        )}

        {data.map((d, i) =>
          d.axisLabel ? (
            <text
              key={i}
              x={points[i].x}
              y={baseline + 16}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              className={cn('text-[11px]', i === n - 1 ? 'fill-fg font-black' : 'fill-muted font-bold')}
            >
              {d.axisLabel}
            </text>
          ) : null,
        )}
      </svg>
      {activePoint && (
        <ChartTooltip
          x={activePoint.x}
          y={(activePoint.y ?? baseline) - 12}
          width={width}
          title={data[activePoint.index].label}
          value={activePoint.value !== null ? describe(activePoint.value) : emptyPointText}
        />
      )}
    </>
  );
}

/**
 * Línea con área suave (10 %), huecos en los días sin datos, valor directo en el último punto
 * y cruz vertical al pasar el cursor. SVG sin dependencias.
 */
export function LineChart({ className, plotHeight = 132, ...props }: LineChartProps) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  return (
    <div
      ref={ref}
      className={cn('relative w-full select-none', className)}
      style={{ height: lineChartHeight(plotHeight) }}
      onPointerLeave={() => setActive(null)}
    >
      {width > 0 && <LineChartPlot {...props} plotHeight={plotHeight} width={width} active={active} onActive={setActive} />}
    </div>
  );
}
