/**
 * The deck file format used for export and import.
 *
 * Example:
 * {
 *   "format": "rekall-deck",
 *   "version": 1,
 *   "exportedAt": "2026-10-16T09:30:00.000Z",
 *   "deck": { "id": "…", "name": "PostgreSQL Fundamentals", "description": "" },
 *   "questions": [
 *     { "type": "multiple_choice", "prompt": "…", "choices": ["…", "…"], "correctIndex": 1 },
 *     { "type": "true_false", "prompt": "…", "answer": true },
 *     { "type": "flashcard", "prompt": "…", "answer": "…", "tags": ["mvcc"] }
 *   ]
 * }
 *
 * Import is deliberately forgiving so decks can be written by hand:
 * "format", "version", "exportedAt" and the deck id are optional, the deck's
 * name may sit at the top level instead of inside "deck", and a multiple
 * choice question may name its correct choice with "answer" instead of
 * "correctIndex".
 */
import { slugify } from '../lib/format';
import { toContent, type Deck, type ImportedDeck, type Question, type QuestionContent } from '../models/types';
import {
  isRecord,
  validateDeckInput,
  validateQuestionList,
  type FieldError,
  type ValidationResult,
} from '../models/validation';

const DECK_FILE_FORMAT = 'rekall-deck';
const DECK_FILE_VERSION = 1;

export interface DeckFile {
  format: typeof DECK_FILE_FORMAT;
  version: number;
  exportedAt: string;
  deck: { id: string; name: string; description: string };
  questions: QuestionContent[];
}

export function createDeckFile(deck: Deck, questions: readonly Question[], exportedAt = new Date()): DeckFile {
  return {
    format: DECK_FILE_FORMAT,
    version: DECK_FILE_VERSION,
    exportedAt: exportedAt.toISOString(),
    deck: { id: deck.id, name: deck.name, description: deck.description },
    questions: questions.map(toContent),
  };
}

export function serializeDeckFile(file: DeckFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** "PostgreSQL Fundamentals" → "postgresql-fundamentals.rekall.json" */
export function deckFileName(deckName: string): string {
  return `${slugify(deckName) || 'deck'}.rekall.json`;
}

function failure(field: string, message: string): ValidationResult<ImportedDeck> {
  return { ok: false, errors: [{ field, message }] };
}

const NOT_A_DECK = "This doesn't look like a Rekall deck file.";

/** Reads a deck file's text and checks every question in it. */
export function parseDeckFile(text: string): ValidationResult<ImportedDeck> {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, '')); // tolerate a byte-order mark
  } catch {
    return failure('file', "This file isn't valid JSON, so it can't be imported.");
  }
  if (!isRecord(data)) return failure('file', NOT_A_DECK);

  if (data.format !== undefined && data.format !== DECK_FILE_FORMAT) {
    return failure('format', `${NOT_A_DECK} (Its format is "${String(data.format)}".)`);
  }
  if (data.version !== undefined) {
    if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) {
      return failure('version', '"version" must be a whole number.');
    }
    if (data.version > DECK_FILE_VERSION) {
      return failure(
        'version',
        `This deck was exported by a newer version of Rekall (file version ${data.version}). Update Rekall to import it.`,
      );
    }
  }
  if (!Array.isArray(data.questions)) {
    return failure('questions', `${NOT_A_DECK} It needs a "questions" list.`);
  }

  // The deck's details normally live under "deck", but a hand-written file may
  // put "name" and "description" at the top level.
  const deckData = isRecord(data.deck) ? data.deck : data;
  const errors: FieldError[] = [];
  const details = validateDeckInput({ name: deckData.name, description: deckData.description });
  if (!details.ok) {
    errors.push(...details.errors.map((error) => ({ field: `deck.${error.field}`, message: error.message })));
  }

  const questions = validateQuestionList(data.questions);
  if (!questions.ok) errors.push(...questions.errors);

  if (!details.ok || !questions.ok) return { ok: false, errors };

  const id = typeof deckData.id === 'string' && /^[\w-]{1,64}$/.test(deckData.id) ? deckData.id : undefined;
  return { ok: true, value: { id, ...details.value, questions: questions.value } };
}
