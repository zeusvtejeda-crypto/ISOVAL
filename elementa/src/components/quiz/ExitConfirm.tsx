'use client';

import { useRef } from 'react';
import { Button, Modal } from '@/components/ui';

export interface ExitConfirmProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

/** Confirmación al salir de una sesión sin terminar. */
export function ExitConfirm({ open, onStay, onLeave }: ExitConfirmProps) {
  const stayRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      open={open}
      onClose={onStay}
      size="sm"
      title="¿Salir de la sesión?"
      description="Lo que ya respondiste cuenta para tu progreso, pero no verás el resumen final."
      initialFocusRef={stayRef}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button ref={stayRef} block className="sm:flex-1" onClick={onStay}>
            Seguir jugando
          </Button>
          <Button variant="ghost" block className="sm:flex-1" onClick={onLeave}>
            Salir
          </Button>
        </div>
      }
    />
  );
}
