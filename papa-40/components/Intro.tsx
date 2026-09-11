"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { config } from "@/data/config";

const FRASES = [
  "Bienvenido a tus primeros 40 años.",
  "11 · 09 · 1986",
  "Hace 40 años comenzó una historia.",
  "Y qué suerte la nuestra de formar parte de ella.",
];

export default function Intro({ fresh }: { fresh: boolean }) {
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    const seen = sessionStorage.getItem("p40-intro") === "1";
    if (!fresh && seen) {
      setStep(FRASES.length);
      return;
    }
    setStep(0);
    const timers = FRASES.map((_, i) =>
      setTimeout(() => {
        setStep(i + 1);
        if (i + 1 === FRASES.length) sessionStorage.setItem("p40-intro", "1");
      }, (i + 1) * 2600)
    );
    return () => timers.forEach(clearTimeout);
  }, [fresh]);
  const done = step === FRASES.length;
  return (
    <>
      <AnimatePresence>
        {step !== null && !done && (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-carbon px-6"
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.9 }}
                className={`text-center font-display text-cream ${
                  step === 1
                    ? "text-4xl tracking-[0.2em] text-gold sm:text-5xl"
                    : "max-w-xl text-2xl leading-snug sm:text-3xl"
                }`}
              >
                {FRASES[step]}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <section className="relative flex min-h-svh flex-col items-center justify-center px-6 py-20 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="text-xs tracking-[0.35em] text-gold"
        >
          11 · 09 · 1986 — 11 · 09 · 2026
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.6 }}
          className="mt-5 font-display text-4xl leading-tight text-warm sm:text-6xl"
        >
          Feliz cumpleaños, Papá ❤️
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 1 }}
          className="mt-4 max-w-md text-base text-beige/90"
        >
          {config.heroCaption}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2, delay: 1.2, ease: "easeOut" }}
          className="relative mt-10 aspect-[4/3] w-full max-w-lg overflow-hidden rounded-2xl border border-cream/10"
        >
          <Image
            src={config.heroImage}
            alt="Nosotros"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 512px"
          />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 2 }}
          className="mt-12 animate-pulse text-sm text-cream/50"
        >
          Desliza para recordar ↓
        </motion.p>
      </section>
    </>
  );
}
