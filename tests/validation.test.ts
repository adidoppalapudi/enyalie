import { describe, expect, it } from 'vitest';
import { normalizeTag, parseTagInput, validateDeckInput, validateQuestionContent } from '../src/models/validation';

function fields(result: ReturnType<typeof validateQuestionContent>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.field);
}

describe('validateDeckInput', () => {
  it('trims the name and defaults the description', () => {
    expect(validateDeckInput({ name: '  PostgreSQL  ' })).toEqual({
      ok: true,
      value: { name: 'PostgreSQL', description: '' },
    });
  });

  it('requires a name', () => {
    const result = validateDeckInput({ name: '   ', description: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].field).toBe('name');
  });

  it('rejects names that are too long', () => {
    expect(validateDeckInput({ name: 'x'.repeat(81) }).ok).toBe(false);
  });
});

describe('validateQuestionContent', () => {
  it('accepts expert difficulty in imported or edited questions', () => {
    const result = validateQuestionContent({
      type: 'flashcard', prompt: 'What is a hapax legomenon?', answer: 'A single occurrence.', difficulty: 'Expert',
    });
    expect(result.ok && result.value.difficulty).toBe('expert');
  });

  it('accepts and cleans up a multiple choice question', () => {
    const result = validateQuestionContent({
      type: 'multiple_choice',
      prompt: '  Default index type? ',
      choices: [' Hash ', 'B-tree'],
      correctIndex: 1,
      explanation: '   ',
      difficulty: ' Easy ',
      tags: ['#Indexes', 'Query Planning', 'indexes'],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        type: 'multiple_choice',
        prompt: 'Default index type?',
        choices: ['Hash', 'B-tree'],
        correctIndex: 1,
        difficulty: 'easy',
        tags: ['indexes', 'query-planning'],
      },
    });
  });

  it('needs 2 to 4 choices', () => {
    expect(
      fields(validateQuestionContent({ type: 'multiple_choice', prompt: 'q', choices: ['a'], correctIndex: 0 })),
    ).toContain('choices');
    const five = ['a', 'b', 'c', 'd', 'e'];
    expect(
      fields(validateQuestionContent({ type: 'multiple_choice', prompt: 'q', choices: five, correctIndex: 0 })),
    ).toContain('choices');
  });

  it('points at empty and duplicate choices', () => {
    const result = validateQuestionContent({
      type: 'multiple_choice',
      prompt: 'q',
      choices: ['Same', '', 'same'],
      correctIndex: 0,
    });
    expect(fields(result)).toEqual(['choices.1', 'choices.2']);
  });

  it('needs a valid correct answer', () => {
    const base = { type: 'multiple_choice', prompt: 'q', choices: ['a', 'b'] };
    expect(fields(validateQuestionContent({ ...base, correctIndex: 2 }))).toEqual(['correctIndex']);
    expect(fields(validateQuestionContent({ ...base, correctIndex: 0.5 }))).toEqual(['correctIndex']);
    expect(fields(validateQuestionContent(base))).toEqual(['correctIndex']);
  });

  it('lets hand-written files name the correct choice instead of its index', () => {
    const result = validateQuestionContent({
      type: 'multiple_choice',
      prompt: 'q',
      choices: ['Hash', 'B-tree'],
      answer: 'b-tree',
    });
    expect(result.ok && result.value.type === 'multiple_choice' && result.value.correctIndex).toBe(1);
  });

  it('accepts numbers as choices', () => {
    const result = validateQuestionContent({
      type: 'multiple_choice',
      prompt: 'Default port?',
      choices: [5432, 3306],
      correctIndex: 0,
    });
    expect(result.ok && result.value.type === 'multiple_choice' && result.value.choices).toEqual(['5432', '3306']);
  });

  it('checks true/false answers', () => {
    expect(validateQuestionContent({ type: 'true_false', prompt: 's', answer: false }).ok).toBe(true);
    expect(validateQuestionContent({ type: 'true_false', prompt: 's', answer: 'TRUE' })).toEqual({
      ok: true,
      value: { type: 'true_false', prompt: 's', answer: true, tags: [] },
    });
    expect(fields(validateQuestionContent({ type: 'true_false', prompt: 's', answer: 'maybe' }))).toEqual(['answer']);
  });

  it('checks flashcards', () => {
    expect(validateQuestionContent({ type: 'flashcard', prompt: 'front', answer: 'back' }).ok).toBe(true);
    expect(fields(validateQuestionContent({ type: 'flashcard', prompt: 'front', answer: '  ' }))).toEqual(['answer']);
  });

  it('rejects unknown types, missing prompts and bad difficulties', () => {
    expect(fields(validateQuestionContent({ type: 'essay', prompt: 'x' }))).toEqual(['type']);
    expect(fields(validateQuestionContent({ type: 'flashcard', answer: 'a' }))).toEqual(['prompt']);
    expect(
      fields(validateQuestionContent({ type: 'flashcard', prompt: 'p', answer: 'a', difficulty: 'extreme' })),
    ).toEqual(['difficulty']);
    expect(fields(validateQuestionContent('not an object'))).toEqual(['question']);
  });
});

describe('tags', () => {
  it('normalises single tags', () => {
    expect(normalizeTag('  #Query Planning ')).toBe('query-planning');
  });

  it('splits typed input on commas and spaces', () => {
    expect(parseTagInput('indexes, performance  #MVCC,,')).toEqual(['indexes', 'performance', 'mvcc']);
  });
});
