'use client';

import { useState } from 'react';
import { useProgress } from '@/hooks/useProgress';
import type { PersonalRecords, SessionSummaryData } from '@/types';
import type { RecordKind } from '@/utils/engine';

const RECORD_FIELD: Record<RecordKind, keyof PersonalRecords> = {
  timeAttack: 'timeAttackBest',
  survival: 'survivalBest',
  streakMode: 'streakModeBest',
};

export interface RecordKeeper {
  /** Récord guardado ahora mismo. */
  best: number;
  /** Récord antes de la última partida terminada. */
  previousBest: number;
  /**
   * Para `onFinish` de `useQuizSession`: guarda el récord y devuelve `newRecord` si lo es, más los
   * logros que desbloquea (Velocidad química, Superviviente…) para que salgan en el resumen.
   */
  submit(value: number, label: string): Pick<SessionSummaryData, 'unlockedAchievements'> & Partial<Pick<SessionSummaryData, 'newRecord'>>;
  /** Al salir a mitad: lo jugado cuenta, así que un récord también se guarda. */
  saveOnExit(value: number): void;
}

/** Récord personal de un modo (contrarreloj, supervivencia, racha) a través de `submitRecord`. */
export function useRecordKeeper(kind: RecordKind): RecordKeeper {
  const { state, submitRecord } = useProgress();
  const field = RECORD_FIELD[kind];
  const [previousBest, setPreviousBest] = useState<number | null>(null);

  return {
    best: state.records[field],
    previousBest: previousBest ?? state.records[field],
    submit(value, label) {
      setPreviousBest(state.records[field]);
      const { isNewRecord, unlockedAchievements } = submitRecord(kind, value);
      return isNewRecord ? { newRecord: { label, value }, unlockedAchievements } : { unlockedAchievements };
    },
    saveOnExit(value) {
      if (value > 0) submitRecord(kind, value);
    },
  };
}
