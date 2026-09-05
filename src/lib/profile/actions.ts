"use server";

import { cookies } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { LOCALE_COOKIE } from "@/lib/i18n/server";
import { db } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/db/session";
import { profileInputSchema, profilePatchSchema } from "./schema";
import type { ProfileInput, ProfilePatch } from "./schema";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** camelCase field -> database column. */
const COLUMNS: Array<[keyof ProfileInput, string]> = [
  ["age", "age"],
  ["sex", "sex"],
  ["heightCm", "height_cm"],
  ["currentWeightKg", "current_weight_kg"],
  ["targetWeightKg", "target_weight_kg"],
  ["goal", "goal"],
  ["experienceLevel", "experience_level"],
  ["trainingDays", "training_days"],
  ["preferredTime", "preferred_time"],
  ["sessionMinutes", "session_minutes"],
  ["equipment", "equipment"],
  ["injuries", "injuries"],
  ["likedExercises", "liked_exercises"],
  ["dislikedExercises", "disliked_exercises"],
  ["notes", "notes"],
  ["coachLanguage", "coach_language"],
  ["conciseReplies", "concise_replies"],
];

/** Keeps <html lang dir> in step with the saved profile on the next request. */
async function syncLocaleCookie(language: string): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, language, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

function friendlyError(message: string): string {
  if (message.includes("does not exist") && message.includes("relation")) {
    return "The database tables don't exist yet. Run `npm run db:migrate`, then try again.";
  }
  if (message.includes("DATABASE_URL")) {
    return "No database is configured. Add your Neon connection string to .env.local.";
  }
  if (
    message.includes("fetch failed") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED")
  ) {
    return "Couldn't reach the database. Check DATABASE_URL in .env.local.";
  }
  return message;
}

function toResult(cause: unknown): ActionResult {
  if (cause instanceof UnauthorizedError) {
    return { ok: false, error: "You are not signed in." };
  }
  const message = cause instanceof Error ? cause.message : "Unknown error";
  return { ok: false, error: friendlyError(message) };
}

/**
 * Writes the finished onboarding profile.
 *
 * Every server action re-checks auth itself — the Next 16 proxy does not run
 * for Server Function calls, so requireUserId() is the only check there is.
 */
export async function completeOnboarding(input: unknown): Promise<ActionResult> {
  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Some answers need fixing.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const userId = await requireUserId();
    const user = await currentUser();
    const v = parsed.data;

    await db()`
      insert into profiles (
        user_id, display_name, age, sex, height_cm, current_weight_kg,
        target_weight_kg, goal, experience_level, training_days,
        preferred_time, session_minutes, equipment, injuries,
        liked_exercises, disliked_exercises, notes, coach_language,
        concise_replies, onboarding_completed_at
      ) values (
        ${userId}, ${user?.firstName ?? null}, ${v.age}, ${v.sex},
        ${v.heightCm}, ${v.currentWeightKg}, ${v.targetWeightKg}, ${v.goal},
        ${v.experienceLevel}, ${v.trainingDays}, ${v.preferredTime},
        ${v.sessionMinutes}, ${v.equipment}, ${v.injuries},
        ${v.likedExercises}, ${v.dislikedExercises}, ${v.notes},
        ${v.coachLanguage}, ${v.conciseReplies}, now()
      )
      on conflict (user_id) do update set
        display_name = excluded.display_name,
        age = excluded.age,
        sex = excluded.sex,
        height_cm = excluded.height_cm,
        current_weight_kg = excluded.current_weight_kg,
        target_weight_kg = excluded.target_weight_kg,
        goal = excluded.goal,
        experience_level = excluded.experience_level,
        training_days = excluded.training_days,
        preferred_time = excluded.preferred_time,
        session_minutes = excluded.session_minutes,
        equipment = excluded.equipment,
        injuries = excluded.injuries,
        liked_exercises = excluded.liked_exercises,
        disliked_exercises = excluded.disliked_exercises,
        notes = excluded.notes,
        coach_language = excluded.coach_language,
        concise_replies = excluded.concise_replies,
        onboarding_completed_at = coalesce(
          profiles.onboarding_completed_at, excluded.onboarding_completed_at)
    `;

    await syncLocaleCookie(v.coachLanguage);
    return { ok: true };
  } catch (cause) {
    console.error("completeOnboarding:", cause);
    return toResult(cause);
  }
}

/**
 * Partial profile edit from Settings. Builds a parameterised SET clause from
 * the fields actually supplied — column names come from the fixed COLUMNS map
 * above, never from user input.
 */
export async function updateProfile(patch: unknown): Promise<ActionResult> {
  const parsed = profilePatchSchema.safeParse(patch);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Some answers need fixing.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data as ProfilePatch;
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [key, column] of COLUMNS) {
    const value = data[key];
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }

  if (assignments.length === 0) return { ok: true };

  try {
    const userId = await requireUserId();
    params.push(userId);

    await db().query(
      `update profiles set ${assignments.join(", ")} where user_id = $${params.length}`,
      params,
    );

    if (data.coachLanguage) await syncLocaleCookie(data.coachLanguage);
    return { ok: true };
  } catch (cause) {
    console.error("updateProfile:", cause);
    return toResult(cause);
  }
}
