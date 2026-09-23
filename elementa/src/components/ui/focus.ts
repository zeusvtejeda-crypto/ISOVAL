const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/** Elementos enfocables y visibles dentro de `root`, en orden del documento. */
export function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
  );
}

/**
 * Mantiene el foco dentro de `root` al pulsar Tab / Mayús+Tab. Si el foco está en el propio `root`
 * (p. ej. el panel de un modal recién abierto), Tab va al primer control y Mayús+Tab al último.
 */
export function trapTab(event: KeyboardEvent, root: HTMLElement | null): void {
  if (!root) return;
  const items = getFocusable(root);
  if (items.length === 0) {
    event.preventDefault();
    root.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const outside = !(active instanceof Node && root.contains(active)) || active === root;
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}
