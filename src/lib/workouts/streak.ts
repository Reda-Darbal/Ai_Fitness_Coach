const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Midnight UTC on the Monday of the given date's week. */
export function startOfWeek(date: Date): number {
  const copy = new Date(date);
  const day = (copy.getUTCDay() + 6) % 7; // Monday = 0
  copy.setUTCDate(copy.getUTCDate() - day);
  copy.setUTCHours(0, 0, 0, 0);
  return copy.getTime();
}

/**
 * Consecutive training weeks, counting back from now.
 *
 * Not having trained yet *this* week does not break the streak — the week is
 * still running. It only breaks once a whole week passes with nothing logged.
 *
 * @param weekStarts Distinct week-start timestamps, any order.
 */
export function calculateWeekStreak(weekStarts: number[], now: Date): number {
  if (weekStarts.length === 0) return 0;

  const weeks = [...new Set(weekStarts)].sort((a, b) => b - a);
  const currentWeek = startOfWeek(now);

  // Start from this week if it has a workout, otherwise from last week.
  let expected = weeks[0] === currentWeek ? currentWeek : currentWeek - WEEK_MS;
  let streak = 0;

  for (const week of weeks) {
    if (week > expected) continue; // future/current week already accounted for
    if (week === expected) {
      streak += 1;
      expected -= WEEK_MS;
    } else {
      break; // a gap ends the streak
    }
  }

  return streak;
}
