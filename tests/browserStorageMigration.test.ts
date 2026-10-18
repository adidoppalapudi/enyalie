import { describe, expect, it } from 'vitest';
import { clearMigratedValue, readMigratedValue, writeMigratedValue } from '../src/lib/browserStorageMigration';

class MemoryStorage {
  values = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('storage is full');
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('browser storage migration', () => {
  it('copies and verifies the legacy value before removing its old key', () => {
    const storage = new MemoryStorage();
    storage.setItem('rekall.palette', 'cloud');

    expect(readMigratedValue(storage, 'enyalie.palette', 'rekall.palette', (value) => value === 'cloud')).toBe(
      'cloud',
    );
    expect(storage.getItem('enyalie.palette')).toBe('cloud');
    expect(storage.getItem('rekall.palette')).toBeNull();
  });

  it('keeps the old value when the new key cannot be verified', () => {
    const storage = new MemoryStorage();
    storage.setItem('rekall.quiz', 'in-progress');
    storage.failWrites = true;

    expect(readMigratedValue(storage, 'enyalie.quiz', 'rekall.quiz')).toBe('in-progress');
    expect(storage.getItem('enyalie.quiz')).toBeNull();
    expect(storage.getItem('rekall.quiz')).toBe('in-progress');
  });

  it('keeps a differing legacy value when the current key already exists', () => {
    const storage = new MemoryStorage();
    storage.setItem('enyalie.preferences', 'current');
    storage.setItem('rekall.preferences', 'legacy');

    expect(readMigratedValue(storage, 'enyalie.preferences', 'rekall.preferences')).toBe('current');
    expect(storage.getItem('rekall.preferences')).toBe('legacy');
  });

  it('retires the old key after verified writes and explicit clears', () => {
    const storage = new MemoryStorage();
    storage.setItem('rekall.session', 'old');
    expect(writeMigratedValue(storage, 'enyalie.session', 'rekall.session', 'new')).toBe(true);
    expect(storage.getItem('enyalie.session')).toBe('new');
    expect(storage.getItem('rekall.session')).toBeNull();

    storage.setItem('rekall.session', 'stale');
    clearMigratedValue(storage, 'enyalie.session', 'rekall.session');
    expect(storage.getItem('enyalie.session')).toBeNull();
  });
});
