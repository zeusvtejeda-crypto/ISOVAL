import { cn } from '@/components/ui/cn';
import { formatNumber } from '@/utils/format';

export interface XpFloatProps {
  amount: number;
  className?: string;
}

/** "+10 XP ⚡" que sube y se desvanece (decorativo: la XP ya se anuncia en el feedback). */
export function XpFloat({ amount, className }: XpFloatProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed right-4 z-[60] inline-flex items-center gap-1 rounded-full bg-xp px-3 py-1.5 text-sm font-black text-bg shadow-float tabular animate-float-up',
        'top-[calc(env(safe-area-inset-top)+4.25rem)] sm:top-[calc(env(safe-area-inset-top)+4.75rem)] lg:right-8 lg:top-6',
        className,
      )}
    >
      +{formatNumber(amount)} XP <span className="text-[0.9em]">⚡</span>
    </div>
  );
}
