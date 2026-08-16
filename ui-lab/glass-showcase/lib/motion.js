/**
 * Vocabulario de movimiento compartido.
 *
 * Tener las curvas y las variantes en un solo sitio es lo que hace que
 * toda la interfaz se sienta como una sola pieza: si cada componente
 * inventa su propia duración, el conjunto se nota descoordinado.
 */

/** Salida suave, sin rebote. La curva de referencia para entradas. */
export const GLIDE = [0.16, 1, 0.3, 1];

/** Muelle para micro-interacciones (hover, tap): responde y asienta rápido. */
export const SPRING = { type: "spring", stiffness: 320, damping: 26, mass: 0.7 };

/** Muelle más blando, para lo que sigue al cursor. */
export const SPRING_SOFT = { type: "spring", stiffness: 150, damping: 20, mass: 0.5 };

/**
 * Contenedor que escalona a sus hijos.
 * @param {number} stagger  segundos entre cada hijo
 * @param {number} delay    retraso antes del primero
 */
export const staggerParent = (stagger = 0.08, delay = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

/** Fade in + slide up: la entrada base de todos los elementos. */
export const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.75, ease: GLIDE },
  },
};

/** Variante para tarjetas: añade un punto de escala al aparecer. */
export const fadeUpScale = {
  hidden: { opacity: 0, y: 34, scale: 0.96, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease: GLIDE },
  },
};

/**
 * Devuelve las variantes ya neutralizadas si el usuario pidió menos
 * movimiento. Aparecer con un fundido corto sigue siendo aceptable;
 * lo que se elimina es el desplazamiento y el desenfoque.
 */
export const respectMotion = (variants, reduced) => {
  if (!reduced) return variants;
  return {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.2 } },
  };
};
