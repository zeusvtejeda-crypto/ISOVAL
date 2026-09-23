import type { Metadata } from 'next';
import { ContrarrelojGame } from '@/components/games';

export const metadata: Metadata = {
  title: 'Contrarreloj',
  description:
    '¿Cuántos elementos puedes identificar en 60 segundos? Símbolos, nombres y números atómicos a toda velocidad. Supera tu récord.',
};

export default function ContrarrelojPage() {
  return <ContrarrelojGame />;
}
