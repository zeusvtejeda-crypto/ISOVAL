import { cn } from '@/components/ui/cn';

export interface LevelEmblemProps {
  level: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  sm: { box: 'size-9 rounded-xl', label: 'text-[0.45rem]', num: 'text-base' },
  md: { box: 'size-14 rounded-2xl', label: 'text-[0.55rem]', num: 'text-2xl' },
  lg: { box: 'size-20 rounded-[1.6rem]', label: 'text-[0.65rem]', num: 'text-4xl' },
  xl: { box: 'size-28 rounded-[2rem]', label: 'text-xs', num: 'text-6xl' },
} as const;

/** Insignia del nivel con forma de casilla de la tabla periódica. */
export function LevelEmblem({ level, size = 'md', className }: LevelEmblemProps) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn(
        'relative grid shrink-0 place-items-center bg-brand-gradient text-on-brand shadow-[0_4px_0_0_var(--color-brand-shade)]',
        s.box,
        className,
      )}
    >
      <span className="flex flex-col items-center leading-none">
        {size !== 'sm' && <span className={cn('font-extrabold uppercase tracking-[0.14em] opacity-85', s.label)}>Nivel</span>}
        <span className={cn('font-black tabular tracking-tight', s.num)}>{level}</span>
      </span>
    </span>
  );
}
