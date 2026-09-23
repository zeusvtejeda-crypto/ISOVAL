import { ELEMENTS } from '@/data/elements';
import type { ChemicalElement } from '@/types';
import { normalizeText } from './format';

interface Indexed {
  el: ChemicalElement;
  symbol: string;
  names: string[];
}

const INDEX: Indexed[] = ELEMENTS.map((el) => ({
  el,
  symbol: el.symbol.toLowerCase(),
  names: [el.name, ...el.altNames].map(normalizeText),
}));

function score(entry: Indexed, q: string): number | null {
  if (entry.symbol === q) return 0;
  if (entry.names.some((n) => n === q)) return 1;
  if (entry.names.some((n) => n.startsWith(q))) return 2;
  if (entry.symbol.startsWith(q)) return 3;
  if (entry.names.some((n) => n.includes(q))) return 4;
  return null;
}

/**
 * Busca por símbolo exacto ("Au", sin distinguir mayúsculas), número ("79") o nombre / nombre
 * alternativo sin acentos ("oro", "tungsteno"). Prefijos antes que subcadenas.
 */
export function searchElements(query: string, limit = 8): ChemicalElement[] {
  const q = normalizeText(query);
  if (!q) return [];

  if (/^\d+$/.test(q)) {
    const exact = Number(q);
    return ELEMENTS.filter((el) => String(el.atomicNumber).startsWith(q))
      .sort((a, b) => {
        if (a.atomicNumber === exact) return -1;
        if (b.atomicNumber === exact) return 1;
        return a.atomicNumber - b.atomicNumber;
      })
      .slice(0, limit);
  }

  const hits: Array<{ el: ChemicalElement; s: number }> = [];
  for (const entry of INDEX) {
    const s = score(entry, q);
    if (s !== null) hits.push({ el: entry.el, s });
  }
  return hits
    .sort((a, b) => a.s - b.s || a.el.atomicNumber - b.el.atomicNumber)
    .slice(0, limit)
    .map((h) => h.el);
}
