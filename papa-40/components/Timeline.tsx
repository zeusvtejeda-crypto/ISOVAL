"use client";
import { useRef, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import Image from "next/image";
import { memories, frasesNosotros, type Memory } from "@/data/memories";
import Lightbox, { Reveal, type LightItem } from "@/components/Lightbox";

export default function Timeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.75", "end 0.9"],
  });
  const scaleY = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });
  const historia = memories.filter((m) => m.section === "historia");
  const nosotros = memories.filter((m) => m.section === "nosotros");
  const items: LightItem[] = memories.flatMap((m) =>
    (m.images ?? (m.image ? [m.image] : [])).map((src) => ({
      src,
      caption: m.caption ?? m.title,
    }))
  );
  const [idx, setIdx] = useState<number | null>(null);
  const openSrc = (src: string) =>
    setIdx(items.findIndex((it) => it.src === src));
  return (
    <div id="historia" ref={ref} className="relative">
      <div
        aria-hidden
        className="absolute bottom-0 left-5 top-0 w-px bg-cream/10 sm:left-1/2"
      />
      <motion.div
        aria-hidden
        style={{ scaleY }}
        className="absolute bottom-0 left-5 top-0 w-px origin-top bg-gold/70 sm:left-1/2"
      />
      <div className="relative mx-auto max-w-3xl px-6 sm:px-10">
        <Reveal className="pt-24 text-center">
          <h2 className="font-display text-4xl text-warm sm:text-5xl">
            40 años de historia.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-beige/80">
            Algunas historias se cuentan con palabras. La nuestra se cuenta con
            recuerdos.
          </p>
        </Reveal>
        <div className="mt-16 space-y-24 pb-24">
          {historia.map((m) => (
            <Block key={m.id} m={m} onOpen={openSrc} />
          ))}
        </div>
        <Reveal className="pb-4 pt-8 text-center">
          <h2 className="font-display text-4xl text-warm sm:text-5xl">
            Y después llegamos nosotros.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-beige/80">
            Una parte de tu historia también se convirtió en la nuestra.
          </p>
        </Reveal>
        <div className="mt-16 space-y-20 pb-28">
          {nosotros.map((m, i) => (
            <div key={m.id} className="space-y-20">
              <Block m={m} onOpen={openSrc} />
              <Frases
                frases={frasesNosotros.slice(
                  Math.ceil((i * frasesNosotros.length) / nosotros.length),
                  Math.ceil(((i + 1) * frasesNosotros.length) / nosotros.length)
                )}
              />
            </div>
          ))}
        </div>
      </div>
      <Lightbox items={items} index={idx} setIndex={setIdx} />
    </div>
  );
}

function Frases({ frases }: { frases: string[] }) {
  return (
    <div className="space-y-8 text-center">
      {frases.map((f, i) => (
        <Reveal key={f} delay={i * 0.05}>
          <p className="font-display text-2xl italic text-cream/90 sm:text-3xl">
            {f}
          </p>
        </Reveal>
      ))}
    </div>
  );
}

function Year({ m }: { m: Memory }) {
  if (!m.year) return null;
  return (
    <p className="mb-4 flex items-center justify-center gap-2 text-xs tracking-[0.3em] text-gold">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
      {m.year.toUpperCase()}
    </p>
  );
}

function Pic({
  src,
  alt,
  onOpen,
  className,
  sizes,
}: {
  src: string;
  alt: string;
  onOpen: (s: string) => void;
  className: string;
  sizes: string;
}) {
  return (
    <button
      onClick={() => onOpen(src)}
      className={`relative block w-full overflow-hidden bg-carbon-2 ${className}`}
      aria-label={`Ver foto: ${alt}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover transition duration-700 hover:scale-[1.03]"
        sizes={sizes}
      />
    </button>
  );
}

function Block({ m, onOpen }: { m: Memory; onOpen: (s: string) => void }) {
  const alt = m.caption ?? m.title ?? "Recuerdo familiar";
  if (m.layout === "text")
    return (
      <Reveal className="text-center">
        <Year m={m} />
        {m.title && (
          <h3 className="font-display text-3xl text-warm">{m.title}</h3>
        )}
        <p className="mx-auto mt-5 max-w-lg font-display text-xl italic leading-relaxed text-cream/90">
          {m.caption}
        </p>
      </Reveal>
    );
  if (m.layout === "video")
    return (
      <Reveal className="text-center">
        <Year m={m} />
        <VideoPlayer video={m.video!} poster={m.poster} />
      </Reveal>
    );
  if (m.layout === "duo")
    return (
      <Reveal className="text-center">
        <Year m={m} />
        <div className="grid grid-cols-2 gap-3">
          {m.images!.map((src, i) => (
            <Pic
              key={src}
              src={src}
              alt={alt}
              onOpen={onOpen}
              className={`aspect-[3/4] rounded-xl ${i === 1 ? "sm:translate-y-6" : ""}`}
              sizes="(max-width: 640px) 50vw, 360px"
            />
          ))}
        </div>
        {m.caption && <Cap text={m.caption} />}
      </Reveal>
    );
  if (m.layout === "polaroid")
    return (
      <Reveal className="flex justify-center">
        <div className="w-72 -rotate-2 rounded-sm bg-warm p-3 pb-5 shadow-2xl transition hover:rotate-0 sm:w-80">
          <Pic
            src={m.image!}
            alt={alt}
            onOpen={onOpen}
            className="aspect-[4/5]"
            sizes="320px"
          />
          <p className="mt-4 text-center font-display text-lg italic text-carbon">
            {m.year}
          </p>
          {m.caption && (
            <p className="mt-1 text-center text-xs text-carbon/60">
              {m.caption}
            </p>
          )}
        </div>
      </Reveal>
    );
  if (m.layout === "side")
    return (
      <Reveal>
        <div className="grid items-center gap-6 sm:grid-cols-2">
          <Pic
            src={m.image!}
            alt={alt}
            onOpen={onOpen}
            className="aspect-[4/3] rounded-xl sm:aspect-[3/4]"
            sizes="(max-width: 640px) 100vw, 360px"
          />
          <div className="text-center sm:text-left">
            <Year m={m} />
            {m.title && (
              <h3 className="font-display text-3xl text-warm">{m.title}</h3>
            )}
            {m.caption && (
              <p className="mt-4 leading-relaxed text-beige/90">{m.caption}</p>
            )}
          </div>
        </div>
      </Reveal>
    );
  // large
  return (
    <Reveal className="text-center">
      <Year m={m} />
      {m.title && (
        <h3 className="mb-6 font-display text-3xl text-warm sm:text-4xl">
          {m.title}
        </h3>
      )}
      <Pic
        src={m.image!}
        alt={alt}
        onOpen={onOpen}
        className="aspect-[4/3] rounded-2xl sm:aspect-[16/10]"
        sizes="(max-width: 768px) 100vw, 720px"
      />
      {m.caption && <Cap text={m.caption} />}
    </Reveal>
  );
}

function Cap({ text }: { text: string }) {
  return (
    <p className="mx-auto mt-5 max-w-md font-display text-lg italic text-beige/90">
      {text}
    </p>
  );
}

export function VideoPlayer({
  video,
  poster,
}: {
  video: string;
  poster?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-cream/10 bg-carbon-2">
      <video
        ref={ref}
        src={video}
        poster={poster}
        playsInline
        controls={playing}
        preload="none"
        className="max-h-[75svh] w-full"
        onEnded={() => setPlaying(false)}
      />
      {!playing && (
        <button
          onClick={() => {
            setPlaying(true);
            ref.current?.play();
          }}
          className="absolute inset-0 flex items-center justify-center bg-carbon/30"
          aria-label="Reproducir recuerdo"
        >
          <span className="rounded-full border border-warm/60 bg-carbon/70 px-6 py-3 text-sm tracking-wide text-warm backdrop-blur">
            Reproducir recuerdo ▶
          </span>
        </button>
      )}
    </div>
  );
}
