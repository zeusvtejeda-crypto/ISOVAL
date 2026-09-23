import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Estudiar ahora',
  description:
    'Tu sesión inteligente de hoy: elementos nuevos, repasos que ya tocan y los que más te cuestan, en unos pocos minutos.',
};

export default function EstudiarLayout({ children }: { children: ReactNode }) {
  return children;
}
