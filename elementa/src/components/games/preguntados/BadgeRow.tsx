import { cn } from '@/components/ui';
import { TRIVIA_CATEGORIES, type TriviaCategoryId } from './categories';

export interface BadgeRowProps {
  badges: readonly TriviaCategoryId[];
  /** Insignia recién ganada (rebota). */
  fresh?: TriviaCategoryId | null;
  size?: 'md' | 'lg';
  className?: string;
}

/** Las 6 insignias de la partida: a color las conseguidas, en gris las pendientes. */
export function BadgeRow({ badges, fresh = null, size = 'md', className }: BadgeRowProps) {
  const large = size === 'lg';
  return (
    <ul
      aria-label={`Insignias: ${badges.length} de ${TRIVIA_CATEGORIES.length}`}
      className={cn('flex flex-wrap items-start justify-center', large ? 'gap-x-3 gap-y-3' : 'gap-1.5 sm:gap-2.5', className)}
    >
      {TRIVIA_CATEGORIES.map((cat) => {
        const won = badges.includes(cat.id);
        return (
          <li key={cat.id} className={cn('flex flex-col items-center gap-1', large && 'w-[4.75rem]')}>
            <span
              aria-hidden
              className={cn(
                'grid place-items-center rounded-full leading-none transition-[opacity,filter,box-shadow] duration-300',
                large ? 'size-14 text-3xl' : 'size-10 text-xl',
                won
                  ? cn(cat.solid, cat.ring, 'shadow-card ring-2 ring-offset-2 ring-offset-bg')
                  : 'border-2 border-dashed border-border-strong bg-surface-2 opacity-60 grayscale',
                fresh === cat.id && 'animate-bounce-in',
              )}
            >
              {cat.emoji}
            </span>
            {large && (
              <span aria-hidden className={cn('text-center text-[0.6875rem] leading-tight font-extrabold', won ? 'text-fg' : 'text-muted')}>
                {cat.label}
              </span>
            )}
            <span className="sr-only">
              {cat.label}: {won ? 'conseguida' : 'pendiente'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
