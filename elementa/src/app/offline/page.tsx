import type { Metadata } from 'next';
import { CloudOff, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { OfflineActions } from './OfflineActions';

export const metadata: Metadata = {
  title: 'Sin conexión',
  robots: { index: false, follow: false },
};

function Reassurance({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-left">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand [&_svg]:size-[1.125rem]"
      >
        {icon}
      </span>
      <span className="pt-1.5 text-sm leading-snug text-fg sm:text-base">{children}</span>
    </li>
  );
}

/**
 * Pantalla sin conexión. El service worker la sirve cuando una página no está en caché
 * (y también se puede abrir en /offline).
 */
export default function OfflinePage() {
  return (
    <section className="flex min-h-[65dvh] flex-col items-center justify-center py-10 text-center">
      <div
        aria-hidden
        className="relative flex size-36 flex-col justify-between rounded-[1.75rem] border-4 border-dashed border-border-strong bg-surface p-3 text-left shadow-card animate-bounce-in sm:size-40"
      >
        <span className="text-sm font-black text-muted tabular">0</span>
        <WifiOff className="mx-auto size-14 text-brand sm:size-16" strokeWidth={2.5} />
        <span className="truncate text-center text-xs font-extrabold text-muted">Desconectio</span>
      </div>

      <p className="mt-8 text-sm font-black tracking-wider text-brand uppercase">Modo sin conexión</p>
      <h1 className="mt-1 text-3xl font-black sm:text-4xl">Sin conexión… por ahora</h1>
      <p className="mt-2 max-w-md text-muted sm:text-lg">
        No pudimos cargar esta pantalla, pero no te preocupes: tu progreso está guardado en este dispositivo.
      </p>

      <OfflineActions />

      <ul className="mt-8 w-full max-w-md space-y-3 rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <Reassurance icon={<ShieldCheck />}>Tu XP, tu racha y tus logros siguen a salvo.</Reassurance>
        <Reassurance icon={<CloudOff />}>Las pantallas que ya abriste funcionan también sin internet.</Reassurance>
        <Reassurance icon={<RefreshCw />}>Cuando vuelva la conexión, recargaremos esta página automáticamente.</Reassurance>
      </ul>
    </section>
  );
}
