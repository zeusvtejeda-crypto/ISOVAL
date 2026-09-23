import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Estadísticas',
  description:
    'Tu progreso con los 118 elementos: dominio, precisión, racha, tiempo de estudio, gráficas de actividad, familias fuertes y débiles y récords personales.',
};

export default function EstadisticasLayout({ children }: { children: ReactNode }) {
  return children;
}
