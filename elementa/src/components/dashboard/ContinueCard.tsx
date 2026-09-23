'use client';

import { ArrowRight } from 'lucide-react';
import { ButtonLink, Skeleton, cn } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { countLearned } from '@/utils/mastery';
import { previewParts, useStudyPreview } from './useStudyPreview';

export interface ContinueCardProps {
  className?: string;
  /** Destino del botón. Por defecto `/estudiar`. */
  href?: string;
  /** Texto del botón. */
  cta?: string;
  /** Nivel del título (h2 en el inicio, h2/h3 en otras pantallas). */
  titleAs?: 'h2' | 'h3';
}

function headline(learned: number, goalMet: boolean): string {
  if (learned === 0) return 'Empieza por tus primeros elementos';
  if (goalMet) return '¡Meta cumplida! ¿Vamos por más?';
  return 'Sigue donde lo dejaste';
}

/**
 * Llamada principal: «Continuar aprendiendo» con la vista previa de la sesión inteligente
 * de hoy (nuevos · repasos · difíciles · minutos).
 */
export function ContinueCard({ className, href = '/estudiar', cta = 'Continuar aprendiendo', titleAs: Title = 'h2' }: ContinueCardProps) {
  const { state, today, ready } = useProgress();
  const preview = useStudyPreview();
  const learned = countLearned(state);

  return (
    <section
      aria-labelledby="continue-title"
      className={cn(
        'relative isolate flex flex-col overflow-hidden rounded-3xl bg-brand-gradient p-5 text-on-brand shadow-card sm:p-6',
        className,
      )}
    >
      {/* Casilla decorativa de fondo (identidad: una casilla de la tabla periódica). */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-5 -right-5 -z-10 grid size-32 rotate-12 place-items-center rounded-[1.75rem] border-4 border-on-brand/20 text-6xl font-black text-on-brand/15 animate-float"
      >
        Ne
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -left-6 -z-10 size-28 rounded-full bg-on-brand/10 blur-2xl"
      />

      <p className="text-xs font-black tracking-wider uppercase opacity-90">Sesión de hoy</p>
      <Title id="continue-title" className="mt-1 text-2xl leading-tight font-black sm:text-[1.7rem]">
        {ready ? headline(learned, today.goalMet) : 'Sigue donde lo dejaste'}
      </Title>

      <div className="mt-3 min-h-8" aria-live="polite">
        {preview ? (
          <ul aria-label="Qué incluye la sesión" className="flex flex-wrap gap-1.5">
            {previewParts(preview).map((part) => (
              <li
                key={part}
                className="inline-flex h-8 items-center rounded-full bg-on-brand/15 px-3 text-sm font-extrabold"
              >
                {part}
              </li>
            ))}
            <li className="inline-flex h-8 items-center gap-1 rounded-full bg-on-brand/15 px-3 text-sm font-extrabold">
              <span aria-hidden>⏱</span>~{preview.minutes} min
            </li>
          </ul>
        ) : (
          <div className="flex gap-1.5" aria-hidden>
            <Skeleton rounded="full" className="h-8 w-24 opacity-40" />
            <Skeleton rounded="full" className="h-8 w-20 opacity-40" />
          </div>
        )}
      </div>

      <div className="mt-auto pt-5">
        <ButtonLink
          href={href}
          variant="inverse"
          size="lg"
          block
          className="group"
          rightIcon={<ArrowRight aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />}
        >
          {cta}
        </ButtonLink>
      </div>
    </section>
  );
}
