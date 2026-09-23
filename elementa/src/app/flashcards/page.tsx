import { Suspense } from 'react';
import { FlashcardsApp, FlashcardsSetupSkeleton } from '@/components/flashcards';

export default function FlashcardsPage() {
  return (
    <Suspense fallback={<FlashcardsSetupSkeleton />}>
      <FlashcardsApp />
    </Suspense>
  );
}
