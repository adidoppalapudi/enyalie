/**
 * Small promise helpers around the IndexedDB API, plus the database schema.
 *
 * IndexedDB is callback-based; these wrappers let the rest of the code use
 * async/await. The rule to keep in mind: a transaction closes as soon as it has
 * no pending requests, so inside a transaction only await IndexedDB requests,
 * never unrelated async work such as fetch().
 */

const DB_VERSION = 2;
export const DECKS = 'decks';
export const QUESTIONS = 'questions';
export const MIGRATIONS = 'migrations';
/** Index on questions.deckId, used to load or delete one deck's questions. */
export const BY_DECK = 'byDeck';

export function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support IndexedDB, so Enyalië cannot save anything.'));
      return;
    }
    const request = indexedDB.open(name, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      // One block per schema version. To change the schema later, bump
      // DB_VERSION and add a new `if (event.oldVersion < N)` block below.
      // Never edit an old block: existing installs have already run it.
      if (event.oldVersion < 1) {
        db.createObjectStore(DECKS, { keyPath: 'id' });
        const questions = db.createObjectStore(QUESTIONS, { keyPath: 'id' });
        questions.createIndex(BY_DECK, 'deckId', { unique: false });
      }
      if (event.oldVersion < 2) db.createObjectStore(MIGRATIONS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local database.'));
    request.onblocked = () => {
      console.warn('Enyalië: database upgrade is waiting for other open tabs to close.');
    };
  });
}

export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Database request failed.'));
  });
}

/** Resolves when the transaction commits; rejects if it fails or is aborted. */
export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Database transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('Database transaction was aborted.'));
  });
}
