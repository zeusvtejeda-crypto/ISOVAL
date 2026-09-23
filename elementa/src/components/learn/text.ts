/** Columnas literales (para que Tailwind las detecte) para 1–5 casillas. */
const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

export function gridColsClass(n: number): string {
  return GRID_COLS[n] ?? 'grid-cols-5';
}

/** "Hidrógeno, Helio y Litio". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
