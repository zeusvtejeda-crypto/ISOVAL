'use client';

import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useHydrated } from '@/hooks/useHydrated';
import { cn } from './cn';
import { trapTab } from './focus';
import { IconButton } from './IconButton';
import { lockScroll, unlockScroll } from './scroll-lock';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Título del diálogo (nombre accesible). */
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Zona inferior fija (botones de acción). */
  footer?: ReactNode;
  size?: ModalSize;
  /** Oculta el título visualmente (se mantiene para lectores de pantalla). */
  hideTitle?: boolean;
  /** Muestra el botón ✕ de cerrar. Por defecto `true`. */
  showClose?: boolean;
  /** Permite cerrar con Escape o tocando el fondo. Por defecto `true`. */
  dismissible?: boolean;
  /**
   * Elemento que recibe el foco al abrir. Por defecto, el propio panel del diálogo (así el lector de
   * pantalla anuncia el título y nunca se enfoca un control fuera de la vista); Tab lleva al primer control.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

const EXIT_MS = 200;

const SIZES: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl',
};

/** Pila de modales abiertos: solo el superior responde al teclado. */
const stack: symbol[] = [];

/**
 * Diálogo modal accesible: portal a `<body>`, `role="dialog"` + `aria-modal`, Escape y toque en el
 * fondo para cerrar, foco atrapado y restaurado al cerrar, scroll del fondo bloqueado.
 * En móvil se muestra como hoja inferior; desde `sm` aparece centrado.
 */
export function Modal(props: ModalProps) {
  const { open } = props;
  const hydrated = useHydrated();
  const [rendered, setRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setRendered(true);
  }
  const closing = rendered && !open;

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setRendered(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  if (!hydrated || !rendered) return null;
  return createPortal(<ModalPanel {...props} closing={closing} />, document.body);
}

interface ModalPanelProps extends ModalProps {
  closing: boolean;
}

function ModalPanel({
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideTitle = false,
  showClose = true,
  dismissible = true,
  initialFocusRef,
  className,
  closing,
}: ModalPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  const requestClose = () => {
    if (dismissible && !closing) onClose();
  };

  const onEscape = useEffectEvent(() => {
    if (dismissible && !closing) onClose();
  });

  const focusInitial = useEffectEvent(() => {
    const panel = panelRef.current;
    if (!panel) return;
    (initialFocusRef?.current ?? panel).focus({ preventScroll: true });
  });

  // Bloqueo de scroll + foco inicial y restauración al desmontar.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockScroll();
    focusInitial();
    return () => {
      unlockScroll();
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  // Teclado: Escape cierra y Tab queda atrapado (solo en el modal superior).
  useEffect(() => {
    const token = Symbol('modal');
    stack.push(token);
    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
      } else if (event.key === 'Tab') {
        trapTab(event, panelRef.current);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const idx = stack.indexOf(token);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden
        onClick={requestClose}
        className={cn('absolute inset-0 bg-overlay backdrop-blur-[2px]', closing ? 'animate-fade-out' : 'animate-fade-in')}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[min(92dvh,52rem)] w-full flex-col overflow-hidden border border-border bg-surface text-fg shadow-float outline-none',
          'rounded-t-[1.75rem] sm:rounded-3xl',
          SIZES[size],
          closing ? 'animate-sheet-down sm:animate-zoom-out' : 'animate-sheet-up sm:animate-zoom-in',
          className,
        )}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border-strong sm:hidden" />
        <div className="flex shrink-0 items-start gap-3 px-5 pt-3 sm:px-6 sm:pt-6">
          <div className={cn('min-w-0 flex-1 pt-1', hideTitle && 'sr-only')}>
            <h2 id={titleId} className="text-xl font-black leading-tight sm:text-2xl">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-muted sm:text-base">
                {description}
              </p>
            )}
          </div>
          {showClose && (
            <IconButton
              label="Cerrar"
              icon={<X />}
              onClick={requestClose}
              data-modal-close=""
              className="-mr-2 ml-auto"
            />
          )}
        </div>
        <div
          className={cn(
            'relative scroll-contained min-h-0 flex-1 overflow-y-auto px-5 pt-3 sm:px-6',
            footer ? 'pb-4' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6',
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-border px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
