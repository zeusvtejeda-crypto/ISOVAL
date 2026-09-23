'use client';

import { cn } from '@/components/ui/cn';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { UserStats } from './UserStats';

/** Barra superior (móvil y tableta): logotipo, racha, nivel y cambio de tema. En escritorio la sustituye SideNav. */
export function TopBar({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border/70 bg-bg/85 pt-safe px-safe backdrop-blur-xl lg:hidden',
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:h-16 sm:px-6">
        <Logo />
        <div className="ml-auto flex items-center gap-1.5">
          <UserStats />
          <ThemeToggle variant="icon" className="-mr-1.5" />
        </div>
      </div>
    </header>
  );
}
