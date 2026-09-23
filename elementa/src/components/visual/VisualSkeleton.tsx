import { Skeleton } from '@/components/ui';

/** Carga de `/visual` (antes de leer el progreso). */
export function VisualSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando retos visuales" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0" rounded="2xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-24" rounded="full" />
          <Skeleton className="h-8 w-40 max-w-full" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      </div>
      <Skeleton className="mt-2 h-52 w-full sm:h-44" rounded="3xl" />
      <Skeleton className="mt-2 h-6 w-32" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36" rounded="3xl" />
        ))}
        <Skeleton className="h-32 sm:col-span-2" rounded="3xl" />
      </div>
    </div>
  );
}
