'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Ancho (px) de un contenedor, medido con `ResizeObserver`. Es 0 hasta la primera medición
 * (en el servidor y durante la hidratación), así que el gráfico se dibuja ya en el cliente.
 */
export function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === next ? prev : next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
