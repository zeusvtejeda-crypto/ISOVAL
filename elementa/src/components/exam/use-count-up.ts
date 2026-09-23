'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/components/ui';

/** Cuenta de 0 a `target` (ease-out) al montarse. Con movimiento reducido devuelve `target` directamente. */
export function useCountUp(target: number, durationMs = 900): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduced || target <= 0) return;
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [target, durationMs, reduced]);

  return reduced || target <= 0 ? Math.max(0, target) : value;
}
