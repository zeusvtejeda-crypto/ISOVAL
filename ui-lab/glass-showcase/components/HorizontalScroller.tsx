import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { useIsDesktopPointer } from "../lib/useMediaQuery";

export interface HorizontalScrollerProps {
  children: ReactNode;
  /** Cabecera fija sobre la pista. */
  heading?: ReactNode;
  className?: string;
}

/** useLayoutEffect avisa en SSR; en servidor no hay nada que medir. */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Margen final como elemento real, no como `padding-right`.
 *
 * En un contenedor que desborda, los navegadores no cuentan el padding
 * derecho dentro de `scrollWidth`. Con `px-6` la última tarjeta acababa
 * clavada contra el borde de la pantalla al final del recorrido. Un
 * elemento flex sí se mide, así que el margen sobrevive.
 */
const EndSpacer = () => <div aria-hidden className="w-6 shrink-0" />;

/**
 * Panel de scroll horizontal ligado al scroll vertical.
 *
 * En escritorio: la sección es más alta que la pantalla, dentro hay un
 * contenedor `sticky` y la pista se desplaza en X según el progreso del
 * scroll. No se secuestra el evento — el usuario sigue haciendo scroll
 * normal, sólo que se traduce a movimiento lateral. Nada de
 * `preventDefault`, así que la rueda, el trackpad, las flechas y la barra
 * de scroll siguen funcionando como espera el sistema.
 *
 * En táctil (y con movimiento reducido): NO se hace nada de eso. Se
 * entrega una fila con scroll nativo y `scroll-snap`. Convertir el gesto
 * vertical del dedo en movimiento lateral rompe la expectativa de la
 * plataforma y arruina el scroll con inercia; el gesto nativo es mejor.
 *
 * ── Dos detalles que no son opcionales ─────────────────────────────
 *
 * 1. La rama la decide SÓLO la capacidad del dispositivo, nunca la
 *    medición. Si `travel` entrara en la condición se crea un bucle:
 *    medir cambia de rama, cambiar de rama vuelve a medir. La medición
 *    ajusta la altura de la sección, no qué se renderiza.
 *
 * 2. El nodo medido se guarda en estado con una ref de callback, no en
 *    `useRef`. Al cambiar de rama, React monta un elemento distinto; con
 *    una ref normal el efecto no se entera, el ResizeObserver se queda
 *    observando el nodo viejo — y un elemento desconectado del DOM
 *    reporta ancho 0. El guardia `isConnected` cubre la carrera que
 *    queda entre el desmontaje y la baja del observer.
 */
export default function HorizontalScroller({
  children,
  heading,
  className = "",
}: HorizontalScrollerProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null);
  const [travel, setTravel] = useState(0);

  const reduced = useReducedMotion();
  const isDesktop = useIsDesktopPointer();
  const hijack = isDesktop && !reduced;

  /* Recorrido = lo que sobresale de la pista respecto al viewport. */
  useIsomorphicLayoutEffect(() => {
    if (!trackEl) return;

    const measure = () => {
      if (!trackEl.isConnected) return;
      setTravel(Math.max(0, trackEl.scrollWidth - window.innerWidth));
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(trackEl);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [trackEl]);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  /* El muelle quita el "pegado" del scroll nativo: la pista llega al
     destino con un asentamiento suave en lugar de clavarse. */
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.4,
    restDelta: 0.0005,
  });

  const x = useTransform(progress, [0, 1], [0, -travel]);
  const barScale = useTransform(progress, [0, 1], [0, 1]);

  /* ── Táctil / movimiento reducido: scroll nativo con snap ───────── */
  if (!hijack) {
    return (
      <section className={`relative py-20 ${className}`}>
        {heading && <div className="mx-auto mb-10 max-w-6xl px-6">{heading}</div>}
        <div
          ref={setTrackEl}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-6
                     [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
          <EndSpacer />
        </div>
      </section>
    );
  }

  /* ── Escritorio: sticky + desplazamiento en X ────────────────────── */
  return (
    <section
      ref={sectionRef}
      className={`relative ${className}`}
      // Altura = una pantalla para el sticky + el recorrido a consumir.
      style={{ height: `calc(100vh + ${travel}px)` }}
    >
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        {heading && <div className="mx-auto mb-10 w-full max-w-6xl px-6">{heading}</div>}

        <motion.div
          ref={setTrackEl}
          style={{ x }}
          className="flex gap-5 px-6 will-change-transform"
        >
          {children}
          <EndSpacer />
        </motion.div>

        {/* Indicador de avance */}
        <div className="mx-auto mt-10 h-px w-full max-w-6xl px-6">
          <div className="h-px w-full overflow-hidden bg-white/10">
            <motion.div
              style={{ scaleX: barScale }}
              className="h-full w-full origin-left bg-gradient-to-r from-iris via-aqua to-rose"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
