/**
 * Core data model.
 *
 * A Deck groups Questions. Questions are stored separately from their deck
 * (linked by `deckId`) so the shape maps directly onto two database tables
 * if a server is added later.
 */

export const QUESTION_TYPES = ['multiple_choice', 'true_false', 'flashcard'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 4;

interface QuestionBase {
  /** The question, the statement (true/false) or the front of the card. */
  prompt: string;
  /** Optional note shown after answering. */
  explanation?: string;
  difficulty?: Difficulty;
  /** Lower-case labels such as "indexes" or "query-planning". */
  tags: string[];
}

export interface MultipleChoiceContent extends QuestionBase {
  type: 'multiple_choice';
  /** Between MIN_CHOICES and MAX_CHOICES options. */
  choices: string[];
  /** Position in `choices` of the correct option. */
  correctIndex: number;
}

export interface TrueFalseContent extends QuestionBase {
  type: 'true_false';
  answer: boolean;
}

export interface FlashcardContent extends QuestionBase {
  type: 'flashcard';
  /** Back of the card, revealed on demand. */
  answer: string;
}

/** Everything a person edits about a question. Deck files contain exactly this. */
export type QuestionContent = MultipleChoiceContent | TrueFalseContent | FlashcardContent;

/** Bookkeeping fields added when something is saved. Times are epoch milliseconds. */
export interface RecordMeta {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export type Question = QuestionContent & RecordMeta & { deckId: string };

export interface DeckInput {
  name: string;
  description: string;
}

export interface Deck extends DeckInput, RecordMeta {}

export interface DeckSummary extends Deck {
  questionCount: number;
}

/** A deck read from a file, ready to be saved. */
export interface ImportedDeck extends DeckInput {
  /** Kept from the file so importing a newer export can replace the older copy. */
  id?: string;
  questions: QuestionContent[];
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'multiple choice',
  true_false: 'true / false',
  flashcard: 'flashcard',
};

/** Two-letter badges used in lists. */
export const QUESTION_TYPE_BADGES: Record<QuestionType, string> = {
  multiple_choice: 'MC',
  true_false: 'TF',
  flashcard: 'FC',
};

/**
 * Returns just the editable content of a question (dropping id, deckId and
 * timestamps), with keys in a stable, readable order. Used for export and
 * when copying questions.
 */
export function toContent(question: QuestionContent): QuestionContent {
  const extras = {
    ...(question.explanation ? { explanation: question.explanation } : {}),
    ...(question.difficulty ? { difficulty: question.difficulty } : {}),
    tags: [...question.tags],
  };
  switch (question.type) {
    case 'multiple_choice':
      return {
        type: 'multiple_choice',
        prompt: question.prompt,
        choices: [...question.choices],
        correctIndex: question.correctIndex,
        ...extras,
      };
    case 'true_false':
      return { type: 'true_false', prompt: question.prompt, answer: question.answer, ...extras };
    case 'flashcard':
      return { type: 'flashcard', prompt: question.prompt, answer: question.answer, ...extras };
  }
}

/** Sorts questions in the order they were added. */
export function sortByCreation<T extends RecordMeta>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}
