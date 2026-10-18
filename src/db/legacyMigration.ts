import type { Deck, Question } from '../models/types';
import { DECKS, MIGRATIONS, QUESTIONS, promisifyRequest, transactionDone } from './idb';

const MIGRATION_ID = 'rekall-to-enyalie-v1';

interface MigrationRecord {
  id: string;
  completedAt: number;
  deckCount: number;
  questionCount: number;
}

type StoredRecord = { id: string };

/** Copies legacy records without deleting the source database. Repeating it is safe. */
export async function migrateLegacyDatabase(target: IDBDatabase, legacyName?: string): Promise<void> {
  if (!legacyName || legacyName === target.name || (await hasCompletedMigration(target))) return;

  const legacy = await openExistingDatabase(legacyName);
  if (!legacy) return;
  try {
    if (!legacy.objectStoreNames.contains(DECKS) || !legacy.objectStoreNames.contains(QUESTIONS)) return;
    const { decks, questions } = await readLegacyRecords(legacy);
    if (decks.length === 0 && questions.length === 0) return;
    await copyAndVerify(target, decks, questions);
  } finally {
    legacy.close();
  }
}

async function hasCompletedMigration(target: IDBDatabase): Promise<boolean> {
  const tx = target.transaction(MIGRATIONS, 'readonly');
  const done = transactionDone(tx);
  const record = await promisifyRequest(tx.objectStore(MIGRATIONS).get(MIGRATION_ID));
  await done;
  return record !== undefined;
}

async function openExistingDatabase(name: string): Promise<IDBDatabase | null> {
  const factory = indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> };
  if (factory.databases) {
    try {
      const databases = await factory.databases();
      if (!databases.some((database) => database.name === name)) return null;
    } catch {
      // Fall back to an open-and-abort probe in browsers that expose but restrict databases().
    }
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    let didNotExist = false;
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) {
        // Abort the implicit create so probing never leaves an empty old database behind.
        didNotExist = true;
        request.transaction?.abort();
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      if (didNotExist) resolve(null);
      else reject(request.error ?? new Error('Could not open the previous local database.'));
    };
  });
}

async function readLegacyRecords(database: IDBDatabase): Promise<{ decks: Deck[]; questions: Question[] }> {
  const tx = database.transaction([DECKS, QUESTIONS], 'readonly');
  const done = transactionDone(tx);
  const decksRequest = promisifyRequest(tx.objectStore(DECKS).getAll()) as Promise<Deck[]>;
  const questionsRequest = promisifyRequest(tx.objectStore(QUESTIONS).getAll()) as Promise<Question[]>;
  const [decks, questions] = await Promise.all([decksRequest, questionsRequest]);
  await done;
  return { decks, questions };
}

function recordsMatch<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function chooseCopy<T extends StoredRecord>(
  source: T,
  existing: Map<string, T>,
  transform: (id: string) => T,
): { record: T; needsWrite: boolean } {
  for (let suffix = 0; ; suffix++) {
    const id = suffix === 0 ? source.id : suffix === 1 ? `migrated-${source.id}` : `migrated-${suffix}-${source.id}`;
    const record = transform(id);
    const found = existing.get(id);
    if (!found) return { record, needsWrite: true };
    if (recordsMatch(found, record)) return { record, needsWrite: false };
  }
  throw new Error('Could not assign a safe id while migrating saved data.');
}

async function copyAndVerify(target: IDBDatabase, decks: Deck[], questions: Question[]): Promise<void> {
  const tx = target.transaction([DECKS, QUESTIONS, MIGRATIONS], 'readwrite');
  const done = transactionDone(tx);
  done.catch(() => {});
  try {
    const deckStore = tx.objectStore(DECKS);
    const questionStore = tx.objectStore(QUESTIONS);
    const migrationStore = tx.objectStore(MIGRATIONS);
    const [existingDeckList, existingQuestionList, completed] = await Promise.all([
      promisifyRequest(deckStore.getAll()) as Promise<Deck[]>,
      promisifyRequest(questionStore.getAll()) as Promise<Question[]>,
      promisifyRequest(migrationStore.get(MIGRATION_ID)),
    ]);
    if (completed !== undefined) {
      await done;
      return;
    }

    const existingDecks = new Map(existingDeckList.map((deck) => [deck.id, deck]));
    const existingQuestions = new Map(existingQuestionList.map((question) => [question.id, question]));
    const deckIds = new Map<string, string>();
    const expectedDecks: Deck[] = [];
    const expectedQuestions: Question[] = [];

    for (const source of decks) {
      const selected = chooseCopy(source, existingDecks, (id) => ({ ...source, id }));
      deckIds.set(source.id, selected.record.id);
      expectedDecks.push(selected.record);
      if (selected.needsWrite) {
        deckStore.add(selected.record);
        existingDecks.set(selected.record.id, selected.record);
      }
    }

    for (const source of questions) {
      const deckId = deckIds.get(source.deckId) ?? source.deckId;
      const selected = chooseCopy(source, existingQuestions, (id) => ({ ...source, id, deckId }));
      expectedQuestions.push(selected.record);
      if (selected.needsWrite) {
        questionStore.add(selected.record);
        existingQuestions.set(selected.record.id, selected.record);
      }
    }

    // Queue verification reads after the adds; only record the migration after those reads match.
    const [savedDecks, savedQuestions] = await Promise.all([
      promisifyRequest(deckStore.getAll()) as Promise<Deck[]>,
      promisifyRequest(questionStore.getAll()) as Promise<Question[]>,
    ]);
    const savedDeckMap = new Map(savedDecks.map((deck) => [deck.id, deck]));
    const savedQuestionMap = new Map(savedQuestions.map((question) => [question.id, question]));
    if (
      expectedDecks.some((deck) => !recordsMatch(savedDeckMap.get(deck.id), deck)) ||
      expectedQuestions.some((question) => !recordsMatch(savedQuestionMap.get(question.id), question))
    ) {
      throw new Error('Enyalië could not verify the data copied from the previous local database.');
    }

    const marker: MigrationRecord = {
      id: MIGRATION_ID,
      completedAt: Date.now(),
      deckCount: decks.length,
      questionCount: questions.length,
    };
    migrationStore.put(marker);
    await done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction has already finished or aborted.
    }
    await done.catch(() => {});
    throw error;
  }
}
