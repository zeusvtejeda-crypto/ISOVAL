import { parseProgressJson, progressRepository, type ProgressRepository } from '@/services/storage';
import { readStoredTheme } from '@/services/theme';
import type {
  AnswerOutcome,
  AnsweredQuestion,
  ExperienceLevel,
  ProgressState,
  UserProfile,
  UserSettings,
} from '@/types';
import { todayKey } from '@/utils/dates';
import {
  applyAnswer,
  applyClearMistakes,
  applyFlashcard,
  applyLearned,
  applyOnboarding,
  applyProfile,
  applyRecord,
  applyReset,
  applySessionComplete,
  applySettings,
  applyXp,
  collectUnlocked,
  createInitialState,
  type AnswerInput,
  type FlashcardInput,
  type RecordKind,
  type SessionCompleteInput,
} from '@/utils/engine';
import { levelFromXp } from '@/utils/levels';

export type ProgressEvent =
  | { type: 'xp'; amount: number }
  | { type: 'levelUp'; level: number }
  | { type: 'achievement'; id: string }
  | { type: 'goalMet' };

export type ProgressEventType = ProgressEvent['type'];

export interface ProgressActions {
  recordAnswer(input: AnswerInput): AnswerOutcome;
  rateFlashcard(input: FlashcardInput): AnswerOutcome;
  /** XP ganada (+5 por elemento nuevo) y logros desbloqueados. */
  markLearned(atomicNumbers: number[]): { xpGained: number; unlockedAchievements: string[] };
  addXp(amount: number): void;
  completeSession(input: SessionCompleteInput): { xpGained: number; unlockedAchievements: string[] };
  /** ¿Nuevo récord personal? y logros desbloqueados por él. */
  submitRecord(kind: RecordKind, value: number): { isNewRecord: boolean; unlockedAchievements: string[] };
  completeOnboarding(experience: ExperienceLevel, diagnostic: AnsweredQuestion[]): { level: number };
  updateSettings(patch: Partial<UserSettings>): void;
  updateProfile(patch: Partial<UserProfile>): void;
  clearMistakes(atomicNumber?: number): void;
  resetProgress(): void;
  exportData(): string;
  /** Reemplaza el progreso con un JSON exportado. `false` si no es válido. */
  importData(json: string): boolean;
}

export interface ProgressStore extends ProgressActions {
  getState(): ProgressState;
  /** Estado inicial por defecto, referencialmente estable (SSR e hidratación). */
  getServerSnapshot(): ProgressState;
  subscribe(listener: () => void): () => void;
  isReady(): boolean;
  /** Carga desde el repositorio (una sola vez). */
  hydrate(): Promise<void>;
  onEvent(listener: (event: ProgressEvent) => void): () => void;
  /** Guarda de inmediato los cambios pendientes. */
  flush(): Promise<void>;
}

export interface ProgressStoreOptions {
  saveDelayMs?: number;
  now?: () => Date;
  /** Ajustes con los que arranca un progreso nuevo (no hay nada guardado). */
  initialSettings?: () => Partial<UserSettings>;
}

const ALL_EVENTS: ProgressEventType[] = ['xp', 'levelUp', 'achievement', 'goalMet'];

/** Estado por defecto fijo (fecha 0) para que el render del servidor sea determinista. */
export const DEFAULT_PROGRESS_STATE: ProgressState = createInitialState(new Date(0));

export function createProgressStore(
  repository: ProgressRepository,
  options: ProgressStoreOptions = {},
): ProgressStore {
  const saveDelayMs = options.saveDelayMs ?? 300;
  const now = options.now ?? (() => new Date());

  let state: ProgressState = DEFAULT_PROGRESS_STATE;
  let ready = false;
  let dirty = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let hydration: Promise<void> | null = null;
  let lifecycleAttached = false;
  const listeners = new Set<() => void>();
  const eventListeners = new Set<(event: ProgressEvent) => void>();

  function notify(): void {
    for (const l of Array.from(listeners)) l();
  }

  function emit(event: ProgressEvent): void {
    for (const l of Array.from(eventListeners)) {
      try {
        l(event);
      } catch {
        // Un oyente defectuoso no debe romper el registro del progreso.
      }
    }
  }

  function emitDiff(prev: ProgressState, next: ProgressState, silent: ProgressEventType[]): void {
    const allowed = (t: ProgressEventType) => !silent.includes(t);
    const gained = next.xp - prev.xp;
    if (gained > 0 && allowed('xp')) emit({ type: 'xp', amount: gained });
    const key = todayKey(now());
    if (allowed('goalMet') && next.daily[key]?.goalMet && !prev.daily[key]?.goalMet) emit({ type: 'goalMet' });
    if (allowed('achievement')) {
      for (const id of collectUnlocked(prev, next)) emit({ type: 'achievement', id });
    }
    const before = levelFromXp(prev.xp).level;
    const after = levelFromXp(next.xp).level;
    if (after > before && allowed('levelUp')) emit({ type: 'levelUp', level: after });
  }

  async function flush(): Promise<void> {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!dirty || !ready) return;
    dirty = false;
    try {
      await repository.save(state);
    } catch {
      dirty = true;
    }
  }

  function scheduleSave(): void {
    dirty = true;
    // Nunca guardar antes de cargar: se sobrescribiría el progreso real con el estado por defecto.
    if (!ready) return;
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void flush();
    }, saveDelayMs);
  }

  function commit(next: ProgressState, silent: ProgressEventType[] = []): void {
    if (next === state) return;
    const prev = state;
    state = next;
    scheduleSave();
    notify();
    emitDiff(prev, next, silent);
  }

  function attachLifecycle(): void {
    if (lifecycleAttached || typeof window === 'undefined') return;
    lifecycleAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush();
    });
    window.addEventListener('pagehide', () => void flush());
    repository.watch?.((external) => {
      // Cambios de otra pestaña; si aquí hay cambios sin guardar, ganan los locales.
      if (!external || saveTimer !== null) return;
      state = external;
      notify();
    });
  }

  function freshState(): ProgressState {
    const initial = createInitialState(now());
    const seed = options.initialSettings?.();
    return seed ? { ...initial, settings: { ...initial.settings, ...seed } } : initial;
  }

  function hydrate(): Promise<void> {
    if (hydration) return hydration;
    hydration = (async () => {
      let loaded: ProgressState | null = null;
      try {
        loaded = await repository.load();
      } catch {
        loaded = null;
      }
      const changedBeforeReady = state !== DEFAULT_PROGRESS_STATE;
      state = loaded ?? (changedBeforeReady ? state : freshState());
      ready = true;
      if (!loaded) scheduleSave();
      attachLifecycle();
      notify();
    })();
    return hydration;
  }

  const actions: ProgressActions = {
    recordAnswer(input) {
      const r = applyAnswer(state, input, now());
      commit(r.state);
      return r.outcome;
    },
    rateFlashcard(input) {
      const r = applyFlashcard(state, input, now());
      commit(r.state);
      return r.outcome;
    },
    markLearned(atomicNumbers) {
      const r = applyLearned(state, atomicNumbers, now());
      commit(r.state);
      return { xpGained: r.xpGained, unlockedAchievements: r.unlockedAchievements };
    },
    addXp(amount) {
      commit(applyXp(state, amount, now()).state);
    },
    completeSession(input) {
      const r = applySessionComplete(state, input, now());
      commit(r.state);
      return { xpGained: r.xpGained, unlockedAchievements: r.unlockedAchievements };
    },
    submitRecord(kind, value) {
      const r = applyRecord(state, kind, value, now());
      commit(r.state);
      return { isNewRecord: r.isNewRecord, unlockedAchievements: r.unlockedAchievements };
    },
    completeOnboarding(experience, diagnostic) {
      const r = applyOnboarding(state, experience, diagnostic, now());
      // La XP inicial no es "ganada": sin toasts de XP ni modal de subida de nivel.
      commit(r.state, ['xp', 'levelUp']);
      void flush();
      return { level: r.level };
    },
    updateSettings(patch) {
      commit(applySettings(state, patch, now()));
    },
    updateProfile(patch) {
      commit(applyProfile(state, patch, now()));
    },
    clearMistakes(atomicNumber) {
      commit(applyClearMistakes(state, atomicNumber, now()));
    },
    resetProgress() {
      commit(applyReset(state, now()), ALL_EVENTS);
      void flush();
    },
    exportData() {
      return JSON.stringify(state, null, 2);
    },
    importData(json) {
      const parsed = parseProgressJson(json, now());
      if (!parsed) return false;
      commit(parsed, ALL_EVENTS);
      void flush();
      return true;
    },
  };

  return {
    ...actions,
    getState: () => state,
    getServerSnapshot: () => DEFAULT_PROGRESS_STATE,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isReady: () => ready,
    hydrate,
    onEvent(listener) {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },
    flush,
  };
}

/**
 * Store global de la app (localStorage). Un progreso nuevo hereda el tema guardado en
 * `localStorage['elementa:theme']` para no pisar el que ya aplicó el script inicial.
 */
export const progressStore: ProgressStore = createProgressStore(progressRepository, {
  initialSettings: () => ({ theme: readStoredTheme() }),
});
