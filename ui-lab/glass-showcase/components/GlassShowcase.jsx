import { motion, useReducedMotion } from "framer-motion";
import MeshBackground from "./MeshBackground";
import SpotlightCard from "./SpotlightCard";
import FloatingBadge from "./FloatingBadge";
import CountUp from "./CountUp";
import {
  GLIDE,
  SPRING,
  staggerParent,
  fadeUp,
  respectMotion,
} from "../lib/motion";

/* ── Datos de ejemplo ─────────────────────────────────────────── */

const CARDS = [
  {
    tag: "01 — Rendimiento",
    title: "Render en 12 ms",
    body: "Cada interacción se resuelve en el hilo de composición. Sin bloqueos, sin fotogramas perdidos.",
    glow: "124, 92, 255",
    icon: (
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinejoin="round" strokeLinecap="round" />
    ),
  },
  {
    tag: "02 — Diseño",
    title: "Sistema vivo",
    body: "Tokens compartidos entre color, espacio y movimiento. Un cambio y toda la interfaz responde.",
    glow: "56, 224, 208",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18" />
      </>
    ),
  },
  {
    tag: "03 — Escala",
    title: "Listo para crecer",
    body: "Componentes desacoplados que aguantan desde la landing hasta el panel más denso.",
    glow: "255, 92, 138",
    icon: (
      <>
        <path d="M4 20V9M10 20V4M16 20v-7M22 20V11" strokeLinecap="round" />
      </>
    ),
  },
];

const BARS = [42, 68, 55, 88, 74, 96];

/* ── Sección ──────────────────────────────────────────────────── */

export default function GlassShowcase() {
  const reduced = useReducedMotion();
  const v = (variants) => respectMotion(variants, reduced);

  return (
    <section className="relative isolate min-h-screen overflow-hidden px-6 py-24 sm:px-10 lg:py-32">
      <MeshBackground />

      <motion.div
        variants={staggerParent(0.09, 0.15)}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl"
      >
        {/* ── Encabezado ───────────────────────────────────────── */}
        <header className="relative mx-auto max-w-3xl text-center">
          <motion.div variants={v(fadeUp)} className="flex justify-center">
            <span
              className="inline-flex items-center gap-2.5 rounded-full border border-white/12
                         bg-white/[0.05] px-4 py-1.5 text-xs font-medium tracking-[0.14em]
                         text-mist-dim uppercase backdrop-blur-xl"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aqua opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aqua" />
              </span>
              Versión 2.0 disponible
            </span>
          </motion.div>

          <motion.h1
            variants={v(fadeUp)}
            className="mt-8 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em]
                       text-mist sm:text-6xl lg:text-7xl"
          >
            Interfaces que se
            <span className="relative ml-3 inline-block">
              <span className="bg-gradient-to-r from-iris via-aqua to-rose bg-clip-text text-transparent">
                sienten
              </span>
              {/* Subrayado que se dibuja después del título */}
              <motion.span
                aria-hidden
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1, delay: 0.9, ease: GLIDE }}
                className="absolute -bottom-1 left-0 h-px w-full origin-left
                           bg-gradient-to-r from-iris via-aqua to-transparent"
              />
            </span>
          </motion.h1>

          <motion.p
            variants={v(fadeUp)}
            className="mx-auto mt-7 max-w-xl text-pretty text-base leading-relaxed text-mist-dim sm:text-lg"
          >
            Un sistema de componentes en cristal, luz y movimiento. Pensado para
            productos donde el detalle es el argumento de venta.
          </motion.p>

          <motion.div
            variants={v(fadeUp)}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <motion.a
              href="#"
              whileHover={reduced ? undefined : { y: -2, scale: 1.03 }}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              transition={SPRING}
              className="group relative overflow-hidden rounded-full bg-mist px-7 py-3.5
                         text-sm font-semibold text-ink-950
                         shadow-[0_10px_40px_-12px_rgba(232,233,243,.5)]"
            >
              <span className="relative z-10">Empezar ahora</span>
              {/* Barrido de luz al pasar el cursor */}
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r
                           from-transparent via-iris/30 to-transparent
                           transition-transform duration-700 group-hover:translate-x-full"
              />
            </motion.a>

            <motion.a
              href="#"
              whileHover={reduced ? undefined : { y: -2, scale: 1.03 }}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              transition={SPRING}
              className="rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5
                         text-sm font-medium text-mist backdrop-blur-xl
                         transition-colors hover:border-white/30 hover:bg-white/[0.08]"
            >
              Ver documentación
            </motion.a>
          </motion.div>

          {/* Insignias flotantes — ocultas en móvil, donde no hay sitio */}
          <FloatingBadge
            className="left-[-3rem] top-16 hidden lg:block"
            delay={0.2}
            glow="124, 92, 255"
          >
            <span className="text-lg leading-none">◆</span>
            <div className="text-left">
              <div className="text-[11px] leading-tight text-mist-dim">Fotogramas</div>
              <div className="text-sm font-semibold leading-tight text-mist">60 fps</div>
            </div>
          </FloatingBadge>

          <FloatingBadge
            className="right-[-4rem] top-40 hidden lg:block"
            delay={1.1}
            amplitude={13}
            glow="255, 92, 138"
          >
            <div className="text-left">
              <div className="text-[11px] leading-tight text-mist-dim">Satisfacción</div>
              <div className="text-sm font-semibold leading-tight text-mist">
                <CountUp to={98} suffix="%" />
              </div>
            </div>
          </FloatingBadge>
        </header>

        {/* ── Rejilla de tarjetas ──────────────────────────────── */}
        <motion.div
          variants={staggerParent(0.1, 0.35)}
          className="mt-20 grid gap-5 sm:grid-cols-2 lg:mt-28 lg:grid-cols-3"
        >
          {CARDS.map((card) => (
            <SpotlightCard key={card.tag} glow={card.glow} className="p-7">
              <div
                className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl
                           border border-white/10 bg-white/[0.05]"
                style={{ color: `rgb(${card.glow})` }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="h-5 w-5"
                  aria-hidden
                >
                  {card.icon}
                </svg>
              </div>

              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist-dim">
                {card.tag}
              </p>
              <h3 className="mt-2.5 text-xl font-semibold tracking-[-0.02em] text-mist">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-mist-dim">{card.body}</p>

              <span
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-mist
                           transition-transform duration-300 group-hover:translate-x-1"
              >
                Explorar
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M2 8h11M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </SpotlightCard>
          ))}
        </motion.div>

        {/* ── Panel ancho con cifras y gráfico ─────────────────── */}
        <motion.div variants={staggerParent(0.1, 0.15)} className="mt-5">
          <SpotlightCard glow="124, 92, 255" lift={-5} className="p-8 sm:p-10">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <h3 className="text-2xl font-semibold tracking-[-0.025em] text-mist sm:text-3xl">
                  Medido, no prometido
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-mist-dim">
                  Cada número sale de trazas reales de producción, no de una
                  demo en local con la caché caliente.
                </p>

                <dl className="mt-8 grid grid-cols-3 gap-6">
                  {[
                    { k: "Latencia", to: 12, suffix: " ms" },
                    { k: "Bundle", to: 34.6, suffix: " kB", decimals: 1 },
                    { k: "Lighthouse", to: 100, suffix: "" },
                  ].map((s) => (
                    <div key={s.k}>
                      <dt className="text-[11px] uppercase tracking-[0.16em] text-mist-dim">
                        {s.k}
                      </dt>
                      <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-mist">
                        <CountUp to={s.to} suffix={s.suffix} decimals={s.decimals ?? 0} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Gráfico: las barras crecen desde la base al entrar */}
              <div className="flex h-40 items-end justify-between gap-2.5 sm:gap-3">
                {BARS.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={reduced ? { height: `${h}%` } : { height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true, margin: "-10%" }}
                    transition={{
                      duration: 0.9,
                      delay: reduced ? 0 : i * 0.07,
                      ease: GLIDE,
                    }}
                    className="w-full rounded-t-md bg-gradient-to-t from-iris/15 via-iris/50 to-aqua/70"
                  />
                ))}
              </div>
            </div>
          </SpotlightCard>
        </motion.div>
      </motion.div>
    </section>
  );
}
