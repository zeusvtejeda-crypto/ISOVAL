import { Check, X } from 'lucide-react';
import { cn } from '@/components/ui';

export type OptionState = 'idle' | 'selected' | 'correct' | 'incorrect' | 'disabled';

export interface OptionButtonProps {
  /** Letra de la insignia: "A"–"D". */
  letter: string;
  label: string;
  /** Texto secundario (p. ej. el nombre bajo un símbolo). */
  sublabel?: string;
  state?: OptionState;
  onClick?: () => void;
  disabled?: boolean;
  /** Atajos para `aria-keyshortcuts` (p. ej. "1 A"). */
  shortcut?: string;
  /** Celda de una rejilla 2 × 2 (etiquetas cortas en pantallas bajas): texto e insignia más pequeños. */
  dense?: boolean;
  className?: string;
}

const BOX: Record<OptionState, string> = {
  idle: 'border-border bg-surface [--press-shade:var(--color-border)] hover:border-border-strong hover:bg-surface-2',
  selected: 'border-brand bg-brand-soft [--press-shade:var(--color-brand)]',
  correct: 'border-success bg-success-soft [--press-shade:var(--color-success)] animate-pop',
  incorrect: 'border-danger bg-danger-soft [--press-shade:var(--color-danger)] animate-shake',
  disabled: 'border-border bg-surface opacity-50 [--press-shade:var(--color-border)]',
};

const BADGE: Record<OptionState, string> = {
  idle: 'border-border text-muted group-hover:border-border-strong',
  selected: 'border-brand bg-brand text-on-brand',
  correct: 'border-success bg-success text-on-success',
  incorrect: 'border-danger bg-danger text-on-danger',
  disabled: 'border-border text-muted',
};

const SPEECH: Partial<Record<OptionState, string>> = {
  correct: ' (respuesta correcta)',
  incorrect: ' (tu respuesta, incorrecta)',
};

/** Opción de respuesta con insignia A–D; verde con "pop" si es correcta, roja con sacudida si no. */
export function OptionButton({
  letter,
  label,
  sublabel,
  state = 'idle',
  onClick,
  disabled = false,
  shortcut,
  dense = false,
  className,
}: OptionButtonProps) {
  const icon = state === 'correct' ? <Check strokeWidth={3} /> : state === 'incorrect' ? <X strokeWidth={3} /> : null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={shortcut}
      className={cn(
        'pressable group relative flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left text-fg',
        'disabled:cursor-default',
        // Pantallas bajas (≤ 700 px de alto): opciones más bajas para que quepan las 4 sin desplazarse.
        dense
          ? '[@media(max-height:700px)]:min-h-12 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:px-2 [@media(max-height:700px)]:py-2'
          : '[@media(max-height:700px)]:min-h-12 [@media(max-height:700px)]:gap-2.5 [@media(max-height:700px)]:py-2',
        BOX[state],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-xl border-2 text-sm font-black transition-colors [&_svg]:size-4',
          dense ? '[@media(max-height:700px)]:size-7 [@media(max-height:700px)]:rounded-lg' : '[@media(max-height:700px)]:size-8',
          BADGE[state],
        )}
      >
        {icon ?? letter}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-lg leading-snug font-extrabold break-words',
            dense && 'hyphens-auto [@media(max-height:700px)]:text-[0.9375rem]',
          )}
        >
          {label}
        </span>
        {sublabel && <span className="block text-sm font-semibold text-muted">{sublabel}</span>}
        {SPEECH[state] && <span className="sr-only">{SPEECH[state]}</span>}
      </span>
    </button>
  );
}
