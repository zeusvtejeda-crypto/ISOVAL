'use client';

import { useId } from 'react';
import { cn } from '@/components/ui';
import { roundedRectPath, type RoundedCorners } from './geometry';
import { useMeasuredWidth } from './use-measured-width';

export interface StackedSegment {
  key: string;
  label: string;
  value: number;
  /** Clase de relleno SVG (`fill-success`…). */
  fillClass: string;
  /** Rayado encima del color (señal que no depende del color, p. ej. «Necesita práctica»). */
  hatched?: boolean;
}

export interface StackedBarProps {
  segments: readonly StackedSegment[];
  ariaLabel: string;
  height?: number;
  /** Muestra el valor de cada tramo en una pastilla, si cabe (se lee sin depender del color). */
  showValues?: boolean;
  className?: string;
}

const GAP = 2;
const MIN_SEGMENT = 2;

export interface StackPart extends StackedSegment {
  x: number;
  w: number;
  corners: RoundedCorners;
}

/**
 * Tramos de la barra apilada para un ancho dado (función pura): proporcionales, con 2 px de
 * separación, un mínimo visible de 2 px y extremos redondeados.
 */
export function layoutStack(segments: readonly StackedSegment[], width: number): StackPart[] {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((acc, s) => acc + s.value, 0);
  if (total <= 0 || width <= 0) return [];
  const usable = Math.max(0, width - GAP * (visible.length - 1));
  // Los tramos mínimos se reservan primero para que la suma no se pase del ancho.
  const small = visible.filter((s) => (s.value / total) * usable < MIN_SEGMENT);
  const rest = usable - small.length * MIN_SEGMENT;
  const restTotal = total - small.reduce((acc, s) => acc + s.value, 0);

  let x = 0;
  return visible.map((s, i) => {
    const w = small.includes(s) ? MIN_SEGMENT : restTotal > 0 ? (s.value / restTotal) * rest : 0;
    const corners: RoundedCorners =
      visible.length === 1 ? 'all' : i === 0 ? 'left' : i === visible.length - 1 ? 'right' : 'none';
    const part = { ...s, x, w, corners };
    x += w + GAP;
    return part;
  });
}

export interface StackedBarPlotProps extends Omit<StackedBarProps, 'className'> {
  width: number;
}

/** Alto de la pastilla con el valor de un tramo. */
const VALUE_PILL_H = 16;

/** Ancho de la pastilla para un valor (≈ 6.5 px por dígito a 11 px + márgenes). */
export function valuePillWidth(value: number): number {
  return Math.round(String(value).length * 6.5 + 10);
}

/** La barra ya medida. */
export function StackedBarPlot({ segments, ariaLabel, width, height = 22, showValues = false }: StackedBarPlotProps) {
  const patternId = `hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const parts = layoutStack(segments, width);
  const pillH = Math.min(VALUE_PILL_H, height - 4);
  return (
    <svg role="img" aria-label={ariaLabel} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      {parts.some((p) => p.hatched) && (
        <defs>
          {/* Mismo rayado que las casillas «Necesita práctica» de la tabla (`TIER_TEXTURE`). */}
          <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect x="2.5" width="1.5" height="4" className="fill-surface" />
          </pattern>
        </defs>
      )}
      {parts.length === 0 ? (
        <path d={roundedRectPath(0, 0, width, height, height / 2, 'all')} className="fill-surface-2" />
      ) : (
        parts.map((p) => {
          const d = roundedRectPath(p.x, 0, p.w, height, height / 2, p.corners);
          const pillW = valuePillWidth(p.value);
          const labelled = showValues && p.w >= pillW + 4;
          return (
            <g key={p.key}>
              <title>{`${p.label}: ${p.value}`}</title>
              <path d={d} className={p.fillClass} />
              {p.hatched && <path d={d} fill={`url(#${patternId})`} />}
              {labelled && (
                <g aria-hidden>
                  <rect
                    x={p.x + p.w / 2 - pillW / 2}
                    y={(height - pillH) / 2}
                    width={pillW}
                    height={pillH}
                    rx={pillH / 2}
                    className="fill-surface"
                  />
                  <text
                    x={p.x + p.w / 2}
                    y={height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-fg text-[11px] font-black tabular"
                  >
                    {p.value}
                  </text>
                </g>
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}

/**
 * Barra apilada horizontal (parte de un todo) con 2 px de separación entre tramos y extremos
 * redondeados. Con `showValues`, cada tramo lleva su valor si cabe; la leyenda va aparte.
 */
export function StackedBar({ className, height = 22, ...props }: StackedBarProps) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  return (
    <div ref={ref} className={cn('w-full', className)} style={{ height }}>
      {width > 0 && <StackedBarPlot {...props} height={height} width={width} />}
    </div>
  );
}
