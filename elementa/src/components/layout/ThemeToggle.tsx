'use client';

import { Moon, Sun } from 'lucide-react';
import { useHydrated } from '@/hooks/useHydrated';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePreference } from '@/types';
import { cn } from '@/components/ui/cn';
import { IconButton, type IconButtonSize } from '@/components/ui/IconButton';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl';

export interface ThemeToggleProps {
  /**
   * - `segmented` (por defecto): ☀️ Claro / 🌙 Oscuro / 🌓 Auto, para Ajustes.
   * - `icon`: botón compacto que alterna claro ↔ oscuro, para barras de navegación.
   */
  variant?: 'segmented' | 'icon';
  size?: IconButtonSize;
  className?: string;
}

const OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'light', label: 'Claro', icon: <span aria-hidden>☀️</span> },
  { value: 'dark', label: 'Oscuro', icon: <span aria-hidden>🌙</span> },
  { value: 'system', label: 'Auto', ariaLabel: 'Automático (según el sistema)', icon: <span aria-hidden>🌓</span> },
];

export function ThemeToggle({ variant = 'segmented', size = 'md', className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  if (variant === 'icon') {
    const label = !hydrated
      ? 'Cambiar tema'
      : resolvedTheme === 'dark'
        ? 'Cambiar a tema claro'
        : 'Cambiar a tema oscuro';
    return (
      <IconButton
        label={label}
        size={size}
        className={className}
        onClick={() => {
          const isDark = document.documentElement.classList.contains('dark');
          setTheme(isDark ? 'light' : 'dark');
        }}
        icon={
          <>
            <Sun aria-hidden className="dark:hidden" />
            <Moon aria-hidden className="hidden dark:block" />
          </>
        }
      />
    );
  }

  return (
    <SegmentedControl<ThemePreference>
      label="Tema"
      options={OPTIONS}
      value={hydrated ? theme : null}
      onChange={setTheme}
      className={cn(className)}
    />
  );
}
