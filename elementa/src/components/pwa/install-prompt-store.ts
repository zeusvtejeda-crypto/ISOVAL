/**
 * Estado de la instalación de la PWA, compartido por toda la app (store externo para `useSyncExternalStore`).
 *
 * `beforeinstallprompt` puede dispararse antes de que se monte cualquier <InstallPrompt />, así que se
 * escucha en cuanto este módulo se evalúa en el navegador (lo importa `ServiceWorkerRegister`, presente en
 * el layout raíz) y el evento se guarda para usarlo más tarde.
 */

import { INSTALL_DISMISSED_KEY } from '@/services/storage/keys';

/** Evento de Chromium para instalar la app (no está en lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface InstallSnapshot {
  /** Evento listo para `prompt()`; `null` si el navegador no ofrece la instalación (o ya se usó). */
  deferred: BeforeInstallPromptEvent | null;
  /** La app se instaló durante esta sesión (`appinstalled` o diálogo aceptado). */
  installed: boolean;
  /** El usuario ocultó la sugerencia de instalación (persistido en este dispositivo). */
  dismissed: boolean;
}

/** En el servidor la sugerencia se considera oculta: nunca se renderiza en el HTML estático. */
const SERVER_SNAPSHOT: InstallSnapshot = Object.freeze({ deferred: null, installed: false, dismissed: true });

let snapshot: InstallSnapshot = { deferred: null, installed: false, dismissed: false };
let started = false;
const listeners = new Set<() => void>();

function update(patch: Partial<InstallSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return typeof (event as Partial<BeforeInstallPromptEvent>).prompt === 'function';
}

/** Empieza a escuchar los eventos de instalación. Idempotente y seguro en el servidor. */
export function startInstallPromptCapture(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  snapshot = { ...snapshot, dismissed: readDismissed() };

  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isBeforeInstallPromptEvent(event)) return;
    // Sustituimos la mini-barra del navegador por nuestro propio botón.
    event.preventDefault();
    update({ deferred: event });
  });
  window.addEventListener('appinstalled', () => update({ deferred: null, installed: true }));
  window.addEventListener('storage', (event) => {
    if (event.key === INSTALL_DISMISSED_KEY || event.key === null) update({ dismissed: readDismissed() });
  });
}

export function subscribeInstall(listener: () => void): () => void {
  startInstallPromptCapture();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallSnapshot(): InstallSnapshot {
  return snapshot;
}

export function getInstallServerSnapshot(): InstallSnapshot {
  return SERVER_SNAPSHOT;
}

let pendingPrompt: Promise<InstallOutcome> | null = null;

/**
 * Abre el diálogo nativo de instalación (solo Chromium). El evento solo puede usarse una vez: se descarta
 * al conocer la respuesta. Llamadas simultáneas comparten el mismo diálogo.
 */
export function promptInstall(): Promise<InstallOutcome> {
  if (pendingPrompt) return pendingPrompt;
  const event = snapshot.deferred;
  if (!event) return Promise.resolve('unavailable');

  pendingPrompt = (async (): Promise<InstallOutcome> => {
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      update({ deferred: null, installed: snapshot.installed || outcome === 'accepted' });
      return outcome;
    } catch {
      update({ deferred: null });
      return 'unavailable';
    } finally {
      pendingPrompt = null;
    }
  })();
  return pendingPrompt;
}

/** Oculta la sugerencia de instalación y lo recuerda en este dispositivo. */
export function dismissInstall(): void {
  try {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, new Date().toISOString());
  } catch {
    // Almacenamiento no disponible (modo privado): se oculta solo durante esta sesión.
  }
  update({ dismissed: true });
}

// Lo antes posible: el evento puede llegar antes de que se monte ningún componente.
startInstallPromptCapture();
