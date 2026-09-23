/**
 * Cuántas fichas caben en una fila de `available` px, dejando sitio para la ficha «+N» si no caben
 * todas. `widths`: ancho de cada ficha; `gap`: separación entre fichas.
 */
export function fittingCount(widths: readonly number[], plusWidth: number, gap: number, available: number): number {
  const all = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);
  if (all <= available) return widths.length;
  let used = plusWidth;
  let count = 0;
  for (const width of widths) {
    if (used + gap + width > available) break;
    used += gap + width;
    count += 1;
  }
  return count;
}
