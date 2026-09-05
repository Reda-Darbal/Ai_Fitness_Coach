"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/db/session";
import { getActiveSessionId } from "./queries";

export type WorkoutResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function fail(cause: unknown): { ok: false; error: string } {
  if (cause instanceof UnauthorizedError) {
    return { ok: false, error: "You are not signed in." };
  }
  const message = cause instanceof Error ? cause.message : "Unknown error";
  console.error("workout action:", message);
  return { ok: false, error: message };
}

/**
 * Starts a session from a program day, copying the prescription onto the
 * session so later edits to the program never rewrite past workouts.
 * Returns the existing session if one is already open.
 */
export async function startWorkout(
  programDayId: string,
): Promise<WorkoutResult<{ sessionId: string }>> {
  try {
    const userId = await requireUserId();
    const sql = db();

    const existing = await getActiveSessionId(userId);
    if (existing) return { ok: true, data: { sessionId: existing } };

    const days = (await sql`
      select id, name from program_days
       where user_id = ${userId} and id = ${programDayId}
       limit 1
    `) as unknown as { id: string; name: string }[];

    const day = days[0];
    if (!day) return { ok: false, error: "That session is not in your program." };

    const created = (await sql`
      insert into workout_sessions (user_id, program_day_id, title)
      values (${userId}, ${day.id}, ${day.name})
      returning id
    `) as unknown as { id: string }[];

    const sessionId = created[0].id;

    await sql`
      insert into workout_exercises
        (user_id, session_id, exercise_id, order_index,
         target_sets, target_rep_min, target_rep_max, rest_seconds, notes)
      select ${userId}, ${sessionId}, pe.exercise_id, pe.order_index,
             pe.sets, pe.rep_min, pe.rep_max, pe.rest_seconds, pe.notes
        from program_exercises pe
       where pe.user_id = ${userId} and pe.program_day_id = ${day.id}
    `;

    revalidatePath("/workout");
    return { ok: true, data: { sessionId } };
  } catch (cause) {
    return fail(cause);
  }
}

const logSetSchema = z.object({
  workoutExerciseId: z.uuid(),
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(200),
  isWarmup: z.boolean().optional(),
});

/** Records one completed set. */
export async function logSet(input: unknown): Promise<WorkoutResult> {
  const parsed = logSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That set looks wrong." };

  try {
    const userId = await requireUserId();
    const sql = db();
    const { workoutExerciseId, weightKg, reps, isWarmup } = parsed.data;

    // Ownership check: the exercise must belong to this user's session.
    const owned = (await sql`
      select id from workout_exercises
       where id = ${workoutExerciseId} and user_id = ${userId} limit 1
    `) as unknown as { id: string }[];
    if (owned.length === 0) return { ok: false, error: "Not your workout." };

    const next = (await sql`
      select coalesce(max(set_index), -1) + 1 as next_index
        from workout_sets
       where user_id = ${userId} and workout_exercise_id = ${workoutExerciseId}
    `) as unknown as { next_index: number }[];

    await sql`
      insert into workout_sets
        (user_id, workout_exercise_id, set_index, weight_kg, reps, is_warmup)
      values (${userId}, ${workoutExerciseId}, ${next[0].next_index},
              ${weightKg}, ${reps}, ${isWarmup ?? false})
    `;

    return { ok: true };
  } catch (cause) {
    return fail(cause);
  }
}

/** Removes the most recent set — the undo for a mistyped entry. */
export async function undoLastSet(
  workoutExerciseId: string,
): Promise<WorkoutResult> {
  try {
    const userId = await requireUserId();
    await db()`
      delete from workout_sets
       where id = (
         select id from workout_sets
          where user_id = ${userId}
            and workout_exercise_id = ${workoutExerciseId}
          order by set_index desc limit 1
       )
    `;
    return { ok: true };
  } catch (cause) {
    return fail(cause);
  }
}

const feedbackSchema = z.object({
  workoutExerciseId: z.uuid(),
  feedback: z.enum(["too_easy", "ok", "too_hard", "pain"]),
});

/**
 * Records how an exercise felt. 'pain' is not just a label — the UI stops
 * coaching that movement and points the user at a professional, per the
 * safety rules.
 */
export async function setExerciseFeedback(
  input: unknown,
): Promise<WorkoutResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown feedback." };

  try {
    const userId = await requireUserId();
    await db()`
      update workout_exercises set feedback = ${parsed.data.feedback}
       where id = ${parsed.data.workoutExerciseId} and user_id = ${userId}
    `;
    return { ok: true };
  } catch (cause) {
    return fail(cause);
  }
}

export async function skipExercise(
  workoutExerciseId: string,
  skipped = true,
): Promise<WorkoutResult> {
  try {
    const userId = await requireUserId();
    await db()`
      update workout_exercises set skipped = ${skipped}
       where id = ${workoutExerciseId} and user_id = ${userId}
    `;
    return { ok: true };
  } catch (cause) {
    return fail(cause);
  }
}

const finishSchema = z.object({
  sessionId: z.uuid(),
  feeling: z.enum(["easy", "good", "hard"]).nullable(),
});

export async function finishWorkout(input: unknown): Promise<WorkoutResult> {
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Could not finish session." };

  try {
    const userId = await requireUserId();
    await db()`
      update workout_sessions
         set completed_at = now(), feeling = ${parsed.data.feeling}
       where id = ${parsed.data.sessionId}
         and user_id = ${userId}
         and completed_at is null
    `;
    revalidatePath("/workout");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (cause) {
    return fail(cause);
  }
}

/** Abandons an in-progress session without recording it as completed. */
export async function cancelWorkout(sessionId: string): Promise<WorkoutResult> {
  try {
    const userId = await requireUserId();
    await db()`
      delete from workout_sessions
       where id = ${sessionId} and user_id = ${userId} and completed_at is null
    `;
    revalidatePath("/workout");
    return { ok: true };
  } catch (cause) {
    return fail(cause);
  }
}
