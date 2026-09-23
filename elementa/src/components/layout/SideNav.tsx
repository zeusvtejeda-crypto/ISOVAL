'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui/cn';
import { LevelBar } from '@/components/gamification/LevelBar';
import { StreakBadge } from '@/components/gamification/StreakBadge';
import { Logo } from './Logo';
import { MAIN_NAV, QUICK_NAV, navState, type NavItem } from './nav-items';
import { ThemeToggle } from './ThemeToggle';

function SideLink({ item, pathname, small = false }: { item: NavItem; pathname: string; small?: boolean }) {
  const state = navState(item, pathname);
  const active = state !== null;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={state === 'page' ? 'page' : state === 'section' ? 'true' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3 font-extrabold transition-[background-color,color,transform] duration-150 active:scale-[0.98]',
        small ? 'min-h-11 text-sm' : 'min-h-12 text-[0.95rem]',
        active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      <Icon aria-hidden className={small ? 'size-[1.1rem]' : 'size-5'} strokeWidth={active ? 2.6 : 2.1} />
      {item.label}
    </Link>
  );
}

/** Barra lateral de escritorio (≥ lg): navegación, accesos rápidos, nivel, racha y tema. */
export function SideNav({ className }: { className?: string }) {
  const pathname = usePathname() ?? '/';

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface/70 px-4 py-6 no-scrollbar lg:flex xl:w-72',
        className,
      )}
    >
      <Logo className="px-2" />

      <nav aria-label="Navegación principal" className="mt-8">
        <ul className="space-y-1">
          {MAIN_NAV.map((item) => (
            <li key={item.href}>
              <SideLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-labelledby="sidenav-quick" className="mt-8">
        <p id="sidenav-quick" className="px-3 pb-2 text-xs font-black tracking-wider text-muted uppercase">
          Accesos rápidos
        </p>
        <ul className="space-y-0.5">
          {QUICK_NAV.map((item) => (
            <li key={item.href}>
              <SideLink item={item} pathname={pathname} small />
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto space-y-3 pt-8">
        <div className="rounded-3xl border border-border bg-surface p-3.5 shadow-card">
          <LevelBar compact />
          <div className="mt-3 flex items-center justify-between gap-2">
            <Link href="/estadisticas" className="inline-flex min-h-11 items-center rounded-full transition-transform active:scale-95">
              <StreakBadge size="sm" showLabel />
            </Link>
            <ThemeToggle variant="icon" size="sm" />
          </div>
        </div>
      </div>
    </aside>
  );
}
