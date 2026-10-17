import type { Deck, DeckInput, DeckSummary, ImportedDeck, Question, QuestionContent } from '../models/types';

/**
 * Everything the app needs from storage.
 *
 * The UI only talks to this interface. Today it is backed by IndexedDB in the
 * browser (indexedDbStore.ts); adding a server later means writing a second
 * implementation that calls an API, without touching the views.
 *
 * Methods that save data validate it and throw a ValidationError when it is
 * invalid, or a NotFoundError when the deck or question no longer exists.
 */
export interface DataStore {
  /** All decks with their question counts, sorted by name. */
  listDecks(): Promise<DeckSummary[]>;
  getDeck(id: string): Promise<Deck | undefined>;
  createDeck(input: DeckInput): Promise<Deck>;
  /** Renames a deck or changes its description. */
  updateDeck(id: string, input: DeckInput): Promise<Deck>;
  /** Copies a deck and all its questions under a new name ("… (copy)"). */
  duplicateDeck(id: string): Promise<Deck>;
  /** Deletes a deck together with its questions. */
  deleteDeck(id: string): Promise<void>;

  /** A deck's questions in the order they were added. */
  listQuestions(deckId: string): Promise<Question[]>;
  /** Every question in every deck (used by Quick Play). */
  listAllQuestions(): Promise<Question[]>;
  getQuestion(id: string): Promise<Question | undefined>;
  addQuestion(deckId: string, content: QuestionContent): Promise<Question>;
  updateQuestion(id: string, content: QuestionContent): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;

  /**
   * Saves a deck read from a file, with all its questions, in one step.
   * With `asNewDeck: false` the deck keeps the id from the file, replacing any
   * existing deck with that id. With `asNewDeck: true` it gets a fresh id.
   */
  importDeck(deck: ImportedDeck, options: { asNewDeck: boolean }): Promise<Deck>;
}
