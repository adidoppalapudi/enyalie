/**
 * The quiz engine: picking questions, checking answers, scoring and streaks.
 *
 * Everything here is a pure function. A QuizSession is plain data; each
 * action returns a new session instead of changing the old one, which keeps
 * the logic easy to test and the session easy to save.
 */
import { createId } from '../lib/id';
import { shuffle, type Random } from '../lib/random';
import { DIFFICULTIES, QUESTION_TYPES, type Difficulty, type Question, type QuestionType } from '../models/types';

export const QUESTION_COUNT_OPTIONS = [5, 10, 20, 'all'] as const;
export type QuestionCount = (typeof QUESTION_COUNT_OPTIONS)[number];

export const TIMER_OPTIONS = ['off', 10, 20, 30] as const;
/** Seconds per question, or "off". */
export type TimerOption = (typeof TIMER_OPTIONS)[number];

/** A difficulty to include; "unrated" matches questions with no difficulty set. */
export type DifficultyFilter = Difficulty | 'unrated';
export const DIFFICULTY_FILTERS: readonly DifficultyFilter[] = [...DIFFICULTIES, 'unrated'];

export interface QuizSettings {
  count: QuestionCount;
  types: QuestionType[];
  difficulties: DifficultyFilter[];
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  timer: TimerOption;
}

export const DEFAULT_SETTINGS: QuizSettings = {
  count: 10,
  types: [...QUESTION_TYPES],
  difficulties: [...DIFFICULTY_FILTERS],
  shuffleQuestions: true,
  shuffleChoices: true,
  timer: 'off',
};

// ---------------------------------------------------------------------------
// Scoring: 100 points per correct answer, plus a streak bonus of 10 points for
// every correct answer in a row after the first, capped at +50. A timed quiz
// adds a speed bonus of up to +50, in proportion to the time left.

const POINTS_PER_CORRECT = 100;
const STREAK_BONUS_STEP = 10;
const MAX_STREAK_BONUS = 50;
const MAX_SPEED_BONUS = 50;

/**
 * Points for one answer. `streak` counts this answer (1 = first in a row).
 * `timeLeft` is the share of the timer left, from 1 down to 0 (0 when untimed).
 */
export function pointsFor(correct: boolean, streak: number, timeLeft = 0): number {
  if (!correct) return 0;
  return (
    POINTS_PER_CORRECT +
    Math.min(Math.max(streak - 1, 0) * STREAK_BONUS_STEP, MAX_STREAK_BONUS) +
    Math.round(timeLeft * MAX_SPEED_BONUS)
  );
}

// ---------------------------------------------------------------------------
// Choosing questions

export function difficultyOf(question: Question): DifficultyFilter {
  return question.difficulty ?? 'unrated';
}

export function filterQuestions(
  questions: readonly Question[],
  filter: Pick<QuizSettings, 'types' | 'difficulties'>,
): Question[] {
  return questions.filter(
    (question) => filter.types.includes(question.type) && filter.difficulties.includes(difficultyOf(question)),
  );
}

/** How many questions a quiz will have, given how many match the filters. */
export function resolveCount(count: QuestionCount, available: number): number {
  return count === 'all' ? available : Math.min(count, available);
}

export interface QuizItem {
  question: Question;
  /** Order to show multiple choice options in, as positions in `question.choices`. */
  choiceOrder: number[];
}

function toItem(question: Question, shuffleChoices: boolean, random: Random): QuizItem {
  const positions = question.type === 'multiple_choice' ? question.choices.map((_, i) => i) : [];
  return { question, choiceOrder: shuffleChoices ? shuffle(positions, random) : positions };
}

function toItems(
  questions: readonly Question[],
  settings: QuizSettings,
  random: Random,
  count = questions.length,
): QuizItem[] {
  const ordered = settings.shuffleQuestions ? shuffle(questions, random) : questions;
  return ordered.slice(0, count).map((question) => toItem(question, settings.shuffleChoices, random));
}

/** Filters, orders and trims questions into the items of a new quiz. */
export function buildQuizItems(
  questions: readonly Question[],
  settings: QuizSettings,
  random: Random = Math.random,
): QuizItem[] {
  const matching = filterQuestions(questions, settings);
  return toItems(matching, settings, random, resolveCount(settings.count, matching.length));
}

/** Quick play: 10 random questions from every deck. */
export const QUICK_PLAY_SETTINGS: QuizSettings = { ...DEFAULT_SETTINGS, count: 10 };

// ---------------------------------------------------------------------------
// Answering

export type QuizResponse =
  /** `choice` is a position in `question.choices` (not the shuffled display position). */
  | { type: 'multiple_choice'; choice: number }
  | { type: 'true_false'; answer: boolean }
  | { type: 'flashcard'; recalled: boolean }
  /** The timer ran out. Ignored if sent before the deadline. */
  | { type: 'timeout' };

export function isCorrect(question: Question, response: QuizResponse): boolean {
  switch (question.type) {
    case 'multiple_choice':
      return response.type === 'multiple_choice' && response.choice === question.correctIndex;
    case 'true_false':
      return response.type === 'true_false' && response.answer === question.answer;
    case 'flashcard':
      return response.type === 'flashcard' && response.recalled;
  }
}

export interface AnswerRecord {
  response: QuizResponse;
  correct: boolean;
  points: number;
}

/** Where a quiz came from, so "back" and "replay" know where to go. */
export type QuizSource = { kind: 'deck'; deckId: string } | { kind: 'quick' };

export interface QuizSession {
  id: string;
  title: string;
  source: QuizSource;
  settings: QuizSettings;
  /** Deck names by id, so a mixed quiz can show where each question came from. */
  deckNames: Record<string, string>;
  items: QuizItem[];
  /** One entry per item, null until that item is answered. */
  answers: (AnswerRecord | null)[];
  /** Index of the item being shown. */
  current: number;
  score: number;
  streak: number;
  bestStreak: number;
  startedAt: number;
  /** When the current question was shown. A timed question's clock runs from here. */
  questionStartedAt: number;
  /** When the current flashcard was revealed, which stops its clock. */
  revealedAt: number | null;
  finishedAt: number | null;
  /** True for a "retry mistakes" round. */
  retry: boolean;
}

export interface NewSession {
  title: string;
  source: QuizSource;
  settings: QuizSettings;
  items: QuizItem[];
  deckNames?: Record<string, string>;
  retry?: boolean;
  now?: number;
}

export function createSession(params: NewSession): QuizSession {
  if (params.items.length === 0) throw new Error('A quiz needs at least one question.');
  const now = params.now ?? Date.now();
  return {
    id: createId(),
    title: params.title,
    source: params.source,
    settings: params.settings,
    deckNames: params.deckNames ?? {},
    items: params.items,
    answers: params.items.map(() => null),
    current: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    startedAt: now,
    questionStartedAt: now,
    revealedAt: null,
    finishedAt: null,
    retry: params.retry ?? false,
  };
}

export function isFinished(session: QuizSession): boolean {
  return session.finishedAt !== null;
}

export function currentItem(session: QuizSession): QuizItem {
  return session.items[session.current];
}

export function currentAnswer(session: QuizSession): AnswerRecord | null {
  return session.answers[session.current] ?? null;
}

export function isLastItem(session: QuizSession): boolean {
  return session.current >= session.items.length - 1;
}

// The timer. A timed question's clock starts when the question is shown and
// can't be paused. It stops at the answer, or when a flashcard is revealed.
// The engine checks every action against the deadline, so a late click or a
// reload can't beat the clock.

/** When the current question runs out of time, or null for an untimed quiz. */
export function deadline(session: QuizSession): number | null {
  const { timer } = session.settings;
  return typeof timer === 'number' ? session.questionStartedAt + timer * 1000 : null;
}

/** Share of the timer left at `time`, from 1 down to 0, or null when untimed. */
function timeLeft(session: QuizSession, time: number): number | null {
  const end = deadline(session);
  if (end === null) return null;
  const limit = (session.settings.timer as number) * 1000;
  return Math.max(0, Math.min(1, (end - time) / limit));
}

/**
 * Records an answer to the current question and updates score and streaks.
 * Answering twice (a double tap, say) is ignored. On a timed quiz, an answer
 * after the deadline counts as out of time.
 */
export function answerCurrent(session: QuizSession, response: QuizResponse, now = Date.now()): QuizSession {
  if (isFinished(session) || currentAnswer(session)) return session;
  const left = timeLeft(session, session.revealedAt ?? now);
  if (response.type === 'timeout' && left !== 0) return session;
  const recorded: QuizResponse = left === 0 ? { type: 'timeout' } : response;
  const correct = isCorrect(currentItem(session).question, recorded);
  const streak = correct ? session.streak + 1 : 0;
  const points = pointsFor(correct, streak, left ?? 0);
  const answers = session.answers.slice();
  answers[session.current] = { response: recorded, correct, points };
  return {
    ...session,
    answers,
    streak,
    bestStreak: Math.max(session.bestStreak, streak),
    score: session.score + points,
  };
}

/** Turns over the current flashcard, which stops its clock. Revealing too late counts as out of time. */
export function revealCurrent(session: QuizSession, now = Date.now()): QuizSession {
  if (isFinished(session) || currentAnswer(session) || session.revealedAt != null) return session;
  if (currentItem(session).question.type !== 'flashcard') return session;
  if (timeLeft(session, now) === 0) return answerCurrent(session, { type: 'timeout' }, now);
  return { ...session, revealedAt: now };
}

/** Moves to the next question, or finishes the quiz after the last one. Unanswered questions can't be skipped. */
export function advance(session: QuizSession, now = Date.now()): QuizSession {
  if (isFinished(session) || !currentAnswer(session)) return session;
  if (isLastItem(session)) return { ...session, finishedAt: now };
  return { ...session, current: session.current + 1, questionStartedAt: now, revealedAt: null };
}

// ---------------------------------------------------------------------------
// Results

export interface Mistake {
  item: QuizItem;
  answer: AnswerRecord;
}

export interface QuizSummary {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  /** Percentage of answered questions that were correct, rounded (0–100). */
  accuracy: number;
  score: number;
  bestStreak: number;
  mistakes: Mistake[];
}

export function summarize(session: QuizSession): QuizSummary {
  const mistakes: Mistake[] = [];
  let answered = 0;
  let correct = 0;
  session.answers.forEach((answer, i) => {
    if (!answer) return;
    answered++;
    if (answer.correct) correct++;
    else mistakes.push({ item: session.items[i], answer });
  });
  return {
    total: session.items.length,
    answered,
    correct,
    incorrect: answered - correct,
    accuracy: answered === 0 ? 0 : Math.round((correct / answered) * 100),
    score: session.score,
    bestStreak: session.bestStreak,
    mistakes,
  };
}

/** Same questions and choice order again, with a fresh score and clock. */
export function replaySession(session: QuizSession, now = Date.now()): QuizSession {
  return createSession({
    title: session.title,
    source: session.source,
    settings: session.settings,
    deckNames: session.deckNames,
    retry: session.retry,
    items: session.items,
    now,
  });
}

/** A new round with only the questions answered wrongly, or null if there were none. */
export function mistakesSession(
  session: QuizSession,
  random: Random = Math.random,
  now = Date.now(),
): QuizSession | null {
  const questions = summarize(session).mistakes.map((mistake) => mistake.item.question);
  if (questions.length === 0) return null;
  return createSession({
    title: session.title,
    source: session.source,
    settings: session.settings,
    deckNames: session.deckNames,
    retry: true,
    items: toItems(questions, session.settings, random),
    now,
  });
}
