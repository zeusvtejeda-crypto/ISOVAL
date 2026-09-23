'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui/cn';
import { MAIN_NAV, navState } from './nav-items';

/** Barra de pestañas inferior (móvil y tableta) con margen para la zona segura de iOS. */
export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-surface/90 pb-safe px-safe backdrop-blur-xl lg:hidden',
        className,
      )}
    >
      <ul className="mx-auto flex max-w-xl items-stretch">
        {MAIN_NAV.map((item) => {
          const state = navState(item, pathname);
          const active = state !== null;
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={state === 'page' ? 'page' : state === 'section' ? 'true' : undefined}
                className="group flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl pt-1.5 pb-1"
              >
                <span
                  className={cn(
                    'grid h-8 w-14 place-items-center rounded-full transition-[background-color,color,transform] duration-200 group-active:scale-90',
                    active ? 'bg-brand-soft text-brand' : 'text-muted group-hover:text-fg',
                  )}
                >
                  <Icon aria-hidden className="size-[1.4rem]" strokeWidth={active ? 2.6 : 2.1} />
                </span>
                <span
                  className={cn(
                    'text-[0.6875rem] leading-none font-extrabold',
                    active ? 'text-brand' : 'text-muted group-hover:text-fg',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
