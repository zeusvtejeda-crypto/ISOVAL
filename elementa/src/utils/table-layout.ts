import { ELEMENTS } from '@/data/elements';
import type { ChemicalElement } from '@/types';

export interface GridPosition {
  /** Columna 1–18. */
  col: number;
  /** Fila 1–7 tabla principal; 9 lantánidos; 10 actínidos (la 8 es separador). */
  row: number;
}

export type NeighborDirection = 'up' | 'down' | 'left' | 'right';

/** Casillas de la tabla principal que remiten a las filas del bloque f. */
export const F_BLOCK_PLACEHOLDERS = {
  lanthanides: { col: 3, row: 6, label: '57–71' },
  actinides: { col: 3, row: 7, label: '89–103' },
} as const;

export const GRID_COLUMNS = 18;
export const GRID_ROWS = 10;

function isLanthanideRow(z: number): boolean {
  return z >= 57 && z <= 71;
}

function isActinideRow(z: number): boolean {
  return z >= 89 && z <= 103;
}

/** `true` si el elemento se dibuja en las filas separadas del bloque f. */
export function isInFBlockRow(el: Pick<ChemicalElement, 'atomicNumber'>): boolean {
  return isLanthanideRow(el.atomicNumber) || isActinideRow(el.atomicNumber);
}

export function getGridPosition(el: ChemicalElement): GridPosition {
  const z = el.atomicNumber;
  if (isLanthanideRow(z)) return { col: 3 + (z - 57), row: 9 };
  if (isActinideRow(z)) return { col: 3 + (z - 89), row: 10 };
  return { col: el.group ?? 3, row: el.period };
}

const MAIN_TABLE: Map<string, ChemicalElement> = new Map(
  ELEMENTS.filter((el) => !isInFBlockRow(el)).map((el) => {
    const { col, row } = getGridPosition(el);
    return [`${col},${row}`, el];
  }),
);

const DELTAS: Record<NeighborDirection, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Elemento en la casilla contigua de la tabla principal, o `null` si no hay uno real. */
export function getNeighbor(el: ChemicalElement, dir: NeighborDirection): ChemicalElement | null {
  if (isInFBlockRow(el)) return null;
  const { col, row } = getGridPosition(el);
  const [dc, dr] = DELTAS[dir];
  return MAIN_TABLE.get(`${col + dc},${row + dr}`) ?? null;
}

/** Elemento de la tabla principal en (col, fila), si existe. */
export function elementAt(col: number, row: number): ChemicalElement | null {
  return MAIN_TABLE.get(`${col},${row}`) ?? null;
}
