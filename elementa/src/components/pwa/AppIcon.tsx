import Image from 'next/image';
import { cn } from '@/components/ui/cn';

export interface AppIconProps {
  /** Lado en píxeles. */
  size?: number;
  className?: string;
}

/** El icono real de la app (el mismo que aparecerá en la pantalla de inicio). Decorativo. */
export function AppIcon({ size = 56, className }: AppIconProps) {
  return (
    <Image
      src="/icons/icon-192.png"
      alt=""
      width={size}
      height={size}
      unoptimized
      draggable={false}
      className={cn('shrink-0 select-none drop-shadow-sm', className)}
    />
  );
}
