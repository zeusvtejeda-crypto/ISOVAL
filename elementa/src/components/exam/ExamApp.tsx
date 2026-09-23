'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProgress } from '@/hooks/useProgress';
import type { ExamSpec } from './build-exam';
import { CustomExamBuilder } from './CustomExamBuilder';
import { ExamChooser } from './ExamChooser';
import { ExamRun, type ExamRunInfo } from './ExamRun';
import { ExamSkeleton } from './ExamSkeleton';
import { CUSTOM_EXAM_PARAM, customSpec, presetSpec, type CustomExamConfig } from './presets';
import { DEFAULT_CUSTOM_TOPICS } from './topics';

const DEFAULT_CUSTOM: CustomExamConfig = {
  topics: [...DEFAULT_CUSTOM_TOPICS],
  scope: { kind: 'all' },
  count: 20,
};

/**
 * /examen: selector (rápido, normal, completo, personalizado) → examen → resultado.
 * La configuración del personalizado se conserva al volver de un examen.
 * Debe renderizarse dentro de `<Suspense>` (usa `useSearchParams`).
 */
export function ExamApp() {
  const searchParams = useSearchParams();
  const isCustom = searchParams.get(CUSTOM_EXAM_PARAM.name) === CUSTOM_EXAM_PARAM.value;
  const { state, ready } = useProgress();
  const [custom, setCustom] = useState<CustomExamConfig>(DEFAULT_CUSTOM);
  const [run, setRun] = useState<(ExamRunInfo & { custom: boolean }) | null>(null);
  const runIds = useRef(0);

  // «Atrás» del navegador durante un examen personalizado (cambia `?tipo`): se abandona el examen.
  if (run !== null && run.custom !== isCustom) setRun(null);

  // Cada pantalla de configuración empieza arriba (el examen se desplaza solo).
  const screen = run ? null : isCustom ? 'custom' : 'chooser';
  useEffect(() => {
    if (screen !== null) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen]);

  if (!ready) return <ExamSkeleton />;

  const start = (spec: ExamSpec) => {
    runIds.current += 1;
    setRun({
      id: runIds.current,
      custom: isCustom,
      spec,
      previousBest: state.records.bestExamPct,
      previousExams: state.stats.examsCompleted,
    });
  };

  if (run) return <ExamRun key={run.id} run={run} onExit={() => setRun(null)} />;

  if (isCustom) {
    return <CustomExamBuilder config={custom} onChange={setCustom} onStart={() => start(customSpec(custom))} />;
  }

  return <ExamChooser onStart={(preset) => start(presetSpec(preset))} />;
}
