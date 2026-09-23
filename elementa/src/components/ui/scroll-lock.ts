/**
 * Bloqueo del scroll del documento con contador (admite modales anidados).
 * Mientras hay alguno activo, <html> tiene `data-scroll-locked` y `data-modal-open`,
 * que otros manejadores de teclado pueden consultar para no reaccionar debajo del modal.
 */
let locks = 0;

export function lockScroll(): void {
  if (typeof document === 'undefined') return;
  locks += 1;
  if (locks > 1) return;
  const root = document.documentElement;
  const gap = window.innerWidth - root.clientWidth;
  root.style.setProperty('--scrollbar-gap', `${Math.max(0, gap)}px`);
  root.setAttribute('data-scroll-locked', '');
  root.setAttribute('data-modal-open', '');
}

export function unlockScroll(): void {
  if (typeof document === 'undefined' || locks === 0) return;
  locks -= 1;
  if (locks > 0) return;
  const root = document.documentElement;
  root.removeAttribute('data-scroll-locked');
  root.removeAttribute('data-modal-open');
  root.style.removeProperty('--scrollbar-gap');
}

/** `true` si hay un modal abierto (útil para atajos de teclado globales). */
export function isModalOpen(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-modal-open');
}
