import {
  parseProgressJson,
  progressRepository,
  type LoadResult,
  type ProgressRepository,
} from '@/services/storage';
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

/**
 * Estado de la persistencia:
 * - `status`: `saved` (todo guardado) · `pending` (cambios por guardar) · `error` (el último guardado
 *   falló; se reintenta con espera creciente de 1 s a 30 s).
 * - `loadIssue`: `corrupt` (lo guardado era ilegible: se hizo una copia de seguridad y se empezó de cero) ·
 *   `error` (no se pudo leer: la app funciona en memoria pero no guarda hasta que una carga funcione) · `null`.
 */
export type SyncStatus = 'saved' | 'pending' | 'error';
export type LoadIssue = 'corrupt' | 'error' | null;
export interface SyncState {
  status: SyncStatus;
  loadIssue: LoadIssue;
}

/**
 * Un cambio del progreso: transición pura desde un estado y el instante en que ocurrió. Las acciones
 * se guardan como operaciones hasta que se guardan, para poder reaplicarlas sobre el estado cargado
 * (cambios hechos antes de terminar de cargar) o sobre el de otra pestaña (sin perder ninguno).
 */
export type ProgressOp = (state: ProgressState, now: Date) => ProgressState;

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
  /** Carga desde el repositorio (una sola vez; si falla, se reintenta sola). */
  hydrate(): Promise<void>;
  onEvent(listener: (event: ProgressEvent) => void): () => void;
  /** Guarda de inmediato los cambios pendientes (si falla, programa un reintento). */
  flush(): Promise<void>;
  /** Estado de la persistencia (referencia estable mientras no cambie). */
  getSyncStatus(): SyncState;
  subscribeSync(listener: () => void): () => void;
}

export interface ProgressStoreOptions {
  saveDelayMs?: number;
  now?: () => Date;
  /** Ajustes con los que arranca un progreso nuevo (no hay nada guardado). */
  initialSettings?: () => Partial<UserSettings>;
  /** Primera espera de los reintentos de carga y guardado (se duplica hasta `retryMaxMs`). */
  retryBaseMs?: number;
  retryMaxMs?: number;
}

interface PendingOp {
  apply: ProgressOp;
  at: Date;
}

const ALL_EVENTS: ProgressEventType[] = ['xp', 'levelUp', 'achievement', 'goalMet'];

/** Estado por defecto fijo (fecha 0) para que el render del servidor sea determinista. */
export const DEFAULT_PROGRESS_STATE: ProgressState = createInitialState(new Date(0));

export const INITIAL_SYNC_STATE: SyncState = Object.freeze({ status: 'saved', loadIssue: null });

export function createProgressStore(
  repository: ProgressRepository,
  options: ProgressStoreOptions = {},
): ProgressStore {
  const saveDelayMs = options.saveDelayMs ?? 300;
  const retryBaseMs = options.retryBaseMs ?? 1000;
  const retryMaxMs = options.retryMaxMs ?? 30_000;
  const now = options.now ?? (() => new Date());

  let state: ProgressState = DEFAULT_PROGRESS_STATE;
  let ready = false;
  /** `true` cuando una carga terminó sin error: antes nunca se guarda (se pisaría el progreso real). */
  let loaded = false;
  /** Cambios desde el último guardado correcto, en orden. */
  let pendingOps: PendingOp[] = [];
  /** Cada cambio que hay que guardar sube `revision`; `savedRevision` es la del último guardado correcto. */
  let revision = 0;
  let savedRevision = 0;
  let saving: Promise<void> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let saveRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let saveRetryMs = 0;
  let loadRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let loadRetryMs = 0;
  let hydration: Promise<void> | null = null;
  let lifecycleAttached = false;
  let sync: SyncState = INITIAL_SYNC_STATE;
  const listeners = new Set<() => void>();
  const syncListeners = new Set<() => void>();
  const eventListeners = new Set<(event: ProgressEvent) => void>();

  function notify(): void {
    for (const l of Array.from(listeners)) l();
  }

  function setSync(patch: Partial<SyncState>): void {
    const next = { ...sync, ...patch };
    if (next.status === sync.status && next.loadIssue === sync.loadIssue) return;
    sync = next;
    for (const l of Array.from(syncListeners)) l();
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

  function emitDiff(prev: ProgressState, next: ProgressState, at: Date, silent: ProgressEventType[]): void {
    const allowed = (t: ProgressEventType) => !silent.includes(t);
    const gained = next.xp - prev.xp;
    if (gained > 0 && allowed('xp')) emit({ type: 'xp', amount: gained });
    const key = todayKey(at);
    if (allowed('goalMet') && next.daily[key]?.goalMet && !prev.daily[key]?.goalMet) emit({ type: 'goalMet' });
    if (allowed('achievement')) {
      for (const id of collectUnlocked(prev, next)) emit({ type: 'achievement', id });
    }
    const before = levelFromXp(prev.xp).level;
    const after = levelFromXp(next.xp).level;
    if (after > before && allowed('levelUp')) emit({ type: 'levelUp', level: after });
  }

  /** Reaplica los cambios sin guardar sobre `base` (cada uno con su instante original). */
  function replay(base: ProgressState): ProgressState {
    return pendingOps.reduce((s, op) => op.apply(s, op.at), base);
  }

  function nextDelay(previous: number): number {
    return previous === 0 ? retryBaseMs : Math.min(retryMaxMs, previous * 2);
  }

  // ---------- Guardado ----------

  async function performSave(): Promise<void> {
    const snapshot = state;
    const snapshotRevision = revision;
    const included = pendingOps.length;
    try {
      await repository.save(snapshot);
    } catch {
      setSync({ status: 'error' });
      scheduleSaveRetry();
      return;
    }
    savedRevision = snapshotRevision;
    pendingOps = pendingOps.slice(included);
    saveRetryMs = 0;
    if (saveRetryTimer !== null) {
      clearTimeout(saveRetryTimer);
      saveRetryTimer = null;
    }
    setSync({ status: revision === savedRevision ? 'saved' : 'pending' });
  }

  async function flush(): Promise<void> {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    // Un solo guardado a la vez: el siguiente parte del estado más reciente.
    while (saving) await saving;
    if (!loaded || revision === savedRevision) return;
    const attempt = performSave();
    saving = attempt;
    try {
      await attempt;
    } finally {
      if (saving === attempt) saving = null;
    }
  }

  function scheduleSave(): void {
    // Nunca guardar antes de una carga correcta: se sobrescribiría el progreso real.
    if (!loaded) return;
    // Hay un reintento con espera en curso: guardará también estos cambios.
    if (saveRetryTimer !== null) return;
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void flush();
    }, saveDelayMs);
  }

  function scheduleSaveRetry(): void {
    if (saveRetryTimer !== null) return;
    saveRetryMs = nextDelay(saveRetryMs);
    saveRetryTimer = setTimeout(() => {
      saveRetryTimer = null;
      void flush();
    }, saveRetryMs);
  }

  /** Hay cambios por guardar. */
  function markDirty(): void {
    revision += 1;
    if (sync.status !== 'error') setSync({ status: 'pending' });
    scheduleSave();
  }

  // ---------- Cambios ----------

  function commit(apply: ProgressOp, at: Date, next: ProgressState, silent: ProgressEventType[] = []): void {
    if (next === state) return;
    const prev = state;
    pendingOps.push({ apply, at });
    state = next;
    markDirty();
    notify();
    emitDiff(prev, next, at, silent);
  }

  /** Aplica una transición que solo devuelve el estado. */
  function update(apply: ProgressOp, silent?: ProgressEventType[]): void {
    const at = now();
    commit(apply, at, apply(state, at), silent);
  }

  /** Aplica una transición del motor que devuelve `{ state, …resultado }` y devuelve el resultado. */
  function run<R extends { state: ProgressState }>(
    apply: (s: ProgressState, at: Date) => R,
    silent?: ProgressEventType[],
  ): R {
    const at = now();
    const result = apply(state, at);
    commit((s, t) => apply(s, t).state, at, result.state, silent);
    return result;
  }

  // ---------- Carga ----------

  function freshState(): ProgressState {
    const initial = createInitialState(now());
    const seed = options.initialSettings?.();
    return seed ? { ...initial, settings: { ...initial.settings, ...seed } } : initial;
  }

  async function safeLoad(): Promise<LoadResult> {
    try {
      return await repository.load();
    } catch (error) {
      return { status: 'error', error };
    }
  }

  /** Decide qué hacer tras una carga: guardar, o no guardar nada y reintentar. */
  function settleLoad(result: LoadResult): void {
    if (result.status === 'error') {
      setSync({ loadIssue: 'error' });
      scheduleLoadRetry();
      return;
    }
    loaded = true;
    loadRetryMs = 0;
    setSync({ loadIssue: result.status === 'corrupt' ? 'corrupt' : null });
    // Vacío o ilegible (ya hay copia de seguridad): el progreso nuevo aún no está guardado.
    // Cargado: solo hay que guardar si hubo cambios antes de cargar.
    if (result.status !== 'ok' || pendingOps.length > 0) {
      markDirty();
    } else {
      savedRevision = revision;
      setSync({ status: 'saved' });
    }
  }

  function scheduleLoadRetry(): void {
    if (loadRetryTimer !== null) return;
    loadRetryMs = nextDelay(loadRetryMs);
    loadRetryTimer = setTimeout(() => {
      loadRetryTimer = null;
      void safeLoad().then((result) => {
        if (loaded) return; // Mientras tanto llegó un estado de otra pestaña.
        // Vacío/ilegible: se sigue con el progreso nuevo en memoria (que ya incluye los cambios).
        if (result.status === 'ok') {
          state = replay(result.state);
          notify();
        }
        settleLoad(result);
      });
    }, loadRetryMs);
  }

  /** Estado guardado por otra pestaña: se adopta y se le reaplican los cambios locales sin guardar. */
  function adoptExternal(external: ProgressState): void {
    if (!loaded && loadRetryTimer !== null) {
      clearTimeout(loadRetryTimer);
      loadRetryTimer = null;
    }
    state = replay(external);
    if (!loaded) {
      settleLoad({ status: 'ok', state: external });
    } else if (pendingOps.length > 0) {
      markDirty();
    } else {
      // Nada local por guardar: lo guardado es exactamente `external`.
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      savedRevision = revision;
      setSync({ status: 'saved' });
    }
    notify();
  }

  function attachLifecycle(): void {
    if (lifecycleAttached) return;
    lifecycleAttached = true;
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void flush();
      });
      window.addEventListener('pagehide', () => void flush());
    }
    repository.watch?.((external) => {
      if (external) adoptExternal(external);
    });
  }

  function hydrate(): Promise<void> {
    if (hydration) return hydration;
    hydration = (async () => {
      const result = await safeLoad();
      // Los cambios hechos antes de cargar (p. ej. el tema) se reaplican sobre lo cargado.
      state = replay(result.status === 'ok' ? result.state : freshState());
      ready = true;
      settleLoad(result);
      attachLifecycle();
      notify();
    })();
    return hydration;
  }

  const actions: ProgressActions = {
    recordAnswer(input) {
      return run((s, at) => applyAnswer(s, input, at)).outcome;
    },
    rateFlashcard(input) {
      return run((s, at) => applyFlashcard(s, input, at)).outcome;
    },
    markLearned(atomicNumbers) {
      const zs = [...atomicNumbers];
      const r = run((s, at) => applyLearned(s, zs, at));
      return { xpGained: r.xpGained, unlockedAchievements: r.unlockedAchievements };
    },
    addXp(amount) {
      run((s, at) => applyXp(s, amount, at));
    },
    completeSession(input) {
      const r = run((s, at) => applySessionComplete(s, input, at));
      return { xpGained: r.xpGained, unlockedAchievements: r.unlockedAchievements };
    },
    submitRecord(kind, value) {
      const r = run((s, at) => applyRecord(s, kind, value, at));
      return { isNewRecord: r.isNewRecord, unlockedAchievements: r.unlockedAchievements };
    },
    completeOnboarding(experience, diagnostic) {
      const answers = [...diagnostic];
      // La XP inicial no es "ganada": sin toasts de XP ni modal de subida de nivel.
      const r = run((s, at) => applyOnboarding(s, experience, answers, at), ['xp', 'levelUp']);
      void flush();
      return { level: r.level };
    },
    updateSettings(patch) {
      const p = { ...patch };
      update((s, at) => applySettings(s, p, at));
    },
    updateProfile(patch) {
      const p = { ...patch };
      update((s, at) => applyProfile(s, p, at));
    },
    clearMistakes(atomicNumber) {
      update((s, at) => applyClearMistakes(s, atomicNumber, at));
    },
    resetProgress() {
      update((s, at) => applyReset(s, at), ALL_EVENTS);
      void flush();
    },
    exportData() {
      return JSON.stringify(state, null, 2);
    },
    importData(json) {
      const parsed = parseProgressJson(json, now());
      if (!parsed) return false;
      // Reemplaza todo: reaplicado sobre otro estado, también lo reemplaza.
      update(() => parsed, ALL_EVENTS);
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
    getSyncStatus: () => sync,
    subscribeSync(listener) {
      syncListeners.add(listener);
      return () => {
        syncListeners.delete(listener);
      };
    },
  };
}

/**
 * Store global de la app (localStorage). Un progreso nuevo hereda el tema guardado en
 * `localStorage['elementa:theme']` para no pisar el que ya aplicó el script inicial.
 */
export const progressStore: ProgressStore = createProgressStore(progressRepository, {
  initialSettings: () => ({ theme: readStoredTheme() }),
});
