"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/db/session";

export type WeightResult = { ok: true } | { ok: false; error: string };

const logSchema = z.object({
  weightKg: z.number().min(20).max(400),
  notes: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
});

/**
 * Records today's body weight. Same-day logging overwrites — a day has one
 * weight worth keeping. The profile's current weight is kept in step so the
 * dashboard and program generation read the same number.
 */
export async function logBodyWeight(input: unknown): Promise<WeightResult> {
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That weight looks wrong." };
  }

  try {
    const userId = await requireUserId();
    const sql = db();
    const { weightKg, notes } = parsed.data;

    await sql`
      insert into body_weight_logs (user_id, logged_on, weight_kg, notes)
      values (${userId}, current_date, ${weightKg}, ${notes ?? null})
      on conflict (user_id, logged_on)
      do update set weight_kg = excluded.weight_kg,
                    notes = coalesce(excluded.notes, body_weight_logs.notes)
    `;

    await sql`
      update profiles set current_weight_kg = ${weightKg}
       where user_id = ${userId}
    `;

    revalidatePath("/progress");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (cause) {
    if (cause instanceof UnauthorizedError) {
      return { ok: false, error: "You are not signed in." };
    }
    const message = cause instanceof Error ? cause.message : "Unknown error";
    console.error("logBodyWeight:", message);
    return { ok: false, error: message };
  }
}
