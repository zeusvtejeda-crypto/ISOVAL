'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Nombre accesible si `label` no es texto. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string | number> {
  options: readonly SegmentedOption<T>[];
  /** Valor seleccionado; `null`/`undefined` = ninguno (p. ej. antes de hidratar). */
  value: T | null | undefined;
  onChange: (value: T) => void;
  /** Nombre accesible del grupo. */
  label: string;
  size?: 'sm' | 'md';
  /** Ocupa todo el ancho y reparte las opciones. */
  block?: boolean;
  className?: string;
}

/** Selector de una opción entre varias (`radiogroup` con navegación por flechas). */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  block = false,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const focusIndex = selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled);

  function move(from: number, dir: 1 | -1 | 'first' | 'last') {
    const n = options.length;
    let i = dir === 'first' ? 0 : dir === 'last' ? n - 1 : from;
    for (let step = 0; step < n; step++) {
      if (dir === 1 || dir === -1) i = (i + dir + n) % n;
      const opt = options[i];
      if (opt && !opt.disabled) {
        onChange(opt.value);
        refs.current[i]?.focus();
        return;
      }
      if (dir === 'first') i++;
      if (dir === 'last') i--;
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, 1 | -1 | 'first' | 'last'> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
      Home: 'first',
      End: 'last',
    };
    const dir = keys[e.key];
    if (dir === undefined) return;
    e.preventDefault();
    move(index, dir);
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'gap-1 rounded-2xl border border-border bg-surface-2 p-1',
        block ? 'flex w-full' : 'inline-flex max-w-full',
        className,
      )}
    >
      {options.map((opt, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel}
            tabIndex={i === focusIndex ? 0 : -1}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 font-extrabold',
              'transition-[background-color,color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-40',
              '[&_svg]:size-4',
              size === 'sm' ? 'min-h-9 text-sm' : 'min-h-11 text-sm sm:text-base',
              block && 'flex-1',
              selected ? 'bg-surface text-fg shadow-card ring-1 ring-border' : 'text-muted hover:text-fg',
            )}
          >
            {opt.icon}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
