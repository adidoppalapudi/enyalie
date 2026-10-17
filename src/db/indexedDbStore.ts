import { NotFoundError, unwrap } from '../lib/errors';
import { createId } from '../lib/id';
import {
  sortByCreation,
  toContent,
  type Deck,
  type DeckInput,
  type DeckSummary,
  type ImportedDeck,
  type Question,
} from '../models/types';
import { nameWithSuffix, validateDeckInput, validateQuestionContent, validateQuestionList } from '../models/validation';
import type { DataStore } from './DataStore';
import { BY_DECK, DECKS, QUESTIONS, openDatabase, promisifyRequest, transactionDone } from './idb';

export interface IndexedDbStoreOptions {
  /** Database name. Tests use a fresh name per test. */
  name?: string;
  /** Clock used for timestamps (injectable for tests). */
  now?: () => number;
}

const byName = (a: DeckSummary, b: DeckSummary) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

export function createIndexedDbStore(options: IndexedDbStoreOptions = {}): DataStore {
  const { name = 'rekall', now = Date.now } = options;
  let dbPromise: Promise<IDBDatabase> | null = null;

  function getDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
      const opening = openDatabase(name).then((db) => {
        // Let another tab upgrade the schema; we reconnect on next use.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        return db;
      });
      opening.catch(() => {
        if (dbPromise === opening) dbPromise = null; // allow a retry after a failure
      });
      dbPromise = opening;
    }
    return dbPromise;
  }

  /** Runs `work` inside one transaction; any error rolls the whole thing back. */
  async function run<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => T | Promise<T>,
  ): Promise<T> {
    const db = await getDb();
    const tx = db.transaction(storeNames, mode);
    const done = transactionDone(tx);
    done.catch(() => {}); // still awaited below; this just avoids "unhandled rejection" noise
    try {
      const result = await work(tx);
      await done;
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // The transaction has already finished or aborted.
      }
      throw error;
    }
  }

  async function getRecord<T>(tx: IDBTransaction, storeName: string, id: string): Promise<T | undefined> {
    return (await promisifyRequest(tx.objectStore(storeName).get(id))) as T | undefined;
  }

  async function deckQuestionKeys(tx: IDBTransaction, deckId: string): Promise<IDBValidKey[]> {
    const index = tx.objectStore(QUESTIONS).index(BY_DECK);
    return promisifyRequest(index.getAllKeys(IDBKeyRange.only(deckId)));
  }

  /** Marks a deck as changed when one of its questions changes. */
  function touchDeck(tx: IDBTransaction, deck: Deck, time: number): void {
    tx.objectStore(DECKS).put({ ...deck, updatedAt: time });
  }

  return {
    listDecks: () =>
      run([DECKS, QUESTIONS], 'readonly', async (tx) => {
        const decks = (await promisifyRequest(tx.objectStore(DECKS).getAll())) as Deck[];
        const index = tx.objectStore(QUESTIONS).index(BY_DECK);
        const counts = await Promise.all(decks.map((deck) => promisifyRequest(index.count(IDBKeyRange.only(deck.id)))));
        return decks.map((deck, i) => ({ ...deck, questionCount: counts[i] })).sort(byName);
      }),

    getDeck: (id) => run(DECKS, 'readonly', (tx) => getRecord<Deck>(tx, DECKS, id)),

    async createDeck(input: DeckInput) {
      const value = unwrap(validateDeckInput(input));
      const time = now();
      const deck: Deck = { id: createId(), ...value, createdAt: time, updatedAt: time };
      await run(DECKS, 'readwrite', (tx) => {
        tx.objectStore(DECKS).add(deck);
      });
      return deck;
    },

    async updateDeck(id, input) {
      const value = unwrap(validateDeckInput(input));
      return run(DECKS, 'readwrite', async (tx) => {
        const existing = await getRecord<Deck>(tx, DECKS, id);
        if (!existing) throw new NotFoundError('That deck no longer exists.');
        const updated: Deck = { ...existing, ...value, updatedAt: now() };
        tx.objectStore(DECKS).put(updated);
        return updated;
      });
    },

    duplicateDeck: (id) =>
      run([DECKS, QUESTIONS], 'readwrite', async (tx) => {
        const source = await getRecord<Deck>(tx, DECKS, id);
        if (!source) throw new NotFoundError('That deck no longer exists.');
        const index = tx.objectStore(QUESTIONS).index(BY_DECK);
        const questions = (await promisifyRequest(index.getAll(IDBKeyRange.only(id)))) as Question[];

        const time = now();
        const copy: Deck = {
          id: createId(),
          name: nameWithSuffix(source.name, ' (copy)'),
          description: source.description,
          createdAt: time,
          updatedAt: time,
        };
        tx.objectStore(DECKS).add(copy);
        sortByCreation(questions).forEach((question, i) => {
          const duplicate: Question = {
            ...toContent(question),
            id: createId(),
            deckId: copy.id,
            createdAt: time + i, // keeps the original order
            updatedAt: time,
          };
          tx.objectStore(QUESTIONS).add(duplicate);
        });
        return copy;
      }),

    deleteDeck: (id) =>
      run([DECKS, QUESTIONS], 'readwrite', async (tx) => {
        tx.objectStore(DECKS).delete(id);
        const keys = await deckQuestionKeys(tx, id);
        keys.forEach((key) => tx.objectStore(QUESTIONS).delete(key));
      }),

    listQuestions: (deckId) =>
      run(QUESTIONS, 'readonly', async (tx) => {
        const index = tx.objectStore(QUESTIONS).index(BY_DECK);
        return sortByCreation((await promisifyRequest(index.getAll(IDBKeyRange.only(deckId)))) as Question[]);
      }),

    listAllQuestions: () =>
      run(QUESTIONS, 'readonly', async (tx) =>
        sortByCreation((await promisifyRequest(tx.objectStore(QUESTIONS).getAll())) as Question[]),
      ),

    getQuestion: (id) => run(QUESTIONS, 'readonly', (tx) => getRecord<Question>(tx, QUESTIONS, id)),

    async addQuestion(deckId, content) {
      const value = unwrap(validateQuestionContent(content));
      return run([DECKS, QUESTIONS], 'readwrite', async (tx) => {
        const deck = await getRecord<Deck>(tx, DECKS, deckId);
        if (!deck) throw new NotFoundError('That deck no longer exists.');
        const time = now();
        const question: Question = { ...value, id: createId(), deckId, createdAt: time, updatedAt: time };
        tx.objectStore(QUESTIONS).add(question);
        touchDeck(tx, deck, time);
        return question;
      });
    },

    async updateQuestion(id, content) {
      const value = unwrap(validateQuestionContent(content));
      return run([DECKS, QUESTIONS], 'readwrite', async (tx) => {
        const existing = await getRecord<Question>(tx, QUESTIONS, id);
        if (!existing) throw new NotFoundError('That question no longer exists.');
        const time = now();
        // Built from the validated content (not spread from `existing`) so that
        // fields from an old question type don't linger after a type change.
        const updated: Question = {
          ...value,
          id,
          deckId: existing.deckId,
          createdAt: existing.createdAt,
          updatedAt: time,
        };
        tx.objectStore(QUESTIONS).put(updated);
        const deck = await getRecord<Deck>(tx, DECKS, existing.deckId);
        if (deck) touchDeck(tx, deck, time);
        return updated;
      });
    },

    deleteQuestion: (id) =>
      run([DECKS, QUESTIONS], 'readwrite', async (tx) => {
        const existing = await getRecord<Question>(tx, QUESTIONS, id);
        if (!existing) return;
        tx.objectStore(QUESTIONS).delete(id);
        const deck = await getRecord<Deck>(tx, DECKS, existing.deckId);
        if (deck) touchDeck(tx, deck, now());
      }),

    async importDeck(input: ImportedDeck, { asNewDeck }) {
      const details = unwrap(validateDeckInput(input));
      const contents = unwrap(validateQuestionList(input.questions));
      return run([DECKS, QUESTIONS], 'readwrite', async (tx) => {
        const id = !asNewDeck && input.id ? input.id : createId();
        const existing = await getRecord<Deck>(tx, DECKS, id);
        if (existing) {
          const keys = await deckQuestionKeys(tx, id);
          keys.forEach((key) => tx.objectStore(QUESTIONS).delete(key));
        }
        const time = now();
        const deck: Deck = { id, ...details, createdAt: existing?.createdAt ?? time, updatedAt: time };
        tx.objectStore(DECKS).put(deck);
        contents.forEach((content, i) => {
          const question: Question = { ...content, id: createId(), deckId: id, createdAt: time + i, updatedAt: time };
          tx.objectStore(QUESTIONS).add(question);
        });
        return deck;
      });
    },
  };
}
