interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Copies a valid legacy value, verifies the destination, then retires the old key. */
export function readMigratedValue(
  storage: BrowserStorage,
  currentKey: string,
  legacyKey: string,
  isValid: (value: string) => boolean = () => true,
): string | null {
  let legacyValue: string | null;
  try {
    const currentValue = storage.getItem(currentKey);
    if (currentValue !== null) {
      if (storage.getItem(legacyKey) === currentValue) storage.removeItem(legacyKey);
      return currentValue;
    }
    legacyValue = storage.getItem(legacyKey);
    if (legacyValue === null || !isValid(legacyValue)) return null;
  } catch {
    return null;
  }

  try {
    storage.setItem(currentKey, legacyValue);
    if (storage.getItem(currentKey) === legacyValue) {
      storage.removeItem(legacyKey);
      return legacyValue;
    }
  } catch {
    // The old value remains available to this read if the new key cannot be written.
  }
  return legacyValue;
}

/** Saves to the current key and removes the legacy key only after read-back succeeds. */
export function writeMigratedValue(
  storage: BrowserStorage,
  currentKey: string,
  legacyKey: string,
  value: string,
): boolean {
  try {
    storage.setItem(currentKey, value);
    if (storage.getItem(currentKey) !== value) return false;
    storage.removeItem(legacyKey);
    return true;
  } catch {
    return false;
  }
}

/** Clears both versions only after the current key is confirmed absent. */
export function clearMigratedValue(storage: BrowserStorage, currentKey: string, legacyKey: string): void {
  try {
    storage.removeItem(currentKey);
    if (storage.getItem(currentKey) === null) storage.removeItem(legacyKey);
  } catch {
    // Storage may be unavailable or blocked.
  }
}
