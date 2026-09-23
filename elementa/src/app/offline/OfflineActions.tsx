'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { House, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { useOnlineStatus } from '@/components/pwa/useOnlineStatus';

type RetryState = 'idle' | 'checking' | 'failed';

const PROBE_TIMEOUT_MS = 5000;

/**
 * ¿Responde el servidor? Un HEAD sin caché (el SW no intercepta peticiones que no son GET).
 * Cualquier respuesta HTTP cuenta como conexión; solo un error de red o el tiempo agotado cuentan como fallo.
 */
async function canReachServer(): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(window.location.href, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * El SW sirve esta página en la URL que no pudo cargarse (p. ej. /tabla): reintentar es recargar esa URL.
 * Si se abrió /offline directamente, se vuelve al inicio.
 */
function retryTarget(): string {
  return window.location.pathname.replace(/\/+$/, '') === '/offline' ? '/' : window.location.href;
}

const MESSAGES: Record<RetryState, string> = {
  idle: '',
  checking: 'Comprobando la conexión…',
  failed: 'Sigues sin conexión. Lo intentaremos de nuevo en cuanto vuelva la red.',
};

/** Estado de la conexión + "Reintentar" (y reintento automático al recuperar la red). */
export function OfflineActions() {
  const online = useOnlineStatus();
  const [state, setState] = useState<RetryState>('idle');
  const checking = useRef(false);

  const retry = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    setState('checking');
    const reachable = await canReachServer();
    checking.current = false;
    if (reachable) {
      window.location.replace(retryTarget());
      return;
    }
    setState('failed');
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      void retry();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [retry]);

  return (
    <div className="mt-6 flex w-full flex-col items-center">
      <div className="flex min-h-7 items-center justify-center">
        {online !== null && (
          <Badge tone={online ? 'success' : 'danger'} size="md">
            <span aria-hidden className="size-2 rounded-full bg-current" />
            {online ? 'Red disponible' : 'Sin conexión'}
          </Badge>
        )}
      </div>

      <div className="mt-5 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <Button
          size="lg"
          loading={state === 'checking'}
          leftIcon={<RefreshCw aria-hidden />}
          onClick={() => void retry()}
        >
          Reintentar
        </Button>
        <ButtonLink href="/" size="lg" variant="secondary" leftIcon={<House aria-hidden />}>
          Ir al inicio
        </ButtonLink>
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm font-bold text-muted">
        {MESSAGES[state]}
      </p>
    </div>
  );
}
