/**
 * Personal bests, kept in localStorage. For each deck, and for quick play,
 * each quiz length has its own best points, accuracy and streak, so a short
 * quiz is never compared with a long one. Each record notes the quiz that set
 * it, which makes recording safe to repeat and lets results say "new best".
 * Mistakes rounds don't count. Storage can be unavailable (private mode,
 * blocked site data), so failures are ignored.
 */
import { formatScore } from '../lib/format';
import { QUESTION_COUNT_OPTIONS, summarize, type QuestionCount, type QuizSession, type QuizSource } from './engine';

const BESTS_KEY = 'enyalie.personalBests';
const RECORDS = ['points', 'accuracy', 'streak'] as const;

export type BestRecord = (typeof RECORDS)[number];

export interface PersonalBest {
  points: number;
  /** The best accuracy, as correct answers out of the questions in that quiz. */
  correct: number;
  total: number;
  streak: number;
  /** The id of the quiz that set each record. */
  setBy: Record<BestRecord, string>;
}

/** Bests by deck id (or "quick"), then by quiz length. */
type Bests = Record<string, Record<string, PersonalBest>>;

function scopeOf(source: QuizSource): string {
  return source.kind === 'deck' ? source.deckId : 'quick';
}

function isBest(value: unknown): value is PersonalBest {
  if (typeof value !== 'object' || value === null) return false;
  const best = value as Partial<PersonalBest>;
  const counts = [best.points, best.correct, best.total, best.streak];
  return (
    counts.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0) &&
    (best.total as number) > 0 &&
    typeof best.setBy === 'object' &&
    best.setBy !== null &&
    RECORDS.every((record) => typeof best.setBy?.[record] === 'string')
  );
}

function load(): Bests {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(BESTS_KEY) ?? '{}');
    return typeof data === 'object' && data !== null ? (data as Bests) : {};
  } catch {
    return {};
  }
}

/** The best for a deck (or quick play) at one quiz length, or null before the first finished quiz. */
export function bestFor(source: QuizSource, count: QuestionCount): PersonalBest | null {
  const best: unknown = load()[scopeOf(source)]?.[String(count)];
  return isBest(best) ? best : null;
}

/** Every best for a deck (or quick play), shortest quiz length first. */
export function bestsFor(source: QuizSource): { count: QuestionCount; best: PersonalBest }[] {
  return QUESTION_COUNT_OPTIONS.flatMap((count) => {
    const best = bestFor(source, count);
    return best ? [{ count, best }] : [];
  });
}

/**
 * Saves a finished quiz's results where they beat the best at its length, and
 * returns the records this quiz holds, e.g. ["points", "streak"]. A record of
 * zero (no correct answers) is never reported. Calling it again for the same
 * quiz changes nothing and returns the same records.
 */
export function recordResult(session: QuizSession): BestRecord[] {
  if (session.retry || session.finishedAt === null) return [];
  const { score, correct, total, bestStreak } = summarize(session);
  const bests = load();
  const scope = scopeOf(session.source);
  const key = String(session.settings.count);
  const old = bests[scope]?.[key];
  const id = session.id;

  let best: PersonalBest;
  if (isBest(old)) {
    best = { ...old, setBy: { ...old.setBy } };
    if (score > old.points) [best.points, best.setBy.points] = [score, id];
    if (correct * old.total > old.correct * total) [best.correct, best.total, best.setBy.accuracy] = [correct, total, id];
    if (bestStreak > old.streak) [best.streak, best.setBy.streak] = [bestStreak, id];
  } else {
    best = { points: score, correct, total, streak: bestStreak, setBy: { points: id, accuracy: id, streak: id } };
  }

  bests[scope] = { ...bests[scope], [key]: best };
  try {
    localStorage.setItem(BESTS_KEY, JSON.stringify(bests));
  } catch {
    // The best just won't be remembered.
  }
  const values: Record<BestRecord, number> = { points: best.points, accuracy: best.correct, streak: best.streak };
  return RECORDS.filter((record) => best.setBy[record] === id && values[record] > 0);
}

/** "1,320 pts · 9/10 · Streak 7", with no-break spaces inside each part so a line only wraps between them. */
export function describeBest(best: PersonalBest): string {
  return `${formatScore(best.points)}\u00a0pts · ${best.correct}/${best.total} · Streak\u00a0${best.streak}`;
}
