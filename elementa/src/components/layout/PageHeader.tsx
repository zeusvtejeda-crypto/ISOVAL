'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { IconButton, IconLink } from '@/components/ui/IconButton';

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Botón de volver: una ruta, o `true` para volver en el historial (o al inicio si no hay). */
  back?: string | true;
  backLabel?: string;
  /** Acciones a la derecha (botones de icono, enlaces…). */
  actions?: ReactNode;
  /** Texto pequeño sobre el título (p. ej. "Modo de juego"). */
  eyebrow?: ReactNode;
  className?: string;
}

/** Encabezado de página: volver, título (h1), subtítulo y acciones. */
export function PageHeader({ title, subtitle, back, backLabel = 'Volver', actions, eyebrow, className }: PageHeaderProps) {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  };

  return (
    <header className={cn('mb-5 flex items-start gap-3 sm:mb-7', className)}>
      {typeof back === 'string' && (
        <IconLink href={back} label={backLabel} icon={<ArrowLeft />} variant="soft" className="-ml-1 shrink-0" />
      )}
      {back === true && (
        <IconButton label={backLabel} icon={<ArrowLeft />} variant="soft" onClick={goBack} className="-ml-1 shrink-0" />
      )}
      <div className={cn('min-w-0 flex-1', back !== undefined && 'pt-0.5')}>
        {eyebrow && <p className="mb-0.5 text-xs font-black tracking-wider text-brand uppercase">{eyebrow}</p>}
        <h1 className="text-2xl leading-tight font-black sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted sm:text-lg">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
