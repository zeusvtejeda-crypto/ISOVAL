"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import Image from "next/image";
import { letter } from "@/data/letter";
import { Reveal } from "@/components/Lightbox";

export default function Closing({ images }: { images: string[] }) {
  return (
    <>
      <Letter />
      <Final images={images} />
    </>
  );
}

function Letter() {
  return (
    <section className="bg-warm px-6 py-28 text-carbon">
      <div className="mx-auto max-w-xl">
        <Reveal className="text-center">
          <p className="text-xs tracking-[0.35em] text-carbon/50">
            ANTES DE TERMINAR…
          </p>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl">
            Hay algo que quiero decirte.
          </h2>
        </Reveal>
        <div className="mt-14 space-y-6">
          {letter.map((p, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.9, delay: 0.15 }}
              className={
                i === 0 || i === letter.length - 1
                  ? "font-display text-2xl italic"
                  : "font-display text-lg leading-relaxed text-carbon/85"
              }
            >
              {p}
            </motion.p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Final({ images }: { images: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [egg, setEgg] = useState(false);
  useEffect(() => {
    if (!inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!sessionStorage.getItem("p40-final")) {
      sessionStorage.setItem("p40-final", "1");
      timers.push(
        setTimeout(() => {
          setEgg(true);
          timers.push(setTimeout(() => setEgg(false), 2600));
        }, 4200)
      );
    }
    timers.push(
      setTimeout(async () => {
        const { default: confetti } = await import("canvas-confetti");
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.3 },
          colors: ["#c2a15c", "#f3ecdd", "#d8c9ae"],
          scalar: 0.8,
          ticks: 260,
        });
      }, 1200)
    );
    return () => timers.forEach(clearTimeout);
  }, [inView]);
  return (
    <section
      ref={ref}
      className="relative overflow-hidden px-6 pb-24 pt-28 text-center"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2 opacity-40 sm:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => {
          const src = images[i % images.length];
          return (
            <div
              key={i}
              className="relative aspect-square overflow-hidden rounded-md"
            >
              <Image
                src={src}
                alt=""
                fill
                className="object-cover"
                sizes="140px"
              />
            </div>
          );
        })}
      </div>
      <div className="relative mt-14 space-y-5">
        <Reveal>
          <p className="font-display text-2xl italic text-beige">
            40 años después…
          </p>
        </Reveal>
        <Reveal delay={0.4}>
          <p className="font-display text-3xl text-cream sm:text-4xl">
            La historia apenas comienza.
          </p>
        </Reveal>
        <Reveal delay={0.8}>
          <h2 className="pt-4 font-display text-4xl leading-tight text-warm sm:text-6xl">
            Feliz cumpleaños, Papá. ❤️
          </h2>
          <p className="mt-4 text-sm tracking-[0.35em] text-gold">
            11 · 09 · 2026
          </p>
        </Reveal>
        <Reveal delay={1.2}>
          <button
            onClick={() =>
              document
                .getElementById("historia")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="mt-8 rounded-full border border-gold/50 px-7 py-3 text-sm tracking-wide text-gold transition hover:bg-gold hover:text-carbon"
          >
            Volver a nuestros recuerdos ↑
          </button>
        </Reveal>
      </div>
      <AnimatePresence>
        {egg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/90"
          >
            <p className="px-6 text-center font-display text-3xl italic text-warm">
              Gracias por ser mi papá.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
