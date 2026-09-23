'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { cleanName } from '@/components/settings/styles';
import { useProgress } from '@/hooks/useProgress';
import type { AnsweredQuestion, ExperienceLevel } from '@/types';
import { AlreadyOnboarded } from './AlreadyOnboarded';
import { DiagnosticStep } from './DiagnosticStep';
import { OnboardingSkeleton } from './OnboardingSkeleton';
import { ProfileStep, type ProfileAnswers } from './ProfileStep';
import { ResultStep, type OnboardingResult } from './ResultStep';
import { STEP_TITLE_ID } from './StepHeader';
import { WelcomeStep } from './WelcomeStep';

type Step = 'welcome' | 'profile' | 'diagnostic' | 'result' | 'already';

interface Flow {
  step: Step;
  /** Ya había hecho la bienvenida al entrar (viene a repetir el diagnóstico). */
  wasOnboarded: boolean;
  experience: ExperienceLevel | null;
  result: OnboardingResult | null;
}

/** Al cambiar de paso: vuelve arriba y lleva el foco al título (lectores de pantalla y teclado). */
function useStepFocus(step: Step | null) {
  const previous = useRef<Step | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = step;
    if (before === null || step === null || step === before || step === 'diagnostic') return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById(STEP_TITLE_ID)?.focus({ preventScroll: true });
  }, [step]);
}

/**
 * Primer uso: bienvenida → experiencia, nombre y meta → diagnóstico de 10 preguntas → nivel inicial.
 * Con la bienvenida ya hecha ofrece volver al inicio o repetir el diagnóstico (`?repetir=1` va directo).
 */
export function Onboarding() {
  const searchParams = useSearchParams();
  const repeatRequested = searchParams.get('repetir') === '1';
  const { ready, state, updateProfile, updateSettings, completeOnboarding } = useProgress();
  const [flow, setFlow] = useState<Flow | null>(null);

  // El paso inicial se decide una sola vez, con el progreso cargado.
  if (ready && flow === null) {
    const onboarded = state.profile.onboarded;
    setFlow({
      step: onboarded ? (repeatRequested ? 'profile' : 'already') : 'welcome',
      wasOnboarded: onboarded,
      experience: state.profile.experience,
      result: null,
    });
  }

  useStepFocus(flow?.step ?? null);

  if (!flow) return <OnboardingSkeleton />;

  const go = (step: Step) => setFlow((f) => (f ? { ...f, step } : f));

  const saveProfile = (answers: ProfileAnswers) => {
    updateProfile({ name: cleanName(answers.name) });
    updateSettings({ dailyGoal: answers.goal });
  };

  const finish = (experience: ExperienceLevel, answered: AnsweredQuestion[], skipped: boolean) => {
    const { level } = completeOnboarding(experience, answered);
    setFlow((f) => (f ? { ...f, experience, step: 'result', result: { level, answered, skipped } } : f));
  };

  switch (flow.step) {
    case 'welcome':
      return <WelcomeStep onStart={() => go('profile')} />;

    case 'already':
      return <AlreadyOnboarded name={state.profile.name} onRepeat={() => go('profile')} />;

    case 'profile':
      return (
        <ProfileStep
          initial={{ experience: flow.experience, name: state.profile.name, goal: state.settings.dailyGoal }}
          onBack={() => go(flow.wasOnboarded ? 'already' : 'welcome')}
          onStart={(answers) => {
            saveProfile(answers);
            setFlow((f) => (f ? { ...f, experience: answers.experience, step: 'diagnostic' } : f));
          }}
          onSkip={(answers) => {
            saveProfile(answers);
            finish(answers.experience ?? flow.experience ?? 'beginner', [], true);
          }}
        />
      );

    case 'diagnostic': {
      const experience = flow.experience ?? 'beginner';
      return (
        <DiagnosticStep
          experience={experience}
          repeating={flow.wasOnboarded}
          onExit={() => go('profile')}
          onSkip={() => finish(experience, [], true)}
          onComplete={(answered) => finish(experience, answered, false)}
        />
      );
    }

    case 'result':
      return flow.result ? (
        <ResultStep
          result={flow.result}
          name={state.profile.name}
          dailyGoal={state.settings.dailyGoal}
          repeated={flow.wasOnboarded}
        />
      ) : null;
  }
}
