// Runs the real IndexedDB code against fake-indexeddb, an in-memory copy of
// the browser API, so these tests work in Node.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createIndexedDbStore } from '../src/db/indexedDbStore';
import { createId } from '../src/lib/id';
import { NotFoundError, ValidationError } from '../src/lib/errors';
import { flashcard, multipleChoice, trueFalse } from './helpers';

/** A fresh, empty database for each test, with a clock that ticks once per call. */
function freshStore(name = `test-${createId()}`) {
  let time = 1000;
  return { store: createIndexedDbStore({ name, now: () => ++time }), name };
}

describe('IndexedDB store', () => {
  it('creates decks and lists them by name with question counts', async () => {
    const { store } = freshStore();
    const zoology = await store.createDeck({ name: 'zoology', description: '' });
    const aws = await store.createDeck({ name: 'AWS', description: 'cloud' });
    await store.addQuestion(aws.id, trueFalse('S3 is object storage.', true));

    const decks = await store.listDecks();
    expect(decks.map((d) => d.name)).toEqual(['AWS', 'zoology']);
    expect(decks.map((d) => d.questionCount)).toEqual([1, 0]);
    expect(await store.getDeck(zoology.id)).toEqual(zoology);
  });

  it('keeps data when the app is reopened', async () => {
    const { store, name } = freshStore();
    const deck = await store.createDeck({ name: 'PostgreSQL', description: '' });
    await store.addQuestion(deck.id, flashcard('MVCC?', 'Multiversion concurrency control'));

    const reopened = createIndexedDbStore({ name });
    expect((await reopened.listDecks())[0].questionCount).toBe(1);
    expect((await reopened.listQuestions(deck.id))[0].prompt).toBe('MVCC?');
  });

  it('adds, updates and deletes questions in order, touching the deck', async () => {
    const { store } = freshStore();
    const deck = await store.createDeck({ name: 'Deck', description: '' });
    const first = await store.addQuestion(deck.id, multipleChoice('One?', ['a', 'b'], 0));
    const second = await store.addQuestion(deck.id, trueFalse('Two.', true));
    expect((await store.listQuestions(deck.id)).map((q) => q.prompt)).toEqual(['One?', 'Two.']);
    expect((await store.getDeck(deck.id))!.updatedAt).toBe(second.updatedAt);

    // Changing the type must not leave the old type's fields behind.
    const updated = await store.updateQuestion(first.id, flashcard('One, now a card', 'back'));
    expect(updated).toEqual({
      type: 'flashcard',
      prompt: 'One, now a card',
      answer: 'back',
      tags: [],
      id: first.id,
      deckId: deck.id,
      createdAt: first.createdAt,
      updatedAt: updated.updatedAt,
    });
    expect('choices' in (await store.getQuestion(first.id))!).toBe(false);

    await store.deleteQuestion(second.id);
    expect((await store.listQuestions(deck.id)).map((q) => q.id)).toEqual([first.id]);
  });

  it('duplicates a deck with copies of its questions', async () => {
    const { store } = freshStore();
    const deck = await store.createDeck({ name: 'Original', description: 'd' });
    await store.addQuestion(deck.id, trueFalse('A.', true));
    await store.addQuestion(deck.id, trueFalse('B.', false));

    const copy = await store.duplicateDeck(deck.id);
    expect(copy.name).toBe('Original (copy)');
    expect(copy.id).not.toBe(deck.id);
    const [originals, copies] = await Promise.all([store.listQuestions(deck.id), store.listQuestions(copy.id)]);
    expect(copies.map((q) => q.prompt)).toEqual(['A.', 'B.']);
    expect(copies.every((q) => q.deckId === copy.id)).toBe(true);
    expect(copies.some((q) => originals.some((o) => o.id === q.id))).toBe(false);
  });

  it('deletes a deck together with its questions', async () => {
    const { store } = freshStore();
    const keep = await store.createDeck({ name: 'Keep', description: '' });
    const remove = await store.createDeck({ name: 'Remove', description: '' });
    await store.addQuestion(keep.id, trueFalse('k', true));
    await store.addQuestion(remove.id, trueFalse('r', true));

    await store.deleteDeck(remove.id);
    expect((await store.listDecks()).map((d) => d.name)).toEqual(['Keep']);
    expect((await store.listAllQuestions()).map((q) => q.prompt)).toEqual(['k']);
  });

  it('imports a deck, replacing an older copy with the same id', async () => {
    const { store } = freshStore();
    const imported = await store.importDeck(
      { id: 'deck-from-laptop', name: 'AWS', description: '', questions: [trueFalse('v1', true)] },
      { asNewDeck: false },
    );
    expect(imported.id).toBe('deck-from-laptop');

    await store.importDeck(
      {
        id: 'deck-from-laptop',
        name: 'AWS v2',
        description: '',
        questions: [trueFalse('a', true), trueFalse('b', false)],
      },
      { asNewDeck: false },
    );
    const decks = await store.listDecks();
    expect(decks).toHaveLength(1);
    expect(decks[0].name).toBe('AWS v2');
    expect((await store.listQuestions('deck-from-laptop')).map((q) => q.prompt)).toEqual(['a', 'b']);

    const copy = await store.importDeck(
      { id: 'deck-from-laptop', name: 'AWS v2 (imported)', description: '', questions: [] },
      { asNewDeck: true },
    );
    expect(copy.id).not.toBe('deck-from-laptop');
    expect(await store.listDecks()).toHaveLength(2);
  });

  it('rejects invalid data and missing decks', async () => {
    const { store } = freshStore();
    await expect(store.createDeck({ name: '  ', description: '' })).rejects.toBeInstanceOf(ValidationError);
    await expect(store.addQuestion('no-such-deck', trueFalse('x', true))).rejects.toBeInstanceOf(NotFoundError);

    const deck = await store.createDeck({ name: 'Deck', description: '' });
    await expect(
      store.addQuestion(deck.id, {
        type: 'multiple_choice',
        prompt: 'x',
        choices: ['only'],
        correctIndex: 0,
        tags: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    // A failed import changes nothing.
    await expect(
      store.importDeck(
        { name: 'Bad', description: '', questions: [trueFalse('ok', true), trueFalse('', true)] },
        { asNewDeck: true },
      ),
    ).rejects.toThrow('Question 2: Prompt is required.');
    expect(await store.listDecks()).toHaveLength(1);
  });
});
