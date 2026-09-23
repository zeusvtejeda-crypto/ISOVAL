import type { Metadata } from 'next';
import { GameHub } from '@/components/hub/GameHub';

export const metadata: Metadata = {
  title: 'Jugar',
  description:
    'Todos los modos de Elementa: sesión inteligente, Aprende 5, flashcards, Preguntados, mini exámenes, contrarreloj, supervivencia, racha y más.',
};

export default function JugarPage() {
  return <GameHub />;
}
