import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { navigate, resolveHref, toHash } from '../router';

/** Sustituto de `next/link` para la versión de un solo archivo (enrutador por hash). */

type Href = string | { pathname?: string; query?: Record<string, string | number | undefined> };

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: Href;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
}

function hrefToString(href: Href): string {
  if (typeof href === 'string') return href;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(href.query ?? {})) if (v !== undefined) params.set(k, String(v));
  const query = params.toString();
  return `${href.pathname ?? ''}${query ? `?${query}` : ''}`;
}

function isExternal(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#') || url.startsWith('//');
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, replace, scroll, onClick, ...props },
  ref,
) {
  const rest = { ...props };
  delete rest.prefetch;
  const url = hrefToString(href);
  const external = isExternal(url);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || external) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(url, { replace, scroll });
  };

  return <a ref={ref} href={external ? url : toHash(resolveHref(url))} onClick={handleClick} {...rest} />;
});

export default Link;
