'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useImmersive } from '@/components/layout';
import { ImmersiveHeader, isActivationTarget, useQuizKeys } from '@/components/quiz';
import { Button, IconButton, cn } from '@/components/ui';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import { LearnCard, type LearnCardVariant } from './LearnCard';

export interface LessonStepperProps {
  /** Elementos a presentar, en orden. */
  elements: readonly number[];
  /** Título de la pantalla (h1 para lectores de pantalla). */
  title: string;
  /** Texto pequeño sobre la tarjeta ("Elemento nuevo"). */
  eyebrow?: string;
  variant?: LearnCardVariant;
  /** Botón del último paso (corto: cabe en 320 px). */
  finishLabel?: string;
  onComplete: () => void;
  /** Salir sin terminar (no se guarda nada). */
  onExit: () => void;
}

/** Pasos del recorrido como segmentos que se van llenando. */
function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-label={`Elemento ${step + 1} de ${total}`}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step + 1}
      className="flex min-w-0 flex-1 gap-1.5"
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-3 flex-1 rounded-full transition-colors duration-300',
            i < step ? 'bg-success' : i === step ? 'bg-brand-gradient' : 'bg-surface-2 ring-1 ring-border/70 ring-inset',
          )}
        />
      ))}
    </div>
  );
}

/**
 * Presentación de elementos uno por uno a pantalla completa (sin navegación): paso 1/5,
 * tarjeta del elemento, «Anterior» / «Siguiente». Teclado: ← →, e Intro para avanzar.
 */
export function LessonStepper({
  elements,
  title,
  eyebrow = 'Elemento nuevo',
  variant = 'full',
  finishLabel = '¡A comprobar!',
  onComplete,
  onExit,
}: LessonStepperProps) {
  useImmersive();
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** `onComplete` solo una vez (doble clic / Intro + clic). */
  const completed = useRef(false);

  const total = elements.length;
  const last = step >= total - 1;
  const element = ELEMENTS_BY_NUMBER[elements[Math.min(step, total - 1)] ?? -1];

  // Cada elemento empieza arriba y el foco va a su nombre (los lectores de pantalla lo anuncian).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const next = () => {
    if (last) {
      if (completed.current) return;
      completed.current = true;
      onComplete();
      return;
    }
    setStep((s) => Math.min(total - 1, s + 1));
  };
  const prev = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  useQuizKeys((event) => {
    if (event.key === 'ArrowRight' && !last) {
      next();
      return true;
    }
    if (event.key === 'ArrowLeft' && step > 0) {
      prev();
      return true;
    }
    if (event.key === 'Enter' && !isActivationTarget(event.target)) {
      next();
      return true;
    }
  }, total > 0);

  if (!element) return null;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="sr-only">{title}</h1>
      <ImmersiveHeader
        onExit={onExit}
        confirmExit={false}
        exitLabel="Salir de la lección"
        center={<StepDots step={step} total={total} />}
        right={
          <span className="shrink-0 text-sm font-black text-muted tabular" aria-hidden>
            {step + 1}/{total}
          </span>
        }
      />

      <div key={element.atomicNumber} className="flex-1 pt-3 pb-4 animate-slide-up sm:pt-5">
        <p className="mb-2.5 text-center text-xs font-black tracking-wider text-brand uppercase sm:text-left">
          {eyebrow} · {step + 1} de {total}
        </p>
        <LearnCard element={element} variant={variant} headingRef={headingRef} />
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 bg-bg/90 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2.5">
          <IconButton
            label="Elemento anterior"
            icon={<ArrowLeft />}
            variant="secondary"
            size="lg"
            onClick={prev}
            disabled={step === 0}
          />
          <Button
            size="lg"
            block
            variant={last ? 'success' : 'primary'}
            rightIcon={last ? <Check aria-hidden /> : <ArrowRight aria-hidden />}
            onClick={next}
            className="flex-1"
          >
            {last ? finishLabel : 'Siguiente'}
          </Button>
        </div>
      </div>
    </div>
  );
}
