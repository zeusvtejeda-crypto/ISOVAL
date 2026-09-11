"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

export type LightItem = { src: string; caption?: string };

export default function Lightbox({
  items,
  index,
  setIndex,
}: {
  items: LightItem[];
  index: number | null;
  setIndex: (i: number | null) => void;
}) {
  const [toast, setToast] = useState(false);
  const touchX = useRef<number | null>(null);
  const pressT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = index !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowRight") setIndex(((index ?? 0) + 1) % items.length);
      if (e.key === "ArrowLeft")
        setIndex(((index ?? 0) - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, index, items.length, setIndex]);
  const startPress = () => {
    pressT.current = setTimeout(() => {
      setToast(true);
      setTimeout(() => setToast(false), 2200);
    }, 650);
  };
  const endPress = () => {
    if (pressT.current) clearTimeout(pressT.current);
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col bg-carbon/95 backdrop-blur-sm"
          onClick={() => setIndex(null)}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
            startPress();
          }}
          onTouchMove={endPress}
          onTouchEnd={(e) => {
            endPress();
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 60)
              setIndex(
                (index! + (dx < 0 ? 1 : -1) + items.length) % items.length
              );
            touchX.current = null;
          }}
        >
          <button
            aria-label="Cerrar"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-cream/20 text-xl text-cream"
            onClick={() => setIndex(null)}
          >
            ×
          </button>
          <div
            className="relative m-auto h-[78svh] w-full max-w-5xl px-2"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="relative h-full w-full"
            >
              <Image
                src={items[index!].src}
                alt={items[index!].caption ?? "Recuerdo"}
                fill
                className="select-none object-contain"
                sizes="100vw"
              />
            </motion.div>
          </div>
          {items[index!].caption && (
            <p className="pb-6 text-center font-display text-base italic text-beige">
              {items[index!].caption}
            </p>
          )}
          <button
            aria-label="Anterior"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((index! - 1 + items.length) % items.length);
            }}
            className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-cream/20 text-cream sm:flex"
          >
            ‹
          </button>
          <button
            aria-label="Siguiente"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((index! + 1) % items.length);
            }}
            className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-cream/20 text-cream sm:flex"
          >
            ›
          </button>
          <AnimatePresence>
            {toast && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-gold px-5 py-2 text-sm text-carbon"
              >
                Este recuerdo sí que es bueno ❤️
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
