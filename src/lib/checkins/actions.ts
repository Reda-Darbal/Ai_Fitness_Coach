"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/db/session";

export type CheckinResult = { ok: true } | { ok: false; error: string };

const optionalText = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional();

const checkinSchema = z.object({
  weightKg: z.number().min(20).max(400).nullable(),
  energy: z.enum(["low", "ok", "high"]),
  sleep: z.enum(["poor", "ok", "good"]),
  soreness: z.enum(["none", "some", "high"]),
  difficulty: z.enum(["too_easy", "right", "too_hard"]),
  liked: optionalText,
  disliked: optionalText,
  notes: optionalText,
});

type CheckinInput = z.infer<typeof checkinSchema>;

/**
 * The digest program generation reads. Always English — it goes into a model
 * prompt, not onto a screen — and compact, per the cost-control rules.
 */
function buildSummary(input: CheckinInput, workoutsDone: number): string {
  const parts = [
    `${workoutsDone} workouts done`,
    `energy ${input.energy}`,
    `sleep ${input.sleep}`,
    `soreness ${input.soreness}`,
    `week felt ${input.difficulty.replace("_", " ")}`,
  ];
  if (input.weightKg != null) parts.push(`weight ${input.weightKg}kg`);
  if (input.liked) parts.push(`enjoyed: ${input.liked}`);
  if (input.disliked) parts.push(`disliked: ${input.disliked}`);
  if (input.notes) parts.push(`note: ${input.notes}`);
  return parts.join("; ");
}

export async function submitCheckin(input: unknown): Promise<CheckinResult> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some answers need fixing." };
  }

  try {
    const userId = await requireUserId();
    const sql = db();
    const v = parsed.data;

    // Workouts completed this week is a fact we already hold — computed, not asked.
    const counted = (await sql`
      select count(*)::int as n from workout_sessions
       where user_id = ${userId}
         and completed_at >= date_trunc('week', now())
    `) as unknown as { n: number }[];
    const workoutsDone = counted[0]?.n ?? 0;

    await sql`
      insert into weekly_checkins
        (user_id, week_start, weight_kg, workouts_done, energy, sleep,
         soreness, difficulty, liked, disliked, notes, summary)
      values
        (${userId}, date_trunc('week', now())::date, ${v.weightKg},
         ${workoutsDone}, ${v.energy}, ${v.sleep}, ${v.soreness},
         ${v.difficulty}, ${v.liked ?? null}, ${v.disliked ?? null},
         ${v.notes ?? null}, ${buildSummary(v, workoutsDone)})
      on conflict (user_id, week_start) do update set
        weight_kg = excluded.weight_kg,
        workouts_done = excluded.workouts_done,
        energy = excluded.energy,
        sleep = excluded.sleep,
        soreness = excluded.soreness,
        difficulty = excluded.difficulty,
        liked = excluded.liked,
        disliked = excluded.disliked,
        notes = excluded.notes,
        summary = excluded.summary
    `;

    // A check-in weight is a weigh-in too — one number, both places.
    if (v.weightKg != null) {
      await sql`
        insert into body_weight_logs (user_id, logged_on, weight_kg)
        values (${userId}, current_date, ${v.weightKg})
        on conflict (user_id, logged_on)
        do update set weight_kg = excluded.weight_kg
      `;
      await sql`
        update profiles set current_weight_kg = ${v.weightKg}
         where user_id = ${userId}
      `;
    }

    revalidatePath("/dashboard");
    revalidatePath("/progress");
    return { ok: true };
  } catch (cause) {
    if (cause instanceof UnauthorizedError) {
      return { ok: false, error: "You are not signed in." };
    }
    const message = cause instanceof Error ? cause.message : "Unknown error";
    console.error("submitCheckin:", message);
    return { ok: false, error: message };
  }
}
