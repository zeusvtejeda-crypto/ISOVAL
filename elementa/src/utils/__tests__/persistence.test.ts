import { describe, expect, it } from 'vitest';
import { LocalStorageRepository, MemoryRepository, parseProgressJson, parseProgressState } from '@/services/storage';
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

describe('LocalStorageRepository', () => {
  it('guarda, carga y borra', async () => {
    const storage = new FakeStorage();
    const repo = new LocalStorageRepository('test-key', () => storage);
    expect(await repo.load()).toBeNull();
    const s = sampleState();
    await repo.save(s);
    expect(storage.getItem('test-key')).not.toBeNull();
    expect(await repo.load()).toEqual(s);
    await repo.clear();
    expect(await repo.load()).toBeNull();
  });

  it('JSON corrupto → null', async () => {
    const storage = new FakeStorage();
    storage.setItem('k', '{roto');
    expect(await new LocalStorageRepository('k', () => storage).load()).toBeNull();
  });

  it('nunca lanza si el almacenamiento falla o no existe', async () => {
    const broken = new LocalStorageRepository('k', () => new BrokenStorage());
    await expect(broken.load()).resolves.toBeNull();
    await expect(broken.save(sampleState())).resolves.toBeUndefined();
    const none = new LocalStorageRepository('k', () => null);
    await expect(none.load()).resolves.toBeNull();
    await expect(none.clear()).resolves.toBeUndefined();
  });
});

describe('progress store', () => {
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

  it('carga el progreso guardado', async () => {
    const saved = sampleState();
    const store = createProgressStore(new MemoryRepository(saved), { now: () => NOW });
    await store.hydrate();
    expect(store.getState()).toEqual(saved);
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

    expect(await repo.load()).toBeNull(); // aún con debounce
    await store.flush();
    expect((await repo.load())?.xp).toBe(store.getState().xp);
    unsub();
    store.markLearned([1]);
    expect(notified).toBe(7);
  });

  it('récords, sesiones y onboarding', async () => {
    const store = createProgressStore(new MemoryRepository(), { now: () => NOW });
    await store.hydrate();
    const events: ProgressEvent[] = [];
    store.onEvent((e) => events.push(e));
    expect(store.submitRecord('survival', 5)).toBe(true);
    expect(store.submitRecord('survival', 4)).toBe(false);
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
});
