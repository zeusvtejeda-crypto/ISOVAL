'use client';

import { useCallback, useMemo, useRef } from 'react';

export interface ResponseTimer {
  /** Marca el inicio (al mostrar una pregunta). */
  start(): void;
  /** Milisegundos desde `start()` (0 si no se inició). */
  elapsed(): number;
}

/** Mide el tiempo de respuesta sin provocar renders. */
export function useResponseTimer(): ResponseTimer {
  const startedAt = useRef<number | null>(null);

  const start = useCallback(() => {
    startedAt.current = performance.now();
  }, []);

  const elapsed = useCallback(() => {
    return startedAt.current === null ? 0 : Math.round(performance.now() - startedAt.current);
  }, []);

  return useMemo(() => ({ start, elapsed }), [start, elapsed]);
}
