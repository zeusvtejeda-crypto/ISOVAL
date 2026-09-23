'use client';

import { ThemeToggle } from '@/components/layout';
import { useHydrated } from '@/hooks/useHydrated';
import { useTheme } from '@/hooks/useTheme';

/** Tema claro / oscuro / del sistema. Se guarda en los ajustes y en este dispositivo. */
export function ThemeSetting() {
  const { theme, resolvedTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <div>
      <ThemeToggle block />
      <p className="mt-2 text-sm font-semibold text-muted">
        {hydrated && theme === 'system'
          ? `Sigue a tu dispositivo: ahora está en modo ${resolvedTheme === 'dark' ? 'oscuro 🌙' : 'claro ☀️'}.`
          : 'Elige cómo quieres ver Elementa.'}
      </p>
    </div>
  );
}
