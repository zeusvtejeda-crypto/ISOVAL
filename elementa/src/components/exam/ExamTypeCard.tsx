import type { ReactNode } from 'react';
import Link from 'next/link';
import { TONE_SOFT, cn, type Tone } from '@/components/ui';

export interface ExamTypeCardProps {
  emoji: string;
  title: string;
  description: string;
  tone: Tone;
  /** Pastillas bajo la descripción ("10 preguntas", "≈ 3 min"). */
  meta: ReactNode;
  /** Icono de la acción (a la derecha). */
  actionIcon: ReactNode;
  /** Botón que empieza el examen… */
  onClick?: () => void;
  /** …o enlace (examen personalizado). */
  href?: string;
}

const CARD =
  'group relative flex w-full items-center gap-3 rounded-3xl border-2 border-border bg-surface p-4 text-left shadow-card ' +
  'transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-float ' +
  'active:translate-y-0 active:scale-[0.98] motion-reduce:hover:translate-y-0 sm:gap-4 sm:p-5';

/** Tarjeta de un tipo de examen: emoji, título, descripción, pastillas y botón de acción. */
export function ExamTypeCard({ emoji, title, description, tone, meta, actionIcon, onClick, href }: ExamTypeCardProps) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-2xl text-2xl leading-none min-[380px]:size-14 min-[380px]:text-3xl sm:size-16 sm:text-4xl',
          'transition-transform duration-200 ease-spring group-hover:scale-110 group-hover:-rotate-6',
          TONE_SOFT[tone],
        )}
      >
        {emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg leading-tight font-black hyphens-auto">{title}</span>
        <span className="mt-0.5 text-sm leading-snug font-semibold text-muted">{description}</span>
        <span className="mt-2 flex flex-wrap gap-1.5">{meta}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full bg-brand text-on-brand shadow-card [&_svg]:size-4 min-[380px]:size-11 min-[380px]:[&_svg]:size-5',
          'transition-transform duration-200 ease-spring group-hover:scale-110',
        )}
      >
        {actionIcon}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={CARD}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={CARD}>
      {body}
    </button>
  );
}
