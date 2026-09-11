"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { reasons } from "@/data/reasons";
import { config } from "@/data/config";
import { extraVideos } from "@/data/memories";
import { Reveal } from "@/components/Lightbox";
import { VideoPlayer } from "@/components/Timeline";

export default function Extras() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-28">
        <Reveal className="text-center">
          <h2 className="font-display text-4xl leading-tight text-warm sm:text-5xl">
            40 años.
            <br />
            40 razones para celebrar que existes.
          </h2>
        </Reveal>
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {reasons.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: (i % 8) * 0.06 }}
              className="rounded-xl border border-cream/10 bg-carbon-2/60 p-4"
            >
              <p className="font-display text-sm text-gold">
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="mt-1.5 text-sm leading-snug text-cream/90">{r}</p>
            </motion.div>
          ))}
        </div>
      </section>
      {extraVideos.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 pb-28">
          <Reveal className="text-center">
            <h2 className="font-display text-3xl text-warm sm:text-4xl">
              Recuerdos en movimiento
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {extraVideos.map((v) => (
              <Reveal key={v.video}>
                <VideoPlayer video={v.video} poster={v.poster} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
      {config.voiceNote && <VoiceNote src={config.voiceNote} />}
      <TimeCircuits />
    </>
  );
}

function VoiceNote({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState("0:00");
  const [dur, setDur] = useState("");
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <section className="mx-auto max-w-xl px-6 pb-28 text-center">
      <Reveal>
        <h2 className="font-display text-3xl text-warm sm:text-4xl">
          Papá, escucha esto.
        </h2>
        <div className="mx-auto mt-8 flex items-center gap-4 rounded-2xl border border-gold/25 bg-carbon-2/70 p-5">
          <button
            onClick={() => {
              const a = ref.current!;
              if (playing) a.pause();
              else a.play();
              setPlaying(!playing);
            }}
            aria-label={playing ? "Pausar mensaje" : "Escuchar mensaje"}
            className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-gold text-xl text-carbon"
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <div className="flex h-10 flex-1 items-center gap-[3px]">
            {Array.from({ length: 32 }).map((_, i) => (
              <motion.span
                key={i}
                animate={
                  playing
                    ? { scaleY: [0.3, 1, 0.4, 0.9, 0.3] }
                    : { scaleY: 0.3 }
                }
                transition={
                  playing
                    ? {
                        duration: 1.1,
                        repeat: Infinity,
                        delay: i * 0.05,
                        ease: "easeInOut",
                      }
                    : { duration: 0.3 }
                }
                className="h-full w-1 flex-1 origin-center rounded-full bg-gold/70"
              />
            ))}
          </div>
          <span className="flex-none text-xs tabular-nums text-cream/70">
            {time}
            {dur && ` / ${dur}`}
          </span>
          <audio
            ref={ref}
            src={src}
            preload="metadata"
            onLoadedMetadata={(e) => setDur(fmt(e.currentTarget.duration))}
            onTimeUpdate={(e) => setTime(fmt(e.currentTarget.currentTime))}
            onEnded={() => setPlaying(false)}
          />
        </div>
      </Reveal>
    </section>
  );
}

// Contador con guiño a Volver al Futuro: los "circuitos de tiempo" del DeLorean.
const MESES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

function TimeCircuits() {
  const [t, setT] = useState<{ y: number; m: number; d: number; h: number }>();
  const [now, setNow] = useState<Date>();
  const [taps, setTaps] = useState(0);
  const [egg, setEgg] = useState(false);
  useEffect(() => {
    const birth = new Date(config.birthDate);
    const tick = () => {
      const current = new Date();
      let y = current.getFullYear() - birth.getFullYear();
      let m = current.getMonth() - birth.getMonth();
      let d = current.getDate() - birth.getDate();
      if (d < 0) {
        m--;
        d += new Date(current.getFullYear(), current.getMonth(), 0).getDate();
      }
      if (m < 0) {
        y--;
        m += 12;
      }
      setT({ y, m, d, h: current.getHours() });
      setNow(current);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (taps < 3) return;
    setEgg(true);
    setTaps(0);
    const id = setTimeout(() => setEgg(false), 2400);
    return () => clearTimeout(id);
  }, [taps]);
  if (!t || !now) return null;
  const fmt = (d: Date) =>
    `${MESES[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")} ${d.getFullYear()}`;
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  const rows = [
    { label: "DESTINO", value: "SEP 11 2026", color: "#ff5a48" },
    { label: "PRESENTE", value: `${fmt(now)} · ${hhmm}`, color: "#7dff8a" },
    { label: "SALIDA", value: "SEP 11 1986", color: "#ffb84d" },
  ];
  const cells = [
    { n: t.y, l: "años" },
    { n: t.m, l: "meses" },
    { n: t.d, l: "días" },
    { n: t.h, l: "horas" },
  ];
  return (
    <section className="mx-auto max-w-3xl px-6 pb-28 text-center">
      <Reveal>
        <h2 className="font-display text-3xl text-warm sm:text-4xl">
          Todo este tiempo haciendo historia.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm italic text-beige/70">
          No hace falta llegar a 88 mph: los recuerdos también viajan en el
          tiempo. ⚡
        </p>
        <button
          onClick={() => setTaps((n) => n + 1)}
          aria-label="Circuitos de tiempo"
          className="mx-auto mt-8 block w-full max-w-md space-y-2 rounded-xl border border-cream/15 bg-black/60 p-4 text-left shadow-2xl"
        >
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-md bg-carbon-2/80 px-4 py-2.5"
            >
              <span className="text-[10px] tracking-[0.3em] text-cream/45">
                {r.label}
              </span>
              <span
                className="font-mono text-sm tabular-nums sm:text-base"
                style={{ color: r.color, textShadow: `0 0 12px ${r.color}66` }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </button>
        <div className="mt-6 grid grid-cols-4 gap-3">
          {cells.map((c) => (
            <div
              key={c.l}
              className="rounded-xl border border-cream/10 bg-carbon-2/60 py-5"
            >
              <p className="font-display text-3xl text-gold sm:text-4xl">
                {c.n}
              </p>
              <p className="mt-1 text-xs tracking-widest text-cream/60">
                {c.l.toUpperCase()}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-cream/40">
          …y contando, desde el 11 de septiembre de 1986.
        </p>
      </Reveal>
      <AnimatePresence>
        {egg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-carbon/90"
          >
            <motion.p
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="font-mono text-5xl tracking-widest text-gold sm:text-7xl"
              style={{ textShadow: "0 0 30px #c2a15c99" }}
            >
              88 MPH ⚡
            </motion.p>
            <p className="mt-4 font-display text-xl italic text-cream/80">
              Directo a 1986… y de vuelta.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
