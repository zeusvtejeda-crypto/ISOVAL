import { Skeleton } from '@/components/ui';

/** Carga de `/logros` (antes de leer el progreso). */
export function AchievementsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tus logros" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0" rounded="2xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-24" rounded="full" />
          <Skeleton className="h-8 w-32 max-w-full" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-32" rounded="3xl" />
        <Skeleton className="h-32" rounded="3xl" />
      </div>
      <Skeleton className="mt-4 h-10 w-full" rounded="2xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-28" rounded="3xl" />
        ))}
      </div>
    </div>
  );
}
