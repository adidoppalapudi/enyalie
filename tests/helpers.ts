import type { Difficulty, Question, QuestionContent } from '../src/models/types';

let counter = 0;

/** Wraps question content in the fields a saved question has. */
export function saved(content: QuestionContent, deckId = 'deck-1'): Question {
  counter++;
  return { ...content, id: `q-${counter}`, deckId, createdAt: counter, updatedAt: counter };
}

export function multipleChoice(
  prompt: string,
  choices: string[],
  correctIndex: number,
  difficulty?: Difficulty,
): QuestionContent {
  return { type: 'multiple_choice', prompt, choices, correctIndex, tags: [], ...(difficulty ? { difficulty } : {}) };
}

export function trueFalse(prompt: string, answer: boolean, difficulty?: Difficulty): QuestionContent {
  return { type: 'true_false', prompt, answer, tags: [], ...(difficulty ? { difficulty } : {}) };
}

export function flashcard(prompt: string, answer: string, difficulty?: Difficulty): QuestionContent {
  return { type: 'flashcard', prompt, answer, tags: [], ...(difficulty ? { difficulty } : {}) };
}

/** A small mixed deck: 2 multiple choice, 2 true/false, 2 flashcards. */
export function sampleQuestions(): Question[] {
  return [
    saved(multipleChoice('Default index type?', ['Hash', 'B-tree', 'GIN'], 1, 'easy')),
    saved(trueFalse('PRIMARY KEY creates a unique index.', true, 'easy')),
    saved(flashcard('What does MVCC stand for?', 'Multiversion concurrency control', 'medium')),
    saved(multipleChoice('Index for JSONB containment?', ['B-tree', 'GIN', 'BRIN', 'Hash'], 1, 'hard')),
    saved(trueFalse('Every table needs a primary key.', false)),
    saved(flashcard('WHERE vs HAVING?', 'Rows vs groups')),
  ];
}
