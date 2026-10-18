import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, createSession } from '../src/quiz/engine';
import { loadPreferences, loadSession, savePreferences, saveSession } from '../src/quiz/persistence';
import { saved, trueFalse } from './helpers';

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('browser preference persistence', () => {
  let local: MemoryStorage;
  let sessionStorageMock: MemoryStorage;

  beforeEach(() => {
    local = new MemoryStorage();
    sessionStorageMock = new MemoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', sessionStorageMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('saves and loads quiz preferences', () => {
    const preferences = { count: 20 as const, shuffleQuestions: false, shuffleChoices: true, timer: 10 as const };
    savePreferences(preferences);

    expect(loadPreferences()).toEqual(preferences);
    expect(local.getItem('enyalie.quizPreferences')).not.toBeNull();
  });

  it('saves and loads an in-progress quiz', () => {
    const question = saved(trueFalse('A saved question?', true));
    const session = createSession({
      title: 'Saved quiz',
      source: { kind: 'deck', deckId: question.deckId },
      settings: DEFAULT_SETTINGS,
      items: [{ question, choiceOrder: [] }],
      now: 123,
    });
    saveSession(session);

    expect(loadSession()).toEqual(session);
    expect(sessionStorageMock.getItem('enyalie.quiz')).not.toBeNull();

    saveSession(null);
    expect(sessionStorageMock.getItem('enyalie.quiz')).toBeNull();
  });
});
