import { Skeleton } from '@/components/ui';

/** Carga de `/estadisticas` (antes de leer el progreso). */
export function StatsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tus estadísticas" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" rounded="full" />
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <Skeleton className="mt-2 h-24 w-full" rounded="3xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-36" rounded="3xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-7 w-40" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64" rounded="3xl" />
        ))}
      </div>
    </div>
  );
}
