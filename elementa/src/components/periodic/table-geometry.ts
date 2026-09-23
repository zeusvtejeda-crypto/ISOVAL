import type { CSSProperties } from 'react';
import { ELEMENTS } from '@/data/elements';
import type { ChemicalElement } from '@/types';
import { F_BLOCK_PLACEHOLDERS, getGridPosition, isInFBlockRow } from '@/utils/table-layout';

/**
 * Geometría de la rejilla de la tabla (pura, calculada una sola vez al cargar el módulo).
 *
 * Filas de `getGridPosition`: 1–7 tabla principal, 8 separador, 9 lantánidos, 10 actínidos.
 * Con ejes visibles se añade una fila de cabecera (números de grupo) y una columna de periodos,
 * así que todo se desplaza +1 en ambas direcciones.
 */

export { ALL_ATOMIC_NUMBERS } from '@/utils/selection';

/** Filas de la rejilla lógica que contienen elementos, de arriba abajo. */
const ELEMENT_ROWS = [1, 2, 3, 4, 5, 6, 7, 9, 10] as const;

const POSITIONS = new Map<number, { col: number; row: number }>(
  ELEMENTS.map((el) => [el.atomicNumber, getGridPosition(el)]),
);

const CELLS = new Map<string, number>(
  ELEMENTS.map((el) => {
    const { col, row } = getGridPosition(el);
    return [`${col},${row}`, el.atomicNumber];
  }),
);

function placement(col: number, row: number, axes: boolean): CSSProperties {
  return axes ? { gridColumn: col + 1, gridRow: row + 1 } : { gridColumn: col, gridRow: row };
}

function buildTileStyles(axes: boolean): Readonly<Record<number, CSSProperties>> {
  const out: Record<number, CSSProperties> = {};
  for (const [z, { col, row }] of POSITIONS) out[z] = placement(col, row, axes);
  return out;
}

/** Estilos de colocación por número atómico (referencias estables: no rompen `memo`). */
export const TILE_PLACEMENT = {
  axes: buildTileStyles(true),
  bare: buildTileStyles(false),
} as const;

export const PLACEHOLDER_PLACEMENT = {
  axes: {
    lanthanides: placement(F_BLOCK_PLACEHOLDERS.lanthanides.col, F_BLOCK_PLACEHOLDERS.lanthanides.row, true),
    actinides: placement(F_BLOCK_PLACEHOLDERS.actinides.col, F_BLOCK_PLACEHOLDERS.actinides.row, true),
  },
  bare: {
    lanthanides: placement(F_BLOCK_PLACEHOLDERS.lanthanides.col, F_BLOCK_PLACEHOLDERS.lanthanides.row, false),
    actinides: placement(F_BLOCK_PLACEHOLDERS.actinides.col, F_BLOCK_PLACEHOLDERS.actinides.row, false),
  },
} as const;

/** Nombre accesible que describe la casilla por su posición (sin revelar el elemento). */
export function positionLabel(el: ChemicalElement): string {
  if (isInFBlockRow(el)) {
    const lanthanide = el.atomicNumber <= 71;
    const index = el.atomicNumber - (lanthanide ? 56 : 88);
    return `Fila de los ${lanthanide ? 'lantánidos' : 'actínidos'}, casilla ${index} de 15`;
  }
  return `Periodo ${el.period}, grupo ${el.group ?? 3}`;
}

export type TableKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

export function isTableKey(key: string): key is TableKey {
  return (
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'Home' ||
    key === 'End'
  );
}

function scanRow(row: number, cols: number[], accept: (z: number) => boolean): number | null {
  for (const col of cols) {
    const z = CELLS.get(`${col},${row}`);
    if (z !== undefined && accept(z)) return z;
  }
  return null;
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  const step = from <= to ? 1 : -1;
  for (let i = from; step > 0 ? i <= to : i >= to; i += step) out.push(i);
  return out;
}

/**
 * Casilla a la que se mueve el foco con las flechas (salta huecos y casillas no aceptadas).
 * Home/End van a la primera/última casilla de la fila.
 */
export function keyTarget(z: number, key: TableKey, accept: (z: number) => boolean): number | null {
  const pos = POSITIONS.get(z);
  if (!pos) return null;
  const { col, row } = pos;
  switch (key) {
    case 'ArrowRight':
      return scanRow(row, range(col + 1, 18), accept);
    case 'ArrowLeft':
      return scanRow(row, range(col - 1, 1), accept);
    case 'Home':
      return scanRow(row, range(1, 18), accept);
    case 'End':
      return scanRow(row, range(18, 1), accept);
    case 'ArrowUp':
    case 'ArrowDown': {
      const idx = ELEMENT_ROWS.indexOf(row as (typeof ELEMENT_ROWS)[number]);
      const rows = key === 'ArrowDown' ? ELEMENT_ROWS.slice(idx + 1) : ELEMENT_ROWS.slice(0, idx).reverse();
      for (const r of rows) {
        const found = CELLS.get(`${col},${r}`);
        if (found !== undefined && accept(found)) return found;
      }
      return null;
    }
  }
}
