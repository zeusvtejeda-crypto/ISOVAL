import { Suspense } from 'react';
import { LearnApp, LearnPageSkeleton } from '@/components/learn';

export default function AprendePage() {
  return (
    <Suspense fallback={<LearnPageSkeleton label="Preparando tu lección" />}>
      <LearnApp />
    </Suspense>
  );
}
