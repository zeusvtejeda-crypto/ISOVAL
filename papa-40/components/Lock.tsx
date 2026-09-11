"use client";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

const ERRORES = [
  "Casi… 👀",
  "Piensa en alguien muy importante.",
  "Ese día todavía no comenzaba esta historia.",
  "Inténtalo otra vez ❤️",
];

export default function Lock({
  onUnlock,
  photos,
}: {
  onUnlock: () => void;
  photos: string[];
}) {
  const [d, setD] = useState("");
  const [m, setM] = useState("");
  const [y, setY] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [stage, setStage] = useState<"input" | "ok1" | "ok2">("input");
  const mRef = useRef<HTMLInputElement>(null);
  const yRef = useRef<HTMLInputElement>(null);
  const check = () => {
    if (Number(d) === 11 && Number(m) === 9 && Number(y) === 1986) {
      setError(null);
      setStage("ok1");
      setTimeout(() => setStage("ok2"), 1600);
      setTimeout(onUnlock, 3400);
    } else {
      setError(ERRORES[Math.floor(Math.random() * ERRORES.length)]);
      setShake((s) => s + 1);
    }
  };
  const inputCls =
    "w-20 rounded-lg border border-cream/20 bg-carbon-2/80 py-3 text-center text-xl text-cream outline-none backdrop-blur focus:border-gold sm:w-24";
  return (
    <motion.div
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-carbon"
    >
      {photos.map((src, i) => (
        <motion.div
          key={src}
          className="absolute h-72 w-72 opacity-20 blur-2xl sm:h-96 sm:w-96"
          style={{
            left: `${[5, 60, 15, 65][i % 4]}%`,
            top: `${[8, 15, 60, 55][i % 4]}%`,
          }}
          animate={{ x: [0, 30, -20, 0], y: [0, -25, 15, 0] }}
          transition={{ duration: 40 + i * 8, repeat: Infinity, ease: "linear" }}
        >
          <Image src={src} alt="" fill className="object-cover" sizes="400px" />
        </motion.div>
      ))}
      <div className="relative z-10 mx-auto max-w-md px-6 text-center">
        {stage === "input" && (
          <>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2 }}
              className="font-display text-2xl leading-snug text-cream sm:text-3xl"
            >
              Esta página guarda una historia muy importante.
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4, duration: 1 }}
              className="mt-6 text-sm tracking-wide text-beige/80"
            >
              Introduce la fecha del mejor día del mundo
            </motion.p>
            <motion.form
              key={shake}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, x: shake ? [0, -10, 10, -6, 6, 0] : 0 }}
              transition={{ delay: shake ? 0 : 2, duration: 0.5 }}
              onSubmit={(e) => {
                e.preventDefault();
                check();
              }}
              className="mt-8"
            >
              <div className="flex items-end justify-center gap-3">
                {[
                  { l: "DÍA", v: d, s: setD, max: 2, ref: null, next: mRef },
                  { l: "MES", v: m, s: setM, max: 2, ref: mRef, next: yRef },
                  { l: "AÑO", v: y, s: setY, max: 4, ref: yRef, next: null },
                ].map((f) => (
                  <label key={f.l} className="flex flex-col items-center gap-2">
                    <span className="text-[10px] tracking-[0.25em] text-cream/50">
                      {f.l}
                    </span>
                    <input
                      ref={f.ref as React.Ref<HTMLInputElement>}
                      inputMode="numeric"
                      maxLength={f.max}
                      value={f.v}
                      aria-label={f.l}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        f.s(v);
                        if (v.length === f.max && f.next?.current)
                          f.next.current.focus();
                      }}
                      className={inputCls}
                    />
                  </label>
                ))}
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-5 text-sm text-gold"
                >
                  {error}
                </motion.p>
              )}
              <button
                type="submit"
                className="mt-8 rounded-full border border-gold/50 px-8 py-3 text-sm tracking-widest text-gold transition hover:bg-gold hover:text-carbon"
              >
                DESBLOQUEAR
              </button>
            </motion.form>
          </>
        )}
        {stage !== "input" && (
          <motion.p
            key={stage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="font-display text-3xl text-cream"
          >
            {stage === "ok1" ? "Correcto." : "Ese día comenzó esta historia."}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
