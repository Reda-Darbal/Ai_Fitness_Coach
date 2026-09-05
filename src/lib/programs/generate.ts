import "server-only";
import { aiProvider } from "@/lib/ai/together";
import { serverEnv } from "@/lib/env.server";
import { db } from "@/lib/db/client";
import {
  GOAL_LABELS,
  WEEKDAY_LABELS,
  type Weekday,
} from "@/lib/profile/constants";
import type { Profile } from "@/lib/profile/queries";
import { buildCandidates, parseFreeTextList } from "./candidates";
import { getLatestCheckinFor } from "@/lib/checkins/queries";
import { generatedProgramSchema, type GeneratedProgram } from "./schema";
import { validateProgram, ProgramValidationError } from "./validate";

const SYSTEM_PROMPT = `You are a careful personal trainer writing a weekly gym program for one client.

Hard rules:
- Choose exercises ONLY from the numbered candidate list. Never invent an exercise or an id.
- Use the exact exerciseId strings given.
- Produce exactly one session for each training day listed, and no others.
- Order exercises within a session most important first: big compound movements before isolation.
- Beginners: 4-6 exercises per session, 2-4 sets, 8-12 reps, 60-120s rest. No training to failure.
- Intermediate/advanced: 5-8 exercises per session, 3-4 sets each; compounds 5-10 reps with 120-180s rest, isolation 10-20 reps with 60-90s rest.
- USE the client's available time — a session should fill roughly 85-100% of it, never overrun it. As a guide: 45 min fits ~4-5 exercises, 60 min ~5-6, 75 min ~6-7, 90 min ~7-8.
- notes: one short practical cue per exercise, max 15 words.

Programming principles (evidence-based, in the style of science-based coaches like Jeff Nippard):
- Train each major muscle about twice per week when the training days allow it (full-body or upper/lower style splits beat single-muscle days).
- Roughly 10-20 hard sets per major muscle per week, scaled down for beginners.
- Compounds in the 5-10 rep range, isolation in the 10-20 range, all effective when taken close to (not to) failure.
- Balance pushing and pulling, and squatting and hinging, across the week.
- Longer rest (2-3 min) for heavy compounds, shorter (60-90s) for isolation.

Reply with JSON only.`;

/** Compact prompt — the whole catalogue would be pure token waste. */
function buildUserPrompt(
  profile: Profile,
  candidates: { byBodyPart: Record<string, { id: string; name: string; equipment: string; target: string }[]> },
  checkinSummary: string | null,
): string {
  const lines: string[] = [];

  lines.push("CLIENT");
  lines.push(`- goal: ${GOAL_LABELS[profile.goal].title}`);
  lines.push(`- experience: ${profile.experienceLevel}`);
  if (profile.age) lines.push(`- age: ${profile.age}`);
  if (profile.sex) lines.push(`- sex: ${profile.sex}`);
  if (profile.currentWeightKg) {
    lines.push(
      `- weight: ${profile.currentWeightKg} kg${
        profile.targetWeightKg ? ` (target ${profile.targetWeightKg} kg)` : ""
      }`,
    );
  }
  lines.push(
    `- training days: ${profile.trainingDays
      .map((d) => WEEKDAY_LABELS[d].full)
      .join(", ")}`,
  );
  lines.push(`- time per session: ${profile.sessionMinutes ?? 60} minutes`);

  const injuries = parseFreeTextList(profile.injuries);
  if (injuries.length > 0) lines.push(`- injuries/limits: ${injuries.join(", ")}`);
  const liked = parseFreeTextList(profile.likedExercises);
  if (liked.length > 0) lines.push(`- enjoys: ${liked.join(", ")}`);
  if (profile.notes) lines.push(`- note: ${profile.notes}`);
  if (checkinSummary) lines.push(`- last weekly check-in: ${checkinSummary}`);

  lines.push("");
  lines.push("CANDIDATE EXERCISES (choose only from these)");
  for (const [bodyPart, list] of Object.entries(candidates.byBodyPart)) {
    lines.push(`${bodyPart}:`);
    for (const e of list) {
      lines.push(`  ${e.id} | ${e.name} | ${e.equipment} | ${e.target}`);
    }
  }

  lines.push("");
  lines.push(
    `Write a ${profile.trainingDays.length}-day weekly program using weekday keys: ${profile.trainingDays.join(", ")}.`,
  );

  return lines.join("\n");
}

export interface GenerationOutcome {
  program: GeneratedProgram;
  repairs: string[];
  generationId: string | null;
}

/**
 * Profile -> candidates -> model -> Zod -> business rules -> program.
 *
 * Every attempt is written to ai_generations, including failures, so a bad
 * generation can be inspected later instead of vanishing into a toast.
 */
export async function generateProgram(
  userId: string,
  profile: Profile,
): Promise<GenerationOutcome> {
  const env = serverEnv();
  if (!env.TOGETHER_API_KEY) {
    throw new Error(
      "Together AI is not configured. Add TOGETHER_API_KEY to .env.local.",
    );
  }

  // The freshest check-in shapes both the hard filters (new dislikes) and
  // what the model is told about how last week actually felt.
  const checkin = await getLatestCheckinFor(userId).catch(() => null);
  const effectiveProfile =
    checkin?.disliked != null
      ? {
          ...profile,
          dislikedExercises: [profile.dislikedExercises, checkin.disliked]
            .filter(Boolean)
            .join(", "),
        }
      : profile;

  const candidates = await buildCandidates(effectiveProfile);
  if (candidates.exercises.length < 8) {
    throw new Error(
      "Not enough exercises match your equipment. Add more equipment in Settings.",
    );
  }

  const prompt = buildUserPrompt(effectiveProfile, {
    byBodyPart: Object.fromEntries(
      Object.entries(candidates.byBodyPart).map(([part, list]) => [
        part,
        list.map((e) => ({
          id: e.id,
          name: e.name,
          equipment: e.equipment,
          target: e.target,
        })),
      ]),
    ),
  }, checkin?.summary ?? null);

  const model = env.TOGETHER_MODEL ?? "unknown";
  const startedAt = Date.now();
  let raw: GeneratedProgram | undefined;
  let status: "ok" | "invalid" | "error" = "error";
  let errorMessage: string | null = null;

  try {
    raw = await aiProvider.generateJson({
      schema: generatedProgramSchema,
      schemaName: "weekly_program",
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0.3,
      maxTokens: 4000,
    });

    const { program, repairs } = validateProgram(raw, {
      candidateIds: new Set(candidates.exercises.map((e) => e.id)),
      trainingDays: profile.trainingDays as Weekday[],
      sessionMinutes: profile.sessionMinutes,
    });

    status = "ok";
    const generationId = await logGeneration({
      userId,
      model,
      status,
      prompt,
      response: program,
      error: null,
      latencyMs: Date.now() - startedAt,
    });

    return { program, repairs, generationId };
  } catch (cause) {
    status = cause instanceof ProgramValidationError ? "invalid" : "error";
    errorMessage = cause instanceof Error ? cause.message : "Unknown error";

    await logGeneration({
      userId,
      model,
      status,
      prompt,
      response: raw ?? null,
      error: errorMessage,
      latencyMs: Date.now() - startedAt,
    });

    throw cause;
  }
}

async function logGeneration(entry: {
  userId: string;
  model: string;
  status: "ok" | "invalid" | "error";
  prompt: string;
  response: unknown;
  error: string | null;
  latencyMs: number;
}): Promise<string | null> {
  try {
    const rows = (await db()`
      insert into ai_generations (user_id, kind, model, status, prompt, response, error, latency_ms)
      values (
        ${entry.userId}, 'program', ${entry.model}, ${entry.status},
        ${JSON.stringify({ prompt: entry.prompt })}::jsonb,
        ${entry.response === null ? null : JSON.stringify(entry.response)}::jsonb,
        ${entry.error}, ${entry.latencyMs}
      )
      returning id
    `) as unknown as { id: string }[];
    return rows[0]?.id ?? null;
  } catch (cause) {
    // Never let audit logging break the feature it is auditing.
    console.error("logGeneration:", cause);
    return null;
  }
}
