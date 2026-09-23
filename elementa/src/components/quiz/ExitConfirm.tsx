'use client';

import { useRef } from 'react';
import { Button, Modal } from '@/components/ui';

export interface ExitConfirmProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  /** Texto del aviso. Por defecto: lo respondido cuenta, pero no habrá resumen. */
  description?: string;
  /** Botón para quedarse. Por defecto "Seguir jugando". */
  stayLabel?: string;
}

export const DEFAULT_EXIT_DESCRIPTION = 'Lo que ya respondiste cuenta para tu progreso, pero no verás el resumen final.';

/** Confirmación al salir de una sesión sin terminar. */
export function ExitConfirm({
  open,
  onStay,
  onLeave,
  description = DEFAULT_EXIT_DESCRIPTION,
  stayLabel = 'Seguir jugando',
}: ExitConfirmProps) {
  const stayRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      open={open}
      onClose={onStay}
      size="sm"
      title="¿Salir de la sesión?"
      description={description}
      initialFocusRef={stayRef}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button ref={stayRef} block className="sm:flex-1" onClick={onStay}>
            {stayLabel}
          </Button>
          <Button variant="ghost" block className="sm:flex-1" onClick={onLeave}>
            Salir
          </Button>
        </div>
      }
    />
  );
}
