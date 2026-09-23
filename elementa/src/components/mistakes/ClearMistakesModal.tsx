'use client';

import { Trash2 } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { pluralize } from '@/utils/format';

export interface ClearMistakesModalProps {
  open: boolean;
  /** Nombre del elemento a limpiar, o `null` para borrar todos. */
  elementName: string | null;
  /** Preguntas que se borrarán. */
  count: number;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmación antes de borrar preguntas falladas (de un elemento o todas). */
export function ClearMistakesModal({ open, elementName, count, onConfirm, onClose }: ClearMistakesModalProps) {
  const questions = `${count} ${pluralize(count, 'pregunta fallada', 'preguntas falladas')}`;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={elementName ? `¿Borrar los errores de ${elementName}?` : '¿Borrar todos tus errores?'}
      description={`Se borrará${count === 1 ? '' : 'n'} ${questions}. Tu dominio y tu XP no cambian.`}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" leftIcon={<Trash2 aria-hidden />} onClick={onConfirm}>
            Borrar
          </Button>
        </div>
      }
    />
  );
}
