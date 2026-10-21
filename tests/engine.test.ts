import { describe, expect, it } from 'vitest';
import { seededRandom } from '../src/lib/random';
import {
  DEFAULT_SETTINGS,
  QUICK_PLAY_SETTINGS,
  advance,
  answerCurrent,
  buildQuizItems,
  createSession,
  currentItem,
  deadline,
  filterQuestions,
  isCorrect,
  isFinished,
  mistakesSession,
  pointsFor,
  replaySession,
  revealCurrent,
  summarize,
  type QuizResponse,
  type QuizSession,
  type QuizSettings,
} from '../src/quiz/engine';
import { sampleQuestions } from './helpers';

const noShuffle: QuizSettings = { ...DEFAULT_SETTINGS, count: 'all', shuffleQuestions: false, shuffleChoices: false };

function newSession(settings: QuizSettings = noShuffle): QuizSession {
  return createSession({
    title: 'test',
    source: { kind: 'deck', deckId: 'deck-1' },
    settings,
    items: buildQuizItems(sampleQuestions(), settings, seededRandom(1)),
    now: 0,
  });
}

/** The right (or a wrong) response for whatever question is showing. */
function respond(session: QuizSession, correct: boolean): QuizResponse {
  const { question } = currentItem(session);
  switch (question.type) {
    case 'multiple_choice':
      return { type: 'multiple_choice', choice: correct ? question.correctIndex : (question.correctIndex + 1) % 2 };
    case 'true_false':
      return { type: 'true_false', answer: correct ? question.answer : !question.answer };
    case 'flashcard':
      return { type: 'flashcard', recalled: correct };
  }
}

/** Answers every question in order: true = right, false = wrong. */
function play(session: QuizSession, pattern: boolean[]): QuizSession {
  let s = session;
  for (const correct of pattern) s = advance(answerCurrent(s, respond(s, correct), 99), 99);
  return s;
}

describe('choosing questions', () => {
  it('includes expert questions by default and honors an expert-only filter', () => {
    const questions = sampleQuestions();
    const expert = { ...questions[0], id: 'expert-question', difficulty: 'expert' as const };
    const all = [...questions, expert];
    expect(buildQuizItems(all, { ...DEFAULT_SETTINGS, count: 'all' })).toHaveLength(7);
    expect(buildQuizItems(all, { ...DEFAULT_SETTINGS, difficulties: ['expert'] }).map((item) => item.question.id))
      .toEqual(['expert-question']);
    expect(buildQuizItems(all, { ...DEFAULT_SETTINGS, difficulties: ['easy'] })
      .every((item) => item.question.difficulty === 'easy')).toBe(true);
  });

  it('filters by type and difficulty, with "unrated" for questions without one', () => {
    const questions = sampleQuestions();
    expect(
      filterQuestions(questions, { types: ['flashcard'], difficulties: ['easy', 'medium', 'hard', 'unrated'] }),
    ).toHaveLength(2);
    expect(
      filterQuestions(questions, { types: ['multiple_choice', 'true_false', 'flashcard'], difficulties: ['unrated'] }),
    ).toHaveLength(2);
    expect(filterQuestions(questions, { types: ['true_false'], difficulties: ['easy'] })).toHaveLength(1);
    expect(filterQuestions(questions, { types: [], difficulties: ['easy'] })).toHaveLength(0);
  });

  it('limits the quiz to the chosen count', () => {
    const questions = sampleQuestions();
    expect(buildQuizItems(questions, { ...DEFAULT_SETTINGS, count: 5 })).toHaveLength(5);
    expect(buildQuizItems(questions, { ...DEFAULT_SETTINGS, count: 20 })).toHaveLength(6);
    expect(buildQuizItems(questions, { ...DEFAULT_SETTINGS, count: 'all' })).toHaveLength(6);
  });

  it('keeps deck order and choice order when shuffling is off', () => {
    const questions = sampleQuestions();
    const items = buildQuizItems(questions, noShuffle);
    expect(items.map((item) => item.question.id)).toEqual(questions.map((q) => q.id));
    expect(items[0].choiceOrder).toEqual([0, 1, 2]);
    expect(items[1].choiceOrder).toEqual([]);
  });

  it('shuffles questions and choices deterministically for a given random source', () => {
    const questions = sampleQuestions();
    const settings: QuizSettings = { ...DEFAULT_SETTINGS, count: 'all' };
    const first = buildQuizItems(questions, settings, seededRandom(42));
    const second = buildQuizItems(questions, settings, seededRandom(42));
    expect(first.map((i) => i.question.id)).toEqual(second.map((i) => i.question.id));
    expect([...first.map((i) => i.question.id)].sort()).toEqual([...questions.map((q) => q.id)].sort());
    for (const item of first) {
      if (item.question.type === 'multiple_choice') {
        expect([...item.choiceOrder].sort()).toEqual(item.question.choices.map((_, i) => i));
      }
    }
  });

  it('quick play takes up to 10 questions of any type and difficulty', () => {
    const twelve = [...sampleQuestions(), ...sampleQuestions()];
    expect(buildQuizItems(twelve, QUICK_PLAY_SETTINGS, seededRandom(3))).toHaveLength(10);
    expect(buildQuizItems(sampleQuestions(), QUICK_PLAY_SETTINGS, seededRandom(3))).toHaveLength(6);
  });

  it('refuses to create an empty quiz', () => {
    expect(() =>
      createSession({ title: 'x', source: { kind: 'quick' }, settings: DEFAULT_SETTINGS, items: [] }),
    ).toThrow('at least one question');
  });
});

describe('answering and scoring', () => {
  it('checks answers by question type', () => {
    const [mc, tf, fc] = sampleQuestions();
    expect(isCorrect(mc, { type: 'multiple_choice', choice: 1 })).toBe(true);
    expect(isCorrect(mc, { type: 'multiple_choice', choice: 0 })).toBe(false);
    expect(isCorrect(tf, { type: 'true_false', answer: true })).toBe(true);
    expect(isCorrect(fc, { type: 'flashcard', recalled: false })).toBe(false);
    expect(isCorrect(mc, { type: 'true_false', answer: true })).toBe(false);
  });

  it('gives 100 points per correct answer plus a capped streak bonus', () => {
    expect(pointsFor(false, 0)).toBe(0);
    expect(pointsFor(true, 1)).toBe(100);
    expect(pointsFor(true, 2)).toBe(110);
    expect(pointsFor(true, 6)).toBe(150);
    expect(pointsFor(true, 20)).toBe(150);
  });

  it('tracks score, streak and best streak', () => {
    const s = play(newSession(), [true, true, true, false, true, true]);
    // 100 + 110 + 120, miss, 100 + 110
    expect(s.score).toBe(540);
    expect(s.bestStreak).toBe(3);
    expect(s.streak).toBe(2);
    expect(isFinished(s)).toBe(true);
    expect(s.finishedAt).toBe(99);
  });

  it('ignores a second answer to the same question', () => {
    const s1 = answerCurrent(newSession(), { type: 'multiple_choice', choice: 1 });
    const s2 = answerCurrent(s1, { type: 'multiple_choice', choice: 0 });
    expect(s2).toBe(s1);
    expect(s2.answers[0]?.correct).toBe(true);
  });

  it("won't skip a question that hasn't been answered", () => {
    const s = newSession();
    expect(advance(s)).toBe(s);
  });
});

describe('results', () => {
  it('summarises accuracy and lists mistakes', () => {
    const summary = summarize(play(newSession(), [true, false, true, false, true, true]));
    expect(summary.total).toBe(6);
    expect(summary.correct).toBe(4);
    expect(summary.incorrect).toBe(2);
    expect(summary.accuracy).toBe(67);
    expect(summary.mistakes.map((m) => m.item.question.prompt)).toEqual([
      'PRIMARY KEY creates a unique index.',
      'Index for JSONB containment?',
    ]);
  });

  it('retries the same questions and choices in order even when shuffling is enabled', () => {
    const done = play(newSession({ ...DEFAULT_SETTINGS, count: 'all' }), [true, false, true, false, true, true]);
    const replay = replaySession(done, 7);
    expect(replay.items).toEqual(done.items);
    expect(replay.settings).toEqual(done.settings);
    expect(replay.source).toEqual(done.source);
    expect(replay.answers.every((a) => a === null)).toBe(true);
    expect(replay.current).toBe(0);
    expect(replay.score).toBe(0);
    expect(replay.streak).toBe(0);
    expect(replay.bestStreak).toBe(0);
    expect(replay.startedAt).toBe(7);
    expect(replay.questionStartedAt).toBe(7);
    expect(replay.revealedAt).toBeNull();
    expect(replay.finishedAt).toBeNull();
    expect(replay.id).not.toBe(done.id);
  });

  it('keeps the source and mistake-round label when retrying a mistake round', () => {
    const done = play(newSession(), [true, false, true, false, true, true]);
    const mistakes = mistakesSession(done, seededRandom(5), 7)!;
    const replay = replaySession(play(mistakes, [true, true]), 100);
    expect(replay.items).toEqual(mistakes.items);
    expect(replay.retry).toBe(true);
    expect(replay.source).toEqual(done.source);
    expect(replay.title).toBe(done.title);
    expect(replay.deckNames).toEqual(done.deckNames);
  });

  it('retries only the questions that were missed', () => {
    const done = play(newSession(), [true, false, true, false, true, true]);
    const retry = mistakesSession(done, seededRandom(5), 7);
    expect(retry?.items).toHaveLength(2);
    expect(retry?.retry).toBe(true);
    expect(mistakesSession(play(newSession(), [true, true, true, true, true, true]))).toBeNull();
  });
});

describe('timed mode', () => {
  const timed: QuizSettings = { ...noShuffle, timer: 20 };
  // Sample order with shuffling off: MC, TF, flashcard, MC, TF, flashcard.

  it('is off by default and for quick play', () => {
    expect(DEFAULT_SETTINGS.timer).toBe('off');
    expect(QUICK_PLAY_SETTINGS.timer).toBe('off');
    expect(deadline(newSession())).toBeNull();
  });

  it('adds a speed bonus of up to 50 in proportion to the time left', () => {
    const session = newSession(timed);
    expect(deadline(session)).toBe(20_000);
    expect(answerCurrent(session, respond(session, true), 0).score).toBe(150);
    expect(answerCurrent(session, respond(session, true), 10_000).score).toBe(125);
    expect(answerCurrent(session, respond(session, false), 0).score).toBe(0);
  });

  it('counts an answer after the deadline as out of time', () => {
    let session = advance(answerCurrent(newSession(timed), { type: 'multiple_choice', choice: 1 }, 1_000), 1_000);
    expect(session.streak).toBe(1);
    session = answerCurrent(session, respond(session, true), 21_000);
    expect(session.answers[1]).toEqual({ response: { type: 'timeout' }, correct: false, points: 0 });
    expect(session.streak).toBe(0);
  });

  it('ignores a timeout before the deadline, and on untimed quizzes', () => {
    const session = newSession(timed);
    expect(answerCurrent(session, { type: 'timeout' }, 19_999)).toBe(session);
    const untimed = newSession();
    expect(answerCurrent(untimed, { type: 'timeout' }, 999_999)).toBe(untimed);
    expect(answerCurrent(untimed, respond(untimed, true), 999_999).score).toBe(100);
  });

  it('restarts the clock on each question', () => {
    const session = advance(answerCurrent(newSession(timed), respond(newSession(timed), true), 5_000), 7_000);
    expect(deadline(session)).toBe(27_000);
  });

  it('stops a flashcard clock at the reveal', () => {
    let session = newSession(timed);
    for (let i = 0; i < 2; i++) session = advance(answerCurrent(session, respond(session, true), 0), 0);
    expect(currentItem(session).question.type).toBe('flashcard');
    session = revealCurrent(session, 15_000);
    expect(session.revealedAt).toBe(15_000);
    // Rating long after the deadline still counts.
    session = answerCurrent(session, { type: 'flashcard', recalled: true }, 60_000);
    expect(session.answers[2]?.points).toBe(100 + 20);
  });

  it('gives flashcards no speed bonus, however fast they are revealed', () => {
    let session = newSession(timed);
    for (let i = 0; i < 2; i++) session = advance(answerCurrent(session, respond(session, true), 0), 0);
    session = answerCurrent(revealCurrent(session, 0), { type: 'flashcard', recalled: true }, 0);
    expect(session.answers[2]?.points).toBe(100 + 20);
  });

  it('counts a flashcard revealed too late as out of time', () => {
    let session = newSession(timed);
    for (let i = 0; i < 2; i++) session = advance(answerCurrent(session, respond(session, true), 0), 0);
    session = revealCurrent(session, 20_000);
    expect(session.revealedAt).toBeNull();
    expect(session.answers[2]?.response).toEqual({ type: 'timeout' });
  });

  it('keeps the timer for replays and mistake rounds', () => {
    const done = play(newSession(timed), [true, false, true, true, true, true]);
    expect(deadline(replaySession(done, 500))).toBe(20_500);
    expect(mistakesSession(done, seededRandom(2), 500)?.settings.timer).toBe(20);
  });
});
