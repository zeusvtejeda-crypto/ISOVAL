/** Atributo del panel de feedback fijo al pie (`FeedbackPanel`). */
export const FEEDBACK_PANEL_ATTR = 'data-feedback-panel';

/** La cabecera fija de las pantallas inmersivas (`ImmersiveHeader`). */
const IMMERSIVE_HEADER_SELECTOR = '[data-immersive-header]';

/** Aire entre lo revelado y la cabecera o el panel. */
const MARGIN_PX = 12;

export interface VerticalSpan {
  top: number;
  bottom: number;
}

/**
 * Desplazamiento vertical mínimo para que todas las cajas `rects` queden dentro de la franja
 * visible `[top, bottom]` (coordenadas de la ventana). Si no caben juntas, alinea la primera arriba.
 * 0 si ya se ven.
 */
export function revealScrollDelta(rects: readonly VerticalSpan[], visible: VerticalSpan): number {
  if (rects.length === 0) return 0;
  const minTop = Math.min(...rects.map((r) => r.top));
  const maxBottom = Math.max(...rects.map((r) => r.bottom));
  if (minTop >= visible.top && maxBottom <= visible.bottom) return 0;
  if (maxBottom - minTop > visible.bottom - visible.top) return minTop - visible.top;
  if (maxBottom > visible.bottom) return maxBottom - visible.bottom;
  return minTop - visible.top;
}

/**
 * Tras responder, desplaza la página lo justo para que `targets` (la opción tocada y la correcta,
 * o las casillas relevantes) queden entre la cabecera fija y el panel de feedback. El panel reserva
 * su alto en el flujo, así que siempre hay sitio para desplazarse.
 */
export function revealAboveFeedback(targets: readonly (Element | null | undefined)[], smooth = true): void {
  const elements = targets.filter((el): el is Element => el instanceof Element);
  if (elements.length === 0) return;
  const panel = document.querySelector<HTMLElement>(`[${FEEDBACK_PANEL_ATTR}]`);
  const header = document.querySelector(IMMERSIVE_HEADER_SELECTOR);
  const visible = {
    top: Math.max(0, header?.getBoundingClientRect().bottom ?? 0) + MARGIN_PX,
    bottom: window.innerHeight - (panel?.offsetHeight ?? 0) - MARGIN_PX,
  };
  const delta = revealScrollDelta(
    elements.map((el) => el.getBoundingClientRect()),
    visible,
  );
  if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: smooth ? 'smooth' : 'auto' });
}
