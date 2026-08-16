import { motion, useReducedMotion, type TargetAndTransition } from "framer-motion";

interface Blob {
  className: string;
  drift: TargetAndTransition;
  duration: number;
}

/**
 * Fondo mesh gradient: manchas de color muy desenfocadas que derivan
 * lentamente sobre un fondo casi negro.
 *
 * Se anima `transform` y nada más — nunca el desenfoque, que obligaría
 * al navegador a repintar el filtro en cada fotograma y es la causa
 * habitual de que estos fondos vayan a tirones.
 */
const BLOBS: Blob[] = [
  {
    className: "bg-iris/40 h-[46rem] w-[46rem] -top-40 -left-32",
    drift: { x: [0, 60, -30, 0], y: [0, -40, 30, 0] },
    duration: 26,
  },
  {
    className: "bg-aqua/25 h-[38rem] w-[38rem] top-1/3 -right-40",
    drift: { x: [0, -50, 25, 0], y: [0, 45, -25, 0] },
    duration: 32,
  },
  {
    className: "bg-rose/25 h-[34rem] w-[34rem] -bottom-48 left-1/4",
    drift: { x: [0, 40, -45, 0], y: [0, -30, 20, 0] },
    duration: 29,
  },
];

export default function MeshBackground() {
  const reduced = useReducedMotion();

  return (
    /* `fixed`, no `absolute`: anclado al documento, las manchas se quedan
       arracimadas arriba y todo lo que viene después se ve apagado.
       Fijo al viewport, la luz ambiental acompaña a la página entera. */
    <div className="grain pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base */}
      <div className="absolute inset-0 bg-ink-950" />

      {/* Manchas de color */}
      {BLOBS.map((blob, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-[110px] ${blob.className}`}
          animate={reduced ? undefined : blob.drift}
          transition={{
            duration: blob.duration,
            repeat: Infinity,
            ease: "easeInOut",
            repeatType: "loop",
          }}
        />
      ))}

      {/* Retícula técnica, muy tenue */}
      <div
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 50% 0%, #000 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, #000 20%, transparent 75%)",
        }}
      />

      {/* Viñeta: hunde los bordes para que el centro respire */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(6,6,10,.85)_100%)]" />
    </div>
  );
}
