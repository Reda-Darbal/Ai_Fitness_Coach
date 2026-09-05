"use server";

import { randomUUID } from "node:crypto";
import Together from "together-ai";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/db/session";
import { serverEnv } from "@/lib/env.server";
import { getProfileFor } from "@/lib/profile/queries";
import { getWeightStatsFor } from "@/lib/weight/queries";
import {
  deleteObject,
  headObject,
  isStorageConfigured,
  presignUpload,
  presignView,
} from "@/lib/storage/s3";
import { calculateTargets } from "./targets";

const MAX_MEAL_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  fr: "French",
};

type Fail = { ok: false; error: string };

function fail(cause: unknown): Fail {
  if (cause instanceof UnauthorizedError) {
    return { ok: false, error: "You are not signed in." };
  }
  const message = cause instanceof Error ? cause.message : "Unknown error";
  console.error("meal action:", message);
  return { ok: false, error: message };
}

/** Same presigned-PUT flow as progress photos, under its own prefix. */
export async function createMealUpload(
  input: unknown,
): Promise<{ ok: true; key: string; uploadUrl: string } | Fail> {
  const parsed = z.object({ contentType: z.string() }).safeParse(input);
  if (!parsed.success || !ALLOWED_TYPES.has(parsed.data.contentType)) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }
  try {
    const userId = await requireUserId();
    if (!isStorageConfigured()) {
      return { ok: false, error: "Photo storage is not configured." };
    }
    const key = `meals/${userId}/${randomUUID()}.${parsed.data.contentType.split("/")[1]}`;
    return { ok: true, key, uploadUrl: await presignUpload(key, parsed.data.contentType) };
  } catch (cause) {
    return fail(cause);
  }
}

const mealEstimateSchema = z.object({
  items: z
    .array(z.object({ name: z.string().max(60), portion: z.string().max(40) }))
    .max(8),
  caloriesKcal: z.object({ min: z.number().min(0), max: z.number().min(0) }),
  proteinG: z.object({ min: z.number().min(0), max: z.number().min(0) }),
  confidence: z.enum(["low", "medium", "high"]),
  verdict: z.string().max(500),
});

export type MealEstimate = z.infer<typeof mealEstimateSchema>;

const SYSTEM_PROMPT = `You are a pragmatic fitness coach estimating a meal from one photo, at the client's request.

Rules:
- Identify the visible foods and rough portions.
- Give RANGES for calories and protein (never a single precise number) — portion size, oils and sauces are guesses from a photo.
- confidence: "low" if portions or ingredients are unclear, "high" only for simple, clearly visible plates.
- verdict: 1-2 sentences on how this meal fits the client's daily targets (given below), practical and encouraging. Mention protein specifically.
- Never give medical or clinical dietary advice; this is everyday fitness guidance.`;

const analyzeSchema = z.object({
  key: z.string().min(1),
  note: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
});

/**
 * Meal photo -> conservative estimate + a verdict against the user's
 * deterministic daily targets. The photo is deleted from storage right after
 * analysis — a meal snapshot has no reason to live longer than its answer.
 */
export async function analyzeMeal(
  input: unknown,
): Promise<{ ok: true; estimate: MealEstimate } | Fail> {
  const parsed = analyzeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That request looks wrong." };

  const env = serverEnv();
  if (!env.TOGETHER_API_KEY || !env.TOGETHER_VISION_MODEL) {
    return { ok: false, error: "The vision model is not configured." };
  }

  const startedAt = Date.now();
  let status: "ok" | "error" = "error";
  let estimate: MealEstimate | null = null;
  let errorMessage: string | null = null;
  let userId: string;

  try {
    userId = await requireUserId();
  } catch (cause) {
    return fail(cause);
  }

  const { key } = parsed.data;
  if (!key.startsWith(`meals/${userId}/`)) {
    return { ok: false, error: "Not your photo." };
  }

  try {
    const head = await headObject(key);
    if (!head) return { ok: false, error: "The upload did not arrive. Try again." };
    if (head.size > MAX_MEAL_BYTES) {
      return { ok: false, error: "That photo is too large (10MB max)." };
    }

    const [profile, weightStats] = await Promise.all([
      getProfileFor(userId),
      getWeightStatsFor(userId).catch(() => null),
    ]);
    const targets = profile
      ? calculateTargets({
          weightKg: weightStats?.currentKg ?? profile.currentWeightKg,
          heightCm: profile.heightCm,
          age: profile.age,
          sex: profile.sex,
          trainingDaysPerWeek: profile.trainingDays.length,
          goal: profile.goal,
        })
      : null;
    const language = LANGUAGE_NAMES[profile?.coachLanguage ?? "en"] ?? "English";

    const contextLines = [
      targets
        ? `Client's daily targets: ${targets.calories} kcal, ${targets.proteinG} g protein. Goal: ${profile?.goal.replace("_", " ")}.`
        : "No daily targets available for this client.",
      parsed.data.note ? `Client says the meal is: ${parsed.data.note}` : null,
      `Write item names and the verdict in ${language}.`,
    ].filter(Boolean);

    const imageUrl = await presignView(key, 600);
    const together = new Together({ apiKey: env.TOGETHER_API_KEY });
    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: [
          { type: "text", text: contextLines.join("\n") },
          { type: "image_url", image_url: { url: imageUrl } },
        ] as never,
      },
    ];
    // The vision model burns ~1.5k HIDDEN reasoning tokens before answering;
    // max_tokens <=900 truncates to finish:'length' with EMPTY content.
    const request = {
      model: env.TOGETHER_VISION_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 6000,
    };

    let content: string | null | undefined;
    try {
      const response = await together.chat.completions.create({
        ...request,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "meal_estimate",
            schema: z.toJSONSchema(mealEstimateSchema),
          },
        } as never,
      });
      content = response.choices?.[0]?.message?.content;
    } catch {
      content = null;
    }
    if (!content) {
      // Some deployments reject strict json_schema; the prompt alone still
      // yields JSON we can extract.
      const response = await together.chat.completions.create(request);
      content = response.choices?.[0]?.message?.content;
    }
    if (!content) throw new Error("The vision model returned nothing.");

    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("The vision model did not return an estimate.");
    }
    estimate = mealEstimateSchema.parse(JSON.parse(content.slice(start, end + 1)));
    status = "ok";
    return { ok: true, estimate };
  } catch (cause) {
    errorMessage = cause instanceof Error ? cause.message : "Unknown error";
    console.error("analyzeMeal:", errorMessage);
    return { ok: false, error: errorMessage };
  } finally {
    // Privacy + hygiene: the snapshot is disposable, the estimate is the record.
    await deleteObject(key).catch(() => undefined);
    try {
      await db()`
        insert into ai_generations (user_id, kind, model, status, prompt, response, error, latency_ms)
        values (
          ${userId}, 'meal', ${env.TOGETHER_VISION_MODEL}, ${status},
          ${JSON.stringify({ note: parsed.data.note ?? null })}::jsonb,
          ${estimate === null ? null : JSON.stringify(estimate)}::jsonb,
          ${errorMessage}, ${Date.now() - startedAt}
        )
      `;
    } catch (logCause) {
      console.error("analyzeMeal log:", logCause);
    }
  }
}
