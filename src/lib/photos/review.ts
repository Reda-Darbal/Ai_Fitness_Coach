"use server";

import Together from "together-ai";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/db/session";
import { serverEnv } from "@/lib/env.server";
import { getProfileFor } from "@/lib/profile/queries";
import { getPhotosByIdsFor } from "./queries";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  fr: "French",
};

const SYSTEM_PROMPT = `You are a careful personal trainer looking at a client's progress photos, at their explicit request.

Rules:
- Offer only conservative visual observations ("shoulders appear slightly fuller", "visible change is small").
- ALWAYS name at least one limitation of photo comparison that applies here: lighting, pose, camera distance, clothing, angle, hydration.
- NEVER state or estimate body-fat percentage, muscle mass, measurements, or anything medical.
- If the photos are not comparable (different poses, very different framing), say so plainly.
- Be encouraging but honest. 4-6 short sentences maximum.`;

const reviewSchema = z.object({
  photoIds: z.array(z.uuid()).min(1).max(4),
  question: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
});

export type ReviewResult =
  | { ok: true; reply: string }
  | { ok: false; error: string };

/**
 * Phase 13: the user explicitly selects photos and asks. Vision runs ONLY on
 * that selection — never automatically — and the model is boxed into
 * conservative language by the system prompt. Every call lands in
 * ai_generations like all the other AI usage.
 */
export async function reviewPhotos(input: unknown): Promise<ReviewResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick 1-4 photos first." };

  const env = serverEnv();
  if (!env.TOGETHER_API_KEY || !env.TOGETHER_VISION_MODEL) {
    return { ok: false, error: "The vision model is not configured." };
  }

  const startedAt = Date.now();
  let status: "ok" | "error" = "error";
  let reply: string | null = null;
  let errorMessage: string | null = null;
  let userId: string;

  try {
    userId = await requireUserId();
  } catch (cause) {
    return cause instanceof UnauthorizedError
      ? { ok: false, error: "You are not signed in." }
      : { ok: false, error: "Unknown error" };
  }

  const photos = await getPhotosByIdsFor(userId, parsed.data.photoIds);
  if (photos.length === 0) return { ok: false, error: "Those photos were not found." };

  const profile = await getProfileFor(userId).catch(() => null);
  const language = LANGUAGE_NAMES[profile?.coachLanguage ?? "en"] ?? "English";

  const caption = photos
    .map(
      (p, i) =>
        `Photo ${i + 1}: ${p.pose} view, taken ${p.takenOn}` +
        (p.weightKg ? `, body weight ${p.weightKg} kg` : ""),
    )
    .join("\n");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text:
        `${caption}\n\n` +
        (parsed.data.question ??
          "Do you notice any visible change between these photos?") +
        `\n\nReply in ${language}.`,
    },
    // Presigned URLs stay valid for an hour — long enough for the model to fetch.
    ...photos.map((p) => ({
      type: "image_url" as const,
      image_url: { url: p.url },
    })),
  ];

  try {
    const together = new Together({ apiKey: env.TOGETHER_API_KEY });
    const response = await together.chat.completions.create({
      model: env.TOGETHER_VISION_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: content as never },
      ],
      temperature: 0.4,
      // The vision model reasons at length before replying; a small budget
      // truncates to empty content.
      max_tokens: 3000,
    });

    reply = response.choices?.[0]?.message?.content ?? null;
    if (!reply) throw new Error("The vision model returned nothing.");
    status = "ok";
    return { ok: true, reply };
  } catch (cause) {
    errorMessage = cause instanceof Error ? cause.message : "Unknown error";
    console.error("reviewPhotos:", errorMessage);
    return { ok: false, error: errorMessage };
  } finally {
    try {
      await db()`
        insert into ai_generations (user_id, kind, model, status, prompt, response, error, latency_ms)
        values (
          ${userId}, 'photo_review', ${env.TOGETHER_VISION_MODEL}, ${status},
          ${JSON.stringify({ photoIds: parsed.data.photoIds, question: parsed.data.question ?? null })}::jsonb,
          ${reply === null ? null : JSON.stringify({ reply })}::jsonb,
          ${errorMessage}, ${Date.now() - startedAt}
        )
      `;
    } catch (logCause) {
      console.error("reviewPhotos log:", logCause);
    }
  }
}
