import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GLIDE, SPRING_PANEL } from "../lib/motion";

export interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Acciones del pie; se alinean a la derecha. */
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal de cristal con AnimatePresence.
 *
 * `AnimatePresence` existe justo para esto: sin él, React desmonta el
 * nodo en cuanto `open` pasa a false y la animación de salida no llega a
 * verse. AnimatePresence lo mantiene vivo hasta que termina.
 *
 * Lo que hace que sea un diálogo de verdad y no una caja bonita:
 *
 *  · El foco entra al panel al abrir y VUELVE al elemento que lo abrió al
 *    cerrar. Sin esa devolución, quien navega con teclado aparece de
 *    vuelta al principio del documento sin saber dónde estaba.
 *  · Tab queda atrapado dentro del panel mientras está abierto.
 *  · Escape cierra, y el clic en el fondo también.
 *  · El scroll del fondo se bloquea compensando el ancho de la barra,
 *    porque si no la página da un salto lateral al abrir.
 */
export default function GlassModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: GlassModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const titleId = useId();
  const descId = useId();

  /* Foco: capturar, atrapar y devolver. */
  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    // Al primer control del panel; si no hay ninguno, al panel mismo.
    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      restoreTo.current?.focus();
    };
  }, [open, onClose]);

  /* Bloqueo de scroll sin salto lateral. */
  useEffect(() => {
    if (!open) return;

    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;

    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          {/* Fondo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.35, ease: GLIDE }}
            onClick={onClose}
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-md"
            aria-hidden
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={reduced ? { duration: 0.12 } : SPRING_PANEL}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/12
                       bg-ink-900/80 p-7 backdrop-blur-2xl outline-none sm:p-8
                       shadow-[0_40px_120px_-30px_rgba(0,0,0,1),inset_0_1px_0_0_rgba(255,255,255,.1)]"
          >
            {/* Luz superior */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-iris/70 to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[22rem] -translate-x-1/2 rounded-full bg-iris/25 blur-[80px]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-6">
                <h2
                  id={titleId}
                  className="text-xl font-semibold tracking-[-0.02em] text-mist sm:text-2xl"
                >
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                             border border-white/10 text-mist-dim transition-colors
                             hover:border-white/25 hover:bg-white/5 hover:text-mist"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {description && (
                <p id={descId} className="mt-3 text-sm leading-relaxed text-mist-dim">
                  {description}
                </p>
              )}

              {children && <div className="mt-6">{children}</div>}

              {footer && (
                <div className="mt-8 flex flex-wrap justify-end gap-3">{footer}</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
