import "server-only";
import { db, isDatabaseConfigured } from "@/lib/db/client";

export type CheckinEnergy = "low" | "ok" | "high";
export type CheckinSleep = "poor" | "ok" | "good";
export type CheckinSoreness = "none" | "some" | "high";
export type CheckinDifficulty = "too_easy" | "right" | "too_hard";

export interface Checkin {
  id: string;
  weekStart: string;
  weightKg: number | null;
  workoutsDone: number;
  energy: CheckinEnergy;
  sleep: CheckinSleep;
  soreness: CheckinSoreness;
  difficulty: CheckinDifficulty;
  liked: string | null;
  disliked: string | null;
  notes: string | null;
  /** Compact English digest built at save time — what the model reads. */
  summary: string;
}

interface Row {
  id: string;
  week_start: Date | string;
  weight_kg: string | number | null;
  workouts_done: number;
  energy: CheckinEnergy;
  sleep: CheckinSleep;
  soreness: CheckinSoreness;
  difficulty: CheckinDifficulty;
  liked: string | null;
  disliked: string | null;
  notes: string | null;
  summary: string;
}

function toCheckin(r: Row): Checkin {
  return {
    id: r.id,
    weekStart:
      r.week_start instanceof Date
        ? r.week_start.toISOString().slice(0, 10)
        : String(r.week_start).slice(0, 10),
    weightKg:
      r.weight_kg === null
        ? null
        : typeof r.weight_kg === "string"
          ? Number(r.weight_kg)
          : r.weight_kg,
    workoutsDone: r.workouts_done,
    energy: r.energy,
    sleep: r.sleep,
    soreness: r.soreness,
    difficulty: r.difficulty,
    liked: r.liked,
    disliked: r.disliked,
    notes: r.notes,
    summary: r.summary,
  };
}

/** This week's check-in, if already done. */
export async function getCurrentCheckinFor(
  userId: string,
): Promise<Checkin | null> {
  const rows = (await db()`
    select * from weekly_checkins
     where user_id = ${userId}
       and week_start = date_trunc('week', now())::date
     limit 1
  `) as unknown as Row[];
  return rows[0] ? toCheckin(rows[0]) : null;
}

/** Most recent check-in inside a freshness window (for program generation). */
export async function getLatestCheckinFor(
  userId: string,
  maxAgeDays = 14,
): Promise<Checkin | null> {
  const rows = (await db()`
    select * from weekly_checkins
     where user_id = ${userId}
       and week_start >= current_date - ${maxAgeDays}::int
     order by week_start desc
     limit 1
  `) as unknown as Row[];
  return rows[0] ? toCheckin(rows[0]) : null;
}

/**
 * Whether to nudge for a check-in: none this week, and there was training in
 * the last 10 days (no point nagging someone who has not started).
 */
export async function isCheckinDue(userId: string | null): Promise<boolean> {
  if (!userId || !isDatabaseConfigured()) return false;
  try {
    const rows = (await db()`
      select
        exists(select 1 from weekly_checkins
                where user_id = ${userId}
                  and week_start = date_trunc('week', now())::date) as done,
        exists(select 1 from workout_sessions
                where user_id = ${userId}
                  and completed_at > now() - interval '10 days') as trained
    `) as unknown as { done: boolean; trained: boolean }[];
    const r = rows[0];
    return Boolean(r && !r.done && r.trained);
  } catch (cause) {
    console.error("isCheckinDue:", cause);
    return false;
  }
}

export async function getCurrentCheckin(
  userId: string | null,
): Promise<Checkin | null> {
  if (!userId || !isDatabaseConfigured()) return null;
  try {
    return await getCurrentCheckinFor(userId);
  } catch (cause) {
    console.error("getCurrentCheckin:", cause);
    return null;
  }
}

export async function getLatestCheckin(
  userId: string | null,
): Promise<Checkin | null> {
  if (!userId || !isDatabaseConfigured()) return null;
  try {
    return await getLatestCheckinFor(userId);
  } catch (cause) {
    console.error("getLatestCheckin:", cause);
    return null;
  }
}
