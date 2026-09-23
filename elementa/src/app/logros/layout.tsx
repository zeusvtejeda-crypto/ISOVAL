import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Logros',
  description:
    'Tus logros en Elementa: cuántos llevas, cuál tienes más cerca y el progreso de cada uno, de «Primer elemento» a «Maestro de la tabla».',
};

export default function LogrosLayout({ children }: { children: ReactNode }) {
  return children;
}
