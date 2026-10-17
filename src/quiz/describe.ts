/** Turning questions and answers into text for the quiz and results screens. */
import type { Question } from '../models/types';
import type { QuizResponse } from './engine';

function trueFalseLabel(value: boolean): string {
  return value ? 'True' : 'False';
}

export function correctAnswerText(question: Question): string {
  switch (question.type) {
    case 'multiple_choice':
      return question.choices[question.correctIndex] ?? '';
    case 'true_false':
      return trueFalseLabel(question.answer);
    case 'flashcard':
      return question.answer;
  }
}

export function responseText(question: Question, response: QuizResponse): string {
  switch (response.type) {
    case 'multiple_choice':
      return question.type === 'multiple_choice' ? (question.choices[response.choice] ?? '—') : '—';
    case 'true_false':
      return trueFalseLabel(response.answer);
    case 'flashcard':
      return response.recalled ? 'Recalled it' : "Didn't recall it";
    case 'timeout':
      return 'Out of time';
  }
}

/** A one-line verdict for the results screen. */
export function verdict(accuracy: number): string {
  if (accuracy === 100) return 'flawless run.';
  if (accuracy >= 80) return 'solid. nearly there.';
  if (accuracy >= 50) return 'getting there. the misses are listed below.';
  return 'tough round. the mistakes list below is your study guide.';
}
