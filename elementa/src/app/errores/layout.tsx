import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Mis errores',
  description:
    'Tus elementos más difíciles y las preguntas que fallaste, con la respuesta correcta y un acceso directo para practicarlas.',
};

export default function ErroresLayout({ children }: { children: ReactNode }) {
  return children;
}
