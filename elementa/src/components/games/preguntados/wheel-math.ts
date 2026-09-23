import { TRIVIA_CATEGORIES, categoryIndex, type TriviaCategoryId } from './categories';

/** Radio de la ruleta en unidades del viewBox (−172…172). */
export const WHEEL_RADIUS = 150;
/** Grados de cada gajo. */
export const SEGMENT = 360 / TRIVIA_CATEGORIES.length;
/** Vueltas completas de cada giro. */
export const WHEEL_TURNS = 5;
/** Curva de la ruleta: arranque rápido y frenada larga. */
export const WHEEL_EASING = 'cubic-bezier(0.12, 0.72, 0.16, 1)';

/** Punto a `radius` y `deg` grados en sentido horario desde arriba. */
function polar(radius: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [radius * Math.cos(rad), radius * Math.sin(rad)];
}

/** Gajos (calculados una vez; deterministas para el render del servidor). */
export const PATHS: readonly string[] = TRIVIA_CATEGORIES.map((_, i) => {
  const [x0, y0] = polar(WHEEL_RADIUS, i * SEGMENT);
  const [x1, y1] = polar(WHEEL_RADIUS, (i + 1) * SEGMENT);
  return `M0 0L${x0.toFixed(2)} ${y0.toFixed(2)}A${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
});

/** Bombillas del borde. */
export const BULBS: readonly [number, number][] = Array.from({ length: 18 }, (_, i) => {
  const [x, y] = polar(WHEEL_RADIUS + 9, i * 20);
  return [Number(x.toFixed(2)), Number(y.toFixed(2))];
});

const mod360 = (deg: number) => ((deg % 360) + 360) % 360;

/**
 * Rotación final (horaria, en grados) para que el puntero de arriba caiga en `id` tras `turns`
 * vueltas completas desde `current`. `jitter` (−0.5…0.5) desplaza la parada dentro del gajo.
 */
export function wheelTarget(current: number, id: TriviaCategoryId, jitter: number, turns = 5): number {
  const center = categoryIndex(id) * SEGMENT + SEGMENT / 2 + Math.max(-0.5, Math.min(0.5, jitter)) * SEGMENT * 0.6;
  const delta = mod360(mod360(-center) - mod360(current));
  return current + turns * 360 + delta;
}

/** Categoría bajo el puntero con la ruleta girada `rotation` grados. */
export function categoryAtPointer(rotation: number): TriviaCategoryId {
  const angle = mod360(-rotation);
  return TRIVIA_CATEGORIES[Math.floor(angle / SEGMENT) % TRIVIA_CATEGORIES.length].id;
}

/**
 * Momentos (ms) de los «clics» de la ruleta: uno por gajo que pasa bajo el puntero, cada vez más
 * espaciados al frenar (inversa aproximada de una curva ease-out cúbica).
 */
export function wheelTickTimes(spinMs: number): number[] {
  const crossings = WHEEL_TURNS * TRIVIA_CATEGORIES.length + 3;
  const out: number[] = [];
  let last = -Infinity;
  for (let k = 1; k <= crossings; k++) {
    const p = k / (crossings + 1);
    const t = spinMs * (1 - Math.cbrt(1 - p));
    if (t - last >= 70) {
      out.push(Math.round(t));
      last = t;
    }
  }
  return out;
}
