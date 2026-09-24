/**
 * Enrutador por hash para la versión de un solo archivo (sin servidor): `#/tabla?e=8`.
 *
 * Sustituye al router de Next.js en `standalone/shims/*`. Mantiene la ruta en memoria (fuente de verdad)
 * y la refleja en el hash cuando el navegador lo permite, así funciona también dentro de marcos
 * restringidos. Los `history.pushState/replaceState('?e=8')` que hace la app se traducen al hash,
 * igual que Next sincroniza el historial nativo con `useSearchParams`.
 */

export interface RouteLocation {
  pathname: string;
  search: string; // sin "?"
}

type Listener = () => void;

const listeners = new Set<Listener>();
let known: ReadonlySet<string> = new Set(['/']);
let current: RouteLocation = { pathname: '/', search: '' };

function emit() {
  for (const fn of listeners) fn();
}

function splitPath(path: string): RouteLocation {
  const [pathname, search = ''] = path.split('?', 2);
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return { pathname: clean || '/', search };
}

/** Ruta a partir del hash; `null` si el hash no es una ruta (p. ej. el ancla "#contenido"). */
function fromHash(hash: string): RouteLocation | null {
  const raw = hash.replace(/^#/, '');
  if (raw === '' || raw === '/') return { pathname: '/', search: '' };
  if (raw.startsWith('/')) return splitPath(raw);
  // Enlace simple del artefacto: "#tabla" → /tabla (solo si existe la ruta).
  const bare = `/${raw}`;
  return known.has(bare) ? { pathname: bare, search: '' } : null;
}

/** Convierte un destino de la app ("/tabla?e=8", "?e=8", "/") en ruta absoluta. */
export function resolveHref(href: string): RouteLocation {
  if (href.startsWith('?')) return { pathname: current.pathname, search: href.slice(1) };
  if (href.startsWith('/')) return splitPath(href);
  return splitPath(`/${href}`);
}

export function toHash(loc: RouteLocation): string {
  return `#${loc.pathname}${loc.search ? `?${loc.search}` : ''}`;
}

export function getLocation(): RouteLocation {
  return current;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let nativePush: History['pushState'] | null = null;
let nativeReplace: History['replaceState'] | null = null;

function writeUrl(loc: RouteLocation, replace: boolean) {
  const write = replace ? nativeReplace : nativePush;
  try {
    write?.call(window.history, null, '', toHash(loc));
  } catch {
    // Marco sin acceso al historial: la ruta sigue viva en memoria.
  }
}

export function navigate(href: string, options: { replace?: boolean; scroll?: boolean } = {}) {
  const next = resolveHref(href);
  const samePage = next.pathname === current.pathname;
  current = next;
  writeUrl(next, options.replace ?? false);
  emit();
  if (options.scroll !== false && !samePage) window.scrollTo(0, 0);
}

/** Traduce las URL que la app pasa al historial nativo ("?e=8", "/tabla") al formato por hash. */
function translate(url: string | URL | null | undefined): { url: string | URL | null | undefined; loc: RouteLocation | null } {
  if (typeof url !== 'string' || url.startsWith('#')) return { url, loc: null };
  if (url.startsWith('?') || url.startsWith('/')) {
    const loc = resolveHref(url);
    return { url: toHash(loc), loc };
  }
  return { url, loc: null };
}

/** Arranca el enrutador: lee la ruta inicial y escucha el historial. */
export function startRouter(routes: Iterable<string>) {
  known = new Set(routes);
  current = fromHash(window.location.hash) ?? { pathname: '/', search: '' };

  nativePush = window.history.pushState;
  nativeReplace = window.history.replaceState;
  const wrap =
    (native: History['pushState']): History['pushState'] =>
    (data, unused, url) => {
      const t = translate(url);
      try {
        native.call(window.history, data, unused, t.url);
      } catch {
        // Ignorado: ver writeUrl.
      }
      if (t.loc) {
        current = t.loc;
        emit();
      }
    };
  window.history.pushState = wrap(nativePush);
  window.history.replaceState = wrap(nativeReplace);

  const sync = () => {
    const loc = fromHash(window.location.hash);
    if (!loc) return; // ancla interna: se mantiene la ruta actual
    if (loc.pathname === current.pathname && loc.search === current.search) return;
    current = loc;
    emit();
  };
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);
}
