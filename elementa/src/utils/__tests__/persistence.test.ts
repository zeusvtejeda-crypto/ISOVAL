import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CORRUPT_BACKUP_PREFIX,
  LocalStorageRepository,
  MemoryRepository,
  parseProgressJson,
  parseProgressState,
  PROGRESS_STORAGE_KEY,
  type LoadResult,
  type ProgressRepository,
} from '@/services/storage';
import { createProgressStore, DEFAULT_PROGRESS_STATE, type ProgressEvent } from '@/store/progress-store';
import type { ProgressState } from '@/types';
import { applyAnswer, type AnswerInput } from '@/utils/engine';
import { createInitialState } from '@/utils/state';
import { NOW } from './helpers';

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

class BrokenStorage extends FakeStorage {
  getItem(): string | null {
    throw new Error('bloqueado');
  }
  setItem(): void {
    throw new Error('cuota llena');
  }
}

const answer: AnswerInput = {
  atomicNumber: 8,
  skill: 'symbol',
  correct: true,
  responseMs: 2000,
  mode: 'practice',
  prompt: '¿Cuál es el símbolo del Oxígeno?',
  correctAnswer: 'O',
  givenAnswer: 'O',
};

function sampleState(): ProgressState {
  return applyAnswer(createInitialState(NOW), answer, NOW).state;
}

describe('parseProgressState', () => {
  it('rechaza lo que no es un guardado de Elementa', () => {
    expect(parseProgressState(null)).toBeNull();
    expect(parseProgressState([])).toBeNull();
    expect(parseProgressState({})).toBeNull();
    expect(parseProgressState({ foo: 1 })).toBeNull();
    expect(parseProgressJson('no es json')).toBeNull();
  });

  it('ida y vuelta sin pérdidas', () => {
    const s = sampleState();
    expect(parseProgressJson(JSON.stringify(s))).toEqual(s);
  });

  it('guardados antiguos sin campos cargan con valores por defecto', () => {
    const old = { version: 1, profile: { onboarded: true }, xp: 120, elements: { 8: { correct: 3 } } };
    const s = parseProgressState(old, NOW) as ProgressState;
    expect(s.profile.onboarded).toBe(true);
    expect(s.xp).toBe(120);
    expect(s.settings).toEqual({ theme: 'system', dailyGoal: 10, sound: true, haptics: true });
    expect(s.elements[8]).toMatchObject({ atomicNumber: 8, correct: 3, incorrect: 0, ease: 2.5, recent: [], skills: {} });
    expect(s.records.bestAnswerStreak).toBe(0);
    expect(s.stats.flashcardsReviewed).toBe(0);
    expect(s.mistakes).toEqual([]);
  });

  it('sanea campos corruptos', () => {
    const bad = {
      version: 1,
      profile: { experience: 'wizard', name: 42 },
      settings: { theme: 'neon', dailyGoal: 7, sound: 'yes' },
      xp: 'mucho',
      elements: { 0: {}, 200: {}, abc: {}, 5: 'x', 6: { recent: [1, 2, 0, 'a'], due: 'ayer', ease: 99 } },
      mistakes: [{ atomicNumber: 999 }, { atomicNumber: 8, at: NOW.toISOString(), skill: 'magic' }],
      daily: { 'no-date': {}, '2026-01-15': { questions: 12, goal: 10 } },
      achievements: { a: 'x', b: 3 },
    };
    const s = parseProgressState(bad, NOW) as ProgressState;
    expect(s.profile).toMatchObject({ experience: null, name: '' });
    expect(s.settings).toMatchObject({ theme: 'system', dailyGoal: 10, sound: true });
    expect(s.xp).toBe(0);
    expect(Object.keys(s.elements)).toEqual(['6']);
    expect(s.elements[6]).toMatchObject({ recent: [1, 0], due: null, ease: 3 });
    expect(s.mistakes).toHaveLength(1);
    expect(s.mistakes[0].skill).toBe('symbol');
    expect(Object.keys(s.daily)).toEqual(['2026-01-15']);
    expect(s.daily['2026-01-15'].goalMet).toBe(true);
    expect(s.achievements).toEqual({ a: 'x' });
  });
});


function okState(result: LoadResult): ProgressState {
  if (result.status !== 'ok') throw new Error(`se esperaba "ok" y llegó "${result.status}"`);
  return result.state;
}

describe('LocalStorageRepository', () => {
  it('guarda, carga y borra', async () => {
    const storage = new FakeStorage();
    const repo = new LocalStorageRepository('test-key', () => storage);
    expect(await repo.load()).toEqual({ status: 'empty' });
    const s = sampleState();
    await repo.save(s);
    expect(storage.getItem('test-key')).not.toBeNull();
    expect(okState(await repo.load())).toEqual(s);
    await repo.clear();
    expect(await repo.load()).toEqual({ status: 'empty' });
  });

  it('JSON ilegible → copia de seguridad y "corrupt" (el original no se toca)', async () => {
    const storage = new FakeStorage();
    const raw = '{"version":1,"profile":{"onboarded":true},"xp":5000,"elem';
    storage.setItem(PROGRESS_STORAGE_KEY, raw);
    const repo = new LocalStorageRepository(PROGRESS_STORAGE_KEY, () => storage, () => NOW);
    expect(await repo.load()).toEqual({ status: 'corrupt', raw });
    expect(storage.getItem(`${CORRUPT_BACKUP_PREFIX}${NOW.toISOString()}`)).toBe(raw);
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBe(raw);
    // Un guardado que no pasa la validación (versión como texto) también se respalda.
    storage.setItem(PROGRESS_STORAGE_KEY, '{"version":"1","profile":{}}');
    expect((await repo.load()).status).toBe('corrupt');
  });

  it('conserva como mucho 3 copias de seguridad (las más recientes)', async () => {
    const storage = new FakeStorage();
    let t = NOW.getTime();
    const repo = new LocalStorageRepository(PROGRESS_STORAGE_KEY, () => storage, () => new Date((t += 1000)));
    for (let i = 0; i < 5; i++) {
      storage.setItem(PROGRESS_STORAGE_KEY, `roto-${i}`);
      await repo.load();
    }
    const backups = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(CORRUPT_BACKUP_PREFIX)) backups.push(storage.getItem(key));
    }
    expect(backups.sort()).toEqual(['roto-2', 'roto-3', 'roto-4']);
  });

  it('sin copia de seguridad posible → "error" (nada debe sobrescribirlo)', async () => {
    class FullStorage extends FakeStorage {
      setItem(): void {
        throw new Error('cuota llena');
      }
    }
    const storage = new FullStorage();
    FakeStorage.prototype.setItem.call(storage, PROGRESS_STORAGE_KEY, '{roto');
    const result = await new LocalStorageRepository(PROGRESS_STORAGE_KEY, () => storage).load();
    expect(result.status).toBe('error');
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBe('{roto');
  });

  it('almacenamiento bloqueado o ausente: load → "error" (no lanza), save rechaza', async () => {
    const broken = new LocalStorageRepository('k', () => new BrokenStorage());
    expect((await broken.load()).status).toBe('error');
    await expect(broken.save(sampleState())).rejects.toThrow('cuota llena');
    const none = new LocalStorageRepository('k', () => null);
    expect((await none.load()).status).toBe('error');
    await expect(none.save(sampleState())).rejects.toThrow();
    await expect(none.clear()).resolves.toBeUndefined();
  });
});

/** Repositorio controlable para simular fallos de carga/guardado. */
class ScriptedRepository implements ProgressRepository {
  readonly inner: MemoryRepository;
  loadCalls = 0;
  saveCalls = 0;
  failLoads = 0;
  failSaves = 0;
  gate: Promise<void> | null = null;

  constructor(initial: ProgressState | null = null) {
    this.inner = new MemoryRepository(initial);
  }

  async load(): Promise<LoadResult> {
    this.loadCalls++;
    if (this.gate) await this.gate;
    if (this.failLoads > 0) {
      this.failLoads--;
      throw new Error('red caída');
    }
    return this.inner.load();
  }

  async save(state: ProgressState): Promise<void> {
    this.saveCalls++;
    if (this.failSaves > 0) {
      this.failSaves--;
      throw new Error('cuota llena');
    }
    await this.inner.save(state);
  }

  async clear(): Promise<void> {
    await this.inner.clear();
  }
}

/** Varias "pestañas" sobre un mismo almacenamiento: cada guardado avisa a las demás (como el evento `storage`). */
class SharedStorage {
  data: string | null;
  private watchers = new Set<{ owner: object; fn: (s: ProgressState | null) => void }>();

  constructor(initial: ProgressState) {
    this.data = JSON.stringify(initial);
  }

  repo(): ProgressRepository {
    const owner = {};
    return {
      load: async () => (this.data ? { status: 'ok', state: JSON.parse(this.data) as ProgressState } : { status: 'empty' }),
      save: async (state) => {
        this.data = JSON.stringify(state);
        for (const w of this.watchers) {
          if (w.owner !== owner) setTimeout(() => w.fn(parseProgressJson(this.data ?? '')), 0);
        }
      },
      clear: async () => {
        this.data = null;
      },
      watch: (fn) => {
        const w = { owner, fn };
        this.watchers.add(w);
        return () => this.watchers.delete(w);
      },
    };
  }
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe('progress store', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('snapshot del servidor estable y listo tras cargar', async () => {
    const store = createProgressStore(new MemoryRepository(), { now: () => NOW, saveDelayMs: 0 });
    expect(store.getServerSnapshot()).toBe(DEFAULT_PROGRESS_STATE);
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(store.getState()).toBe(DEFAULT_PROGRESS_STATE);
    expect(store.isReady()).toBe(false);
    await store.hydrate();
    expect(store.isReady()).toBe(true);
    expect(store.getState().profile.createdAt).toBe(NOW.toISOString());
  });

  it('carga el progreso guardado sin volver a guardarlo', async () => {
    const saved = sampleState();
    const repo = new ScriptedRepository(saved);
    const store = createProgressStore(repo, { now: () => NOW, saveDelayMs: 0 });
    await store.hydrate();
    expect(store.getState()).toEqual(saved);
    await store.flush();
    expect(repo.saveCalls).toBe(0);
    expect(store.getSyncStatus()).toEqual({ status: 'saved', loadIssue: null });
  });

  it('un progreso nuevo arranca con los ajustes iniciales; uno guardado los ignora', async () => {
    const initialSettings = () => ({ theme: 'dark' as const });
    const fresh = createProgressStore(new MemoryRepository(), { now: () => NOW, initialSettings });
    await fresh.hydrate();
    expect(fresh.getState().settings.theme).toBe('dark');

    const saved = sampleState();
    const loaded = createProgressStore(new MemoryRepository(saved), { now: () => NOW, initialSettings });
    await loaded.hydrate();
    expect(loaded.getState().settings.theme).toBe(saved.settings.theme);
  });

  it('acciones síncronas, notificaciones, eventos y persistencia', async () => {
    const repo = new MemoryRepository();
    const store = createProgressStore(repo, { now: () => NOW, saveDelayMs: 10_000 });
    await store.hydrate();
    await store.flush(); // guarda el progreso nuevo
    let notified = 0;
    const events: ProgressEvent[] = [];
    const unsub = store.subscribe(() => notified++);
    store.onEvent((e) => events.push(e));

    const outcome = store.recordAnswer(answer);
    expect(outcome.xpGained).toBe(10);
    expect(notified).toBe(1);
    expect(events).toEqual(expect.arrayContaining([{ type: 'xp', amount: 10 }, { type: 'achievement', id: 'first-element' }]));

    store.updateSettings({ dailyGoal: 5 });
    for (let i = 0; i < 4; i++) store.recordAnswer(answer);
    expect(events).toContainEqual({ type: 'goalMet' });

    store.addXp(200);
    expect(events).toContainEqual({ type: 'levelUp', level: 2 });

    expect(repo.peek()?.xp).toBe(0); // aún con debounce
    expect(store.getSyncStatus().status).toBe('pending');
    await store.flush();
    expect(repo.peek()?.xp).toBe(store.getState().xp);
    expect(store.getSyncStatus().status).toBe('saved');
    unsub();
    store.markLearned([1]);
    expect(notified).toBe(7);
  });

  it('récords, sesiones y onboarding', async () => {
    const store = createProgressStore(new MemoryRepository(), { now: () => NOW });
    await store.hydrate();
    const events: ProgressEvent[] = [];
    store.onEvent((e) => events.push(e));
    expect(store.submitRecord('survival', 5).isNewRecord).toBe(true);
    expect(store.submitRecord('survival', 4)).toEqual({ isNewRecord: false, unlockedAchievements: [] });
    expect(store.completeSession({ mode: 'exam', total: 10, correct: 9, durationMs: 1000 }).xpGained).toBe(50);
    events.length = 0;
    expect(store.completeOnboarding('beginner', []).level).toBe(1);
    expect(store.getState().profile.onboarded).toBe(true);
    expect(events.filter((e) => e.type === 'xp' || e.type === 'levelUp')).toEqual([]);
  });

  it('exportar, importar, reiniciar y limpiar errores', async () => {
    const store = createProgressStore(new MemoryRepository(), { now: () => NOW });
    await store.hydrate();
    store.recordAnswer({ ...answer, correct: false });
    store.updateSettings({ theme: 'dark' });
    const json = store.exportData();
    store.clearMistakes();
    expect(store.getState().mistakes).toEqual([]);
    expect(store.importData('{"hola": 1}')).toBe(false);
    expect(store.importData(json)).toBe(true);
    expect(store.getState().mistakes).toHaveLength(1);
    store.resetProgress();
    expect(store.getState().xp).toBe(0);
    expect(store.getState().mistakes).toEqual([]);
    expect(store.getState().settings.theme).toBe('dark');
  });

  it('un oyente que lanza no rompe el registro', async () => {
    const store = createProgressStore(new MemoryRepository(), { now: () => NOW });
    await store.hydrate();
    store.onEvent(() => {
      throw new Error('boom');
    });
    expect(() => store.recordAnswer(answer)).not.toThrow();
  });

  it('progreso ilegible: se conserva la copia, se empieza de cero y se avisa (loadIssue "corrupt")', async () => {
    const storage = new FakeStorage();
    const raw = '{"version":1,"profile":{"onboarded":true},"xp":5000,"elements":{"8":{"cor';
    storage.setItem(PROGRESS_STORAGE_KEY, raw);
    const repo = new LocalStorageRepository(PROGRESS_STORAGE_KEY, () => storage, () => NOW);
    const store = createProgressStore(repo, { now: () => NOW, saveDelayMs: 0 });
    await store.hydrate();
    expect(store.getSyncStatus().loadIssue).toBe('corrupt');
    expect(store.getState().xp).toBe(0);
    await store.flush();
    expect(storage.getItem(`${CORRUPT_BACKUP_PREFIX}${NOW.toISOString()}`)).toBe(raw);
    expect(parseProgressJson(storage.getItem(PROGRESS_STORAGE_KEY) ?? '')?.xp).toBe(0);
    expect(store.getSyncStatus()).toEqual({ status: 'saved', loadIssue: 'corrupt' });
  });

  it('una carga que lanza no guarda nada; se reintenta y luego se reaplican los cambios', async () => {
    vi.useFakeTimers();
    const saved = { ...sampleState(), xp: 5000 };
    const repo = new ScriptedRepository(saved);
    repo.failLoads = 2;
    const store = createProgressStore(repo, { now: () => NOW, saveDelayMs: 0 });
    await store.hydrate();
    expect(store.isReady()).toBe(true); // usable en memoria
    expect(store.getSyncStatus().loadIssue).toBe('error');
    store.addXp(50);
    expect(store.getState().xp).toBe(50);
    await vi.advanceTimersByTimeAsync(500);
    await store.flush();
    expect(repo.saveCalls).toBe(0);
    expect(repo.inner.peek()?.xp).toBe(5000);

    await vi.advanceTimersByTimeAsync(1000); // 1.er reintento: falla
    expect(repo.loadCalls).toBe(2);
    expect(repo.saveCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(2000); // 2.º reintento: funciona
    expect(repo.loadCalls).toBe(3);
    expect(store.getSyncStatus().loadIssue).toBeNull();
    expect(store.getState().xp).toBe(5050);
    await vi.advanceTimersByTimeAsync(10);
    expect(repo.inner.peek()?.xp).toBe(5050);
    expect(store.getSyncStatus().status).toBe('saved');
  });

  it('un guardado que falla se reintenta con espera creciente y avisa (status "error")', async () => {
    vi.useFakeTimers();
    const repo = new ScriptedRepository(sampleState());
    const store = createProgressStore(repo, { now: () => NOW, saveDelayMs: 300 });
    await store.hydrate();
    repo.failSaves = 2;
    store.addXp(50);
    await vi.advanceTimersByTimeAsync(300);
    expect(repo.saveCalls).toBe(1);
    expect(store.getSyncStatus().status).toBe('error');
    store.addXp(5); // durante la espera no se adelanta el reintento
    await vi.advanceTimersByTimeAsync(999);
    expect(repo.saveCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(1); // +1 s: falla otra vez
    expect(repo.saveCalls).toBe(2);
    expect(store.getSyncStatus().status).toBe('error');
    await vi.advanceTimersByTimeAsync(2000); // +2 s: funciona
    expect(repo.saveCalls).toBe(3);
    expect(store.getSyncStatus().status).toBe('saved');
    expect(repo.inner.peek()?.xp).toBe(store.getState().xp);
    expect(store.getState().xp).toBe(sampleState().xp + 55);
  });

  it('los cambios hechos antes de cargar sobreviven a la carga', async () => {
    const saved = { ...sampleState(), xp: 300 };
    const repo = new ScriptedRepository(saved);
    let open = () => {};
    repo.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const store = createProgressStore(repo, { now: () => NOW, saveDelayMs: 0 });
    const hydration = store.hydrate();
    store.addXp(50);
    store.updateSettings({ theme: 'dark' });
    expect(store.getState().xp).toBe(50); // respuesta inmediata en la UI
    await store.flush();
    expect(repo.saveCalls).toBe(0); // nunca antes de cargar
    open();
    await hydration;
    expect(store.getState().xp).toBe(350);
    expect(store.getState().settings.theme).toBe('dark');
    await store.flush();
    expect(repo.inner.peek()).toMatchObject({ xp: 350, settings: { theme: 'dark' } });
  });

  it('dos pestañas que responden casi a la vez conservan ambas respuestas', async () => {
    const shared = new SharedStorage(sampleState());
    const a = createProgressStore(shared.repo(), { now: () => NOW, saveDelayMs: 5 });
    const b = createProgressStore(shared.repo(), { now: () => NOW, saveDelayMs: 40 });
    await Promise.all([a.hydrate(), b.hydrate()]);
    const base = sampleState().stats.totalQuestions;

    // A guarda su respuesta mientras la de B aún espera su guardado: B recibe el estado de A y
    // reaplica la suya encima (antes la ignoraba y luego guardaba encima, perdiendo la de A).
    a.recordAnswer({ ...answer, atomicNumber: 1 });
    b.recordAnswer({ ...answer, atomicNumber: 2 });
    await tick(120);

    for (const store of [a, b]) {
      expect(store.getState().stats.totalQuestions).toBe(base + 2);
      expect(store.getState().elements[1]).toBeDefined();
      expect(store.getState().elements[2]).toBeDefined();
    }
    const stored = parseProgressJson(shared.data ?? '') as ProgressState;
    expect(stored.stats.totalQuestions).toBe(base + 2);
    expect(a.getSyncStatus().status).toBe('saved');
    expect(b.getSyncStatus().status).toBe('saved');
  });

  it('sin cambios locales, el estado de otra pestaña se adopta tal cual (sin volver a guardarlo)', async () => {
    const shared = new SharedStorage(sampleState());
    const a = createProgressStore(shared.repo(), { now: () => NOW, saveDelayMs: 5 });
    const bRepo = shared.repo();
    const saveSpy = vi.spyOn(bRepo, 'save');
    const b = createProgressStore(bRepo, { now: () => NOW, saveDelayMs: 5 });
    await Promise.all([a.hydrate(), b.hydrate()]);
    a.addXp(40);
    await tick(30);
    expect(b.getState().xp).toBe(a.getState().xp);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
