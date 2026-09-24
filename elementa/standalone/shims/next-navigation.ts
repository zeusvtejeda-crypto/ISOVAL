import { useMemo, useSyncExternalStore } from 'react';
import { getLocation, navigate, subscribe } from '../router';

/** Sustituto de `next/navigation` para la versión de un solo archivo (enrutador por hash). */

interface NavigateOptions {
  scroll?: boolean;
}

const router = {
  push: (href: string, options?: NavigateOptions) => navigate(href, { scroll: options?.scroll }),
  replace: (href: string, options?: NavigateOptions) => navigate(href, { replace: true, scroll: options?.scroll }),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => {},
  prefetch: () => {},
};

function useLocation() {
  return useSyncExternalStore(subscribe, getLocation, getLocation);
}

export function useRouter() {
  return router;
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}
