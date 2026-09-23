import { clampTooltipX } from './geometry';

export interface ChartTooltipProps {
  /** Centro horizontal (px) dentro del gráfico. */
  x: number;
  /** Borde inferior del tooltip (px desde arriba del gráfico). */
  y: number;
  width: number;
  title: string;
  value: string;
}

/** Lectura al pasar el cursor: valor destacado y etiqueta secundaria (decorativo: los datos están en la tabla). */
export function ChartTooltip({ x, y, width, title, value }: ChartTooltipProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-surface px-2.5 py-1.5 text-center whitespace-nowrap shadow-float"
      style={{ left: clampTooltipX(x, width), top: Math.max(0, y) }}
    >
      <p className="text-sm leading-tight font-black">{value}</p>
      <p className="text-[11px] leading-tight font-bold text-muted">{title}</p>
    </div>
  );
}
