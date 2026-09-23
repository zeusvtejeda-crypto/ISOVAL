'use client';

import { cn } from '@/components/ui/cn';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { UserStats } from './UserStats';

/**
 * Barra superior (móvil y tableta): logotipo, racha, nivel y cambio de tema. En escritorio la sustituye SideNav.
 * Por debajo de 360 px (teléfonos de 320 px) el logotipo pierde el nombre y los huecos se estrechan para que
 * quepa entera incluso con una racha de 3 cifras y nivel de 2 (si no, el navegador ensancharía la página).
 */
export function TopBar({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border/70 bg-bg/85 pt-safe px-safe backdrop-blur-xl lg:hidden',
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 max-[359px]:px-3 sm:h-16 sm:px-6">
        <Logo compact="narrow" />
        <div className="ml-auto flex min-w-0 items-center gap-1.5 max-[359px]:gap-1">
          <UserStats className="min-w-0 max-[359px]:gap-1" />
          <ThemeToggle variant="icon" className="-mr-1.5" />
        </div>
      </div>
    </header>
  );
}
