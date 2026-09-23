'use client';

import { useMemo } from 'react';
import { masteryMap } from '@/utils/mastery';
import { useNow } from './useNow';
import { useProgressState } from './useProgressState';

/** Dominio 0–100 de los 118 elementos, indexado por número atómico. */
export function useMasteryMap(): Record<number, number> {
  const state = useProgressState();
  const now = useNow();
  return useMemo(() => masteryMap(state, now), [state, now]);
}
