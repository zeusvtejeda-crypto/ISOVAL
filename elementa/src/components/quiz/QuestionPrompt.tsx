import { cn } from '@/components/ui';
import type { Question } from '@/types';
import { QUESTION_TYPE_META } from '@/utils/questions';

export interface QuestionPromptProps {
  question: Question;
  /** Id del enunciado (para `aria-labelledby` de las opciones). */
  headingId?: string;
  /** Texto de ayuda bajo el enunciado. */
  hint?: string;
  /**
   * Etiqueta del tipo de pregunta ("Símbolo → Nombre"). `'tall'`: solo en pantallas altas (cuando la
   * pantalla ya muestra otra píldora, p. ej. la categoría de Preguntados). Por defecto `true`.
   */
  showType?: boolean | 'tall';
  className?: string;
}

// En pantallas bajas (≤ 700 px de alto) el sujeto encoge para que quepan las 4 opciones.
function subjectSize(text: string): string {
  if (text.length <= 3) return 'text-6xl sm:text-7xl [@media(max-height:700px)]:text-5xl';
  if (text.length <= 10) return 'text-4xl sm:text-5xl [@media(max-height:700px)]:text-3xl';
  return 'text-2xl sm:text-3xl [@media(max-height:700px)]:text-2xl';
}

/** Tipo de pregunta, enunciado y "sujeto" grande opcional (p. ej. "Na", "26"). */
export function QuestionPrompt({ question, headingId, hint, showType = true, className }: QuestionPromptProps) {
  const meta = QUESTION_TYPE_META[question.type];
  const subject = question.subject?.trim();
  return (
    <header className={cn('flex flex-col items-center text-center', className)}>
      {showType && (
        <p
          className={cn(
            'rounded-full bg-brand-soft px-3 py-1 text-xs font-black tracking-wide text-brand uppercase [@media(max-height:700px)]:py-0.5',
            showType === 'tall' && '[@media(max-height:700px)]:hidden',
          )}
        >
          {meta.label}
        </p>
      )}
      <h2
        id={headingId}
        className={cn(
          'max-w-xl text-xl leading-snug font-black sm:text-2xl [@media(max-height:700px)]:text-lg [@media(max-height:700px)]:leading-snug',
          showType === true ? 'mt-3 [@media(max-height:700px)]:mt-1.5' : showType === 'tall' && 'mt-3 [@media(max-height:700px)]:mt-0',
        )}
      >
        {question.prompt}
      </h2>
      {hint && <p className="mt-1 max-w-xl text-sm font-semibold text-muted">{hint}</p>}
      {subject && (
        <p
          aria-hidden
          className={cn(
            'mt-4 max-w-full rounded-3xl border-2 border-border bg-surface px-6 py-3 leading-none font-black tracking-tight break-words text-fg shadow-card animate-bounce-in tabular',
            '[@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:rounded-2xl [@media(max-height:700px)]:px-5 [@media(max-height:700px)]:py-2',
            subjectSize(subject),
          )}
        >
          {subject}
        </p>
      )}
    </header>
  );
}
