import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
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

describe('legacy browser preference migration', () => {
  let local: MemoryStorage;
  let sessionStorageMock: MemoryStorage;

  beforeEach(() => {
    local = new MemoryStorage();
    sessionStorageMock = new MemoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', sessionStorageMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('moves quiz preferences to the Enyalië key and verifies the copy', () => {
    const legacy = JSON.stringify({ count: 20, shuffleQuestions: false, shuffleChoices: true, timer: 10 });
    local.setItem('rekall.quizPreferences', legacy);

    expect(loadPreferences()).toEqual({ count: 20, shuffleQuestions: false, shuffleChoices: true, timer: 10 });
    expect(local.getItem('enyalie.quizPreferences')).toBe(legacy);
    expect(local.getItem('rekall.quizPreferences')).toBeNull();
  });

  it('moves an in-progress quiz in session storage without changing its content', () => {
    const question = saved(trueFalse('A saved question?', true));
    const session = createSession({
      title: 'Saved quiz',
      source: { kind: 'deck', deckId: question.deckId },
      settings: DEFAULT_SETTINGS,
      items: [{ question, choiceOrder: [] }],
      now: 123,
    });
    const legacy = JSON.stringify(session);
    sessionStorageMock.setItem('rekall.quiz', legacy);

    expect(loadSession()).toEqual(session);
    expect(sessionStorageMock.getItem('enyalie.quiz')).toBe(legacy);
    expect(sessionStorageMock.getItem('rekall.quiz')).toBeNull();
  });

  it('writes new storage names and clears their legacy counterparts after verification', () => {
    savePreferences({ count: 5, shuffleQuestions: true, shuffleChoices: false, timer: 'off' });
    expect(local.getItem('enyalie.quizPreferences')).not.toBeNull();

    const session = createSession({
      title: 'Active quiz',
      source: { kind: 'quick' },
      settings: DEFAULT_SETTINGS,
      items: [{ question: saved(trueFalse('Question?', true)), choiceOrder: [] }],
      now: 456,
    });
    saveSession(session);
    expect(sessionStorageMock.getItem('enyalie.quiz')).not.toBeNull();
    saveSession(null);
    expect(sessionStorageMock.getItem('enyalie.quiz')).toBeNull();
    expect(sessionStorageMock.getItem('rekall.quiz')).toBeNull();
  });

  it('migrates the pre-paint palette key from index.html', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    if (!script) return;
    local.setItem('rekall.palette', 'cloud');
    const document = { documentElement: { dataset: {} as Record<string, string> } };

    runInNewContext(script, { localStorage: local, document });

    expect(document.documentElement.dataset.palette).toBe('cloud');
    expect(local.getItem('enyalie.palette')).toBe('cloud');
    expect(local.getItem('rekall.palette')).toBeNull();
  });
});
