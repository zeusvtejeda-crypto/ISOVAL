import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { LINK_CARD } from '@/components/dashboard/styles';
import { TONE_SOFT, cn } from '@/components/ui';
import type { ModeInfo } from './modes';

export interface ModeCardProps {
  mode: ModeInfo;
  /** Contenido bajo la descripción: récord, contador… */
  footer?: ReactNode;
  className?: string;
}

/** Tarjeta de un modo de juego: icono, título, descripción de una línea y récord opcional. */
export function ModeCard({ mode, footer, className }: ModeCardProps) {
  return (
    <Link href={mode.href} className={cn(LINK_CARD, 'flex h-full items-center gap-4 p-4', className)}>
      <span
        aria-hidden
        className={cn(
          'grid size-14 shrink-0 place-items-center rounded-2xl text-3xl leading-none',
          'transition-transform duration-200 ease-spring group-hover:scale-110 group-hover:-rotate-6',
          TONE_SOFT[mode.tone],
        )}
      >
        {mode.emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg leading-tight font-black">{mode.title}</span>
        <span className="mt-0.5 text-sm leading-snug font-semibold text-muted">{mode.description}</span>
        {footer && <span className="mt-2 flex min-h-6 items-center">{footer}</span>}
      </span>
      <ChevronRight
        aria-hidden
        className="size-5 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </Link>
  );
}
