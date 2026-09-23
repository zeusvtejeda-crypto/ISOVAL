'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { IconButton } from '@/components/ui/IconButton';
import type { CelebrationKind, CelebrationToastData } from './celebration-plan';

export type { CelebrationKind } from './celebration-plan';

export interface CelebrationToast extends CelebrationToastData {
  id: number;
}

const KIND_META: Record<CelebrationKind, { eyebrow: string; eyebrowClass: string; iconClass: string }> = {
  achievement: { eyebrow: 'Logro desbloqueado', eyebrowClass: 'text-xp', iconClass: 'bg-xp-soft ring-xp/40' },
  goal: { eyebrow: 'Meta diaria', eyebrowClass: 'text-success', iconClass: 'bg-success-soft ring-success/40' },
  level: { eyebrow: 'Nuevo nivel', eyebrowClass: 'text-brand', iconClass: 'bg-brand-soft ring-brand/40' },
};

export interface CelebrationToastsProps {
  /** Avisos visibles (el anfitrión decide cuántos: 1 en modo inmersivo, hasta 3 si no). */
  toasts: readonly CelebrationToast[];
  onDismiss: (id: number) => void;
  /**
   * Pantalla de enfoque: avisos compactos (sin texto secundario ni enlace, para no sacar al usuario)
   * y colocados bajo la cabecera del quiz, sin tapar nunca el botón de salir.
   */
  immersive?: boolean;
}

/**
 * Pila de avisos de celebración en la parte superior (región `aria-live`). El contenedor no captura
 * toques (`pointer-events-none`): solo la tarjeta y su botón de cerrar son interactivos.
 */
export function CelebrationToasts({ toasts, onDismiss, immersive = false }: CelebrationToastsProps) {
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4',
        immersive
          ? // Bajo la cabecera inmersiva (py-4/sm:py-6 del contenedor + ~60 px de cabecera).
            'top-[calc(env(safe-area-inset-top)+4.5rem)] sm:top-[calc(env(safe-area-inset-top)+5.25rem)]'
          : 'top-[calc(env(safe-area-inset-top)+0.75rem)]',
      )}
    >
      {toasts.map((toast) => {
        const meta = KIND_META[toast.kind];
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full items-center rounded-2xl border border-border bg-surface/95 shadow-float backdrop-blur-md animate-slide-down',
              immersive ? 'max-w-xs gap-2.5 p-1.5 pl-2' : 'max-w-sm gap-3 p-2.5 pl-3',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid shrink-0 place-items-center rounded-xl ring-2 animate-bounce-in',
                immersive ? 'size-9 text-xl' : 'size-11 text-2xl',
                meta.iconClass,
              )}
            >
              {toast.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-[0.7rem] font-black uppercase tracking-wider', meta.eyebrowClass)}>
                {toast.eyebrow ?? meta.eyebrow}
              </p>
              <p className="truncate font-black leading-tight">{toast.title}</p>
              {toast.body && <p className={immersive ? 'sr-only' : 'truncate text-sm text-muted'}>{toast.body}</p>}
            </div>
            {toast.href && !immersive && (
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
