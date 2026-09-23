import { useSyncExternalStore } from 'react';
import {
  dismissInstall,
  getInstallServerSnapshot,
  getInstallSnapshot,
  promptInstall,
  subscribeInstall,
  type InstallOutcome,
} from './install-prompt-store';
import { useInstallPlatform, type InstallPlatform } from './platform';
import { useIsStandalone } from './useIsStandalone';

export type { InstallOutcome } from './install-prompt-store';
export type { InstallPlatform } from './platform';

export interface InstallPromptApi {
  /** El navegador ofrece el diálogo nativo (Chrome/Edge en Android y escritorio). */
  canPrompt: boolean;
  /** La app se instaló durante esta sesión. */
  installed: boolean;
  /** El usuario ocultó la sugerencia (`localStorage['elementa:install-dismissed']`). */
  dismissed: boolean;
  /** La app ya se está usando instalada. */
  isStandalone: boolean;
  /** Instrucciones manuales disponibles cuando no hay diálogo nativo. */
  platform: InstallPlatform;
  /** Abre el diálogo nativo; `unavailable` si el navegador no lo ofrece. */
  promptInstall: () => Promise<InstallOutcome>;
  /** Oculta la sugerencia y lo recuerda en este dispositivo. */
  dismiss: () => void;
}

/** Todo lo necesario para ofrecer la instalación de Elementa con una interfaz propia. */
export function useInstallPrompt(): InstallPromptApi {
  const snapshot = useSyncExternalStore(subscribeInstall, getInstallSnapshot, getInstallServerSnapshot);
  const isStandalone = useIsStandalone();
  const platform = useInstallPlatform();
  return {
    canPrompt: snapshot.deferred !== null,
    installed: snapshot.installed,
    dismissed: snapshot.dismissed,
    isStandalone,
    platform,
    promptInstall,
    dismiss: dismissInstall,
  };
}
