import type { Metadata } from 'next';
import { PreguntadosGame } from '@/components/games';

export const metadata: Metadata = {
  title: 'Preguntados',
  description:
    'Gira la ruleta de categorías (símbolos, números, masa, familias, ubicación y propiedades), responde y reúne las 6 insignias para ganar la Corona química.',
};

export default function PreguntadosPage() {
  return <PreguntadosGame />;
}
