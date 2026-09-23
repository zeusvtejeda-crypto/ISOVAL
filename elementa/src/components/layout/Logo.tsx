import Link from 'next/link';
import { cn } from '@/components/ui/cn';

/** Isotipo: una casilla de la tabla periódica con el "símbolo" El. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-brand-gradient text-on-brand',
        'shadow-[0_3px_0_0_var(--color-brand-shade)] transition-transform duration-200 ease-spring',
        className,
      )}
    >
      <span className="absolute top-[3px] right-[4px] text-[0.55rem] leading-none text-on-brand/80">✦</span>
      <span className="text-[0.95rem] font-black leading-none tracking-tighter">El</span>
    </span>
  );
}

export interface LogoProps {
  className?: string;
  /**
   * Solo el isotipo, sin el nombre: `true` siempre; `'narrow'` solo en pantallas de menos de 360 px
   * (teléfonos de 320 px, donde el nombre no cabe junto a racha, nivel y tema).
   */
  compact?: boolean | 'narrow';
}

/** Logotipo con enlace al inicio. */
export function Logo({ className, compact = false }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="Elementa, ir al inicio"
      className={cn(
        'group inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-2xl pr-1',
        compact === 'narrow' && 'max-[359px]:pr-0',
        className,
      )}
    >
      <LogoMark className="group-hover:-rotate-6 group-active:scale-95" />
      {compact !== true && (
        <span
          aria-hidden
          className={cn('text-xl font-black tracking-tight text-fg', compact === 'narrow' && 'max-[359px]:hidden')}
        >
          Elementa
        </span>
      )}
    </Link>
  );
}
