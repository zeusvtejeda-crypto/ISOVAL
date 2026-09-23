'use client';

import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@/hooks/useProgress';
import type { VisualMode } from './modes';
import { VisualChooser } from './VisualChooser';
import { VisualRun } from './VisualRun';
import { VisualSkeleton } from './VisualSkeleton';

interface RunInfo {
  /** Cambia en cada partida (se usa como `key`). */
  id: number;
  mode: VisualMode;
}

/** /visual: selector de retos → sesión de 10 preguntas sobre la tabla → resumen. */
export function VisualApp() {
  const { ready } = useProgress();
  const [run, setRun] = useState<RunInfo | null>(null);
  const runIds = useRef(0);

  // El selector empieza arriba al volver de una partida.
  const running = run !== null;
  useEffect(() => {
    if (!running) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [running]);

  if (!ready) return <VisualSkeleton />;
  if (run) return <VisualRun key={run.id} mode={run.mode} onExit={() => setRun(null)} />;

  const start = (mode: VisualMode) => {
    runIds.current += 1;
    setRun({ id: runIds.current, mode });
  };

  return <VisualChooser onStart={start} />;
}
