import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Practicar',
  description:
    'Refuerza tus errores, los elementos que más te cuestan, tus repasos pendientes o un bloque o familia concretos con preguntas que se adaptan a ti.',
};

export default function PracticarLayout({ children }: { children: ReactNode }) {
  return children;
}
