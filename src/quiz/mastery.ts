const DAY_MS = 86_400_000;
const NEW_WEIGHT = 5;
const RIGHT_WEIGHT = 0.2;
const MISS_WEIGHT = 3;
const DRIFT = 0.85;
const SIT_OUT_ROUNDS = 2;
const WAIT_DAYS = [0, 1, 2, 4, 8, 16] as const;
const MASTERED_LEVEL = 5;

export type MasteryLevel = 1 | 2 | 3 | 4 | 5;

export interface ProgressIdentity {
  questionId: string;
  deckId: string;
}

export interface QuestionProgress extends ProgressIdentity {
  level: MasteryLevel;
  promotionDay: number;
  weightAfter: number;
  answeredDay: number;
  rightRound: number | null;
  dropDay: number | null;
  seen: number;
  right: number;
}

/** Returns a stable integer for the user's local calendar day. */
export function dayNumber(time: number): number {
  const date = new Date(time);
  return Math.round(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
}

/** Returns the question's current draw weight. */
export function weightOf(
  progress: QuestionProgress | undefined,
  today: number,
): number {
  if (!progress) return NEW_WEIGHT;

  // A clock correction should not make a weight more extreme than its
  // just-answered value.
  const elapsedDays = Math.max(0, today - progress.answeredDay);
  return 1 + (progress.weightAfter - 1) * DRIFT ** elapsedDays;
}

/**
 * completedRounds is the deck's round count before the next quiz starts.
 * A right answer rests for the next two rounds.
 */
export function isSittingOut(
  progress: QuestionProgress | undefined,
  completedRounds: number,
): boolean {
  return (
    progress?.rightRound != null &&
    completedRounds - progress.rightRound < SIT_OUT_ROUNDS
  );
}

function nextLevel(level: MasteryLevel): MasteryLevel {
  return Math.min(level + 1, MASTERED_LEVEL) as MasteryLevel;
}

function previousLevel(level: MasteryLevel): MasteryLevel {
  return Math.max(level - 1, 1) as MasteryLevel;
}

/** Applies one scored answer and returns a new progress record. */
export function applyAnswer(
  progress: QuestionProgress | undefined,
  identity: ProgressIdentity,
  correct: boolean,
  today: number,
  round: number,
): QuestionProgress {
  let level: MasteryLevel;
  let promotionDay: number;
  let dropDay = progress?.dropDay ?? null;

  if (!progress) {
    level = correct ? 2 : 1;
    promotionDay = today + WAIT_DAYS[level];
  } else if (correct) {
    if (today >= progress.promotionDay) {
      level = nextLevel(progress.level);
      promotionDay = today + WAIT_DAYS[level];
    } else {
      level = progress.level;
      promotionDay = progress.promotionDay;
    }
  } else {
    level = progress.dropDay === today
      ? progress.level
      : previousLevel(progress.level);
    dropDay = today;
    promotionDay = today + WAIT_DAYS[level];
  }

  return {
    ...identity,
    level,
    promotionDay,
    weightAfter: correct ? RIGHT_WEIGHT : MISS_WEIGHT,
    answeredDay: today,
    rightRound: correct ? round : null,
    dropDay,
    seen: (progress?.seen ?? 0) + 1,
    right: (progress?.right ?? 0) + (correct ? 1 : 0),
  };
}
