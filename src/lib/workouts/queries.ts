import "server-only";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { exerciseProvider } from "@/lib/exercises/free-exercise-db";
import {
  recommendProgression,
  type ProgressionRecommendation,
} from "./progression";
import type { Exercise } from "@/lib/exercises/types";

export type SetFeedback = "too_easy" | "ok" | "too_hard" | "pain";

export interface LoggedSet {
  id: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  isWarmup: boolean;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  restSeconds: number;
  skipped: boolean;
  feedback: SetFeedback | null;
  notes: string | null;
  exercise: Exercise | null;
  sets: LoggedSet[];
  /** What this exercise looked like in the previous session. */
  previous: LoggedSet[];
  /** How the previous session felt, if recorded. */
  previousFeedback: SetFeedback | null;
  /** Deterministic overload recommendation derived from `previous`. */
  recommendation: ProgressionRecommendation;
}

export interface WorkoutSession {
  id: string;
  title: string;
  startedAt: string;
  completedAt: string | null;
  exercises: SessionExercise[];
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : null;
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** The session currently in progress, if any. */
export async function getActiveSessionId(
  userId: string,
): Promise<string | null> {
  const rows = (await db()`
    select id from workout_sessions
     where user_id = ${userId} and completed_at is null
     order by started_at desc limit 1
  `) as unknown as { id: string }[];
  return rows[0]?.id ?? null;
}

/**
 * A full session: exercises, the sets logged so far, and what the same
 * exercise looked like last time. userId is filtered on every query — the
 * authorization boundary.
 */
export async function getSessionFor(
  userId: string,
  sessionId: string,
): Promise<WorkoutSession | null> {
  const sql = db();

  const sessions = (await sql`
    select id, title, started_at, completed_at
      from workout_sessions
     where user_id = ${userId} and id = ${sessionId}
     limit 1
  `) as unknown as {
    id: string;
    title: string;
    started_at: Date | string;
    completed_at: Date | string | null;
  }[];

  const session = sessions[0];
  if (!session) return null;

  const exerciseRows = (await sql`
    select id, exercise_id, order_index, target_sets, target_rep_min,
           target_rep_max, rest_seconds, skipped, feedback, notes
      from workout_exercises
     where user_id = ${userId} and session_id = ${sessionId}
     order by order_index
  `) as unknown as {
    id: string;
    exercise_id: string;
    order_index: number;
    target_sets: number;
    target_rep_min: number;
    target_rep_max: number;
    rest_seconds: number;
    skipped: boolean;
    feedback: SetFeedback | null;
    notes: string | null;
  }[];

  const setRows = (await sql`
    select ws.id, ws.workout_exercise_id, ws.set_index, ws.weight_kg,
           ws.reps, ws.is_warmup
      from workout_sets ws
      join workout_exercises we on we.id = ws.workout_exercise_id
     where ws.user_id = ${userId} and we.session_id = ${sessionId}
     order by ws.set_index
  `) as unknown as {
    id: string;
    workout_exercise_id: string;
    set_index: number;
    weight_kg: string | number | null;
    reps: number | null;
    is_warmup: boolean;
  }[];

  // Strictly THE most recent completed session per exercise — resolving the
  // workout_exercise first, then its sets, so two different past sessions can
  // never blend into one phantom "previous performance".
  const exerciseIds = exerciseRows.map((e) => e.exercise_id);
  const previousRows =
    exerciseIds.length === 0
      ? []
      : ((await sql`
          with last_we as (
            select distinct on (we.exercise_id)
                   we.id, we.exercise_id, we.feedback
              from workout_exercises we
              join workout_sessions s on s.id = we.session_id
             where we.user_id = ${userId}
               and we.exercise_id = any(${exerciseIds})
               and s.id <> ${sessionId}
               and s.completed_at is not null
               and we.skipped = false
             order by we.exercise_id, s.completed_at desc
          )
          select lw.exercise_id, lw.feedback, ws.id, ws.set_index,
                 ws.weight_kg, ws.reps, ws.is_warmup
            from last_we lw
            join workout_sets ws on ws.workout_exercise_id = lw.id
           order by lw.exercise_id, ws.set_index
        `) as unknown as {
          exercise_id: string;
          feedback: SetFeedback | null;
          id: string;
          set_index: number;
          weight_kg: string | number | null;
          reps: number | null;
          is_warmup: boolean;
        }[]);

  const catalogue = await exerciseProvider.getByIds(exerciseIds);
  const byId = new Map(catalogue.map((e) => [e.id, e]));

  const toSet = (r: {
    id: string;
    set_index: number;
    weight_kg: string | number | null;
    reps: number | null;
    is_warmup: boolean;
  }): LoggedSet => ({
    id: r.id,
    setIndex: r.set_index,
    weightKg: num(r.weight_kg),
    reps: r.reps,
    isWarmup: r.is_warmup,
  });

  return {
    id: session.id,
    title: session.title,
    startedAt: iso(session.started_at),
    completedAt: session.completed_at ? iso(session.completed_at) : null,
    exercises: exerciseRows.map((row) => {
      const exercise = byId.get(row.exercise_id) ?? null;
      const previous = previousRows
        .filter((p) => p.exercise_id === row.exercise_id)
        .map(toSet);
      const previousFeedback =
        previousRows.find((p) => p.exercise_id === row.exercise_id)?.feedback ??
        null;

      return {
        id: row.id,
        exerciseId: row.exercise_id,
        orderIndex: row.order_index,
        targetSets: row.target_sets,
        targetRepMin: row.target_rep_min,
        targetRepMax: row.target_rep_max,
        restSeconds: row.rest_seconds,
        skipped: row.skipped,
        feedback: row.feedback,
        notes: row.notes,
        exercise,
        sets: setRows.filter((s) => s.workout_exercise_id === row.id).map(toSet),
        previous,
        previousFeedback,
        recommendation: recommendProgression({
          targetRepMin: row.target_rep_min,
          targetRepMax: row.target_rep_max,
          previousSets: previous,
          feedback: previousFeedback,
          equipment: exercise?.equipment ?? "unknown",
        }),
      };
    }),
  };
}

/** Never throws — pages use it for rendering decisions. */
export async function getSession(
  userId: string | null,
  sessionId: string,
): Promise<{ session: WorkoutSession | null; error: string | null }> {
  if (!userId || !isDatabaseConfigured()) {
    return { session: null, error: null };
  }
  try {
    return { session: await getSessionFor(userId, sessionId), error: null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown error";
    console.error("getSession:", message);
    return { session: null, error: message };
  }
}
