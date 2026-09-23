'use client';

import { Play, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Badge, ProgressRing, type Tone } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { formatNumber, pluralize } from '@/utils/format';
import { ExamTypeCard } from './ExamTypeCard';
import { CUSTOM_EXAM_HREF, EXAM_PRESETS, estimatedMinutes, type ExamPreset } from './presets';

export interface ExamChooserProps {
  onStart: (preset: ExamPreset) => void;
}

function bestTone(pct: number): Tone {
  if (pct >= 90) return 'success';
  if (pct >= 60) return 'brand';
  return 'warning';
}

/** Tu mejor examen (%), exámenes hechos y perfectos. */
function BestScore() {
  const { state } = useProgress();
  const best = state.records.bestExamPct;
  const exams = state.stats.examsCompleted;
  const perfect = state.stats.perfectExams;
  const hasExams = exams > 0;

  return (
    <section
      aria-label="Tu récord de exámenes"
      className="mb-6 flex items-center gap-4 rounded-3xl border border-border bg-surface p-4 shadow-card sm:gap-5 sm:p-5"
    >
      <ProgressRing
        value={hasExams ? best / 100 : 0}
        size={84}
        stroke={10}
        tone={bestTone(best)}
        label={hasExams ? `Tu mejor examen: ${best}%` : 'Aún no tienes exámenes'}
      >
        <span className="text-xl font-black tabular">{hasExams ? `${best}%` : '🏅'}</span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black tracking-wider text-muted uppercase">Tu mejor examen</p>
        {hasExams ? (
          <>
            <p className="text-3xl leading-tight font-black tabular">{best}%</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone="brand" icon={<span aria-hidden>📝</span>}>
                {formatNumber(exams)} {pluralize(exams, 'examen', 'exámenes')}
              </Badge>
              {perfect > 0 && (
                <Badge tone="xp" icon={<span aria-hidden>💯</span>}>
                  {formatNumber(perfect)} {pluralize(perfect, 'perfecto', 'perfectos')}
                </Badge>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-xl leading-tight font-black">¡Aún sin estrenar!</p>
            <p className="mt-0.5 text-sm font-semibold text-muted">Haz tu primer examen y marca tu récord.</p>
          </>
        )}
      </div>
    </section>
  );
}

/** Selector de examen: rápido, normal, completo o personalizado. Los predefinidos empiezan al tocarlos. */
export function ExamChooser({ onStart }: ExamChooserProps) {
  return (
    <>
      <PageHeader
        back="/jugar"
        backLabel="Volver a Jugar"
        eyebrow="Ponte a prueba"
        title="Mini examen"
        subtitle="Sin pistas y con nota final. ¿Cuánto sabes?"
      />

      <BestScore />

      <section aria-labelledby="exam-types-title">
        <h2 id="exam-types-title" className="mb-3 text-lg font-black sm:text-xl">
          Elige tu examen
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EXAM_PRESETS.map((preset, i) => (
            <li key={preset.id} className="flex animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <ExamTypeCard
                emoji={preset.emoji}
                title={preset.title}
                description={preset.description}
                tone={preset.tone}
                actionIcon={<Play fill="currentColor" />}
                onClick={() => onStart(preset)}
                meta={
                  <>
                    <Badge tone={preset.tone}>{preset.count} preguntas</Badge>
                    <Badge tone="neutral">≈ {estimatedMinutes(preset.count)} min</Badge>
                  </>
                }
              />
            </li>
          ))}
          <li className="flex animate-slide-up" style={{ animationDelay: `${EXAM_PRESETS.length * 50}ms` }}>
            <ExamTypeCard
              emoji="🎛️"
              title="Examen personalizado"
              description="Tú eliges los temas, los elementos y cuántas preguntas."
              tone="accent"
              actionIcon={<SlidersHorizontal />}
              href={CUSTOM_EXAM_HREF}
              meta={
                <>
                  <Badge tone="accent">10–50 preguntas</Badge>
                  <Badge tone="neutral">A tu medida</Badge>
                </>
              }
            />
          </li>
        </ul>
      </section>

      <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-bold text-muted">
        <span aria-hidden>🎁</span>
        <span>+50 XP al terminar</span>
        <span aria-hidden>·</span>
        <span>+100 XP extra si es perfecto</span>
      </p>
    </>
  );
}
