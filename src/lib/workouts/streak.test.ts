import { describe, expect, it } from "vitest";
import { calculateWeekStreak, startOfWeek } from "./streak";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const now = new Date("2026-09-05T12:00:00Z"); // a Saturday
const thisWeek = startOfWeek(now);

describe("calculateWeekStreak", () => {
  it("is zero with no training weeks", () => {
    expect(calculateWeekStreak([], now)).toBe(0);
  });

  it("counts a single week trained", () => {
    expect(calculateWeekStreak([thisWeek], now)).toBe(1);
  });

  it("counts consecutive weeks", () => {
    expect(
      calculateWeekStreak([thisWeek, thisWeek - WEEK, thisWeek - 2 * WEEK], now),
    ).toBe(3);
  });

  it("does not break the streak just because this week has no workout yet", () => {
    // Trained the last three weeks, not yet this one — still a live streak.
    expect(
      calculateWeekStreak(
        [thisWeek - WEEK, thisWeek - 2 * WEEK, thisWeek - 3 * WEEK],
        now,
      ),
    ).toBe(3);
  });

  it("breaks on a missed week", () => {
    expect(
      calculateWeekStreak([thisWeek, thisWeek - 2 * WEEK, thisWeek - 3 * WEEK], now),
    ).toBe(1);
  });

  it("ignores duplicate weeks from several sessions", () => {
    expect(
      calculateWeekStreak([thisWeek, thisWeek, thisWeek - WEEK, thisWeek - WEEK], now),
    ).toBe(2);
  });

  it("is zero when the last workout is long past", () => {
    expect(calculateWeekStreak([thisWeek - 5 * WEEK], now)).toBe(0);
  });

  it("puts Sunday in the week that started on Monday", () => {
    const monday = new Date("2026-08-31T00:00:00Z");
    const sunday = new Date("2026-09-06T23:59:00Z");
    expect(startOfWeek(sunday)).toBe(startOfWeek(monday));
  });
});
