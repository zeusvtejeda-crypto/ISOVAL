import type { ReactNode } from 'react';
import { Ellipsis, Share, SquarePlus } from 'lucide-react';
import type { InstallPlatform } from './platform';

/** Nombre de un botón o menú del sistema, con su icono. */
function UiLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-1.5 py-0.5 align-middle text-[0.8125rem] leading-tight font-extrabold whitespace-nowrap text-fg [&_svg]:size-3.5 [&_svg]:shrink-0">
      {icon}
      {children}
    </span>
  );
}

function Step({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-black text-brand tabular"
      >
        {number}
      </span>
      <span className="min-w-0 text-sm leading-relaxed text-fg">{children}</span>
    </li>
  );
}

/** Pasos para instalar a mano cuando el navegador no ofrece un diálogo (iOS y Safari en Mac). */
export function InstallInstructions({ platform }: { platform: Exclude<InstallPlatform, 'other'> }) {
  if (platform === 'mac-safari') {
    return (
      <ol className="space-y-2" aria-label="Cómo añadir Elementa al Dock">
        <Step number={1}>
          En la barra de menús de Safari, abre <UiLabel>Archivo</UiLabel>.
        </Step>
        <Step number={2}>
          Elige <UiLabel icon={<SquarePlus aria-hidden />}>Añadir al Dock</UiLabel>.
        </Step>
      </ol>
    );
  }

  return (
    <ol className="space-y-2" aria-label="Cómo añadir Elementa a la pantalla de inicio">
      <Step number={1}>
        Toca <UiLabel icon={<Share aria-hidden />}>Compartir</UiLabel>
        <span className="text-muted">
          {' '}
          (si no lo ves, está en el menú <UiLabel icon={<Ellipsis aria-hidden />}>Más</UiLabel>)
        </span>
        .
      </Step>
      <Step number={2}>
        Elige <UiLabel icon={<SquarePlus aria-hidden />}>Añadir a pantalla de inicio</UiLabel>.
      </Step>
    </ol>
  );
}
