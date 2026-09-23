import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { OnboardingSkeleton } from '@/components/onboarding/OnboardingSkeleton';

export const metadata: Metadata = {
  title: 'Bienvenida',
  description: 'Cuéntanos cuánto sabes de la tabla periódica y haz un diagnóstico de 10 preguntas para empezar en tu nivel.',
};

export default function BienvenidaPage() {
  // `Onboarding` lee `?repetir=1` con useSearchParams: necesita un límite de Suspense.
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <Onboarding />
    </Suspense>
  );
}
