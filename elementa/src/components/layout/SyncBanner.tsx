'use client';

import { useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { IconButton } from '@/components/ui/IconButton';
import { useSyncStatus } from '@/hooks/useProgressState';

type SyncIssue = 'load-error' | 'save-error' | 'corrupt';

const MESSAGES: Record<SyncIssue, string> = {
  'load-error': 'No pudimos leer tu progreso guardado. Lo intentaremos de nuevo antes de guardar nada.',
  'save-error': 'No se pudo guardar tu progreso. Lo intentaremos de nuevo.',
  corrupt: 'No pudimos leer tu progreso guardado; guardamos una copia de seguridad.',
};

/**
 * Aviso pequeño y descartable cuando la persistencia tiene un problema (ver `progressStore.getSyncStatus()`).
 * Si el problema desaparece y vuelve, el aviso reaparece aunque se hubiera cerrado.
 */
export function SyncBanner({ className }: { className?: string }) {
  const { status, loadIssue } = useSyncStatus();
  const issue: SyncIssue | null =
    loadIssue === 'error' ? 'load-error' : status === 'error' ? 'save-error' : loadIssue === 'corrupt' ? 'corrupt' : null;
  const [dismissed, setDismissed] = useState<SyncIssue | null>(null);
  const [prevIssue, setPrevIssue] = useState<SyncIssue | null>(issue);

  if (issue !== prevIssue) {
    setPrevIssue(issue);
    if (issue === null) setDismissed(null);
  }

  return (
    <div role="status" aria-live="polite">
      {issue !== null && issue !== dismissed && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft py-2 pr-1.5 pl-3.5 text-sm font-bold text-fg animate-slide-down',
            className,
          )}
        >
          <TriangleAlert aria-hidden className="mt-2 size-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1 py-1.5">{MESSAGES[issue]}</p>
          <IconButton size="sm" label="Cerrar aviso" icon={<X />} onClick={() => setDismissed(issue)} />
        </div>
      )}
    </div>
  );
}
