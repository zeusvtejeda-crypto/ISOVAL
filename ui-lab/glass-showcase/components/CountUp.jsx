import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, animate } from "framer-motion";

/**
 * Contador que arranca al entrar en pantalla.
 *
 * Escribe el número con `textContent` desde la suscripción al MotionValue
 * en lugar de guardarlo en estado: así la cuenta no dispara ~60 renders
 * de React por segundo.
 */
export default function CountUp({
  to,
  from = 0,
  duration = 1.6,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const reduced = useReducedMotion();
  const value = useMotionValue(from);

  useEffect(() => {
    if (!inView) return;

    const format = (n) =>
      `${prefix}${n.toLocaleString("es-MX", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

    if (reduced) {
      if (ref.current) ref.current.textContent = format(to);
      return;
    }

    const unsubscribe = value.on("change", (n) => {
      if (ref.current) ref.current.textContent = format(n);
    });

    const controls = animate(value, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [inView, to, duration, decimals, prefix, suffix, reduced, value]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {from}
      {suffix}
    </span>
  );
}
