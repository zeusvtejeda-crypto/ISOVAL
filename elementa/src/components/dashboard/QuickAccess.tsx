import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { TONE_SOFT, cn, type Tone } from '@/components/ui';
import { formatNumber, pluralize } from '@/utils/format';
import { LINK_CARD } from './styles';

interface QuickLink {
  href: string;
  emoji: string;
  label: string;
  hint: string;
  tone: Tone;
  /** Contador en la esquina (p. ej. elementos difíciles por reforzar). */
  count?: number;
}

function quickLinks(difficultCount: number): QuickLink[] {
  return [
    { href: '/flashcards', emoji: '🃏', label: 'Flashcards', hint: 'Voltea y recuerda', tone: 'brand' },
    { href: '/examen', emoji: '📝', label: 'Mini examen', hint: 'Ponte a prueba', tone: 'accent' },
    { href: '/preguntados', emoji: '🎡', label: 'Modo Preguntados', hint: 'Gira la ruleta', tone: 'xp' },
    { href: '/tabla', emoji: '⚛️', label: 'Tabla periódica', hint: 'Explora los 118', tone: 'success' },
    {
      href: '/errores',
      emoji: '🎯',
      label: 'Mis errores',
      hint:
        difficultCount > 0
          ? `${formatNumber(difficultCount)} ${pluralize(difficultCount, 'elemento', 'elementos')} por reforzar`
          : '¡Nada pendiente!',
      tone: 'danger',
      count: difficultCount,
    },
    { href: '/estadisticas', emoji: '📊', label: 'Estadísticas', hint: 'Mira cómo mejoras', tone: 'streak' },
  ];
}

export interface QuickAccessProps {
  /** Elementos difíciles (`difficultElements`): el mismo número que «Elementos difíciles» en /errores. */
  difficultCount: number;
  className?: string;
}

/** Rejilla de accesos rápidos: icono, nombre y una pista de una línea. */
export function QuickAccess({ difficultCount, className }: QuickAccessProps) {
  return (
    <section aria-labelledby="quick-access-title" className={className}>
      <h2 id="quick-access-title" className="mb-3 text-xl font-black">
        Accesos rápidos
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {quickLinks(difficultCount).map((item) => (
          <li key={item.href} className="min-w-0">
            <Link href={item.href} className={cn(LINK_CARD, 'flex h-full min-h-32 flex-col gap-3 p-4')}>
              <span className="flex items-start justify-between gap-2">
                <span
                  aria-hidden
                  className={cn(
                    'grid size-12 shrink-0 place-items-center rounded-2xl text-2xl leading-none transition-transform duration-200 ease-spring group-hover:scale-110 group-hover:-rotate-6',
                    TONE_SOFT[item.tone],
                  )}
                >
                  {item.emoji}
                </span>
                {item.count !== undefined && item.count > 0 ? (
                  <span
                    aria-hidden
                    className="grid h-7 min-w-7 place-items-center rounded-full bg-danger px-2 text-sm font-black text-on-danger tabular animate-pop"
                  >
                    {item.count > 99 ? '99+' : item.count}
                  </span>
                ) : (
                  <ChevronRight
                    aria-hidden
                    className="size-5 text-muted transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                )}
              </span>
              <span className="min-w-0">
                <span className="block leading-tight font-black">{item.label}</span>
                <span className="mt-0.5 block text-sm leading-snug font-semibold text-muted">{item.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
