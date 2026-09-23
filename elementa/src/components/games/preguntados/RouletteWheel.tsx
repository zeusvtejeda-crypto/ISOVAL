import { cn } from '@/components/ui';
import { TRIVIA_CATEGORIES, type TriviaCategoryId } from './categories';
import { BULBS, PATHS, SEGMENT, WHEEL_EASING, WHEEL_RADIUS as R } from './wheel-math';

export interface RouletteWheelProps {
  /** Rotación de la ruleta en grados. */
  rotation: number;
  /** Anima el giro hasta `rotation` durante `spinMs`. */
  spinning?: boolean;
  spinMs?: number;
  /** Categoría donde cayó: los demás gajos se atenúan. */
  landed?: TriviaCategoryId | null;
  /** Giro lento decorativo (portada). */
  idle?: boolean;
  className?: string;
}

/** Ruleta SVG de 6 categorías con puntero fijo arriba. Decorativa: el estado se anuncia fuera. */
export function RouletteWheel({ rotation, spinning = false, spinMs = 0, landed = null, idle = false, className }: RouletteWheelProps) {
  return (
    <div aria-hidden className={cn('relative aspect-square w-full select-none', className)}>
      <div className="absolute inset-[3%] rounded-full shadow-float" />
      {/* Recorte circular fijo: el cuadrado girado no ensancha la página (su caja crece hasta ×√2). */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${spinMs}ms ${WHEEL_EASING}` : undefined,
          }}
        >
          <svg
            viewBox="-172 -172 344 344"
            className={cn('size-full', idle && '[animation:eg-wheel-idle_40s_linear_infinite]')}
          >
            <circle r={R + 10} className="fill-brand-shade" />
            {TRIVIA_CATEGORIES.map((cat, i) => (
              <path
                key={cat.id}
                d={PATHS[i]}
                className={cn(
                  cat.fill,
                  'stroke-surface transition-opacity duration-300',
                  landed && landed !== cat.id && 'opacity-35',
                )}
                strokeWidth={3}
                strokeLinejoin="round"
              />
            ))}
            {TRIVIA_CATEGORIES.map((cat, i) => (
              <g key={cat.id} transform={`rotate(${i * SEGMENT + SEGMENT / 2})`}>
                <text y={-R * 0.55} textAnchor="middle" dominantBaseline="central" fontSize={36}>
                  {cat.emoji}
                </text>
                <text
                  y={-R * 0.83}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={cat.label.length > 9 ? 14 : 16}
                  fontWeight={900}
                  className={cat.ink}
                >
                  {cat.label}
                </text>
              </g>
            ))}
            {BULBS.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={3.2} className={i % 2 === 0 ? 'fill-xp-glow' : 'fill-surface'} />
            ))}
          </svg>
        </div>
      </div>

      {/* Centro fijo */}
      <div className="absolute inset-0 grid place-items-center">
        <span className="grid size-[19%] place-items-center rounded-full border-[5px] border-brand-shade bg-surface text-[clamp(1.25rem,6vw,2rem)] leading-none shadow-card">
          ⚛️
        </span>
      </div>

      {/* Puntero fijo */}
      <svg
        viewBox="0 0 40 48"
        className={cn('absolute top-0 left-1/2 w-[12%] -translate-x-1/2 -translate-y-[38%] drop-shadow-md', landed && 'animate-wiggle')}
      >
        <path
          d="M20 46 L9.28 25 A14 14 0 1 1 30.72 25 Z"
          className="fill-fg stroke-surface"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <circle cx={20} cy={16} r={5.5} className="fill-surface" />
      </svg>
    </div>
  );
}
