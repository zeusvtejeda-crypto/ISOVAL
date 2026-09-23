'use client';

import { PageHeader } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { useProgress } from '@/hooks/useProgress';
import type { DailyGoal } from '@/types';
import { AboutSection } from './AboutSection';
import { DataSettings } from './DataSettings';
import { FeedbackSettings } from './FeedbackSettings';
import { GoalPicker } from './GoalPicker';
import { InstallSetting } from './InstallSetting';
import { ProfileSettings } from './ProfileSettings';
import { SettingsSection } from './SettingsSection';
import { ThemeSetting } from './ThemeSetting';

function SettingsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tus ajustes" className="flex flex-col gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-4 rounded-3xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10" rounded="2xl" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-12" rounded="2xl" />
        </div>
      ))}
    </div>
  );
}

function GoalSetting() {
  const { state, updateSettings } = useProgress();
  return (
    <GoalPicker
      legend="Preguntas al día"
      hideLegend
      name="settings-daily-goal"
      value={state.settings.dailyGoal}
      onChange={(goal: DailyGoal) => updateSettings({ dailyGoal: goal })}
    />
  );
}

/** Ajustes: tema, perfil, meta diaria, sonido/vibración, instalación, datos y acerca de. */
export function SettingsScreen() {
  const { ready } = useProgress();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Ajustes" subtitle="Haz Elementa a tu medida." />
      {!ready ? (
        <SettingsSkeleton />
      ) : (
        <div className="flex flex-col gap-4 animate-fade-in">
          <SettingsSection id="settings-theme" emoji="🎨" title="Apariencia">
            <ThemeSetting />
          </SettingsSection>
          <SettingsSection id="settings-profile" emoji="🙂" title="Tu perfil">
            <ProfileSettings />
          </SettingsSection>
          <SettingsSection
            id="settings-goal"
            emoji="🎯"
            title="Meta diaria"
            description="Cúmplela cada día para mantener tu racha 🔥"
          >
            <GoalSetting />
          </SettingsSection>
          <SettingsSection id="settings-feedback" emoji="🔔" title="Sonido y vibración">
            <FeedbackSettings />
          </SettingsSection>
          <SettingsSection id="settings-install" emoji="📲" title="Instalar la app">
            <InstallSetting />
          </SettingsSection>
          <SettingsSection id="settings-data" emoji="💾" title="Tus datos">
            <DataSettings />
          </SettingsSection>
          <SettingsSection id="settings-about" emoji="ℹ️" title="Acerca de">
            <AboutSection />
          </SettingsSection>
        </div>
      )}
    </div>
  );
}
