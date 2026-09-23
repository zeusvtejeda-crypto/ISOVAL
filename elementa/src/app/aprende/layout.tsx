import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Aprende 5',
  description:
    'Aprende 5 elementos nuevos hoy: uno por uno, con trucos para recordarlos, su ubicación en la tabla y preguntas rápidas para comprobarlo.',
};

export default function AprendeLayout({ children }: { children: ReactNode }) {
  return children;
}
