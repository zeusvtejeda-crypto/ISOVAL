'use client';

import { useEffect, useState } from 'react';
import { House, ListChecks, RotateCcw, Target } from 'lucide-react';
import { Confetti, XpBadge } from '@/components/gamification';
import { SummaryAchievements } from '@/components/quiz/SummaryAchievements';
import { ReviewList } from '@/components/quiz/SummaryElements';
import { Badge, Button, ButtonLink, cn, ProgressBar, TONE_SOFT, type Tone } from '@/components/ui';
import type { AnsweredQuestion, SessionSummaryData } from '@/types';
import { formatDuration, formatNumber } from '@/utils/format';
import { XP_RULES } from '@/utils/xp';
import { ExamReview } from './ExamReview';
import { examGrade, examPercent, practiceMistakesHref, topicScores } from './results';
import { TopicBreakdown } from './TopicBreakdown';
import { useCountUp } from './use-count-up';

export interface ExamResultsProps {
  summary: SessionSummaryData;
  answered: readonly AnsweredQuestion[];
  /** Mejor % antes de este examen. */
  previousBest: number;
  /** Exámenes terminados antes de este. */
  previousExams: number;
  onNewExam: () => void;
}

/** Color de arriba del degradado de la tarjeta, según el tono de la nota. */
const GRADE_WASH: Record<Tone, string> = {
  brand: 'from-brand-soft',
  success: 'from-success-soft',
  danger: 'from-danger-soft',
  warning: 'from-warning-soft',
  xp: 'from-xp-soft',
  streak: 'from-streak-soft',
  accent: 'from-accent-soft',
  neutral: 'from-surface-2',
};

function ScoreCard({ summary }: { summary: SessionSummaryData }) {
  const { correct, total } = summary;
  const pct = examPercent(correct, total);
  const grade = examGrade(pct);
  const shownCorrect = useCountUp(correct);
  const shownPct = useCountUp(pct);
  const perfect = total > 0 && correct === total;
  const bonus = XP_RULES.examComplete + (perfect ? XP_RULES.perfectExam : 0);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface px-5 pt-6 pb-5 text-center shadow-card sm:px-7">
      {/* Degradado del tono de la nota: se desvanece sin cortar el marcador «7 / 10». */}
      <div aria-hidden className={cn('absolute inset-x-0 top-0 h-48 bg-linear-to-b to-transparent', GRADE_WASH[grade.tone])} />
      <div className="relative">
        <span aria-hidden className="inline-block text-5xl animate-bounce-in">
          {grade.emoji}
        </span>
        <p className="sr-only">
          {correct} de {total} correctas: {pct}%
        </p>
        <p aria-hidden className="mt-1 text-6xl leading-none font-black tabular sm:text-7xl">
          {shownCorrect}
          <span className="text-4xl text-muted sm:text-5xl"> / {total}</span>
        </p>
        <p
          aria-hidden
          className={cn('mt-3 inline-flex rounded-full px-4 py-1 text-2xl font-black tabular animate-pop', TONE_SOFT[grade.tone])}
        >
          {shownPct}%
        </p>
        <h2 className="mt-3 text-2xl font-black">{grade.title}</h2>
        <p className="mt-0.5 font-semibold text-muted">{grade.message}</p>

        <ProgressBar
          value={total > 0 ? correct / total : 0}
          tone={pct >= 60 ? 'success' : pct >= 40 ? 'warning' : 'danger'}
          size="md"
          ariaLabel="Porcentaje de aciertos"
          className="mt-4"
        />

        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-extrabold">
          <span className="text-success">
            <span aria-hidden>✅ </span>Correctas: <span className="tabular">{correct}</span>
          </span>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <span className="text-danger">
            <span aria-hidden>❌ </span>Incorrectas: <span className="tabular">{Math.max(0, total - correct)}</span>
          </span>
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <XpBadge value={summary.xpGained} plus size="lg" className="animate-bounce-in" />
          <Badge tone="neutral" size="md" icon={<span aria-hidden>⏱</span>}>
            {formatDuration(summary.durationMs)}
          </Badge>
        </div>
        <p className="mt-2 text-xs font-bold text-muted">
          Incluye +{formatNumber(bonus)} XP por {perfect ? 'examen perfecto' : 'terminar el examen'}
        </p>
      </div>
    </div>
  );
}

function RecordBanner({ pct, previousBest, first }: { pct: number; previousBest: number; first: boolean }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-3xl border-2 border-xp/40 bg-xp-soft p-4 animate-bounce-in">
      <span aria-hidden className="text-3xl">
        {first ? '🎓' : '🏆'}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-black text-xp">{first ? '¡Tu primer examen!' : '¡Nuevo récord!'}</p>
        <p className="font-bold">
          {first ? (
            <>
              Marca a batir: <span className="font-black tabular">{pct}%</span>
            </>
          ) : (
            <>
              Tu mejor examen: <span className="font-black tabular">{pct}%</span>{' '}
              <span className="text-muted">(antes {previousBest}%)</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * Resultado del examen: nota, aciertos/fallos, XP, récord, logros, aciertos por tema, elementos
 * a repasar y acciones (practicar errores, revisar respuestas, nuevo examen).
 */
export function ExamResults({ summary, answered, previousBest, previousExams, onNewExam }: ExamResultsProps) {
  const [view, setView] = useState<'result' | 'review'>('result');
  const { correct, total } = summary;
  const pct = examPercent(correct, total);
  const practiceHref = practiceMistakesHref(answered);
  const first = previousExams === 0;
  const record = total > 0 && (first || pct > previousBest);
  const celebrate = total >= 5 && pct >= 80;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);

  return (
    <>
      {/* Fuera de las vistas: el confeti se lanza una sola vez aunque vayas a la revisión y vuelvas. */}
      {celebrate && <Confetti pieces={pct === 100 ? 180 : 110} origin={pct === 100 ? 'center' : 'top'} />}
      {view === 'review' ? (
        <ExamReview answered={answered} onBack={() => setView('result')} />
      ) : (
        <ResultView
          summary={summary}
          answered={answered}
          pct={pct}
          record={record}
          first={first}
          previousBest={previousBest}
          practiceHref={practiceHref}
          onReview={() => setView('review')}
          onNewExam={onNewExam}
        />
      )}
    </>
  );
}

interface ResultViewProps {
  summary: SessionSummaryData;
  answered: readonly AnsweredQuestion[];
  pct: number;
  record: boolean;
  first: boolean;
  previousBest: number;
  practiceHref: string | null;
  onReview: () => void;
  onNewExam: () => void;
}

function ResultView({
  summary,
  answered,
  pct,
  record,
  first,
  previousBest,
  practiceHref,
  onReview,
  onNewExam,
}: ResultViewProps) {
  return (
    <section aria-labelledby="exam-result-title" className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-4 animate-fade-in">
      <header className="pt-2 text-center">
        <p className="text-sm font-black tracking-wide text-brand uppercase">{summary.title}</p>
        <h1 id="exam-result-title" className="mt-1 text-3xl font-black sm:text-4xl">
          Resultado
        </h1>
      </header>

      <ScoreCard summary={summary} />

      {record && <RecordBanner pct={pct} previousBest={previousBest} first={first} />}
      <SummaryAchievements ids={summary.unlockedAchievements} />
      <TopicBreakdown scores={topicScores(answered)} />
      <ReviewList atomicNumbers={summary.toReview} />

      <div className="mt-2 flex flex-col gap-2.5">
        {practiceHref && (
          <ButtonLink href={practiceHref} size="lg" block leftIcon={<Target aria-hidden />}>
            Practicar mis errores
          </ButtonLink>
        )}
        <Button variant="secondary" size="lg" block leftIcon={<ListChecks aria-hidden />} onClick={onReview}>
          Revisar respuestas
        </Button>
        <Button
          variant={practiceHref ? 'secondary' : 'primary'}
          size="lg"
          block
          leftIcon={<RotateCcw aria-hidden />}
          onClick={onNewExam}
        >
          Nuevo examen
        </Button>
        <ButtonLink href="/" variant="ghost" size="lg" block leftIcon={<House aria-hidden />}>
          Volver al inicio
        </ButtonLink>
      </div>
    </section>
  );
}
