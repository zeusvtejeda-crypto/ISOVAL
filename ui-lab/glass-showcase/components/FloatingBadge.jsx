import { motion, useReducedMotion } from "framer-motion";

/**
 * Insignia flotante con loop infinito.
 *
 * Dos bucles con duraciones distintas (8.5s y 4.2s) que nunca coinciden:
 * el ojo no llega a detectar el patrón y la flotación parece orgánica en
 * vez de mecánica. Es el mismo motivo por el que el `delay` desincroniza
 * varias insignias entre sí.
 */
export default function FloatingBadge({
  children,
  className = "",
  delay = 0,
  amplitude = 10,
  glow = "56, 224, 208", // aqua
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={`absolute ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay: delay + 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        animate={
          reduced
            ? undefined
            : { y: [0, -amplitude, 0], rotate: [0, 1.2, 0, -1.2, 0] }
        }
        transition={{
          y: { duration: 4.2, repeat: Infinity, ease: "easeInOut", delay },
          rotate: { duration: 8.5, repeat: Infinity, ease: "easeInOut", delay },
        }}
        className="relative"
      >
        {/* Resplandor que late bajo la insignia */}
        <motion.div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-2xl blur-xl"
          style={{ background: `rgba(${glow}, 0.35)` }}
          animate={reduced ? undefined : { opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay }}
        />

        <div
          className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.07]
                     px-4 py-2.5 backdrop-blur-xl
                     shadow-[0_12px_36px_-10px_rgba(0,0,0,.8),inset_0_1px_0_0_rgba(255,255,255,.14)]"
        >
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
