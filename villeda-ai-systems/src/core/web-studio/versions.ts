import type { SiteSpec } from "./spec";
export type Version = { n: number; spec: SiteSpec; note: string; at: string };
/** Historial inmutable: guardar agrega; restaurar crea una versión nueva (no borra historia). */
export const save = (h: Version[], spec: SiteSpec, note: string, at = new Date().toISOString()): Version[] => [...h, { n: (h.at(-1)?.n ?? 0) + 1, spec, note, at }];
export function restore(h: Version[], n: number, at?: string): Version[] {
  const v = h.find((x) => x.n === n); if (!v) throw new Error(`Versión ${n} no existe`);
  return save(h, v.spec, `Restaurada v${n}`, at);
}
