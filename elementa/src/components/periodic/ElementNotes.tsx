import type { ReactNode } from 'react';
import { cn } from '@/components/ui';
import type { ChemicalElement } from '@/types';

interface NoteProps {
  emoji: string;
  title: ReactNode;
  children: ReactNode;
  className: string;
}

function Note({ emoji, title, children, className }: NoteProps) {
  return (
    <section className={cn('rounded-2xl px-4 py-3.5', className)}>
      <h3 className="flex items-center gap-2 text-sm font-black">
        <span aria-hidden className="text-base">
          {emoji}
        </span>
        {title}
      </h3>
      <p className="mt-1 leading-relaxed">{children}</p>
    </section>
  );
}

function clean(text: string | undefined): string {
  return (text ?? '').trim();
}

/**
 * Textos del elemento: descripción, dato curioso, truco para recordarlo, etimología y usos.
 * Cada bloque se oculta si su texto está vacío.
 */
export function ElementNotes({ element, className }: { element: ChemicalElement; className?: string }) {
  const description = clean(element.description);
  const funFact = clean(element.funFact);
  const memoryTip = clean(element.memoryTip);
  const etymology = clean(element.etymology);
  const uses = (element.uses ?? []).map(clean).filter(Boolean);

  if (!description && !funFact && !memoryTip && !etymology && uses.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {description && <p className="text-base leading-relaxed sm:text-lg">{description}</p>}
      {funFact && (
        <Note emoji="💡" title="Dato curioso" className="bg-xp-soft">
          {funFact}
        </Note>
      )}
      {memoryTip && (
        <Note emoji="🧠" title="Truco para recordarlo" className="bg-brand-soft">
          {memoryTip}
        </Note>
      )}
      {etymology && (
        <Note emoji="📜" title={`¿Por qué ${element.symbol}?`} className="bg-surface-2">
          {etymology}
        </Note>
      )}
      {uses.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-black">
            <span aria-hidden className="text-base">
              🛠️
            </span>
            Usos
          </h3>
          <ul className="flex flex-wrap gap-2">
            {uses.map((use, i) => (
              <li
                key={`${i}-${use}`}
                className="inline-flex min-h-9 items-center rounded-full border-2 border-border bg-surface px-3 py-1 text-sm leading-tight font-bold"
              >
                {use}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
