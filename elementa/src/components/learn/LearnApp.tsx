'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout';
import { QuizScreen } from '@/components/quiz';
import { useProgress } from '@/hooks/useProgress';
import { useQuizSession } from '@/hooks/useQuizSession';
import { newElements } from '@/utils/planner';
import { buildCheckQuestions } from './check-questions';
import { LearnAllDone } from './LearnAllDone';
import { LearnComplete } from './LearnComplete';
import { LearnIntro } from './LearnIntro';
import { LearnPageSkeleton } from './LearnSkeletons';
import { LessonStepper } from './LessonStepper';
import { resolveLearnSource, type LearnSource } from './learn-source';
import { NO_LEARN_REWARD, withLearnAchievements, type LearnReward } from './reward';

/** Elementos por lección. */
const LESSON_SIZE = 5;

interface Lesson {
  id: number;
  elements: number[];
}

type Phase = 'intro' | 'learn' | 'quiz';

interface LearnQuizProps {
  lesson: Lesson;
  source: LearnSource;
  reward: LearnReward;
  onExit: () => void;
  onMore: () => void;
}

/** Comprobación: 2 preguntas por elemento y la celebración final. */
function LearnQuiz({ lesson, source, reward, onExit, onMore }: LearnQuizProps) {
  const { state } = useProgress();
  const session = useQuizSession({
    mode: 'learn5',
    title: 'Aprende 5',
    questions: () => buildCheckQuestions(lesson.elements),
  });
  const remaining = newElements(state, LESSON_SIZE, source.pool).length;

  return (
    <QuizScreen
      session={session}
      onExit={onExit}
      renderSummary={(summary) => (
        <LearnComplete
          summary={withLearnAchievements(summary, reward)}
          elements={lesson.elements}
          learnXp={reward.xpGained}
          remaining={remaining}
          onMore={onMore}
        />
      )}
    />
  );
}

function LearnFlow({ source }: { source: LearnSource }) {
  const router = useRouter();
  const { state, ready, markLearned } = useProgress();
  const [phase, setPhase] = useState<Phase>('intro');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [reward, setReward] = useState<LearnReward>(NO_LEARN_REWARD);
  const lessonIds = useRef(0);

  // Los siguientes no aprendidos del grupo, en orden atómico (determinista: seguro en el render).
  const upcoming = useMemo(() => newElements(state, LESSON_SIZE, source.pool), [state, source.pool]);
  const learnedInPool = useMemo(
    () => source.pool.filter((z) => state.elements[z]?.learned).length,
    [state.elements, source.pool],
  );

  useEffect(() => {
    if (phase === 'intro') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [phase]);

  if (!ready) return <LearnPageSkeleton label="Preparando tu lección" />;

  if (phase === 'learn' && lesson) {
    return (
      <LessonStepper
        elements={lesson.elements}
        title="Aprende 5"
        onExit={() => setPhase('intro')}
        onComplete={() => {
          // Se marcan al terminar la lección (antes de las preguntas): así cada elemento suma sus +5 XP
          // aunque la comprobación lo marque como aprendido al acertarlo.
          setReward(markLearned(lesson.elements));
          setPhase('quiz');
        }}
      />
    );
  }

  if (phase === 'quiz' && lesson) {
    return (
      <LearnQuiz
        key={lesson.id}
        lesson={lesson}
        source={source}
        reward={reward}
        onExit={() => router.push('/')}
        onMore={() => {
          setLesson(null);
          setReward(NO_LEARN_REWARD);
          setPhase('intro');
        }}
      />
    );
  }

  const start = () => {
    if (upcoming.length === 0) return;
    lessonIds.current += 1;
    setLesson({ id: lessonIds.current, elements: [...upcoming] });
    setPhase('learn');
  };

  return (
    <>
      <PageHeader
        title="Aprende 5"
        subtitle="Pocos, bien aprendidos y con trucos para no olvidarlos."
        back={source.kind === 'all' ? '/' : '/bloques'}
        backLabel={source.kind === 'all' ? 'Volver al inicio' : 'Volver a bloques'}
      />
      {upcoming.length === 0 ? (
        <LearnAllDone source={source} />
      ) : (
        <LearnIntro source={source} elements={upcoming} learnedInPool={learnedInPool} onStart={start} />
      )}
    </>
  );
}

/**
 * /aprende — «Aprende 5»: presenta 5 elementos nuevos uno por uno y luego comprueba con
 * 2 preguntas por elemento. `?block=<id>` o `?family=<categoría>` limitan los elementos.
 * Debe renderizarse dentro de `<Suspense>` (usa `useSearchParams`).
 */
export function LearnApp() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const source = useMemo(() => resolveLearnSource(new URLSearchParams(query)), [query]);
  return <LearnFlow key={query} source={source} />;
}
