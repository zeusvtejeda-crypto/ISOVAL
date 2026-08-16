import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { SPRING, SPRING_SOFT, fadeUpScale, respectMotion } from "../lib/motion";

/**
 * Tarjeta glassmorphism con resplandor dinámico ligado al cursor.
 *
 * Cómo funciona el brillo, que es la parte interesante:
 *
 *  1. La posición del puntero se guarda en MotionValues, NO en estado de
 *     React. Mover el ratón no provoca ni un render: Framer Motion
 *     escribe directo en el DOM. Es la diferencia entre 60fps y un
 *     componente que se atraganta.
 *
 *  2. Esa posición alimenta dos capas:
 *     · el halo interior — un degradado radial suave sobre el relleno.
 *     · el borde vivo — el mismo degradado, pero recortado a 1px con la
 *       máscara XOR de `.ring-mask` (ver index.css).
 *
 *  3. Las coordenadas pasan por un muelle blando, así el brillo persigue
 *     al cursor con algo de inercia en vez de ir pegado a él. Ese pequeño
 *     retraso es lo que lo hace sentir físico.
 */
export default function SpotlightCard({
  children,
  className = "",
  glow = "124, 92, 255", // RGB del resplandor; por defecto, iris
  lift = -8,
  ...props
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const opacity = useMotionValue(0);

  const x = useSpring(rawX, SPRING_SOFT);
  const y = useSpring(rawY, SPRING_SOFT);

  // Un solo degradado reutilizado por las dos capas.
  const spotlight = useMotionTemplate`radial-gradient(260px circle at ${x}px ${y}px, rgba(${glow}, 0.55), transparent 70%)`;
  const bloom = useMotionTemplate`radial-gradient(340px circle at ${x}px ${y}px, rgba(${glow}, 0.14), transparent 65%)`;

  function handlePointerMove(e) {
    if (reduced) return;
    const rect = ref.current.getBoundingClientRect();
    rawX.set(e.clientX - rect.left);
    rawY.set(e.clientY - rect.top);
  }

  return (
    <motion.div
      ref={ref}
      variants={respectMotion(fadeUpScale, reduced)}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => opacity.set(1)}
      onPointerLeave={() => opacity.set(0)}
      whileHover={reduced ? undefined : { y: lift, scale: 1.015 }}
      whileTap={reduced ? undefined : { scale: 0.995 }}
      transition={SPRING}
      className={[
        "group relative isolate overflow-hidden rounded-3xl",
        // El cristal: fondo casi transparente + desenfoque de lo que hay detrás
        "border border-white/10 bg-white/[0.035] backdrop-blur-2xl",
        // Sombra profunda + luz interior en el borde superior
        "shadow-[0_20px_60px_-20px_rgba(0,0,0,.9),inset_0_1px_0_0_rgba(255,255,255,.09)]",
        className,
      ].join(" ")}
      {...props}
    >
      {/* Halo interior */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500"
        style={{ background: bloom, opacity }}
      />

      {/* Borde vivo: el degradado recortado al contorno */}
      <motion.div
        aria-hidden
        className="ring-mask pointer-events-none absolute inset-0 rounded-3xl p-px transition-opacity duration-500"
        style={{ background: spotlight, opacity }}
      />

      {/* Reflejo diagonal fijo, como el de un cristal real */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />

      <div className="relative">{children}</div>
    </motion.div>
  );
}
