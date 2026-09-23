import { Skeleton } from '@/components/ui';

/** Carga del selector de examen (antes de leer el progreso). */
export function ExamSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando exámenes" className="flex flex-col gap-4">
      <Skeleton className="h-4 w-28" rounded="full" />
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <Skeleton className="mt-2 h-28 w-full" rounded="3xl" />
      <Skeleton className="mt-2 h-6 w-40" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32" rounded="3xl" />
        ))}
      </div>
    </div>
  );
}
