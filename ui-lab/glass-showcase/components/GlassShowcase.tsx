import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import MeshBackground from "./MeshBackground";
import SpotlightCard from "./SpotlightCard";
import FloatingBadge from "./FloatingBadge";
import CountUp from "./CountUp";
import HorizontalScroller from "./HorizontalScroller";
import GlassModal from "./GlassModal";
import {
  GLIDE,
  GLOW,
  SPRING,
  staggerParent,
  fadeUp,
  respectMotion,
  type GlowColor,
} from "../lib/motion";

/* ── Datos de ejemplo ─────────────────────────────────────────── */

interface Card {
  tag: string;
  title: string;
  body: string;
  glow: GlowColor;
  icon: ReactNode;
}

const CARDS: Card[] = [
  {
    tag: "01 — Rendimiento",
    title: "Render en 12 ms",
    body: "Cada interacción se resuelve en el hilo de composición. Sin bloqueos, sin fotogramas perdidos.",
    glow: GLOW.iris,
    icon: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinejoin="round" strokeLinecap="round" />,
  },
  {
    tag: "02 — Diseño",
    title: "Sistema vivo",
    body: "Tokens compartidos entre color, espacio y movimiento. Un cambio y toda la interfaz responde.",
    glow: GLOW.aqua,
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
    glow: GLOW.rose,
    icon: <path d="M4 20V9M10 20V4M16 20v-7M22 20V11" strokeLinecap="round" />,
  },
];

const BARS = [42, 68, 55, 88, 74, 96];

interface Slide {
  n: string;
  title: string;
  body: string;
  glow: GlowColor;
}

const SLIDES: Slide[] = [
  { n: "01", title: "Descubrimiento", body: "Auditamos el producto actual y marcamos dónde se pierde la atención.", glow: GLOW.iris },
  { n: "02", title: "Dirección", body: "Una sola ruta visual, defendida con prototipos en movimiento, no con capturas.", glow: GLOW.aqua },
  { n: "03", title: "Sistema", body: "Tokens, componentes y reglas de movimiento que el equipo puede sostener sin nosotros.", glow: GLOW.rose },
  { n: "04", title: "Implementación", body: "Código de producción, accesible y medido. Nada de maquetas que luego hay que rehacer.", glow: GLOW.iris },
  { n: "05", title: "Medición", body: "Trazas reales, presupuesto de rendimiento y una lista corta de lo que hay que afinar.", glow: GLOW.aqua },
];

/* ── Sección ──────────────────────────────────────────────────── */

export default function GlassShowcase() {
  const reduced = useReducedMotion();
  const [modalOpen, setModalOpen] = useState(false);
  const v = (variants: Parameters<typeof respectMotion>[0]) =>
    respectMotion(variants, reduced);

  return (
    <div className="relative isolate overflow-x-clip">
      <MeshBackground />

      {/* ══════════ HERO ══════════ */}
      <section className="px-6 py-24 sm:px-10 lg:py-32">
        <motion.div
          variants={staggerParent(0.09, 0.15)}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-6xl"
        >
          <header className="relative mx-auto max-w-3xl text-center">
            <motion.div variants={v(fadeUp)} className="flex justify-center">
              <span
                className="inline-flex items-center gap-2.5 rounded-full border border-white/12
                           bg-white/[0.05] px-4 py-1.5 text-xs font-medium uppercase
                           tracking-[0.14em] text-mist-dim backdrop-blur-xl"
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
              <motion.button
                type="button"
                onClick={() => setModalOpen(true)}
                whileHover={reduced ? undefined : { y: -2, scale: 1.03 }}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                transition={SPRING}
                className="group relative overflow-hidden rounded-full bg-mist px-7 py-3.5
                           text-sm font-semibold text-ink-950
                           shadow-[0_10px_40px_-12px_rgba(232,233,243,.5)]"
              >
                <span className="relative z-10">Empezar ahora</span>
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r
                             from-transparent via-iris/30 to-transparent
                             transition-transform duration-700 group-hover:translate-x-full"
                />
              </motion.button>

              <motion.a
                href="#proceso"
                whileHover={reduced ? undefined : { y: -2, scale: 1.03 }}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                transition={SPRING}
                className="rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5
                           text-sm font-medium text-mist backdrop-blur-xl
                           transition-colors hover:border-white/30 hover:bg-white/[0.08]"
              >
                Ver el proceso
              </motion.a>
            </motion.div>

            <FloatingBadge className="left-[-3rem] top-16 hidden lg:block" delay={0.2} glow={GLOW.iris}>
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
              glow={GLOW.rose}
            >
              <div className="text-left">
                <div className="text-[11px] leading-tight text-mist-dim">Satisfacción</div>
                <div className="text-sm font-semibold leading-tight text-mist">
                  <CountUp to={98} suffix="%" />
                </div>
              </div>
            </FloatingBadge>
          </header>

          {/* ══════════ TARJETAS ══════════ */}
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
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden>
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

                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-mist transition-transform duration-300 group-hover:translate-x-1">
                  Explorar
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <path d="M2 8h11M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </SpotlightCard>
            ))}
          </motion.div>

          {/* ══════════ PANEL DE CIFRAS ══════════ */}
          <motion.div variants={staggerParent(0.1, 0.15)} className="mt-5">
            <SpotlightCard glow={GLOW.iris} lift={-5} className="p-8 sm:p-10">
              <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.025em] text-mist sm:text-3xl">
                    Medido, no prometido
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-mist-dim">
                    Cada número sale de trazas reales de producción, no de una demo
                    en local con la caché caliente.
                  </p>

                  <dl className="mt-8 grid grid-cols-3 gap-6">
                    {[
                      { k: "Latencia", to: 12, suffix: " ms", decimals: 0 },
                      { k: "Bundle", to: 34.6, suffix: " kB", decimals: 1 },
                      { k: "Lighthouse", to: 100, suffix: "", decimals: 0 },
                    ].map((s) => (
                      <div key={s.k}>
                        <dt className="text-[11px] uppercase tracking-[0.16em] text-mist-dim">
                          {s.k}
                        </dt>
                        <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-mist">
                          <CountUp to={s.to} suffix={s.suffix} decimals={s.decimals} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="flex h-40 items-end justify-between gap-2.5 sm:gap-3">
                  {BARS.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={reduced ? { height: `${h}%` } : { height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true, margin: "-10%" }}
                      transition={{ duration: 0.9, delay: reduced ? 0 : i * 0.07, ease: GLIDE }}
                      className="w-full rounded-t-md bg-gradient-to-t from-iris/15 via-iris/50 to-aqua/70"
                    />
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════ SCROLL HORIZONTAL ══════════ */}
      <div id="proceso">
        <HorizontalScroller
          heading={
            <div className="max-w-xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-mist-dim">
                Cómo trabajamos
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-mist sm:text-4xl">
                Cinco pasos, sin sorpresas
              </h2>
            </div>
          }
        >
          {SLIDES.map((slide) => (
            <SpotlightCard
              key={slide.n}
              glow={slide.glow}
              lift={-6}
              initial="show"
              animate="show"
              className="w-[80vw] shrink-0 snap-center p-8 sm:w-[22rem]"
            >
              <div
                className="text-5xl font-semibold tracking-[-0.05em]"
                style={{ color: `rgb(${slide.glow})` }}
              >
                {slide.n}
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em] text-mist">
                {slide.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-mist-dim">{slide.body}</p>
            </SpotlightCard>
          ))}
        </HorizontalScroller>
      </div>

      {/* ══════════ MODAL ══════════ */}
      <GlassModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Arranquemos el proyecto"
        description="Cuéntanos en una línea qué estás construyendo. Respondemos en menos de 24 horas."
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium
                         text-mist-dim transition-colors hover:border-white/30 hover:text-mist"
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-full bg-mist px-5 py-2.5 text-sm font-semibold text-ink-950
                         transition-transform hover:scale-[1.03]"
            >
              Enviar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-mist-dim">
              Email
            </span>
            <input
              type="email"
              placeholder="tu@empresa.com"
              className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3
                         text-sm text-mist placeholder:text-mist-dim/60
                         focus:border-iris/60 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-mist-dim">
              Proyecto
            </span>
            <textarea
              rows={3}
              placeholder="Estamos rediseñando el panel de…"
              className="w-full resize-none rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3
                         text-sm text-mist placeholder:text-mist-dim/60
                         focus:border-iris/60 focus:outline-none"
            />
          </label>
        </div>
      </GlassModal>
    </div>
  );
}
