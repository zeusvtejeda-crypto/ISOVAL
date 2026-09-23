'use client';

import { useId, type ReactNode } from 'react';
import { cn } from './cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Etiqueta visible (nombre accesible del interruptor). */
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Oculta la etiqueta visualmente (sigue disponible para lectores de pantalla). */
  hideLabel?: boolean;
  id?: string;
  className?: string;
}

/** Interruptor accesible (`role="switch"`); toda la fila es pulsable. */
export function Switch({ checked, onChange, label, description, disabled = false, hideLabel = false, id, className }: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? `switch-${autoId}`;
  const labelId = `${switchId}-label`;
  const descId = description ? `${switchId}-desc` : undefined;

  return (
    <div className={cn('flex min-h-14 items-center justify-between gap-4', disabled && 'opacity-50', className)}>
      <div className={cn('min-w-0 flex-1', hideLabel && 'sr-only')}>
        <label id={labelId} htmlFor={switchId} className="block font-bold text-fg">
          {label}
        </label>
        {description && (
          <p id={descId} className="mt-0.5 text-sm text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-8 w-[3.25rem] shrink-0 items-center rounded-full p-1 transition-colors duration-200',
          'before:absolute before:-inset-1.5 before:content-[""] disabled:cursor-not-allowed',
          checked ? 'bg-brand' : 'bg-border-strong',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'size-6 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-spring',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
