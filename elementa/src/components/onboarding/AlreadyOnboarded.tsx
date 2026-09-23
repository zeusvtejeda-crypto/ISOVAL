import { House, RotateCcw } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui';
import { STEP_TITLE_ID } from './StepHeader';

export interface AlreadyOnboardedProps {
  name: string;
  onRepeat: () => void;
}

/** Si ya hizo la bienvenida: volver al inicio o repetir el diagnóstico. */
export function AlreadyOnboarded({ name, onRepeat }: AlreadyOnboardedProps) {
  const cleanName = name.trim();
  return (
    <section
      aria-labelledby={STEP_TITLE_ID}
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-8 text-center"
    >
      <span aria-hidden className="text-7xl leading-none animate-float">
        👋
      </span>
      <h1 id={STEP_TITLE_ID} tabIndex={-1} className="mt-5 text-3xl leading-tight font-black outline-none">
        {cleanName ? `¡Hola de nuevo, ${cleanName}!` : '¡Hola de nuevo!'}
      </h1>
      <p className="mt-2 font-semibold text-muted sm:text-lg">
        Ya completaste la bienvenida. Puedes volver a medir tu nivel cuando quieras.
      </p>
      <div className="mt-8 flex w-full flex-col gap-2.5">
        <ButtonLink href="/" size="lg" block leftIcon={<House aria-hidden />}>
          Volver al inicio
        </ButtonLink>
        <Button variant="secondary" size="lg" block leftIcon={<RotateCcw aria-hidden />} onClick={onRepeat}>
          Repetir diagnóstico
        </Button>
      </div>
      <p className="mt-3 text-sm font-semibold text-muted">Repetir el diagnóstico nunca te quita XP.</p>
    </section>
  );
}
