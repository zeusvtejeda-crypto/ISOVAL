import { ProgressBar, type Tone } from '@/components/ui';
import type { TopicScore } from './results';
import { TOPIC_META } from './topics';

function tone(ratio: number): Tone {
  if (ratio >= 0.8) return 'success';
  if (ratio >= 0.5) return 'warning';
  return 'danger';
}

/** Aciertos por tema del examen (barras). */
export function TopicBreakdown({ scores }: { scores: readonly TopicScore[] }) {
  if (scores.length < 2) return null;
  return (
    <section aria-labelledby="exam-topics-title" className="rounded-3xl border border-border bg-surface p-4 shadow-card">
      <h2 id="exam-topics-title" className="flex items-center gap-2 font-black">
        <span aria-hidden>📊</span> Por tema
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {scores.map((s) => {
          const meta = TOPIC_META[s.topic];
          const ratio = s.total > 0 ? s.correct / s.total : 0;
          return (
            <li key={s.topic}>
              <ProgressBar
                value={ratio}
                tone={tone(ratio)}
                size="sm"
                showValue
                valueText={`${s.correct}/${s.total}`}
                ariaLabel={`${meta.label}: ${s.correct} de ${s.total}`}
                label={
                  <>
                    <span aria-hidden className="mr-1.5">
                      {meta.emoji}
                    </span>
                    {meta.label}
                  </>
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
