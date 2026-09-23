import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Bloques y familias',
  description:
    'Aprende la tabla periódica de 10 en 10 o por familias químicas: mira tu dominio de cada grupo y elige qué aprender o practicar.',
};

export default function BloquesLayout({ children }: { children: ReactNode }) {
  return children;
}
