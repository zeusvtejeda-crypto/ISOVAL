'use client';

import { useSearchParams } from 'next/navigation';
import { ElementModal } from '@/components/periodic';
import { ELEMENTS_BY_NUMBER } from '@/data/elements';

/** `?e=<Z>` → número atómico válido (1–118) o `null`. */
export function parseElementParam(value: string | null): number | null {
  if (!value || !/^\d{1,3}$/.test(value.trim())) return null;
  const z = Number(value.trim());
  return ELEMENTS_BY_NUMBER[z] ? z : null;
}

interface ElementParamModalProps {
  onClose: () => void;
  onNavigate: (atomicNumber: number) => void;
}

/**
 * Ficha del elemento indicado en la URL (`/tabla?e=8`). Lee `useSearchParams`, así que debe ir
 * dentro de un `<Suspense>` para que el resto de la página se prerenderice.
 */
export function ElementParamModal({ onClose, onNavigate }: ElementParamModalProps) {
  const params = useSearchParams();
  const atomicNumber = parseElementParam(params.get('e'));
  return <ElementModal atomicNumber={atomicNumber} onClose={onClose} onNavigate={onNavigate} />;
}
