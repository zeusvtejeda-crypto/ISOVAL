import { Suspense } from 'react';
import { ExamApp, ExamSkeleton } from '@/components/exam';

export default function ExamenPage() {
  return (
    <Suspense fallback={<ExamSkeleton />}>
      <ExamApp />
    </Suspense>
  );
}
