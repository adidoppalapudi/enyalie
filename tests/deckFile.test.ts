import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { createDeckFile, deckFileName, parseDeckFile, serializeDeckFile } from '../src/io/deckFile';
import type { Deck } from '../src/models/types';
import { sampleQuestions } from './helpers';

const deck: Deck = {
  id: 'deck-1',
  name: 'PostgreSQL Fundamentals',
  description: 'Indexes, MVCC and friends',
  createdAt: 1,
  updatedAt: 2,
};

function errorsOf(text: string): string[] {
  const result = parseDeckFile(text);
  return result.ok ? [] : result.errors.map((error) => error.message);
}

describe('deck files', () => {
  it('round-trips a deck through export and import', () => {
    const questions = sampleQuestions();
    const text = serializeDeckFile(createDeckFile(deck, questions, new Date('2026-10-16T12:00:00Z')));
    const parsed = parseDeckFile(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.id).toBe('deck-1');
    expect(parsed.value.name).toBe('PostgreSQL Fundamentals');
    expect(parsed.value.description).toBe('Indexes, MVCC and friends');
    expect(parsed.value.questions).toEqual(
      questions.map(({ id: _id, deckId: _deckId, createdAt: _created, updatedAt: _updated, ...content }) => content),
    );
  });

  it('writes only question content, not internal ids', () => {
    const file = createDeckFile(deck, sampleQuestions());
    expect(file.format).toBe('enyalie-deck');
    expect(file.version).toBe(1);
    expect(Object.keys(file.questions[0])).toEqual(['type', 'prompt', 'choices', 'correctIndex', 'difficulty', 'tags']);
  });

  it('names files after the deck', () => {
    expect(deckFileName('PostgreSQL Fundamentals')).toBe('postgresql-fundamentals.enyalie.json');
    expect(deckFileName('Café & Crème brûlée!')).toBe('cafe-creme-brulee.enyalie.json');
    expect(deckFileName('???')).toBe('deck.enyalie.json');
  });

  it('imports legacy Rekall deck files', () => {
    const legacyFile = JSON.parse(serializeDeckFile(createDeckFile(deck, sampleQuestions()))) as Record<string, unknown>;
    legacyFile.format = 'rekall-deck';
    expect(parseDeckFile(JSON.stringify(legacyFile)).ok).toBe(true);
  });

  it('accepts minimal hand-written files', () => {
    const parsed = parseDeckFile(
      String.fromCharCode(0xfeff) + // a byte-order mark, as some editors add
        JSON.stringify({
          name: 'History',
          questions: [
            { type: 'flashcard', prompt: 'Year of the Battle of Hastings?', answer: 1066 },
            {
              type: 'multiple_choice',
              prompt: 'First emperor of Rome?',
              choices: ['Augustus', 'Nero'],
              answer: 'Augustus',
            },
          ],
        }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.id).toBeUndefined();
    expect(parsed.value.description).toBe('');
    expect(parsed.value.questions).toHaveLength(2);
  });

  it('drops deck ids that are not safe to reuse', () => {
    const parsed = parseDeckFile(JSON.stringify({ deck: { id: '../../etc', name: 'X' }, questions: [] }));
    expect(parsed.ok && parsed.value.id).toBeUndefined();
  });

  it('explains what is wrong with a bad file', () => {
    expect(errorsOf('{ not json')[0]).toMatch(/isn't valid JSON/);
    expect(errorsOf('[1, 2]')[0]).toMatch(/doesn't look like an Enyalië deck/);
    expect(errorsOf(JSON.stringify({ format: 'anki', name: 'x', questions: [] }))[0]).toMatch(/format is "anki"/);
    expect(errorsOf(JSON.stringify({ version: 9, name: 'x', questions: [] }))[0]).toMatch(/newer version of Enyalië/);
    expect(errorsOf(JSON.stringify({ name: 'x' }))[0]).toMatch(/"questions" list/);
    expect(errorsOf(JSON.stringify({ questions: [] }))).toEqual(['Deck name is required.']);
  });

  it('reports every broken question with its number', () => {
    const messages = errorsOf(
      JSON.stringify({
        name: 'x',
        questions: [
          { type: 'true_false', prompt: 'fine', answer: true },
          { type: 'true_false', prompt: '', answer: true },
          { type: 'multiple_choice', prompt: 'p', choices: ['only one'], correctIndex: 0 },
        ],
      }),
    );
    expect(messages).toEqual([
      'Question 2: Prompt is required.',
      'Question 3: Multiple choice questions need 2 to 4 choices (this one has 1).',
    ]);
  });
});

describe('starter decks', () => {
  const folder = new URL('../src/starter-decks/', import.meta.url);
  const files = readdirSync(folder).filter((name) => name.endsWith('.enyalie.json'));

  it('are all valid deck files with their own ids', () => {
    expect(files.length).toBeGreaterThan(0);
    const ids = files.map((name) => {
      const result = parseDeckFile(readFileSync(new URL(name, folder), 'utf8'));
      expect(result.ok, name).toBe(true);
      return result.ok ? result.value.id : undefined;
    });
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
