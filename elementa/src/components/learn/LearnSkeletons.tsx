import { Skeleton } from '@/components/ui';

function HeaderSkeleton() {
  return (
    <div className="mb-5 flex items-start gap-3 sm:mb-7">
      <Skeleton className="size-11 shrink-0" rounded="2xl" />
      <div className="flex-1">
        <Skeleton className="h-3 w-24" rounded="full" />
        <Skeleton className="mt-2 h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" rounded="full" />
      </div>
    </div>
  );
}

/** Carga de «Estudiar ahora» y «Aprende 5». */
export function LearnPageSkeleton({ label = 'Cargando tu sesión' }: { label?: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <HeaderSkeleton />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <Skeleton className="h-80" rounded="3xl" />
        <Skeleton className="h-14" rounded="2xl" />
      </div>
    </div>
  );
}

/** Carga de «Bloques y familias». */
export function BlocksSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando bloques">
      <HeaderSkeleton />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-full max-w-sm" rounded="2xl" />
        <Skeleton className="h-36" rounded="3xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72" rounded="3xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
