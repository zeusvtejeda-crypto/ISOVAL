import type { MasteryTier } from '@/types';
import { cn } from '@/components/ui/cn';
import { TIER_META, masteryTier } from '@/utils/mastery';

export interface MasteryBadgeProps {
  /** Dominio 0–100 (se ignora si se pasa `tier`). */
  value?: number;
  tier?: MasteryTier;
  /** Muestra el emoji del nivel. Por defecto `true`. */
  showEmoji?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** 🔴 Necesita práctica · 🟠 Aprendiendo · 🟡 Casi dominado · 🟢 Dominado */
export function MasteryBadge({ value = 0, tier, showEmoji = true, size = 'sm', className }: MasteryBadgeProps) {
  const t = tier ?? masteryTier(value);
  const meta = TIER_META[t];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-surface-2 font-extrabold leading-none',
        size === 'sm' ? 'h-7 gap-1 px-2.5 text-xs' : 'h-8 gap-1.5 px-3 text-sm',
        meta.textClass,
        className,
      )}
    >
      {showEmoji && (
        <span aria-hidden className="text-[0.8em]">
          {meta.emoji}
        </span>
      )}
      {meta.label}
    </span>
  );
}
