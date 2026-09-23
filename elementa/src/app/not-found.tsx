import { House, LayoutGrid } from 'lucide-react';
import { ButtonLink } from '@/components/ui/ButtonLink';

/** 404: "un elemento que no existe". */
export default function NotFound() {
  return (
    <section className="flex min-h-[65dvh] flex-col items-center justify-center py-10 text-center">
      <div
        aria-hidden
        className="relative flex size-36 flex-col justify-between rounded-[1.75rem] border-4 border-dashed border-border-strong bg-surface p-3 text-left shadow-card animate-bounce-in sm:size-40"
      >
        <span className="text-sm font-black text-muted tabular">404</span>
        <span className="text-center text-6xl leading-none font-black text-brand sm:text-7xl">?</span>
        <span className="truncate text-center text-xs font-extrabold text-muted">Desconocidio</span>
      </div>

      <p className="mt-8 text-sm font-black tracking-wider text-brand uppercase">Error 404</p>
      <h1 className="mt-1 text-3xl font-black sm:text-4xl">Este elemento no existe… todavía</h1>
      <p className="mt-2 max-w-md text-muted sm:text-lg">
        La página que buscas no está en nuestra tabla. Vuelve al inicio o explora los 118 elementos que sí existen.
      </p>

      <div className="mt-7 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <ButtonLink href="/" size="lg" leftIcon={<House aria-hidden />}>
          Volver al inicio
        </ButtonLink>
        <ButtonLink href="/tabla" size="lg" variant="secondary" leftIcon={<LayoutGrid aria-hidden />}>
          Ver la tabla
        </ButtonLink>
      </div>
    </section>
  );
}
