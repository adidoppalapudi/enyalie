// Imports into the real IndexedDB store, running on fake-indexeddb.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { DataStore } from '../src/db/DataStore';
import { createIndexedDbStore } from '../src/db/indexedDbStore';
import { createDeckFile, createDecksFile, serializeDeckFile } from '../src/io/deckFile';
import { importDeckFiles, summarizeImport, type ConflictChoice, type DeckConflict } from '../src/io/importDecks';
import { createId } from '../src/lib/id';
import type { Deck } from '../src/models/types';
import { flashcard, saved } from './helpers';

function freshStore() {
  let time = 1000;
  return createIndexedDbStore({ name: `test-${createId()}`, now: () => ++time });
}

/** A file the user picked, holding `text`. */
function file(name: string, text: string) {
  return { name, size: text.length, text: async () => text };
}

/** A deck with `questionCount` flashcards. */
function deckWith(id: string, name: string, questionCount = 3) {
  const deck: Deck = { id, name, description: '', createdAt: 1, updatedAt: 1 };
  const questions = Array.from({ length: questionCount }, (_, i) =>
    saved(flashcard(`${name} question ${i + 1}?`, 'Answer'), id),
  );
  return { deck, questions };
}

/** The text of a valid deck file with `questionCount` flashcards. */
function deckText(id: string, name: string, questionCount = 3): string {
  const { deck, questions } = deckWith(id, name, questionCount);
  return serializeDeckFile(createDeckFile(deck, questions));
}

/** For batches where no deck is in the library yet; a call shows up as a skipped file. */
async function noConflictExpected(): Promise<ConflictChoice> {
  throw new Error('Unexpected conflict.');
}

describe('importing several deck files', () => {
  it('imports every good file and skips a broken one without blocking the rest', async () => {
    const store = freshStore();
    const names = ['aws', 'geography', 'llm-vocabulary', 'movies', 'pokemon'];
    names.push('spelling', 'texas-history', 'us-history', 'vocabulary', 'weather');
    const broken = JSON.parse(deckText('deck-geography', 'World Geography', 5));
    broken.questions[3].prompt = '';
    const files = names.map((name) =>
      file(`${name}.enyalie.json`, name === 'geography' ? JSON.stringify(broken) : deckText(`deck-${name}`, name)),
    );

    const report = await importDeckFiles(files.reverse(), { store, onConflict: noConflictExpected });

    expect(summarizeImport(report)).toBe(
      'Imported 9 decks. Skipped 1: geography.enyalie.json (Question 4: Prompt is required).',
    );
    // Handled in name order, whatever order the picker gave.
    expect(report.imported.map((item) => item.source)).toEqual(
      names.filter((name) => name !== 'geography').map((name) => `${name}.enyalie.json`),
    );
    expect(await store.listDecks()).toHaveLength(9);
  });

  it('asks once for each deck already in the library and follows each choice', async () => {
    const store = freshStore();
    await importDeckFiles(
      [
        file('a.json', deckText('deck-a', 'Alpha', 2)),
        file('b.json', deckText('deck-b', 'Beta', 2)),
        file('c.json', deckText('deck-c', 'Gamma', 2)),
      ],
      { store, onConflict: noConflictExpected },
    );

    const asked: DeckConflict[] = [];
    const choices: Record<string, ConflictChoice> = { 'deck-a': 'replace', 'deck-b': 'keep-both', 'deck-c': 'skip' };
    const report = await importDeckFiles(
      [
        file('d.json', deckText('deck-d', 'Delta', 1)),
        file('a.json', deckText('deck-a', 'Alpha', 5)),
        file('c.json', deckText('deck-c', 'Gamma', 5)),
        file('b.json', deckText('deck-b', 'Beta', 5)),
      ],
      {
        store,
        onConflict: async (conflict) => {
          asked.push(conflict);
          return choices[conflict.existing.id];
        },
      },
    );

    expect(asked.map((c) => [c.source, c.position, c.total, c.existing.name, c.deck.questions.length])).toEqual([
      ['a.json', 1, 4, 'Alpha', 5],
      ['b.json', 2, 4, 'Beta', 5],
      ['c.json', 3, 4, 'Gamma', 5],
    ]);
    expect(summarizeImport(report)).toBe(
      'Imported 3 decks. Skipped 1: c.json (you kept the copy already in your library).',
    );
    const decks = await store.listDecks();
    expect(decks.map((deck) => [deck.name, deck.questionCount])).toEqual([
      ['Alpha', 5],
      ['Beta', 2],
      ['Beta (imported)', 5],
      ['Delta', 1],
      ['Gamma', 2],
    ]);
  });

  it('asks about a deck that appears twice in the same batch', async () => {
    const store = freshStore();
    const asked: DeckConflict[] = [];
    const report = await importDeckFiles(
      [file('old.json', deckText('deck-x', 'Rivers', 2)), file('new.json', deckText('deck-x', 'Rivers', 4))],
      {
        store,
        onConflict: async (conflict) => {
          asked.push(conflict);
          return 'skip';
        },
      },
    );
    expect(asked.map((c) => c.source)).toEqual(['old.json']);
    expect(report.imported.map((item) => [item.source, item.questionCount])).toEqual([['new.json', 4]]);
    expect((await store.listDecks()).map((deck) => deck.questionCount)).toEqual([4]);
  });

  it("skips files it can't read or that aren't decks, and counts every problem", async () => {
    const store = freshStore();
    const report = await importDeckFiles(
      [
        file('notes.txt', 'hello'),
        { name: 'huge.json', size: 21 * 1024 * 1024, text: async () => '' },
        file('bad.json', JSON.stringify({ name: '', questions: [{ type: 'flashcard', prompt: '', answer: '' }] })),
        file('good.json', deckText('deck-good', 'Good', 2)),
      ],
      { store, onConflict: noConflictExpected },
    );

    expect(summarizeImport(report)).toBe(
      'Imported 1 deck. Skipped 3: bad.json (Deck name is required, and 2 more problems); ' +
        'huge.json (The file is over 20 MB, too large to import); ' +
        "notes.txt (This file isn't valid JSON, so it can't be imported).",
    );
    const bad = report.skipped[0];
    expect(bad.kind === 'invalid' && bad.problems).toEqual([
      'Deck name is required.',
      'Question 1: Prompt is required.',
      'Question 1: Answer is required.',
    ]);
  });

  it('imports every deck in an export-all file and asks only about decks already there', async () => {
    const store = freshStore();
    await importDeckFiles([file('a.json', deckText('deck-a', 'Alpha', 2))], { store, onConflict: noConflictExpected });

    const asked: DeckConflict[] = [];
    const backup = serializeDeckFile(
      createDecksFile([deckWith('deck-a', 'Alpha', 5), deckWith('deck-b', 'Beta', 1), deckWith('deck-c', 'Gamma', 4)]),
    );
    const report = await importDeckFiles([file('all.json', backup)], {
      store,
      onConflict: async (conflict) => {
        asked.push(conflict);
        return 'keep-both';
      },
    });

    expect(asked.map((c) => [c.source, c.position, c.total])).toEqual([['all.json, "Alpha"', 1, 3]]);
    expect(summarizeImport(report)).toBe('Imported 3 decks.');
    expect((await store.listDecks()).map((deck) => [deck.name, deck.questionCount])).toEqual([
      ['Alpha', 2],
      ['Alpha (imported)', 5],
      ['Beta', 1],
      ['Gamma', 4],
    ]);
  });

  it('keeps going when saving one deck fails', async () => {
    const real = freshStore();
    const store: Pick<DataStore, 'getDeck' | 'importDeck'> = {
      getDeck: (id) => real.getDeck(id),
      importDeck: async (deck, options) => {
        if (deck.name === 'Beta') throw new Error('The disk is full.');
        return real.importDeck(deck, options);
      },
    };
    const report = await importDeckFiles(
      [
        file('a.json', deckText('deck-a', 'Alpha')),
        file('b.json', deckText('deck-b', 'Beta')),
        file('c.json', deckText('deck-c', 'Gamma')),
      ],
      { store, onConflict: noConflictExpected },
    );
    expect(summarizeImport(report)).toBe('Imported 2 decks. Skipped 1: b.json (The disk is full).');
  });

  it('says when nothing was imported', async () => {
    const store = freshStore();
    const report = await importDeckFiles([file('x.json', '[]'), file('y.json', '{}')], {
      store,
      onConflict: noConflictExpected,
    });
    expect(summarizeImport(report)).toBe(
      "No decks were imported. Skipped 2: x.json (This doesn't look like an Enyalië deck file); " +
        'y.json (This doesn\'t look like an Enyalië deck file. It needs a "questions" list).',
    );
  });
});
