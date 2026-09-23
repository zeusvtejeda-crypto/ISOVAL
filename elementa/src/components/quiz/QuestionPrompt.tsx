import { cn } from '@/components/ui';
import type { Question } from '@/types';
import { QUESTION_TYPE_META } from '@/utils/questions';

export interface QuestionPromptProps {
  question: Question;
  /** Id del enunciado (para `aria-labelledby` de las opciones). */
  headingId?: string;
  /** Texto de ayuda bajo el enunciado. */
  hint?: string;
  className?: string;
}

function subjectSize(text: string): string {
  if (text.length <= 3) return 'text-6xl sm:text-7xl';
  if (text.length <= 10) return 'text-4xl sm:text-5xl';
  return 'text-2xl sm:text-3xl';
}

/** Tipo de pregunta, enunciado y "sujeto" grande opcional (p. ej. "Na", "26"). */
export function QuestionPrompt({ question, headingId, hint, className }: QuestionPromptProps) {
  const meta = QUESTION_TYPE_META[question.type];
  const subject = question.subject?.trim();
  return (
    <header className={cn('flex flex-col items-center text-center', className)}>
      <p className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black tracking-wide text-brand uppercase">
        {meta.label}
      </p>
      <h2 id={headingId} className="mt-3 max-w-xl text-xl leading-snug font-black sm:text-2xl">
        {question.prompt}
      </h2>
      {hint && <p className="mt-1 max-w-xl text-sm font-semibold text-muted">{hint}</p>}
      {subject && (
        <p
          aria-hidden
          className={cn(
            'mt-4 max-w-full rounded-3xl border-2 border-border bg-surface px-6 py-3 leading-none font-black tracking-tight break-words text-fg shadow-card animate-bounce-in tabular',
            subjectSize(subject),
          )}
        >
          {subject}
        </p>
      )}
    </header>
  );
}
