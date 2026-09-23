export type ClassValue = string | number | false | null | undefined;

/**
 * Une clases condicionales: `cn('a', cond && 'b', undefined)` → "a b".
 * No resuelve conflictos entre utilidades: usa `className` para márgenes, ancho o posición.
 */
export function cn(...classes: ClassValue[]): string {
  let out = '';
  for (const c of classes) {
    if (!c) continue;
    out = out ? `${out} ${c}` : String(c);
  }
  return out;
}
