'use client';

import { useMemo } from 'react';
import { progressStore, type ProgressActions } from '@/store/progress-store';
import type { DailyActivity, ProgressState } from '@/types';
import { todayKey } from '@/utils/dates';
import { emptyDay } from '@/utils/engine';
import { levelFromXp, type LevelInfo } from '@/utils/levels';
import { computeStreak, type StreakInfo } from '@/utils/streak';
import { useNow } from './useNow';
import { useProgressReady, useProgressState } from './useProgressState';

export interface UseProgressResult extends ProgressActions {
  state: ProgressState;
  /** `false` hasta cargar el progreso guardado: mientras tanto muestra un Skeleton. */
  ready: boolean;
  level: LevelInfo;
  streak: StreakInfo;
  /** Actividad de hoy (vacía si aún no hay). */
  today: DailyActivity;
}

/** Acciones estables (misma referencia en cada render). */
const actions: ProgressActions = {
  recordAnswer: progressStore.recordAnswer,
  rateFlashcard: progressStore.rateFlashcard,
  markLearned: progressStore.markLearned,
  addXp: progressStore.addXp,
  completeSession: progressStore.completeSession,
  submitRecord: progressStore.submitRecord,
  completeOnboarding: progressStore.completeOnboarding,
  updateSettings: progressStore.updateSettings,
  updateProfile: progressStore.updateProfile,
  clearMistakes: progressStore.clearMistakes,
  resetProgress: progressStore.resetProgress,
  exportData: progressStore.exportData,
  importData: progressStore.importData,
};

/** Clave fija antes de cargar: el render del servidor y la hidratación coinciden en cualquier zona horaria. */
const PLACEHOLDER_DAY = '1970-01-01';

/** Hook principal: progreso, datos derivados (nivel, racha, hoy) y acciones. */
export function useProgress(): UseProgressResult {
  const state = useProgressState();
  const ready = useProgressReady();
  const now = useNow();

  return useMemo(() => {
    const key = ready ? todayKey(now) : PLACEHOLDER_DAY;
    return {
      ...actions,
      state,
      ready,
      level: levelFromXp(state.xp),
      streak: computeStreak(state.daily, key),
      today: state.daily[key] ?? emptyDay(key, state.settings.dailyGoal),
    };
  }, [state, ready, now]);
}
