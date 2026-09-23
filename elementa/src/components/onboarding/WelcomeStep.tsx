import { ArrowRight } from 'lucide-react';
import { ElementTile } from '@/components/periodic';
import { Button, cn } from '@/components/ui';
import { getElement } from '@/data/elements';
import { STEP_TITLE_ID } from './StepHeader';

const VALUES = [
  { emoji: '🎮', title: 'Aprende jugando', text: 'Trivia, retos contrarreloj, rachas y más.' },
  { emoji: '🧠', title: 'Memoriza de verdad', text: 'Repasas cada elemento justo antes de olvidarlo.' },
  { emoji: '🏆', title: 'Sube de nivel', text: 'Gana XP, mantén tu racha y desbloquea logros.' },
] as const;

/** Casillas que flotan alrededor del logotipo (H, O, Au, Ne). */
const FLOATING = [
  { z: 1, className: 'top-1 left-0 -rotate-12', delay: '0ms' },
  { z: 8, className: 'top-0 right-1 rotate-6', delay: '-1.1s' },
  { z: 79, className: 'bottom-0 left-5 rotate-6', delay: '-2.2s' },
  { z: 10, className: 'right-4 bottom-1 -rotate-6', delay: '-0.6s' },
] as const;

function HeroArt() {
  return (
    <div aria-hidden className="relative h-44 w-64 shrink-0">
      {FLOATING.map(({ z, className, delay }) => (
        <div key={z} className={cn('absolute animate-float', className)} style={{ animationDelay: delay }}>
          <ElementTile element={getElement(z)} size="sm" decorative className="shadow-card" />
        </div>
      ))}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="relative grid size-24 place-items-center rounded-[1.75rem] bg-brand-gradient text-on-brand shadow-[0_6px_0_0_var(--color-brand-shade)] animate-bounce-in">
          <span className="absolute top-2 right-2.5 text-xs leading-none opacity-80">✦</span>
          <span className="text-4xl leading-none font-black tracking-tighter">El</span>
        </span>
      </div>
    </div>
  );
}

/** Paso 1: logotipo, propuesta de valor y «Empezar». */
export function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <section
      aria-labelledby={STEP_TITLE_ID}
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-4 text-center"
    >
      <HeroArt />
      <h1 id={STEP_TITLE_ID} tabIndex={-1} className="mt-6 text-5xl font-black tracking-tight outline-none">
        <span className="text-brand-gradient">Elementa</span>
      </h1>
      <p className="mt-2 text-lg font-bold text-muted sm:text-xl">
        Domina los 118 elementos de la tabla periódica jugando.
      </p>

      <ul className="mt-7 flex w-full flex-col gap-2.5 text-left">
        {VALUES.map((v, i) => (
          <li
            key={v.title}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card animate-slide-up"
            style={{ animationDelay: `${120 + i * 80}ms` }}
          >
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-2xl leading-none">
              {v.emoji}
            </span>
            <span className="min-w-0">
              <span className="block leading-tight font-black">{v.title}</span>
              <span className="mt-0.5 block text-sm font-semibold text-muted">{v.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <Button size="lg" block className="mt-8" rightIcon={<ArrowRight aria-hidden />} onClick={onStart}>
        Empezar
      </Button>
      <p className="mt-3 text-sm font-semibold text-muted">2 minutos · Sin registrarte · Gratis</p>
    </section>
  );
}
