'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/components/ui';

/** Cuenta de 0 hasta `target` con desaceleración (valor final directo con movimiento reducido). */
export function useCountUp(target: number, durationMs = 900): number {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      setShown(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reducedMotion]);

  return reducedMotion ? target : shown;
}
