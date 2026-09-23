'use client';

import { useMemo } from 'react';
import type { ElementProgress, MasteryTier } from '@/types';
import { computeMastery, masteryTier } from '@/utils/mastery';
import { useNow } from './useNow';
import { useProgressState } from './useProgressState';

export interface ElementMastery {
  /** 0–100. */
  mastery: number;
  tier: MasteryTier;
  /** Progreso guardado (`undefined` si nunca se vio). */
  progress: ElementProgress | undefined;
}

export function useElementMastery(atomicNumber: number): ElementMastery {
  const state = useProgressState();
  const now = useNow();
  const progress = state.elements[atomicNumber];
  return useMemo(() => {
    const mastery = computeMastery(progress, now);
    return { mastery, tier: masteryTier(mastery), progress };
  }, [progress, now]);
}
