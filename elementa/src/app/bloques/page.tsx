import { Suspense } from 'react';
import { BlocksApp } from '@/components/learn/BlocksApp';
import { BlocksSkeleton } from '@/components/learn/LearnSkeletons';

export default function BloquesPage() {
  return (
    <Suspense fallback={<BlocksSkeleton />}>
      <BlocksApp />
    </Suspense>
  );
}
