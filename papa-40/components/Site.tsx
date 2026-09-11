"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { config } from "@/data/config";
import Lock from "@/components/Lock";
import Intro from "@/components/Intro";
import Timeline from "@/components/Timeline";
import Gallery from "@/components/Gallery";
import Extras from "@/components/Extras";
import Closing from "@/components/Closing";

export default function Site({ gallery }: { gallery: string[] }) {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [freshUnlock, setFreshUnlock] = useState(false);
  useEffect(() => {
    setLocked(sessionStorage.getItem("p40-unlocked") !== "1");
  }, []);
  const unlock = () => {
    sessionStorage.setItem("p40-unlocked", "1");
    setFreshUnlock(true);
    setLocked(false);
  };
  if (locked === null) return <div className="min-h-screen bg-carbon" />;
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {locked ? (
          <Lock key="lock" onUnlock={unlock} photos={gallery.slice(0, 4)} />
        ) : (
          <motion.main
            key="site"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
          >
            {config.music && <Music fresh={freshUnlock} />}
            <Intro fresh={freshUnlock} />
            <Timeline />
            <Gallery images={gallery} />
            <Extras />
            <Closing images={gallery} />
          </motion.main>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

function Music({ fresh }: { fresh: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [asked, setAsked] = useState(!fresh);
  const [showVol, setShowVol] = useState(false);
  const [missing, setMissing] = useState(false);
  const toggle = (on: boolean) => {
    const a = audioRef.current;
    if (!a) return;
    if (on) a.play().catch(() => setMissing(true));
    else a.pause();
    setPlaying(on);
  };
  // Si la canción todavía no se ha subido, la música se oculta sola.
  if (missing) return null;
  return (
    <>
      <audio
        ref={audioRef}
        src={config.music!}
        loop
        preload="metadata"
        onError={() => setMissing(true)}
      />
      <AnimatePresence>
        {!asked && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { delay: 9, duration: 0.8 },
            }}
            exit={{ opacity: 0, y: 20, transition: { duration: 0.4 } }}
            className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
          >
            <div className="flex max-w-md flex-col items-center gap-2 rounded-2xl border border-gold/30 bg-carbon-2/90 px-5 py-4 text-center backdrop-blur">
              <span className="text-sm text-cream/90">
                ¿Quieres vivir esta historia con música?
              </span>
              <span className="text-xs italic text-gold/80">
                {config.musicTagline}
              </span>
              <div className="mt-1 flex items-center gap-3">
                <button
                  onClick={() => {
                    toggle(true);
                    setAsked(true);
                  }}
                  className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-carbon"
                >
                  Sí ▶
                </button>
                <button
                  onClick={() => setAsked(true)}
                  className="px-2 py-2 text-sm text-cream/60"
                >
                  Ahora no
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {asked && (
        <div
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2"
          onMouseEnter={() => setShowVol(true)}
          onMouseLeave={() => setShowVol(false)}
        >
          {showVol && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              defaultValue={1}
              aria-label="Volumen"
              onChange={(e) => {
                if (audioRef.current)
                  audioRef.current.volume = Number(e.target.value);
              }}
              className="w-24 accent-gold"
            />
          )}
          <button
            onClick={() => {
              toggle(!playing);
              setShowVol(true);
            }}
            aria-label={playing ? "Pausar música" : "Reproducir música"}
            className={`flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-carbon-2/90 text-lg backdrop-blur ${
              playing ? "text-gold" : "text-cream/60"
            }`}
          >
            ♫
          </button>
        </div>
      )}
    </>
  );
}
