'use client';

import { useEffect, useEffectEvent } from 'react';
import { isModalOpen } from '@/components/ui';

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/**
 * Atajos de teclado globales mientras `enabled`. El manejador devuelve `true` si usó la tecla
 * (se cancela su acción por defecto). Se ignoran repeticiones, teclas con modificadores,
 * campos de texto y pulsaciones con un modal abierto.
 */
export function useQuizKeys(onKey: (event: KeyboardEvent) => boolean | void, enabled = true): void {
  const handle = useEffectEvent(onKey);
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isModalOpen() || isTextField(event.target)) return;
      if (handle(event) === true) event.preventDefault();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled]);
}

/**
 * ¿El foco está en un control que ya reacciona a Enter/Espacio (botón, enlace, radio…)? Los atajos
 * globales de Enter/Espacio deben ignorar esas pulsaciones para no activar dos cosas a la vez.
 */
export function isActivationTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a, input, select, textarea, [role="button"], [role="radio"], [role="switch"]') !== null
  );
}

/** "1"–"4" o "a"–"d" → 0–3; cualquier otra tecla → `null`. */
export function optionIndexFromKey(key: string): number | null {
  if (/^[1-4]$/.test(key)) return Number(key) - 1;
  const lower = key.toLowerCase();
  if (/^[a-d]$/.test(lower)) return lower.charCodeAt(0) - 97;
  return null;
}
