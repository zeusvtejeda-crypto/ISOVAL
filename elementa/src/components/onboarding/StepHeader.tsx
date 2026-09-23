import { ArrowLeft } from 'lucide-react';
import { IconButton, cn } from '@/components/ui';

/** Id del título (h1) de cada paso: recibe el foco al cambiar de paso. */
export const STEP_TITLE_ID = 'bienvenida-titulo';

/** Pasos visibles de la bienvenida: bienvenida · perfil · diagnóstico · resultado. */
export const ONBOARDING_STEPS = 4;

export interface StepHeaderProps {
  /** Paso actual (1-based). */
  step: number;
  onBack?: () => void;
  className?: string;
}

/** Cabecera de un paso: volver + barra segmentada de progreso ("Paso 2 de 4"). */
export function StepHeader({ step, onBack, className }: StepHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {onBack ? (
        <IconButton label="Volver al paso anterior" icon={<ArrowLeft />} variant="soft" onClick={onBack} className="-ml-1" />
      ) : (
        <span aria-hidden className="size-11 shrink-0" />
      )}
      <div aria-hidden className="flex flex-1 gap-1.5">
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-2.5 flex-1 rounded-full transition-colors duration-500',
              i < step ? 'bg-brand-gradient' : 'bg-surface-2 ring-1 ring-border ring-inset',
            )}
          />
        ))}
      </div>
      <p className="shrink-0 text-sm font-extrabold text-muted tabular">
        Paso {step} de {ONBOARDING_STEPS}
      </p>
    </div>
  );
}
