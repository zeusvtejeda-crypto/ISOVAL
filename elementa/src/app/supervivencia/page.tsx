import type { Metadata } from 'next';
import { SupervivenciaGame } from '@/components/games';

export const metadata: Metadata = {
  title: 'Supervivencia',
  description:
    'Tres vidas y preguntas infinitas sobre la tabla periódica, cada vez más difíciles. Cada error te cuesta una vida: ¿cuánto aguantas?',
};

export default function SupervivenciaPage() {
  return <SupervivenciaGame />;
}
