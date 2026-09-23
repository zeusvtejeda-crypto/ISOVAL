'use client';

import { useId, useState } from 'react';
import { CircleCheck, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { AppIcon } from './AppIcon';
import { InstallInstructions } from './InstallInstructions';
import { useInstallPrompt, type InstallPromptApi } from './useInstallPrompt';

export { useIsStandalone } from './useIsStandalone';
export { useInstallPrompt, type InstallPromptApi } from './useInstallPrompt';

export interface InstallPromptProps {
  /**
   * `card` (por defecto): tarjeta promocional descartable, p. ej. en el inicio.
   * `compact`: fila sobria para Ajustes; también informa cuando la app ya está instalada.
   */
  variant?: 'card' | 'compact';
  /** Muestra el botón de ocultar y respeta el descarte guardado. Por defecto: `true` en `card`, `false` en `compact`. */
  dismissible?: boolean;
  className?: string;
}

type Mode = 'native' | 'ios' | 'mac-safari' | 'installed';

function resolveMode(api: InstallPromptApi, variant: 'card' | 'compact', dismissible: boolean): Mode | null {
  if (api.isStandalone) return variant === 'compact' ? 'installed' : null;
  if (dismissible && api.dismissed) return null;
  if (api.installed) return 'installed';
  if (api.canPrompt) return 'native';
  if (api.platform !== 'other') return api.platform;
  return null;
}

const CARD_COPY: Record<Mode, { title: string; text: string }> = {
  native: {
    title: 'Instala Elementa',
    text: 'Ábrela desde tu pantalla de inicio, a pantalla completa y aunque no tengas internet.',
  },
  ios: {
    title: 'Añade Elementa a tu inicio',
    text: 'Ábrela como una app y estudia aunque no tengas internet.',
  },
  'mac-safari': {
    title: 'Añade Elementa al Dock',
    text: 'Ábrela como una app y estudia aunque no tengas internet.',
  },
  installed: {
    title: '¡Elementa ya está instalada!',
    text: 'Búscala en tu pantalla de inicio o entre tus apps.',
  },
};

const COMPACT_COPY: Record<Mode, { title: string; text: string }> = {
  native: { title: 'Instalar Elementa', text: 'Úsala como app, también sin conexión.' },
  ios: { title: 'Instalar en iPhone o iPad', text: 'Toca Compartir → Añadir a pantalla de inicio.' },
  'mac-safari': { title: 'Añadir al Dock', text: 'En Safari: Archivo → Añadir al Dock.' },
  installed: { title: 'App instalada', text: 'Elementa ya está en este dispositivo.' },
};

/**
 * Sugerencia para instalar la PWA: botón nativo en Chrome/Edge (`beforeinstallprompt`) e instrucciones
 * en iOS y Safari para Mac. No se muestra si la app ya está instalada o si el usuario la ocultó.
 */
export function InstallPrompt({ variant = 'card', dismissible = variant === 'card', className }: InstallPromptProps) {
  const api = useInstallPrompt();
  const [prompting, setPrompting] = useState(false);
  const titleId = useId();
  const mode = resolveMode(api, variant, dismissible);

  if (!mode) return null;

  const handleInstall = async () => {
    setPrompting(true);
    try {
      await api.promptInstall();
    } finally {
      setPrompting(false);
    }
  };

  if (variant === 'compact') {
    const copy = COMPACT_COPY[mode];
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <AppIcon size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight text-fg">{copy.title}</p>
          <p className="mt-0.5 text-sm leading-snug text-muted">{copy.text}</p>
        </div>
        {mode === 'native' && (
          <Button size="sm" loading={prompting} leftIcon={<Download aria-hidden />} onClick={handleInstall}>
            Instalar
          </Button>
        )}
        {mode === 'installed' && <CircleCheck aria-hidden className="size-6 shrink-0 text-success" />}
        {dismissible && mode !== 'installed' && (
          <IconButton label="Ocultar sugerencia de instalación" icon={<X aria-hidden />} size="sm" onClick={api.dismiss} />
        )}
      </div>
    );
  }

  const copy = CARD_COPY[mode];
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-card animate-slide-up sm:p-5',
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-44 rounded-full bg-brand/10 blur-2xl" />

      <div className="relative flex items-start gap-3.5">
        <AppIcon size={56} />
        <div className={cn('min-w-0 flex-1', dismissible && 'pr-8')}>
          <h2 id={titleId} className="text-lg leading-tight font-black text-fg">
            {copy.title}
          </h2>
          <p aria-live="polite" className="mt-1 text-sm leading-snug text-muted">
            {copy.text}
          </p>
        </div>
      </div>

      {mode === 'native' && (
        <div className="relative mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button loading={prompting} leftIcon={<Download aria-hidden />} onClick={handleInstall} className="w-full sm:w-auto">
            Instalar Elementa
          </Button>
          <span className="text-center text-xs font-bold text-muted sm:text-left">Gratis · Sin tiendas de apps</span>
        </div>
      )}

      {(mode === 'ios' || mode === 'mac-safari') && (
        <div className="relative mt-4">
          <InstallInstructions platform={mode} />
          {dismissible && (
            <Button variant="secondary" size="sm" onClick={api.dismiss} className="mt-4 w-full sm:w-auto">
              Entendido
            </Button>
          )}
        </div>
      )}

      {dismissible && (
        <div className="absolute top-3 right-3">
          <IconButton
            label={mode === 'installed' ? 'Cerrar' : 'Ocultar sugerencia de instalación'}
            icon={<X aria-hidden />}
            size="sm"
            className="text-muted"
            onClick={api.dismiss}
          />
        </div>
      )}
    </section>
  );
}
