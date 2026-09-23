import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Mini examen',
  description:
    'Ponte a prueba con un examen rápido (10), normal (20), completo (50) o personalizado: elige temas y elementos, y descubre tu nota, tus errores y qué repasar.',
};

export default function ExamenLayout({ children }: { children: ReactNode }) {
  return children;
}
