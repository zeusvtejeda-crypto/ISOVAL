/**
 * Utilidades de aleatoriedad. Todas aceptan un generador opcional (`rng`) para poder
 * reproducir resultados en pruebas; por defecto usan `Math.random`.
 * No llamar durante el render del servidor (hidratación).
 */

export type Rng = () => number;

/** Devuelve una copia barajada (Fisher–Yates). */
export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** `n` elementos distintos al azar (o todos si hay menos). */
export function sample<T>(arr: readonly T[], n: number, rng: Rng = Math.random): T[] {
  return shuffle(arr, rng).slice(0, Math.max(0, n));
}

/** Un elemento al azar. Lanza si el arreglo está vacío. */
export function pick<T>(arr: readonly T[], rng: Rng = Math.random): T {
  if (arr.length === 0) throw new Error('pick(): arreglo vacío');
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Muestreo ponderado SIN reemplazo. Los pesos ≤ 0 (o no finitos) nunca se eligen
 * mientras queden candidatos con peso positivo; después se completan al azar.
 */
export function weightedSample<T>(
  items: readonly T[],
  weights: readonly number[],
  n: number,
  rng: Rng = Math.random,
): T[] {
  const count = Math.min(Math.max(0, n), items.length);
  const pool = items.map((item, i) => {
    const w = weights[i];
    return { item, w: Number.isFinite(w) && w > 0 ? w : 0 };
  });
  const out: T[] = [];
  while (out.length < count) {
    const total = pool.reduce((acc, p) => acc + p.w, 0);
    let index: number;
    if (total <= 0) {
      index = Math.floor(rng() * pool.length);
    } else {
      let r = rng() * total;
      index = pool.findIndex((p) => {
        r -= p.w;
        return p.w > 0 && r < 0;
      });
      if (index < 0) index = pool.length - 1;
    }
    out.push(pool[index].item);
    pool.splice(index, 1);
  }
  return out;
}

/** Entero aleatorio en [min, max] (ambos incluidos). */
export function randomInt(min: number, max: number, rng: Rng = Math.random): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Identificador único corto (UUID si el entorno lo permite). */
export function uid(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
