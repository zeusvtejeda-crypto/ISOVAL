import { Skeleton } from '@/components/ui';

/** Marcador del inicio mientras carga el progreso (misma estructura que el panel). */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tu progreso" className="flex flex-col gap-5 sm:gap-6">
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-full max-w-xl" />
        <Skeleton className="h-8 w-2/3 max-w-md sm:hidden" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 rounded-3xl border border-border bg-surface p-4 sm:p-5 lg:col-span-3">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14" rounded="2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-3" rounded="full" />
            </div>
          </div>
          <Skeleton className="h-20" rounded="2xl" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" rounded="2xl" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton className="h-52" rounded="3xl" />
          <Skeleton className="h-48" rounded="3xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-32" rounded="3xl" />
        ))}
      </div>
    </div>
  );
}
