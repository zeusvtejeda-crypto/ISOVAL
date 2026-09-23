import { Suspense } from 'react';
import { LearnApp } from '@/components/learn/LearnApp';
import { LearnPageSkeleton } from '@/components/learn/LearnSkeletons';

export default function AprendePage() {
  return (
    <Suspense fallback={<LearnPageSkeleton label="Preparando tu lección" />}>
      <LearnApp />
    </Suspense>
  );
}
