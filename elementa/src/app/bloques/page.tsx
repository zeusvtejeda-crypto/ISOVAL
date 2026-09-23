import { Suspense } from 'react';
import { BlocksApp, BlocksSkeleton } from '@/components/learn';

export default function BloquesPage() {
  return (
    <Suspense fallback={<BlocksSkeleton />}>
      <BlocksApp />
    </Suspense>
  );
}
