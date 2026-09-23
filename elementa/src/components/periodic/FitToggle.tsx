'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { Chip } from '@/components/ui';

export interface FitToggleProps {
  /** `true` = tabla ajustada al ancho de la pantalla. */
  compact: boolean;
  onChange: (compact: boolean) => void;
  size?: 'sm' | 'md';
  className?: string;
}

/** Conmutador "Ajustar a pantalla" para `PeriodicTable` (`compact`). */
export function FitToggle({ compact, onChange, size = 'md', className }: FitToggleProps) {
  return (
    <Chip
      size={size}
      selected={compact}
      onClick={() => onChange(!compact)}
      icon={compact ? <Maximize2 aria-hidden /> : <Minimize2 aria-hidden />}
      className={className}
    >
      Ajustar a pantalla
    </Chip>
  );
}
