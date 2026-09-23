'use client';

import { cn } from '@/components/ui';
import { roundedRectPath, type RoundedCorners } from './geometry';
import { useMeasuredWidth } from './use-measured-width';

export interface StackedSegment {
  key: string;
  label: string;
  value: number;
  /** Clase de relleno SVG (`fill-success`…). */
  fillClass: string;
}

export interface StackedBarProps {
  segments: readonly StackedSegment[];
  ariaLabel: string;
  height?: number;
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

/** La barra ya medida. */
export function StackedBarPlot({ segments, ariaLabel, width, height = 22 }: StackedBarPlotProps) {
  const parts = layoutStack(segments, width);
  return (
    <svg role="img" aria-label={ariaLabel} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      {parts.length === 0 ? (
        <path d={roundedRectPath(0, 0, width, height, height / 2, 'all')} className="fill-surface-2" />
      ) : (
        parts.map((p) => (
          <path key={p.key} d={roundedRectPath(p.x, 0, p.w, height, height / 2, p.corners)} className={p.fillClass}>
            <title>{`${p.label}: ${p.value}`}</title>
          </path>
        ))
      )}
    </svg>
  );
}

/**
 * Barra apilada horizontal (parte de un todo) con 2 px de separación entre tramos y extremos
 * redondeados. La leyenda con los valores se muestra aparte.
 */
export function StackedBar({ className, height = 22, ...props }: StackedBarProps) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  return (
    <div ref={ref} className={cn('w-full', className)} style={{ height }}>
      {width > 0 && <StackedBarPlot {...props} height={height} width={width} />}
    </div>
  );
}
