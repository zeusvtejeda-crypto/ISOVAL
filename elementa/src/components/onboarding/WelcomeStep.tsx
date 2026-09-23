import { ArrowRight } from 'lucide-react';
import { ElementTile } from '@/components/periodic/ElementTile';
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
    <div aria-hidden className="relative h-44 w-64 shrink-0 [@media(max-height:700px)]:h-32 [@media(max-height:700px)]:w-56">
      {FLOATING.map(({ z, className, delay }) => (
        <div key={z} className={cn('absolute animate-float', className)} style={{ animationDelay: delay }}>
          <ElementTile element={getElement(z)} size="sm" decorative className="shadow-card" />
        </div>
      ))}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span
          className={cn(
            'relative grid size-24 place-items-center rounded-[1.75rem] bg-brand-gradient text-on-brand shadow-[0_6px_0_0_var(--color-brand-shade)] animate-bounce-in',
            '[@media(max-height:700px)]:size-20 [@media(max-height:700px)]:rounded-3xl',
          )}
        >
          <span className="absolute top-2 right-2.5 text-xs leading-none opacity-80">✦</span>
          <span className="text-4xl leading-none font-black tracking-tighter">El</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Paso 1: logotipo, propuesta de valor y «Empezar». En pantallas bajas (≤ 700 px) el contenido se
 * compacta y «Empezar» queda fijo al pie, así se ve sin desplazarse a 320×568 y 375×667.
 */
export function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <section
      aria-labelledby={STEP_TITLE_ID}
      className={cn(
        'mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-4 text-center',
        // Pantallas bajas (iPhone SE, 320×568): todo más junto y arriba.
        '[@media(max-height:700px)]:justify-start [@media(max-height:700px)]:py-0',
      )}
    >
      <HeroArt />
      <h1
        id={STEP_TITLE_ID}
        tabIndex={-1}
        className="mt-6 text-5xl font-black tracking-tight outline-none [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:text-4xl"
      >
        <span className="text-brand-gradient">Elementa</span>
      </h1>
      <p className="mt-2 text-lg font-bold text-muted sm:text-xl [@media(max-height:700px)]:mt-1 [@media(max-height:700px)]:text-base">
        Domina los 118 elementos de la tabla periódica jugando.
      </p>

      <ul className="mt-7 flex w-full flex-col gap-2.5 text-left [@media(max-height:700px)]:mt-4 [@media(max-height:700px)]:gap-2">
        {VALUES.map((v, i) => (
          <li
            key={v.title}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card animate-slide-up [@media(max-height:700px)]:py-2"
            style={{ animationDelay: `${120 + i * 80}ms` }}
          >
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-2xl leading-none [@media(max-height:700px)]:size-9 [@media(max-height:700px)]:text-xl"
            >
              {v.emoji}
            </span>
            <span className="min-w-0">
              <span className="block leading-tight font-black">{v.title}</span>
              <span className="mt-0.5 block text-sm font-semibold text-muted [@media(max-height:700px)]:leading-snug">{v.text}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* Fijo al pie (opaco): si el contenido no cabe, «Empezar» sigue a la vista sin desplazarse. */}
      <div className="sticky bottom-0 z-10 mt-8 w-full bg-bg pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] [@media(max-height:700px)]:mt-3">
        <Button size="lg" block rightIcon={<ArrowRight aria-hidden />} onClick={onStart}>
          Empezar
        </Button>
        <p className="mt-3 text-sm font-semibold text-muted [@media(max-height:700px)]:mt-1.5">2 minutos · Sin registrarte · Gratis</p>
      </div>
    </section>
  );
}
