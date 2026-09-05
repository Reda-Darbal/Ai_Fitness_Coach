import "server-only";
import { db, isDatabaseConfigured } from "@/lib/db/client";

export interface WeightPoint {
  /** ISO date (yyyy-mm-dd). */
  date: string;
  weightKg: number;
}

export interface WeightStats {
  /** Most recent logged weight, if any. */
  currentKg: number | null;
  currentDate: string | null;
  /** Earliest log in the window — the journey's starting point. */
  startKg: number | null;
  changeKg: number | null;
  /** Average of the last 7 days vs the 7 before — the trend that matters. */
  weekAvgKg: number | null;
  prevWeekAvgKg: number | null;
  trendKg: number | null;
}

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

function day(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/** Daily weigh-ins, oldest first, for charting. */
export async function getWeightSeriesFor(
  userId: string,
  days = 180,
): Promise<WeightPoint[]> {
  const rows = (await db()`
    select logged_on, weight_kg
      from body_weight_logs
     where user_id = ${userId}
       and logged_on >= current_date - ${days}::int
     order by logged_on
  `) as unknown as { logged_on: Date | string; weight_kg: string | number }[];

  return rows.map((r) => ({ date: day(r.logged_on), weightKg: num(r.weight_kg) }));
}

/**
 * Headline weight numbers. The trend compares weekly AVERAGES, not two single
 * days — per the spec, one-day fluctuations are noise, not progress.
 */
export async function getWeightStatsFor(userId: string): Promise<WeightStats> {
  const rows = (await db()`
    select
      (select weight_kg from body_weight_logs
        where user_id = ${userId} order by logged_on desc limit 1) as current_kg,
      (select logged_on from body_weight_logs
        where user_id = ${userId} order by logged_on desc limit 1) as current_date,
      (select weight_kg from body_weight_logs
        where user_id = ${userId} order by logged_on asc limit 1)  as start_kg,
      (select avg(weight_kg) from body_weight_logs
        where user_id = ${userId}
          and logged_on > current_date - 7)                        as week_avg,
      (select avg(weight_kg) from body_weight_logs
        where user_id = ${userId}
          and logged_on <= current_date - 7
          and logged_on > current_date - 14)                       as prev_week_avg
  `) as unknown as Record<string, unknown>[];

  const r = rows[0] ?? {};
  const currentKg = r.current_kg == null ? null : num(r.current_kg);
  const startKg = r.start_kg == null ? null : num(r.start_kg);
  const weekAvgKg = r.week_avg == null ? null : num(r.week_avg);
  const prevWeekAvgKg = r.prev_week_avg == null ? null : num(r.prev_week_avg);

  return {
    currentKg,
    currentDate: r.current_date ? day(r.current_date) : null,
    startKg,
    changeKg:
      currentKg !== null && startKg !== null
        ? Math.round((currentKg - startKg) * 10) / 10
        : null,
    weekAvgKg: weekAvgKg !== null ? Math.round(weekAvgKg * 10) / 10 : null,
    prevWeekAvgKg:
      prevWeekAvgKg !== null ? Math.round(prevWeekAvgKg * 10) / 10 : null,
    trendKg:
      weekAvgKg !== null && prevWeekAvgKg !== null
        ? Math.round((weekAvgKg - prevWeekAvgKg) * 10) / 10
        : null,
  };
}

const EMPTY: WeightStats = {
  currentKg: null,
  currentDate: null,
  startKg: null,
  changeKg: null,
  weekAvgKg: null,
  prevWeekAvgKg: null,
  trendKg: null,
};

/** Never throw — pages render with placeholders instead. */
export async function getWeightStats(
  userId: string | null,
): Promise<WeightStats> {
  if (!userId || !isDatabaseConfigured()) return EMPTY;
  try {
    return await getWeightStatsFor(userId);
  } catch (cause) {
    console.error("getWeightStats:", cause);
    return EMPTY;
  }
}

export async function getWeightSeries(
  userId: string | null,
  days?: number,
): Promise<WeightPoint[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    return await getWeightSeriesFor(userId, days);
  } catch (cause) {
    console.error("getWeightSeries:", cause);
    return [];
  }
}
