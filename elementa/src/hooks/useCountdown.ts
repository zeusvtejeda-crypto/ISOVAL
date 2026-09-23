'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 100;

export interface CountdownOptions {
  /** Se llama una vez al llegar a 0. */
  onEnd?: () => void;
}

export interface CountdownControls {
  remainingMs: number;
  running: boolean;
  /** Empieza o reanuda. */
  start(): void;
  pause(): void;
  /** Detiene y vuelve a `ms` (por defecto la duración inicial). */
  reset(ms?: number): void;
}

/** Cuenta atrás precisa (basada en `performance.now`, inmune a retrasos del intervalo). */
export function useCountdown(durationMs: number, options: CountdownOptions = {}): CountdownControls {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);
  const remainingRef = useRef(durationMs);
  const runningRef = useRef(false);
  const endAtRef = useRef<number | null>(null);
  const durationRef = useRef(durationMs);
  const onEndRef = useRef(options.onEnd);

  useEffect(() => {
    onEndRef.current = options.onEnd;
    durationRef.current = durationMs;
  });

  useEffect(() => {
    if (!running) return;
    const endAt = performance.now() + remainingRef.current;
    endAtRef.current = endAt;
    const id = setInterval(() => {
      const left = Math.max(0, endAt - performance.now());
      remainingRef.current = left;
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(id);
        runningRef.current = false;
        setRunning(false);
        onEndRef.current?.();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, runId]);

  const start = useCallback(() => {
    if (runningRef.current || remainingRef.current <= 0) return;
    runningRef.current = true;
    setRunning(true);
    setRunId((n) => n + 1);
  }, []);

  const pause = useCallback(() => {
    if (runningRef.current && endAtRef.current !== null) {
      remainingRef.current = Math.max(0, endAtRef.current - performance.now());
    }
    endAtRef.current = null;
    runningRef.current = false;
    setRunning(false);
    setRemainingMs(remainingRef.current);
  }, []);

  const reset = useCallback((ms?: number) => {
    const value = ms ?? durationRef.current;
    remainingRef.current = value;
    endAtRef.current = null;
    runningRef.current = false;
    setRemainingMs(value);
    setRunning(false);
    setRunId((n) => n + 1);
  }, []);

  return { remainingMs, running, start, pause, reset };
}
