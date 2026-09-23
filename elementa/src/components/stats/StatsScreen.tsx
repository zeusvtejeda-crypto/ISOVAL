'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { LevelBar } from '@/components/gamification';
import { PageHeader } from '@/components/layout';
import { difficultFocus } from '@/components/practice/target';
import { ButtonLink, Card, TONE_SOFT, cn, type Tone } from '@/components/ui';
import { ACHIEVEMENTS } from '@/data/achievements';
import { TOTAL_ELEMENTS } from '@/data/elements';
import { useNow } from '@/hooks/useNow';
import { useProgress } from '@/hooks/useProgress';
import { todayKey } from '@/utils/dates';
import { formatDuration, formatNumber, formatPercent, pluralize } from '@/utils/format';
import { MASTERED_THRESHOLD, countLearned, masteryMap } from '@/utils/mastery';
import { AccuracyChart, LearnedChart, QuestionsChart, WeeklyChart } from './ActivityCharts';
import { BestFamilies } from './BestFamilies';
import { KpiGrid, type Kpi } from './KpiGrid';
import { MasteryOverview } from './MasteryOverview';
import { PracticeFocus } from './PracticeFocus';
import { RecordsGrid } from './RecordsGrid';
import { StatsSkeleton } from './StatsSkeleton';
import { bestFamilies, familyStats, skillAccuracy, weakestFamilies } from './stats-data';

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="mb-3 text-xl font-black sm:text-2xl">
      {children}
    </h2>
  );
}

interface MoreLinkProps {
  href: string;
  emoji: string;
  title: string;
  detail: string;
  tone: Tone;
}

function MoreLink({ href, emoji, title, detail, tone }: MoreLinkProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-3xl border border-border bg-surface p-4 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-float active:scale-[0.98] motion-reduce:hover:translate-y-0"
    >
      <span aria-hidden className={cn('grid size-12 shrink-0 place-items-center rounded-2xl text-2xl', TONE_SOFT[tone])}>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg leading-tight font-black">{title}</span>
        <span className="block text-sm font-semibold text-muted">{detail}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** /estadisticas: nivel, métricas, gráficas de actividad, dominio, familias, qué practicar y récords. */
export function StatsScreen() {
  const { state, ready, level, streak } = useProgress();
  const now = useNow();
  const today = todayKey(now);

  const derived = useMemo(() => {
    const mastery = masteryMap(state, now);
    const families = familyStats(state, mastery);
    const best = bestFamilies(families);
    return {
      mastery,
      mastered: Object.values(mastery).filter((m) => m >= MASTERED_THRESHOLD).length,
      learned: countLearned(state),
      best,
      weakest: weakestFamilies(families, best),
      // Los mismos que practica «Practicar los más flojos» (`/practicar?focus=dificiles`).
      weak: difficultFocus(state, now, 8),
      skills: skillAccuracy(state),
      achievements: ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length,
    };
  }, [state, now]);

  if (!ready) return <StatsSkeleton />;

  const { stats } = state;
  const newUser = stats.totalQuestions === 0 && stats.flashcardsReviewed === 0;
  const kpis: Kpi[] = [
    {
      key: 'mastered',
      emoji: '🏆',
      label: 'Elementos dominados',
      value: (
        <>
          {derived.mastered}
          <span className="text-base font-extrabold text-muted"> / {TOTAL_ELEMENTS}</span>
        </>
      ),
      hint: `${derived.learned} ${pluralize(derived.learned, 'aprendido', 'aprendidos')}`,
      tone: 'success',
    },
    {
      key: 'accuracy',
      emoji: '🎯',
      label: 'Precisión',
      value: stats.totalQuestions > 0 ? formatPercent(stats.totalCorrect / stats.totalQuestions) : '—',
      hint:
        stats.totalQuestions > 0
          ? `${formatNumber(stats.totalCorrect)} ${pluralize(stats.totalCorrect, 'acierto', 'aciertos')}`
          : 'Aún sin respuestas',
      tone: 'brand',
    },
    {
      key: 'questions',
      emoji: '❓',
      label: 'Preguntas respondidas',
      value: formatNumber(stats.totalQuestions),
      hint:
        stats.flashcardsReviewed > 0
          ? `+ ${formatNumber(stats.flashcardsReviewed)} ${pluralize(stats.flashcardsReviewed, 'flashcard', 'flashcards')}`
          : undefined,
      tone: 'accent',
    },
    {
      key: 'streak',
      emoji: '🔥',
      label: 'Racha',
      value: (
        <>
          {streak.current}
          <span className="ml-1 text-base font-extrabold text-muted">{pluralize(streak.current, 'día', 'días')}</span>
        </>
      ),
      hint: `Mejor: ${streak.best} ${pluralize(streak.best, 'día', 'días')}`,
      tone: 'streak',
    },
    {
      key: 'time',
      emoji: '⏱️',
      label: 'Tiempo estudiado',
      value: stats.totalTimeMs >= 60_000 ? formatDuration(stats.totalTimeMs) : stats.totalTimeMs > 0 ? '< 1 min' : '0 min',
      hint:
        stats.sessionsCompleted > 0
          ? `${formatNumber(stats.sessionsCompleted)} ${pluralize(stats.sessionsCompleted, 'sesión', 'sesiones')}`
          : undefined,
      tone: 'xp',
    },
    {
      key: 'xp',
      emoji: '⚡',
      label: 'XP total',
      value: formatNumber(state.xp),
      hint: `Nivel ${level.level} · ${level.title}`,
      tone: 'xp',
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Tu progreso" title="Estadísticas" subtitle="Así va tu aventura con los 118 elementos." />

      <div className="flex flex-col gap-8 sm:gap-10">
        {newUser && (
          <Card tone="brand" padding="lg" className="flex flex-col items-start gap-3 overflow-hidden animate-slide-up">
            <p aria-hidden className="text-4xl animate-float">
              🚀
            </p>
            <div>
              <h2 className="text-xl font-black sm:text-2xl">¡Tu aventura empieza aquí!</h2>
              <p className="mt-1 font-semibold opacity-90">
                Responde tus primeras preguntas y verás crecer tus gráficas, tu racha y tu dominio.
              </p>
            </div>
            <ButtonLink href="/estudiar" variant="secondary" leftIcon={<Sparkles aria-hidden />}>
              Empezar a estudiar
            </ButtonLink>
          </Card>
        )}

        <section aria-labelledby="stats-summary-title" className="flex flex-col gap-3">
          <h2 id="stats-summary-title" className="sr-only">
            Resumen
          </h2>
          <Card>
            <LevelBar level={level} />
          </Card>
          <KpiGrid items={kpis} />
        </section>

        <section aria-labelledby="stats-activity-title">
          <SectionTitle id="stats-activity-title">Tu actividad</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WeeklyChart state={state} today={today} />
            <AccuracyChart state={state} today={today} />
            <LearnedChart state={state} today={today} />
            <QuestionsChart state={state} today={today} />
          </div>
        </section>

        <section aria-labelledby="stats-mastery-title" className="flex flex-col gap-4">
          <SectionTitle id="stats-mastery-title">Tu dominio</SectionTitle>
          <MasteryOverview state={state} mastery={derived.mastery} />
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <BestFamilies families={derived.best} />
            <PracticeFocus state={state} families={derived.weakest} weakElements={derived.weak} skills={derived.skills} />
          </div>
        </section>

        <section aria-labelledby="stats-records-title">
          <SectionTitle id="stats-records-title">Récords personales</SectionTitle>
          <RecordsGrid records={state.records} bestDayStreak={streak.best} />
        </section>

        <section aria-labelledby="stats-more-title">
          <SectionTitle id="stats-more-title">Más de tu progreso</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoreLink
              href="/logros"
              emoji="🏆"
              title="Logros"
              detail={`${derived.achievements} de ${ACHIEVEMENTS.length} desbloqueados`}
              tone="xp"
            />
            <MoreLink
              href="/errores"
              emoji="🎯"
              title="Mis errores"
              detail={
                state.mistakes.length > 0
                  ? `${formatNumber(state.mistakes.length)} ${pluralize(state.mistakes.length, 'pregunta fallada', 'preguntas falladas')}`
                  : 'Sin preguntas falladas'
              }
              tone="danger"
            />
          </div>
        </section>
      </div>
    </>
  );
}
