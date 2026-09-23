'use client';

import { useRef, useState } from 'react';
import { Modal } from '@/components/ui';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';
import { ElementDetail } from './ElementDetail';

export interface ElementModalProps {
  /** Elemento a mostrar; `null` cierra el modal. */
  atomicNumber: number | null;
  onClose: () => void;
  /**
   * Se llama al pasar al elemento anterior/siguiente (p. ej. para actualizar la URL).
   * El modal cambia de elemento aunque no se indique.
   */
  onNavigate?: (atomicNumber: number) => void;
}

/** Ficha del elemento en un modal (hoja inferior en móvil). */
export function ElementModal({ atomicNumber, onClose, onNavigate }: ElementModalProps) {
  const valid = atomicNumber !== null && ELEMENTS_BY_NUMBER[atomicNumber] !== undefined;
  const topRef = useRef<HTMLDivElement>(null);
  // Foco inicial en el nombre (arriba), no en «Practicar este elemento» (fuera de la pantalla en móvil).
  const titleRef = useRef<HTMLElement>(null);
  // Elemento mostrado: sigue a la prop, pero se conserva durante la animación de cierre y
  // permite navegar aunque el padre no controle `onNavigate`.
  const [prop, setProp] = useState(atomicNumber);
  const [shown, setShown] = useState<number | null>(valid ? atomicNumber : null);

  if (atomicNumber !== prop) {
    setProp(atomicNumber);
    if (valid) setShown(atomicNumber);
  }

  const navigate = (z: number) => {
    setShown(z);
    onNavigate?.(z);
    topRef.current?.scrollIntoView({ block: 'start' });
  };

  const element = shown !== null ? ELEMENTS_BY_NUMBER[shown] : undefined;

  return (
    <Modal
      open={valid}
      onClose={onClose}
      title={element?.name ?? 'Elemento'}
      hideTitle
      size="lg"
      initialFocusRef={titleRef}
    >
      <div ref={topRef} aria-hidden className="-mt-3 h-0" />
      {element && (
        <ElementDetail atomicNumber={element.atomicNumber} onNavigate={navigate} titleAs="p" titleRef={titleRef} />
      )}
    </Modal>
  );
}
