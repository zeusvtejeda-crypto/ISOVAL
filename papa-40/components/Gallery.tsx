"use client";
import { useState } from "react";
import Image from "next/image";
import Lightbox, { Reveal, type LightItem } from "@/components/Lightbox";

export default function Gallery({ images }: { images: string[] }) {
  const items: LightItem[] = images.map((src) => ({ src }));
  const [idx, setIdx] = useState<number | null>(null);
  const [featured, ...rest] = images;
  return (
    <section className="mx-auto max-w-5xl px-6 pb-28 pt-10">
      <Reveal className="text-center">
        <h2 className="font-display text-4xl text-warm sm:text-5xl">
          Nuestros recuerdos
        </h2>
        <p className="mx-auto mt-4 max-w-md text-beige/80">
          Toca cualquier foto para verla de cerca.
        </p>
      </Reveal>
      {featured && (
        <Reveal className="mt-14">
          <button
            onClick={() => setIdx(0)}
            className="relative block aspect-[16/9] w-full overflow-hidden rounded-2xl bg-carbon-2"
            aria-label="Ver foto destacada"
          >
            <Image
              src={featured}
              alt="Recuerdo destacado"
              fill
              className="object-cover transition duration-700 hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 1024px"
            />
          </button>
        </Reveal>
      )}
      <div className="mt-4 columns-2 gap-4 md:columns-3 [&>*]:mb-4">
        {rest.map((src, i) => (
          <Reveal key={src} delay={(i % 3) * 0.08}>
            <button
              onClick={() => setIdx(i + 1)}
              className={`relative block w-full overflow-hidden rounded-xl bg-carbon-2 ${
                i % 4 === 1 ? "aspect-[3/4]" : i % 4 === 3 ? "aspect-square" : "aspect-[4/3]"
              }`}
              aria-label="Ver foto"
            >
              <Image
                src={src}
                alt="Recuerdo familiar"
                fill
                className="object-cover transition duration-700 hover:scale-[1.04]"
                sizes="(max-width: 768px) 50vw, 340px"
              />
            </button>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-10">
        <div className="no-scrollbar -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6">
          {images.map((src, i) => (
            <button
              key={`strip-${src}`}
              onClick={() => setIdx(i)}
              className="relative h-40 w-56 flex-none snap-center overflow-hidden rounded-lg bg-carbon-2"
              aria-label="Ver foto"
            >
              <Image
                src={src}
                alt="Recuerdo"
                fill
                className="object-cover"
                sizes="224px"
              />
            </button>
          ))}
        </div>
      </Reveal>
      <Lightbox items={items} index={idx} setIndex={setIdx} />
    </section>
  );
}
