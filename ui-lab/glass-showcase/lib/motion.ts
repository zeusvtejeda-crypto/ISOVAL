import type { Variants, Transition } from "framer-motion";

/**
 * Vocabulario de movimiento compartido.
 *
 * Tener las curvas y las variantes en un solo sitio es lo que hace que
 * toda la interfaz se sienta como una sola pieza: si cada componente
 * inventa su propia duración, el conjunto se nota descoordinado.
 */

/** Salida suave, sin rebote. La curva de referencia para entradas. */
export const GLIDE = [0.16, 1, 0.3, 1] as const;

/** Muelle para micro-interacciones (hover, tap): responde y asienta rápido. */
export const SPRING: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 26,
  mass: 0.7,
};

/** Muelle más blando, para lo que sigue al cursor. */
export const SPRING_SOFT = {
  stiffness: 150,
  damping: 20,
  mass: 0.5,
} as const;

/** Muelle con algo de cuerpo, para la entrada de superficies grandes. */
export const SPRING_PANEL: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 28,
  mass: 0.9,
};

/**
 * Contenedor que escalona a sus hijos.
 *
 * @param stagger segundos entre cada hijo
 * @param delay   retraso antes del primero
 */
export const staggerParent = (stagger = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

/** Fade in + slide up: la entrada base de todos los elementos. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.75, ease: GLIDE },
  },
};

/** Variante para tarjetas: añade un punto de escala al aparecer. */
export const fadeUpScale: Variants = {
  hidden: { opacity: 0, y: 34, scale: 0.96, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease: GLIDE },
  },
};

/** Entrada mínima, para cuando el sistema pide menos movimiento. */
const REDUCED: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

/**
 * Devuelve las variantes ya neutralizadas si el usuario pidió menos
 * movimiento. Aparecer con un fundido corto sigue siendo aceptable;
 * lo que se elimina es el desplazamiento y el desenfoque.
 *
 * `useReducedMotion()` devuelve `boolean | null` (null mientras no se ha
 * resuelto), por eso el parámetro acepta null.
 */
export const respectMotion = (
  variants: Variants,
  reduced: boolean | null,
): Variants => (reduced ? REDUCED : variants);

/** Colores de resplandor, en el formato "R, G, B" que espera SpotlightCard. */
export const GLOW = {
  iris: "124, 92, 255",
  aqua: "56, 224, 208",
  rose: "255, 92, 138",
} as const;

export type GlowColor = (typeof GLOW)[keyof typeof GLOW] | (string & {});
