'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gamepad2, Table2 } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { QuizScreen } from '@/components/quiz';
import { ButtonLink, EmptyState } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import { useQuizSession } from '@/hooks/useQuizSession';
import { planStudySession, type StudyPlan } from '@/utils/planner';
import { LearnPageSkeleton } from './LearnSkeletons';
import { LessonStepper } from './LessonStepper';
import { StudyPlanView } from './StudyPlanView';
import { NO_LEARN_REWARD, withLearnAchievements, type LearnReward } from './reward';
import { StudySummary } from './StudySummary';

type Phase = 'plan' | 'learn' | 'quiz';

interface StudyQuizProps {
  plan: StudyPlan;
  reward: LearnReward;
  onExit: () => void;
  onAnother: () => void;
}

/** Preguntas de la sesión (se monta al empezar, así el conjunto es el del plan). */
function StudyQuiz({ plan, reward, onExit, onAnother }: StudyQuizProps) {
  const session = useQuizSession({ mode: 'study', title: 'Estudiar ahora', questions: () => plan.questions });
  return (
    <QuizScreen
      session={session}
      onExit={onExit}
      renderSummary={(summary) => (
        <StudySummary
          summary={withLearnAchievements(summary, reward)}
          learned={plan.newElements}
          learnXp={reward.xpGained}
          onAnother={onAnother}
        />
      )}
    />
  );
}

function StudyEmpty() {
  return (
    <EmptyState
      icon="✨"
      title="Nada que estudiar ahora"
      description="No pudimos preparar tu sesión. Explora la tabla o juega un rato."
      action={
        <>
          <ButtonLink href="/tabla" leftIcon={<Table2 aria-hidden />}>
            Ver la tabla
          </ButtonLink>
          <ButtonLink href="/jugar" variant="secondary" leftIcon={<Gamepad2 aria-hidden />}>
            Jugar
          </ButtonLink>
        </>
      }
    />
  );
}

/**
 * /estudiar — «Estudiar ahora»: plan del día (nuevos + repasos + difíciles), presentación de los
 * nuevos (se marcan como aprendidos), preguntas mezcladas y feedback final.
 */
export function StudyApp() {
  const router = useRouter();
  const { state, ready, markLearned } = useProgress();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [phase, setPhase] = useState<Phase>('plan');
  const [reward, setReward] = useState<LearnReward>(NO_LEARN_REWARD);
  const [runId, setRunId] = useState(0);
  const planned = useRef(false);

  // El plan se calcula una sola vez al cargar el progreso (usa aleatoriedad y la fecha: solo en el cliente).
  useEffect(() => {
    if (!ready || planned.current) return;
    planned.current = true;
    setPlan(planStudySession(state, new Date()));
  }, [ready, state]);

  // La pantalla del plan empieza arriba (también al volver de una sesión).
  useEffect(() => {
    if (phase === 'plan') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [phase, runId]);

  if (!ready || !plan) return <LearnPageSkeleton label="Preparando tu sesión" />;

  const startQuiz = (learned: LearnReward) => {
    setReward(learned);
    setRunId((id) => id + 1);
    setPhase('quiz');
  };

  const start = () => {
    if (plan.newElements.length > 0) setPhase('learn');
    else startQuiz(NO_LEARN_REWARD);
  };

  const another = () => {
    setPlan(planStudySession(state, new Date()));
    setReward(NO_LEARN_REWARD);
    setPhase('plan');
  };

  if (phase === 'learn') {
    return (
      <LessonStepper
        elements={plan.newElements}
        title="Estudiar ahora: elementos nuevos"
        variant="quick"
        finishLabel="¡A practicar!"
        onExit={() => setPhase('plan')}
        onComplete={() => startQuiz(markLearned(plan.newElements))}
      />
    );
  }

  if (phase === 'quiz') {
    return <StudyQuiz key={runId} plan={plan} reward={reward} onExit={() => router.push('/')} onAnother={another} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Estudiar ahora"
        title="Tu sesión inteligente"
        subtitle="Nuevos, repasos y difíciles en una sola sesión."
        back="/"
        backLabel="Volver al inicio"
      />
      {plan.questions.length === 0 ? <StudyEmpty /> : <StudyPlanView plan={plan} onStart={start} />}
    </>
  );
}
