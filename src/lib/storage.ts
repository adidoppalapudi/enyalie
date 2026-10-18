let requested = false;

/**
 * Asks the browser to keep Enyalië's data even when the device runs low on
 * space. Called once, after you first create or import a deck. Chrome decides
 * silently; Firefox may show a prompt. Failure is harmless.
 */
export function requestPersistentStorage(): void {
  if (requested) return;
  requested = true;
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    // Not supported here.
  }
}
