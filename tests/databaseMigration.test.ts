import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createIndexedDbStore } from '../src/db/indexedDbStore';
import { createId } from '../src/lib/id';
import { trueFalse } from './helpers';

describe('IndexedDB rebrand migration', () => {
  it('does not create an empty legacy database when none exists', async () => {
    const suffix = createId();
    const oldName = `rekall-${suffix}`;
    const newName = `enyalie-${suffix}`;
    const databasesDescriptor = Object.getOwnPropertyDescriptor(indexedDB, 'databases');
    Object.defineProperty(indexedDB, 'databases', { configurable: true, value: undefined });
    try {
      await createIndexedDbStore({ name: newName, legacyName: oldName }).listDecks();
    } finally {
      if (databasesDescriptor) Object.defineProperty(indexedDB, 'databases', databasesDescriptor);
      else delete (indexedDB as unknown as { databases?: unknown }).databases;
    }
    expect((await indexedDB.databases()).some((database) => database.name === oldName)).toBe(false);
  });

  it('copies legacy decks and questions, verifies them, and leaves the old database intact', async () => {
    const suffix = createId();
    const oldName = `rekall-${suffix}`;
    const newName = `enyalie-${suffix}`;
    const oldStore = createIndexedDbStore({ name: oldName, legacyName: null });
    const deck = await oldStore.createDeck({ name: 'Saved deck', description: 'legacy data' });
    const question = await oldStore.addQuestion(deck.id, trueFalse('Saved question?', true));
    const savedDeck = (await oldStore.getDeck(deck.id))!;

    const newStore = createIndexedDbStore({ name: newName, legacyName: oldName });
    expect(await newStore.listDecks()).toEqual([{ ...savedDeck, questionCount: 1 }]);
    expect(await newStore.listQuestions(deck.id)).toEqual([question]);
    expect(await oldStore.listDecks()).toEqual([{ ...savedDeck, questionCount: 1 }]);

    const reopened = createIndexedDbStore({ name: newName, legacyName: oldName });
    expect(await reopened.listDecks()).toHaveLength(1);
    expect(await reopened.listAllQuestions()).toEqual([question]);
  });

  it('preserves both databases when record ids collide', async () => {
    const suffix = createId();
    const oldName = `rekall-${suffix}`;
    const newName = `enyalie-${suffix}`;
    const oldStore = createIndexedDbStore({ name: oldName, legacyName: null });
    const newStore = createIndexedDbStore({ name: newName, legacyName: null });

    await oldStore.importDeck(
      { id: 'shared-deck', name: 'Legacy copy', description: '', questions: [trueFalse('Old?', true)] },
      { asNewDeck: false },
    );
    await newStore.importDeck(
      { id: 'shared-deck', name: 'Current copy', description: '', questions: [trueFalse('New?', false)] },
      { asNewDeck: false },
    );

    const migrated = createIndexedDbStore({ name: newName, legacyName: oldName });
    const decks = await migrated.listDecks();
    expect(decks.map((item) => item.name)).toEqual(['Current copy', 'Legacy copy']);
    expect(decks.map((item) => item.id)).toContain('shared-deck');
    expect(decks.some((item) => item.id.startsWith('migrated-shared-deck'))).toBe(true);
    expect((await migrated.listAllQuestions()).map((item) => item.prompt).sort()).toEqual(['New?', 'Old?']);

    const repeated = createIndexedDbStore({ name: newName, legacyName: oldName });
    expect(await repeated.listDecks()).toHaveLength(2);
    expect(await repeated.listAllQuestions()).toHaveLength(2);
  });
});
