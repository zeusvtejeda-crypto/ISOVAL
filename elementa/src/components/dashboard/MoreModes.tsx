import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/components/ui';

interface ModeLink {
  href: string;
  emoji: string;
  label: string;
}

const MORE_MODES: readonly ModeLink[] = [
  { href: '/aprende', emoji: '🌱', label: 'Aprende 5' },
  { href: '/contrarreloj', emoji: '⏱️', label: 'Contrarreloj' },
  { href: '/supervivencia', emoji: '❤️', label: 'Supervivencia' },
  { href: '/racha', emoji: '🔥', label: 'Racha' },
  { href: '/visual', emoji: '🗺️', label: 'Visual' },
  { href: '/bloques', emoji: '🧱', label: 'Bloques' },
  { href: '/logros', emoji: '🏆', label: 'Logros' },
];

/** Fila secundaria de modos: carrusel horizontal en móvil, fila que se ajusta en pantallas anchas. */
export function MoreModes({ className }: { className?: string }) {
  return (
    <section aria-labelledby="more-modes-title" className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="more-modes-title" className="text-xl font-black">
          Más formas de jugar
        </h2>
        <Link
          href="/jugar"
          className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-extrabold text-brand hover:bg-brand-soft"
        >
          Ver todos
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      <div className="relative">
        <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {MORE_MODES.map((mode) => (
            <li key={mode.href} className="shrink-0 snap-start">
              <Link
                href={mode.href}
                className={cn(
                  'group inline-flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-surface py-2 pr-4 pl-2.5 font-extrabold shadow-card',
                  'transition-[transform,border-color,background-color] duration-150 hover:border-border-strong hover:bg-surface-2 active:scale-[0.96]',
                )}
              >
                <span
                  aria-hidden
                  className="grid size-8 place-items-center rounded-xl bg-surface-2 text-lg leading-none transition-transform duration-200 ease-spring group-hover:scale-110"
                >
                  {mode.emoji}
                </span>
                {mode.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
