import { getElement } from '@/data/elements';
import type { ChemicalElement } from '@/types';

export type Difficulty = 1 | 2 | 3;

/** Elementos famosos fuera de los 20 primeros (se consideran fáciles). */
const FAMOUS = new Set([26, 29, 30, 47, 50, 53, 79, 80, 82, 92]);

/** Elementos del bloque d/p poco conocidos (se consideran difíciles). */
const OBSCURE = new Set([43, 72, 73, 75, 76, 77, 81, 84, 85, 87]);

/**
 * Dificultad intrínseca de un elemento:
 * 1 = comunes (Z ≤ 20 y famosos como Fe, Cu, Ag, Au, Hg, Pb, Sn, Zn, I, U),
 * 3 = bloque f, superpesados (Z ≥ 104) y otros poco conocidos, 2 = el resto.
 */
export function elementDifficulty(elOrZ: ChemicalElement | number): Difficulty {
  const el = typeof elOrZ === 'number' ? getElement(elOrZ) : elOrZ;
  const z = el.atomicNumber;
  if (z <= 20 || FAMOUS.has(z)) return 1;
  if (el.block === 'f' || z >= 104 || OBSCURE.has(z)) return 3;
  return 2;
}

export function maxDifficulty(a: Difficulty, b: Difficulty): Difficulty {
  return a >= b ? a : b;
}
