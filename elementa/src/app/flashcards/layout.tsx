import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Flashcards',
  description:
    'Memoriza símbolos, nombres, números atómicos, familias, grupos y masas con flashcards que giran y repetición espaciada: lo que te cuesta vuelve a salir.',
};

export default function FlashcardsLayout({ children }: { children: ReactNode }) {
  return children;
}
