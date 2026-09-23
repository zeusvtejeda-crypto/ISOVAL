'use client';

import { useState } from 'react';
import { cn } from '@/components/ui';
import { niceMax } from '../stats-data';
import { ChartTooltip } from './ChartTooltip';
import { roundedRectPath } from './geometry';
import { useMeasuredWidth } from './use-measured-width';

export interface ColumnDatum {
  /** Etiqueta del eje (corta): "lun", "16 sep". Vacía = sin etiqueta. */
  axisLabel: string;
  /** Etiqueta completa (tooltip y tabla): "lunes 16 sep". */
  label: string;
  value: number;
  /** Columna destacada (p. ej. hoy). */
  highlight?: boolean;
}

export interface ColumnChartProps {
  data: readonly ColumnDatum[];
  /** Nombre accesible del gráfico (resumen en una frase). */
  ariaLabel: string;
  /** Texto del valor en tooltip: "12 preguntas". */
  describe: (value: number) => string;
  /** Qué columnas llevan su valor encima: todas (pocas columnas) o solo la mayor y las destacadas. */
  valueLabels?: 'all' | 'key';
  /** Líneas de referencia con su valor a la izquierda. */
  grid?: boolean;
  /** Línea de referencia (p. ej. la meta diaria). */
  reference?: { value: number; label: string };
  /** Alto del área de dibujo (px). */
  plotHeight?: number;
  className?: string;
}

const TOP = 22;
const AXIS = 24;
const GUTTER = 30;
/** Hueco a la derecha para la etiqueta de la línea de referencia ("Meta 10"). */
const REF_GUTTER = 48;
const MAX_BAR = 24;
/** En modo `key`, la mayor columna no se etiqueta si está a menos de estas columnas de una destacada. */
const LABEL_CLEARANCE = 3;

export function columnChartHeight(plotHeight: number): number {
  return TOP + plotHeight + AXIS;
}

export interface ColumnLayout {
  height: number;
  baseline: number;
  barWidth: number;
  left: number;
  /** Borde derecho del área de columnas. */
  right: number;
  slot: number;
  yMax: number;
  ticks: Array<{ value: number; y: number }>;
  reference: { y: number; label: string } | null;
  bars: Array<ColumnDatum & { cx: number; top: number; h: number; labelled: boolean }>;
}

/** Geometría de las columnas para un ancho dado (función pura). */
export function layoutColumns(
  data: readonly ColumnDatum[],
  width: number,
  opts: Pick<ColumnChartProps, 'valueLabels' | 'grid' | 'reference' | 'plotHeight'> = {},
): ColumnLayout {
  const { valueLabels = 'all', grid = false, reference, plotHeight = 132 } = opts;
  const n = data.length;
  const maxValue = data.reduce((m, d) => Math.max(m, d.value), 0);
  const refValue = reference && reference.value > 0 ? reference.value : 0;
  const yMax = niceMax(Math.max(maxValue, refValue));
  const maxIndex = maxValue > 0 ? data.findIndex((d) => d.value === maxValue) : -1;
  const highlighted = data.flatMap((d, i) => (d.highlight && d.value > 0 ? [i] : []));
  const labelMax =
    maxIndex >= 0 &&
    (data[maxIndex].highlight === true || highlighted.every((i) => Math.abs(i - maxIndex) > LABEL_CLEARANCE));

  const left = grid ? GUTTER : 0;
  const right = Math.max(left, width - (refValue > 0 ? REF_GUTTER : 0));
  const plotW = Math.max(0, right - left);
  const slot = n > 0 ? plotW / n : 0;
  const barWidth = Math.max(3, Math.min(MAX_BAR, slot * 0.62));
  const baseline = TOP + plotHeight;
  const yOf = (v: number) => baseline - (v / yMax) * plotHeight;

  return {
    height: columnChartHeight(plotHeight),
    baseline,
    barWidth,
    left,
    right,
    slot,
    yMax,
    ticks: grid ? (yMax % 2 === 0 ? [yMax / 2, yMax] : [yMax]).map((value) => ({ value, y: yOf(value) })) : [],
    reference: reference && refValue > 0 ? { y: yOf(refValue), label: reference.label } : null,
    bars: data.map((d, i) => {
      const h = d.value > 0 ? Math.max(3, baseline - yOf(d.value)) : 0;
      return {
        ...d,
        cx: left + slot * i + slot / 2,
        top: baseline - h,
        h,
        labelled: d.value > 0 && (valueLabels === 'all' || d.highlight === true || (i === maxIndex && labelMax)),
      };
    }),
  };
}

export interface ColumnChartPlotProps extends ColumnChartProps {
  width: number;
  active: number | null;
  onActive: (index: number | null) => void;
}

/** El gráfico ya medido: SVG + tooltip. */
export function ColumnChartPlot({ width, active, onActive, data, ariaLabel, describe, ...opts }: ColumnChartPlotProps) {
  const layout = layoutColumns(data, width, opts);
  const { height, baseline, barWidth, left, right, slot } = layout;
  const anyHighlight = data.some((d) => d.highlight);
  const current = active !== null ? layout.bars[active] : undefined;

  return (
    <>
      <svg
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block touch-pan-y overflow-visible"
      >
        {layout.ticks.map((t) => (
          <g key={t.value}>
            <line x1={left} x2={right} y1={t.y} y2={t.y} className="stroke-border" strokeWidth={1} />
            <text x={left - 6} y={t.y} dy="0.35em" textAnchor="end" className="fill-muted text-[10px] font-bold tabular">
              {t.value}
            </text>
          </g>
        ))}
        <line x1={left} x2={right} y1={baseline + 0.5} y2={baseline + 0.5} className="stroke-border-strong" strokeWidth={1} />
        {layout.reference && (
          <g>
            <line
              x1={left}
              x2={right}
              y1={layout.reference.y}
              y2={layout.reference.y}
              className="stroke-xp-glow"
              strokeWidth={1.5}
            />
            <text
              x={width}
              y={layout.reference.y}
              dy="0.35em"
              textAnchor="end"
              className="fill-muted text-[10px] font-black"
            >
              {layout.reference.label}
            </text>
          </g>
        )}

        {layout.bars.map((b, i) => (
          <g key={i}>
            {b.h > 0 && (
              <path
                d={roundedRectPath(b.cx - barWidth / 2, b.top, barWidth, b.h, 4, 'top')}
                className={cn(
                  'transition-opacity duration-150',
                  b.highlight || !anyHighlight ? 'fill-brand' : 'fill-brand/55',
                  active !== null && active !== i && 'opacity-45',
                )}
              />
            )}
            {b.labelled && (
              <text
                x={b.cx}
                y={b.top - 6}
                textAnchor="middle"
                className={cn('text-[11px] font-black tabular', b.highlight ? 'fill-fg' : 'fill-muted')}
              >
                {b.value}
              </text>
            )}
            {b.axisLabel && (
              <text
                x={b.cx}
                y={baseline + 16}
                textAnchor="middle"
                className={cn('text-[11px]', b.highlight ? 'fill-fg font-black' : 'fill-muted font-bold')}
              >
                {b.axisLabel}
              </text>
            )}
            <rect
              x={left + slot * i}
              y={0}
              width={slot}
              height={height}
              fill="transparent"
              onPointerEnter={() => onActive(i)}
              onPointerDown={() => onActive(i)}
            />
          </g>
        ))}
      </svg>
      {current && (
        <ChartTooltip
          x={current.cx}
          y={(current.h > 0 ? current.top : baseline) - 22}
          width={width}
          title={current.label}
          value={describe(current.value)}
        />
      )}
    </>
  );
}

/** Columnas verticales con valores directos, eje de días y lectura al pasar el cursor. SVG sin dependencias. */
export function ColumnChart({ className, plotHeight = 132, ...props }: ColumnChartProps) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  return (
    <div
      ref={ref}
      className={cn('relative w-full select-none', className)}
      style={{ height: columnChartHeight(plotHeight) }}
      onPointerLeave={() => setActive(null)}
    >
      {width > 0 && (
        <ColumnChartPlot {...props} plotHeight={plotHeight} width={width} active={active} onActive={setActive} />
      )}
    </div>
  );
}
