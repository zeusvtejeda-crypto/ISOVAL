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
   * - `segmented` (por defecto): ☀️ Claro / 🌙 Oscuro / 💻 Sistema, para Ajustes.
   * - `icon`: botón compacto que alterna claro ↔ oscuro, para barras de navegación.
   */
  variant?: 'segmented' | 'icon';
  size?: IconButtonSize;
  /** `segmented`: ocupa todo el ancho. */
  block?: boolean;
  /** `segmented`: por debajo de 360 px muestra solo los iconos (cada opción conserva su `aria-label`). */
  compactBelow360?: boolean;
  className?: string;
}

const THEMES: readonly { value: ThemePreference; label: string; ariaLabel: string; emoji: string }[] = [
  { value: 'light', label: 'Claro', ariaLabel: 'Claro', emoji: '☀️' },
  { value: 'dark', label: 'Oscuro', ariaLabel: 'Oscuro', emoji: '🌙' },
  { value: 'system', label: 'Sistema', ariaLabel: 'Sistema (como tu dispositivo)', emoji: '💻' },
];

function themeOptions(compact: boolean): SegmentedOption<ThemePreference>[] {
  return THEMES.map(({ value, label, ariaLabel, emoji }) => ({
    value,
    ariaLabel,
    icon: <span aria-hidden>{emoji}</span>,
    label: compact ? <span className="max-[359px]:sr-only">{label}</span> : label,
  }));
}

const OPTIONS = themeOptions(false);
const COMPACT_OPTIONS = themeOptions(true);

export function ThemeToggle({
  variant = 'segmented',
  size = 'md',
  block,
  compactBelow360 = false,
  className,
}: ThemeToggleProps) {
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
      options={compactBelow360 ? COMPACT_OPTIONS : OPTIONS}
      value={hydrated ? theme : null}
      onChange={setTheme}
      block={block}
      className={cn(className)}
    />
  );
}
