import { Skeleton } from '@/components/ui';

/** Marcador de la bienvenida mientras carga el progreso (sin hooks: válido también en el servidor). */
export function OnboardingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando"
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 py-8"
    >
      <Skeleton className="size-24" rounded="3xl" />
      <Skeleton className="h-11 w-56" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <div className="mt-4 flex w-full flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16" rounded="2xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-14 w-full" rounded="2xl" />
    </div>
  );
}
