import { CircleAlert, CircleCheck } from 'lucide-react';
import { cn } from '@/components/ui';

export interface Status {
  tone: 'success' | 'danger';
  text: string;
}

/**
 * Mensaje de resultado de una acción (exportar, importar…). La región viva siempre está en el DOM
 * (vacía no ocupa espacio) para que los lectores de pantalla anuncien cada cambio.
 */
export function StatusMessage({ status, className }: { status: Status | null; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      {status && (
        <p
          key={status.text}
          className={cn(
            'mt-3 flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-bold',
            status.tone === 'success' ? 'bg-success-soft text-success animate-pop' : 'bg-danger-soft text-danger animate-shake',
          )}
        >
          {status.tone === 'success' ? (
            <CircleCheck aria-hidden className="mt-px size-4.5 shrink-0" />
          ) : (
            <CircleAlert aria-hidden className="mt-px size-4.5 shrink-0" />
          )}
          {status.text}
        </p>
      )}
    </div>
  );
}
