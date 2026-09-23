/** Esquinas redondeadas de una barra: la punta de datos se redondea y la base queda recta. */
export type RoundedCorners = 'top' | 'left' | 'right' | 'all' | 'none';

function fmt(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '0';
}

/** Trazado SVG de un rectángulo con radio `r` solo en las esquinas indicadas. */
export function roundedRectPath(x: number, y: number, w: number, h: number, r: number, corners: RoundedCorners): string {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  const rad = Math.max(0, Math.min(r, width / 2, height / (corners === 'top' ? 1 : 2)));
  const tl = corners === 'top' || corners === 'left' || corners === 'all' ? rad : 0;
  const tr = corners === 'top' || corners === 'right' || corners === 'all' ? rad : 0;
  const br = corners === 'right' || corners === 'all' ? rad : 0;
  const bl = corners === 'left' || corners === 'all' ? rad : 0;
  const x2 = x + width;
  const y2 = y + height;
  return [
    `M${fmt(x + tl)},${fmt(y)}`,
    `H${fmt(x2 - tr)}`,
    tr ? `Q${fmt(x2)},${fmt(y)} ${fmt(x2)},${fmt(y + tr)}` : '',
    `V${fmt(y2 - br)}`,
    br ? `Q${fmt(x2)},${fmt(y2)} ${fmt(x2 - br)},${fmt(y2)}` : '',
    `H${fmt(x + bl)}`,
    bl ? `Q${fmt(x)},${fmt(y2)} ${fmt(x)},${fmt(y2 - bl)}` : '',
    `V${fmt(y + tl)}`,
    tl ? `Q${fmt(x)},${fmt(y)} ${fmt(x + tl)},${fmt(y)}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Tramos consecutivos de valores no nulos (los días sin actividad cortan la línea). */
export function segments<T>(values: ReadonlyArray<T | null>): Array<Array<{ index: number; value: T }>> {
  const out: Array<Array<{ index: number; value: T }>> = [];
  let run: Array<{ index: number; value: T }> = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (run.length > 0) out.push(run);
      run = [];
    } else {
      run.push({ index, value });
    }
  });
  if (run.length > 0) out.push(run);
  return out;
}

/** Posición horizontal del tooltip, dentro del gráfico. */
export function clampTooltipX(x: number, width: number, half = 70): number {
  if (width <= half * 2) return width / 2;
  return Math.min(width - half, Math.max(half, x));
}
