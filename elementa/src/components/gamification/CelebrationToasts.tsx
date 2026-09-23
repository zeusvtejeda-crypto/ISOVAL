'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { IconButton } from '@/components/ui/IconButton';

export type CelebrationKind = 'achievement' | 'goal' | 'level';

export interface CelebrationToast {
  id: number;
  kind: CelebrationKind;
  emoji: string;
  title: string;
  body?: string;
  href?: string;
}

const KIND_META: Record<CelebrationKind, { eyebrow: string; eyebrowClass: string; iconClass: string }> = {
  achievement: { eyebrow: 'Logro desbloqueado', eyebrowClass: 'text-xp', iconClass: 'bg-xp-soft ring-xp/40' },
  goal: { eyebrow: 'Meta diaria', eyebrowClass: 'text-success', iconClass: 'bg-success-soft ring-success/40' },
  level: { eyebrow: 'Nuevo nivel', eyebrowClass: 'text-brand', iconClass: 'bg-brand-soft ring-brand/40' },
};

export interface CelebrationToastsProps {
  toasts: readonly CelebrationToast[];
  onDismiss: (id: number) => void;
  /** Oculta los enlaces para no sacar al usuario de una pantalla de enfoque. */
  hideLinks?: boolean;
}

/** Pila de avisos de celebración en la parte superior (región `aria-live`). */
export function CelebrationToasts({ toasts, onDismiss, hideLinks = false }: CelebrationToastsProps) {
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => {
        const meta = KIND_META[toast.kind];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-surface/95 p-2.5 pl-3 shadow-float backdrop-blur-md animate-slide-down"
          >
            <span
              aria-hidden
              className={cn('grid size-11 shrink-0 place-items-center rounded-xl text-2xl ring-2 animate-bounce-in', meta.iconClass)}
            >
              {toast.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-[0.7rem] font-black uppercase tracking-wider', meta.eyebrowClass)}>{meta.eyebrow}</p>
              <p className="truncate font-black leading-tight">{toast.title}</p>
              {toast.body && <p className="truncate text-sm text-muted">{toast.body}</p>}
            </div>
            {toast.href && !hideLinks && (
              <Link
                href={toast.href}
                onClick={() => onDismiss(toast.id)}
                className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-2.5 text-sm font-extrabold text-brand hover:bg-brand-soft"
              >
                Ver
              </Link>
            )}
            <IconButton size="sm" label="Cerrar aviso" icon={<X />} onClick={() => onDismiss(toast.id)} />
          </div>
        );
      })}
    </div>
  );
}
