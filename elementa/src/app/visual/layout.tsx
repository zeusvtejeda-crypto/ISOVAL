import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Visual',
  description:
    'Preguntas sobre la tabla periódica: toca la casilla de un elemento, encuéntralo por su número, selecciona una familia entera o elige un miembro de un grupo.',
};

export default function VisualLayout({ children }: { children: ReactNode }) {
  return children;
}
