import { Suspense } from 'react';
import { PracticeApp, PracticeSkeleton } from '@/components/practice';

export default function PracticarPage() {
  return (
    <Suspense fallback={<PracticeSkeleton />}>
      <PracticeApp />
    </Suspense>
  );
}
