"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/db/session";
import { getProfileFor } from "@/lib/profile/queries";
import { GOAL_LABELS } from "@/lib/profile/constants";
import { generateProgram } from "./generate";
import type { GeneratedProgram } from "./schema";

export type GenerateResult =
  | { ok: true; repairs: string[] }
  | { ok: false; error: string };

/** Writes the validated program, replacing whatever was active before. */
async function saveProgram(
  userId: string,
  program: GeneratedProgram,
  goal: string,
  generationId: string | null,
): Promise<void> {
  const sql = db();

  // Previous programs are archived, never deleted — workout history will
  // reference them from Phase 6 on.
  await sql`
    update programs set status = 'archived'
     where user_id = ${userId} and status = 'active'
  `;

  const inserted = (await sql`
    insert into programs (user_id, title, status, goal, weeks, generation_id)
    values (${userId}, ${program.title}, 'active', ${goal}, 1, ${generationId})
    returning id
  `) as unknown as { id: string }[];

  const programId = inserted[0].id;

  for (const [dayIndex, day] of program.days.entries()) {
    const dayRows = (await sql`
      insert into program_days
        (user_id, program_id, weekday, order_index, name, focus, estimated_minutes)
      values (
        ${userId}, ${programId}, ${day.weekday}, ${dayIndex},
        ${day.name}, ${day.focus}, ${day.estimatedMinutes}
      )
      returning id
    `) as unknown as { id: string }[];

    const dayId = dayRows[0].id;

    for (const [exerciseIndex, exercise] of day.exercises.entries()) {
      await sql`
        insert into program_exercises
          (user_id, program_day_id, exercise_id, order_index,
           sets, rep_min, rep_max, rest_seconds, notes)
        values (
          ${userId}, ${dayId}, ${exercise.exerciseId}, ${exerciseIndex},
          ${exercise.sets}, ${exercise.repMin}, ${exercise.repMax},
          ${exercise.restSeconds}, ${exercise.notes}
        )
      `;
    }
  }
}

/**
 * Builds this week's program. Auth is re-checked here because the Next 16
 * proxy does not run for Server Function calls.
 */
export async function generateProgramAction(): Promise<GenerateResult> {
  try {
    const userId = await requireUserId();
    const profile = await getProfileFor(userId);

    if (!profile) {
      return { ok: false, error: "Finish onboarding first." };
    }
    if (profile.trainingDays.length === 0) {
      return { ok: false, error: "Add training days in Settings first." };
    }
    if (profile.equipment.length === 0) {
      return { ok: false, error: "Add your equipment in Settings first." };
    }

    const { program, repairs, generationId } = await generateProgram(
      userId,
      profile,
    );

    await saveProgram(
      userId,
      program,
      GOAL_LABELS[profile.goal].title,
      generationId,
    );

    revalidatePath("/dashboard");
    revalidatePath("/workout");
    return { ok: true, repairs };
  } catch (cause) {
    if (cause instanceof UnauthorizedError) {
      return { ok: false, error: "You are not signed in." };
    }
    const message = cause instanceof Error ? cause.message : "Unknown error";
    console.error("generateProgramAction:", message);
    return { ok: false, error: message };
  }
}
