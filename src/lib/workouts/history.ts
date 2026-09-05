import "server-only";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { exerciseProvider } from "@/lib/exercises/free-exercise-db";
import { calculateWeekStreak, startOfWeek } from "./streak";

export interface SessionSummary {
  id: string;
  title: string;
  startedAt: string;
  completedAt: string;
  exerciseCount: number;
  setCount: number;
  /** Sum of weight x reps over working sets, in kg. */
  volumeKg: number;
  durationMinutes: number | null;
}

export interface ExerciseSessionHistory {
  sessionId: string;
  completedAt: string;
  sets: { setIndex: number; weightKg: number | null; reps: number | null }[];
  bestWeightKg: number | null;
  volumeKg: number;
}

export interface TrainingStats {
  workoutsThisWeek: number;
  workoutsAllTime: number;
  volumeThisWeekKg: number;
  /** Consecutive weeks with at least one workout, counting back from now. */
  weekStreak: number;
  lastWorkoutAt: string | null;
}

function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Recent completed sessions with their headline numbers.
 *
 * Volume and set counts are aggregated in SQL rather than by loading every set
 * into the app — this is arithmetic the database is better at, and the spec is
 * explicit that plain code (not the AI) does the maths.
 */
export async function listSessionsFor(
  userId: string,
  limit = 20,
): Promise<SessionSummary[]> {
  const rows = (await db()`
    select s.id,
           s.title,
           s.started_at,
           s.completed_at,
           count(distinct we.id)                              as exercise_count,
           count(ws.id)                                       as set_count,
           coalesce(sum(
             case when ws.is_warmup then 0
                  else coalesce(ws.weight_kg, 0) * coalesce(ws.reps, 0) end
           ), 0)                                              as volume_kg,
           extract(epoch from (s.completed_at - s.started_at)) as duration_seconds
      from workout_sessions s
      left join workout_exercises we
        on we.session_id = s.id and we.skipped = false
      left join workout_sets ws on ws.workout_exercise_id = we.id
     where s.user_id = ${userId} and s.completed_at is not null
     group by s.id
     order by s.completed_at desc
     limit ${limit}
  `) as unknown as Record<string, unknown>[];

  return rows.map((r) => {
    const seconds = num(r.duration_seconds);
    return {
      id: String(r.id),
      title: String(r.title),
      startedAt: iso(r.started_at),
      completedAt: iso(r.completed_at),
      exerciseCount: num(r.exercise_count),
      setCount: num(r.set_count),
      volumeKg: Math.round(num(r.volume_kg)),
      durationMinutes: seconds > 0 ? Math.round(seconds / 60) : null,
    };
  });
}

/** Every past session that included one exercise, newest first. */
export async function getExerciseHistoryFor(
  userId: string,
  exerciseId: string,
  limit = 8,
): Promise<ExerciseSessionHistory[]> {
  const rows = (await db()`
    select s.id            as session_id,
           s.completed_at,
           ws.set_index,
           ws.weight_kg,
           ws.reps,
           ws.is_warmup
      from workout_sets ws
      join workout_exercises we on we.id = ws.workout_exercise_id
      join workout_sessions s   on s.id = we.session_id
     where ws.user_id = ${userId}
       and we.exercise_id = ${exerciseId}
       and s.completed_at is not null
     order by s.completed_at desc, ws.set_index
  `) as unknown as {
    session_id: string;
    completed_at: Date | string;
    set_index: number;
    weight_kg: string | number | null;
    reps: number | null;
    is_warmup: boolean;
  }[];

  const bySession = new Map<string, ExerciseSessionHistory>();
  for (const row of rows) {
    let entry = bySession.get(row.session_id);
    if (!entry) {
      if (bySession.size >= limit) continue;
      entry = {
        sessionId: row.session_id,
        completedAt: iso(row.completed_at),
        sets: [],
        bestWeightKg: null,
        volumeKg: 0,
      };
      bySession.set(row.session_id, entry);
    }
    const weight = row.weight_kg === null ? null : num(row.weight_kg);
    entry.sets.push({
      setIndex: row.set_index,
      weightKg: weight,
      reps: row.reps,
    });
    if (!row.is_warmup) {
      entry.volumeKg += num(row.weight_kg) * num(row.reps);
      if (weight !== null && (entry.bestWeightKg === null || weight > entry.bestWeightKg)) {
        entry.bestWeightKg = weight;
      }
    }
  }

  return [...bySession.values()].map((e) => ({
    ...e,
    volumeKg: Math.round(e.volumeKg),
  }));
}

/** Headline training numbers for the dashboard. */
export async function getTrainingStatsFor(
  userId: string,
): Promise<TrainingStats> {
  const sql = db();

  const totals = (await sql`
    select
      count(*) filter (
        where s.completed_at >= date_trunc('week', now())
      ) as this_week,
      count(*) as all_time,
      max(s.completed_at) as last_at
    from workout_sessions s
    where s.user_id = ${userId} and s.completed_at is not null
  `) as unknown as Record<string, unknown>[];

  const volume = (await sql`
    select coalesce(sum(
             case when ws.is_warmup then 0
                  else coalesce(ws.weight_kg, 0) * coalesce(ws.reps, 0) end
           ), 0) as volume_kg
      from workout_sets ws
      join workout_exercises we on we.id = ws.workout_exercise_id
      join workout_sessions s   on s.id = we.session_id
     where ws.user_id = ${userId}
       and s.completed_at >= date_trunc('week', now())
  `) as unknown as Record<string, unknown>[];

  // Distinct training weeks, newest first — a streak is how many of those run
  // back-to-back from the current (or previous) week.
  const weeks = (await sql`
    select distinct date_trunc('week', s.completed_at) as week
      from workout_sessions s
     where s.user_id = ${userId} and s.completed_at is not null
     order by week desc
     limit 60
  `) as unknown as { week: Date | string }[];

  const weekStreak = calculateWeekStreak(
    weeks.map((w) =>
      startOfWeek(new Date(w.week instanceof Date ? w.week : String(w.week))),
    ),
    new Date(),
  );

  const row = totals[0] ?? {};
  return {
    workoutsThisWeek: num(row.this_week),
    workoutsAllTime: num(row.all_time),
    volumeThisWeekKg: Math.round(num(volume[0]?.volume_kg)),
    weekStreak,
    lastWorkoutAt: row.last_at ? iso(row.last_at) : null,
  };
}

const EMPTY_STATS: TrainingStats = {
  workoutsThisWeek: 0,
  workoutsAllTime: 0,
  volumeThisWeekKg: 0,
  weekStreak: 0,
  lastWorkoutAt: null,
};

/** Never throws — the dashboard renders with zeros if history is unavailable. */
export async function getTrainingStats(
  userId: string | null,
): Promise<TrainingStats> {
  if (!userId || !isDatabaseConfigured()) return EMPTY_STATS;
  try {
    return await getTrainingStatsFor(userId);
  } catch (cause) {
    console.error("getTrainingStats:", cause);
    return EMPTY_STATS;
  }
}

export async function listSessions(
  userId: string | null,
  limit?: number,
): Promise<SessionSummary[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    return await listSessionsFor(userId, limit);
  } catch (cause) {
    console.error("listSessions:", cause);
    return [];
  }
}

export async function getExerciseHistory(
  userId: string | null,
  exerciseId: string,
): Promise<ExerciseSessionHistory[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    return await getExerciseHistoryFor(userId, exerciseId);
  } catch (cause) {
    console.error("getExerciseHistory:", cause);
    return [];
  }
}

export interface WeeklyVolumePoint {
  /** ISO date of the Monday starting the week. */
  weekStart: string;
  volumeKg: number;
  workouts: number;
}

/**
 * Volume per week for the last N weeks, zero-filled: a week with no training
 * keeps its slot so the chart shows the gap instead of quietly compressing it.
 */
export async function getWeeklyVolumeSeriesFor(
  userId: string,
  weeks = 8,
): Promise<WeeklyVolumePoint[]> {
  const rows = (await db()`
    select date_trunc('week', s.completed_at) as week,
           count(distinct s.id) as workouts,
           coalesce(sum(
             case when ws.is_warmup then 0
                  else coalesce(ws.weight_kg, 0) * coalesce(ws.reps, 0) end
           ), 0) as volume_kg
      from workout_sessions s
      left join workout_exercises we
        on we.session_id = s.id and we.skipped = false
      left join workout_sets ws on ws.workout_exercise_id = we.id
     where s.user_id = ${userId}
       and s.completed_at is not null
       and s.completed_at >= date_trunc('week', now()) - make_interval(weeks => ${weeks - 1})
     group by 1
     order by 1
  `) as unknown as {
    week: Date | string;
    workouts: string | number;
    volume_kg: string | number;
  }[];

  const byWeek = new Map(
    rows.map((r) => [
      iso(r.week).slice(0, 10),
      { volumeKg: Math.round(num(r.volume_kg)), workouts: num(r.workouts) },
    ]),
  );

  const points: WeeklyVolumePoint[] = [];
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const currentWeek = startOfWeek(new Date());
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekStart = new Date(currentWeek - i * WEEK_MS)
      .toISOString()
      .slice(0, 10);
    const entry = byWeek.get(weekStart);
    points.push({
      weekStart,
      volumeKg: entry?.volumeKg ?? 0,
      workouts: entry?.workouts ?? 0,
    });
  }
  return points;
}

export async function getWeeklyVolumeSeries(
  userId: string | null,
  weeks?: number,
): Promise<WeeklyVolumePoint[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    return await getWeeklyVolumeSeriesFor(userId, weeks);
  } catch (cause) {
    console.error("getWeeklyVolumeSeries:", cause);
    return [];
  }
}

export interface PersonalRecord {
  exerciseId: string;
  name: string;
  weightKg: number;
  reps: number | null;
  achievedOn: string;
}

/** Heaviest working-set weight ever, per exercise — the PR board. */
export async function getPersonalRecordsFor(
  userId: string,
  limit = 5,
): Promise<PersonalRecord[]> {
  const rows = (await db()`
    select distinct on (we.exercise_id)
           we.exercise_id, ws.weight_kg, ws.reps, s.completed_at
      from workout_sets ws
      join workout_exercises we on we.id = ws.workout_exercise_id
      join workout_sessions s on s.id = we.session_id
     where ws.user_id = ${userId}
       and ws.is_warmup = false
       and ws.weight_kg is not null
       and s.completed_at is not null
     order by we.exercise_id, ws.weight_kg desc, s.completed_at desc
  `) as unknown as {
    exercise_id: string;
    weight_kg: string | number;
    reps: number | null;
    completed_at: Date | string;
  }[];

  const top = rows
    .map((r) => ({
      exerciseId: r.exercise_id,
      weightKg: num(r.weight_kg),
      reps: r.reps,
      achievedOn: iso(r.completed_at),
    }))
    .sort((a, b) => b.weightKg - a.weightKg)
    .slice(0, limit);

  const catalogue = await exerciseProvider.getByIds(top.map((t) => t.exerciseId));
  const names = new Map(catalogue.map((e) => [e.id, e.name]));
  return top.map((t) => ({ ...t, name: names.get(t.exerciseId) ?? t.exerciseId }));
}

export async function getPersonalRecords(
  userId: string | null,
  limit?: number,
): Promise<PersonalRecord[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    return await getPersonalRecordsFor(userId, limit);
  } catch (cause) {
    console.error("getPersonalRecords:", cause);
    return [];
  }
}
