import { Skeleton } from '@/components/ui';

/** Carga de `/practicar` (antes de leer el progreso). */
export function PracticeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Preparando la práctica" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0" rounded="2xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-24" rounded="full" />
          <Skeleton className="h-8 w-52 max-w-full" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      </div>
      <Skeleton className="mt-2 h-44 w-full" rounded="3xl" />
      <Skeleton className="h-12 w-full" rounded="2xl" />
      <Skeleton className="mt-4 h-14 w-full" rounded="2xl" />
    </div>
  );
}
