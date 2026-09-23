import type { Metadata } from 'next';
import { RachaGame } from '@/components/games/racha/RachaGame';

export const metadata: Metadata = {
  title: 'Modo Racha',
  description:
    'Encadena aciertos sobre los elementos químicos: tu XP se multiplica (x1.5, x2, x3) y ganas bonus en las rachas de 5, 10 y 20. Un error y se acaba.',
};

export default function RachaPage() {
  return <RachaGame />;
}
