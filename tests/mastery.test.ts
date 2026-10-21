import { describe, expect, it } from "vitest";
import {
  applyAnswer,
  dayNumber,
  isSittingOut,
  type QuestionProgress,
  weightOf,
} from "../src/quiz/mastery";

const identity = { questionId: "question-1", deckId: "deck-1" };

function progress(
  overrides: Partial<QuestionProgress> = {},
): QuestionProgress {
  return {
    ...identity,
    level: 3,
    promotionDay: 104,
    weightAfter: 0.2,
    answeredDay: 100,
    rightRound: 7,
    dropDay: null,
    seen: 4,
    right: 3,
    ...overrides,
  };
}

function roundedWeight(value: number): number {
  return Math.round(value * 100) / 100;
}

describe("dayNumber", () => {
  it("uses local calendar days across a daylight-saving date", () => {
    const early = dayNumber(new Date(2026, 2, 8, 0, 5).getTime());
    const late = dayNumber(new Date(2026, 2, 8, 23, 55).getTime());
    const nextDay = dayNumber(new Date(2026, 2, 9, 0, 5).getTime());

    expect(late).toBe(early);
    expect(nextDay).toBe(early + 1);
  });
});

describe("weightOf", () => {
  it("gives unanswered questions the new-question weight", () => {
    expect(weightOf(undefined, 100)).toBe(5);
  });

  it.each([
    [0, 0.2],
    [1, 0.32],
    [4, 0.58],
    [7, 0.74],
    [14, 0.92],
  ])("drifts a right-answer weight toward one after %i days", (days, expected) => {
    expect(
      roundedWeight(weightOf(progress({ answeredDay: 100, weightAfter: 0.2 }), 100 + days)),
    ).toBe(expected);
  });

  it.each([
    [0, 3],
    [1, 2.7],
    [4, 2.04],
    [7, 1.64],
    [14, 1.21],
  ])("drifts a missed-answer weight toward one after %i days", (days, expected) => {
    expect(
      roundedWeight(weightOf(progress({ answeredDay: 100, weightAfter: 3 }), 100 + days)),
    ).toBe(expected);
  });

  it("does not amplify a weight when the stored answer day is in the future", () => {
    expect(weightOf(progress({ answeredDay: 101, weightAfter: 3 }), 100)).toBe(3);
  });
});

describe("isSittingOut", () => {
  it("rests a right answer for exactly the next two deck rounds", () => {
    const answeredInRoundSeven = progress({ rightRound: 7 });

    expect(isSittingOut(answeredInRoundSeven, 7)).toBe(true);
    expect(isSittingOut(answeredInRoundSeven, 8)).toBe(true);
    expect(isSittingOut(answeredInRoundSeven, 9)).toBe(false);
  });

  it("never rests a missed question or a new question", () => {
    expect(isSittingOut(progress({ rightRound: null }), 7)).toBe(false);
    expect(isSittingOut(undefined, 7)).toBe(false);
  });
});

describe("applyAnswer", () => {
  it("starts a correct question at level 2", () => {
    expect(applyAnswer(undefined, identity, true, 100, 1)).toEqual({
      ...identity,
      level: 2,
      promotionDay: 102,
      weightAfter: 0.2,
      answeredDay: 100,
      rightRound: 1,
      dropDay: null,
      seen: 1,
      right: 1,
    });
  });

  it("starts a missed question at level 1", () => {
    expect(applyAnswer(undefined, identity, false, 100, 1)).toEqual({
      ...identity,
      level: 1,
      promotionDay: 101,
      weightAfter: 3,
      answeredDay: 100,
      rightRound: null,
      dropDay: null,
      seen: 1,
      right: 0,
    });
  });

  it("treats an early correct answer as practice without raising the level", () => {
    const updated = applyAnswer(progress(), identity, true, 103, 8);

    expect(updated).toMatchObject({
      level: 3,
      promotionDay: 104,
      weightAfter: 0.2,
      answeredDay: 103,
      rightRound: 8,
      seen: 5,
      right: 4,
    });
  });

  it("raises the level after its wait and caps it at level 5", () => {
    const raised = applyAnswer(progress(), identity, true, 104, 8);
    const mastered = applyAnswer(
      progress({ level: 5, promotionDay: 100 }),
      identity,
      true,
      104,
      8,
    );

    expect(raised).toMatchObject({ level: 4, promotionDay: 112 });
    expect(mastered).toMatchObject({ level: 5, promotionDay: 120 });
  });

  it("drops one level after a miss and clears the right-answer rest", () => {
    const updated = applyAnswer(progress(), identity, false, 105, 8);

    expect(updated).toMatchObject({
      level: 2,
      promotionDay: 107,
      weightAfter: 3,
      answeredDay: 105,
      rightRound: null,
      dropDay: 105,
      seen: 5,
      right: 3,
    });
  });

  it("drops at most once per day and never below level 1", () => {
    const alreadyDropped = progress({ level: 2, dropDay: 105 });
    const sameDay = applyAnswer(alreadyDropped, identity, false, 105, 8);
    const floor = applyAnswer(
      progress({ level: 1, dropDay: 104 }),
      identity,
      false,
      105,
      8,
    );

    expect(sameDay.level).toBe(2);
    expect(floor.level).toBe(1);
  });
});
